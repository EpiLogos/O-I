import {ExpressionLayout} from "./shared/Expression";
import {mintInstance,parseInstance,instanceFileName} from "./flow/instance";
import {userFlowsArea} from "./flow/instances";
import {fileOperation,type FileMutation} from "./files/client";
import {DRAFT_KEY} from "./flow/DraftSurface";
import {DOCUMENT_FORMS,resolveDocumentForm} from "./flow/documentForms";
import {ContextTray} from "./context/ContextTray";
import {FileHistory} from "./files/FileHistory";
import {encounter} from "./encounter/client";
import {useEncounterSession} from "./encounter/session";
import {AgentChat} from "./agent/chat/AgentChat";
import type {EncounterRow} from "./encounter/EncounterList";
import {AgentLayer} from "./agent/AgentLayer";
import {navigateExplore,type PresentationMeta} from "./explore/navigate";
import {MODE_CURATION,isWorkspaceMode,WORKSPACE_MODES,type WorkspaceMode} from "./workspace/mode";
import {EXPRESSION_COMPOSE_EVENT,summonExpression} from "./expression/summon";
import {ModeLeftBody,modeExtraPlanes} from "./workspace/modeBodies";
import type {TaPaneOpens} from "./expressions/TaOntaSide";
import type {FactoryPanelHost} from "./contributions/factory/sidebar/sidebarModel";
import {publishCentreView} from "./contributions/factory/desk/deskModel";
import {GroupPane} from "./surface/Workbench";
import {centreBindingOf, ModeCentreBody, StageCentreMark, warmWorkspaceTrees} from "./surface/retention";
import type {HostedAppState} from "./expressions/hostedApp";
import {FactoryNavigator} from "./surfaces/navigator/FactoryNavigator";
/**
 * The Cradle root (U0.3b + U0.4 + U0.6). One layout state, persisted to
 * localStorage and restored on load (map §5 U0.3b). Zero surfaces =
 * austere rest, exactly the U0.3 shape. ≥1 surface = the Workbench frame
 * (law 12).
 *
 * U0.4 mounts the kernel seam: the frame's surface bindings and the
 * kernel's surface/buffer state stay reconciled through three effects —
 * mount (a layout binding new to the kernel opens kernel-side; a source
 * surface also opens its buffer through the owner), unmount (a binding
 * gone from the layout closes kernel-side), and focus (D16: focus follows
 * the active binding — the one global focus relation moves, exactly one
 * event when it actually moves). Keyboard, pointer, and context-menu
 * invocations all funnel through one executor.
 *
 * U0.6 mounts the walk channel (dev/walk builds only, map §3 D10): the
 * typed `__cradle.walk` client binds the same KernelApi below — the same
 * seam, never a second authority path — and is absent from production
 * bundles by the build gate above.
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
const LibraryBrowser=lazy(()=>import("./library/LibraryBrowser").then(module=>({default:module.LibraryBrowser})));
// Technē summon seam (T2): the HUD's summon CustomEvents present the Library,
// the gallery search and the current subject's verso through the existing
// surfaces — see src/library/techneSummon.tsx (the parent reconciles the
// mounting point).
import { TechneSummonSurface } from "./library/techneSummon";
import { readFile } from "./files/client";
import { acquireFileReading, acquireFileBytes, applyReceipt } from "./files/resources";
import { applyWikiProjectionReceipt } from "./techne/wikiProjectionStore";
import { detectFormat } from "./material/detect";
import type { CentralLocation, NativeFileReading } from "./kernel/types";
import { WorldNavigator } from "./surfaces/navigator/WorldNavigator";
import { readDraft } from "./workspace/drafts";
import { DesktopShell } from "./workspace/DesktopShell";
import { useWorkspaces } from "./workspace/store";
import { useSearchLeader, matchesSearchLeader } from "./knowledge/leader";
import { SearchOverlay } from "./knowledge/SearchOverlay";
import { knowledge } from "./knowledge/client";
import type { KnowledgeAddress, KnowledgeReading } from "./kernel/types";
import { Rest } from "./Rest";
import { useKernel } from "./kernel/KernelProvider";
import type { ListedSource } from "./kernel/types";
import { ContextMenu, type MenuState } from "./surface/ContextMenu";
import { SourceHistory } from "./surface/SourceHistory";
import { Workbench, ArrangementActions } from "./surface/Workbench";
import { frameActionForKey } from "./surface/keys";

import {
  bindingDisclosures,
  executeFrameAction,
  frameDisclosures,
  type MenuContext,
} from "./surface/registry";
import {
  activeBindingId,
  detachBinding,
  groupsOf,
  makeSourceBinding,
  openBinding,
  splitOff,
  stepDepthDown,
} from "./surface/engine";
import type {
  ActionArg,
  ActionDisclosure,
  LayoutState,
  Pane,
  RestorePoint,
  SurfaceBinding,
  SurfaceId,
} from "./surface/types";
import { createPortal, flushSync } from "react-dom";

function snapshotOf(state: LayoutState): RestorePoint {
  return {
    root: state.root,
    surfaces: state.surfaces,
    closedStack: state.closedStack,
    focusedGroupId: state.focusedGroupId,
  };
}

/** The U0.6 walk gate, baked by vite.config.ts: true in dev (`vite serve`)
 * and in walk bundles (`WALK=1 vite build`); `false` in a plain production
 * build, where the dynamic import below is dead-code-eliminated and the
 * `__cradle.walk` chunk is never emitted (map §3 D10: dev tooling only). */
declare const __CRADLE_WALK__: boolean;

/** The modes whose centre the frame stages: every workspace mode with a
 * curated centre kind. Each gets one ALWAYS-PRESENT keyed stage slot (the
 * per-mode stage law, 2026-09-20): the centre body mounts in its own slot
 * the moment its mode's tree carries it, and a mode swap flips the slot's
 * visibility — the DOM never moves, so a hosted application's document,
 * engine and in-memory state survive every round trip. */
const STAGE_MODES:readonly WorkspaceMode[] = WORKSPACE_MODES.filter(mode => !!MODE_CURATION[mode].centreKind);

export function CradleFrame({onComposed}:{onComposed?:()=>void}) {
  const [WalkChannel, setWalkChannel] = useState<ComponentType<{layout:LayoutState}> | null>(null);
  useEffect(() => {
    if (__CRADLE_WALK__) void import("./walk/WalkChannel").then(module => setWalkChannel(() => module.WalkChannel));
  }, []);
  useEffect(() => { onComposed?.(); }, [onComposed]);
  const kernel = useKernel();
  const leader = useSearchLeader();
  const [searchOpen,setSearchOpen] = useState(false);
  // The ONE Library (library/): O:I Web is the connective field, not a mode —
  // so the Library is summoned over whatever mode you are in and scoped by
  // it. Once opened it stays mounted (hidden) so a return lands on the same
  // query, scope and selection.
  const [library,setLibrary] = useState<"closed"|"open"|"held">("closed");
  const [namingRequest,setNamingRequest] = useState<"create" | "rename" | null>(null);
  const workspace = useWorkspaces();
  const workspaceRef=useRef(workspace);workspaceRef.current=workspace;
  const [windowError,setWindowError]=useState<string>();
  // BOOT-09: a per-surface owner open failure, shown where that binding's
  // tab would otherwise render, with Retry re-running the same mount.
  const [surfaceErrors,setSurfaceErrors]=useState<Record<string,string>>({});
  const detachedRequests=useRef(new Set<string>());
  const [redockFocus,setRedockFocus]=useState<string>();
  // The workspace record still carries its legacy `writing`/`writingMode`
  // fields so no persisted workspace is destroyed on restore, but nothing
  // renders them any more: writing is a real Flow in a NOW register now.
  const state = workspace.current.layout;
  const setState = workspace.setLayout;
  // Broker invalidation (WF2): kernel `file_changed` receipts drop the
  // broker's resident readings for the changed file, so the next acquire is
  // a real owner read while consumers keep their last reading visible.
  // applyReceipt dedupes by its own cursor; feeding every receipt is safe.
  // The wiki projection store rides the same feed: a changed register wiki
  // basis invalidates its cached reading and re-projects (its own dedupe).
  useEffect(() => {
    for (const receipt of kernel.receipts) {
      applyReceipt(receipt);
      applyWikiProjectionReceipt(receipt, kernel.transport);
    }
  }, [kernel.receipts, kernel.transport]);
  // A PENDING binding restored after a restart has no in-flight open behind
  // it — the process that owned the acquisition is gone. Retire each one
  // exactly once through the ordinary open path: the tab keeps its place in
  // its own tree and the acquisition + admission run through openFile, which
  // fills it in place (a file whose read fails shows the BOOT-09 error with
  // Retry, never a forever-"Opening…" tab).
  const retiredPending = useRef<Set<SurfaceId>>(new Set());
  const completeRestoredPending = useCallback(async (workspaceId: string, binding: SurfaceBinding) => {
    const location = binding.location;
    if (!location) return;
    const format = detectFormat({ path: location.path });
    const isBinary = format === "image" || format === "pdf" || format === "unsupported";
    try {
      const reading = isBinary
        ? await acquireFileBytes(kernel.transport, location)
        : await acquireFileReading(kernel.transport, location);
      const opened = await kernel.apply({ op: "surface_open", surface_id: binding.id, kind: "file", source_ref: reading.location.ref, title: binding.title });
      if (opened?.result !== "surface_opened") throw new Error("Central file surface could not be opened");
      workspaceRef.current.replaceSurface(workspaceId, { ...binding, pending: undefined, ref: reading.location.ref, title: binding.title, location: reading.location });
    } catch (error) {
      setSurfaceErrors(held => ({ ...held, [binding.id]: error instanceof Error ? error.message : String(error) }));
      workspaceRef.current.replaceSurface(workspaceId, { ...binding, pending: false });
    }
  }, [kernel]);
  useEffect(() => {
    for (const w of workspace.workspaces) {
      for (const group of groupsOf(w.layout.root)) {
        for (const id of group.tabs) {
          const binding = w.layout.surfaces[id];
          if (binding?.pending && binding.location && !retiredPending.current.has(id)) {
            retiredPending.current.add(id);
            void completeRestoredPending(w.id, binding);
          }
        }
      }
    }
  }, [workspace.workspaces, completeRestoredPending]);
  const navigatorOpen = state.agencyDepth === "panel" || state.agencyDepth === "full";
  const setNavigatorOpen = (open: boolean) => setState(s => ({ ...s, agencyDepth: open ? "panel" : "strip" }));
  const navigatorRef = useRef(false);
  navigatorRef.current = navigatorOpen;
  const returnFocus = useRef<HTMLElement | null>(null);
  const rememberWorkFocus = () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && active.closest(".workspace-canvas,.pane") && !active.closest(".ctx-menu,.world-navigator")) {
      returnFocus.current = active;
    } else if (!returnFocus.current?.isConnected) {
      returnFocus.current = document.querySelector<HTMLElement>(".pane.focused .cm-content");
    }
  };
  const summonWorld = () => {
    rememberWorkFocus();
    setNavigatorOpen(true);
  };
  const dismissWorld = () => {
    setNavigatorOpen(false);
    requestAnimationFrame(() => {
      const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>(".pane.focused .cm-content");
      target?.focus();
    });
  };

  // The restore point: the layout as this session loaded it. `Restore
  // layout` (⌘⌥R / strip menu) returns the frame here.
  const restorePoint = useRef<RestorePoint>(snapshotOf(state));
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  menuRef.current = menu;
  const stateRef = useRef(state);
  stateRef.current = state;
  const kernelSurfaces = kernel.snapshot.surfaces;
  const lastFocusedSurface = useRef<SurfaceId | null>(null);

  useEffect(() => {
    lastFocusedSurface.current = null;
    restorePoint.current = snapshotOf(workspace.current.layout);
    const project = workspace.current.project;
    if (project) {
      if (kernel.snapshot.navigator?.project?.project.name !== project) void kernel.apply({ op: "project_browse", project });
    } else if (kernel.snapshot.navigator?.project) void kernel.apply({ op: "world_browse" });
  }, [workspace.current.id, workspace.current.layout.mode]);


  // -------------------------------------------------------------------------
  // Kernel reconciliation (U0.4)
  //
  // The layout's OPEN surfaces (in the pane tree — `surfaces` also carries
  // closed bindings for the reopen stack) reconcile with the kernel's
  // surface state:
  //   mount — a binding the kernel does not know opens kernel-side; a
  //           source surface opens its buffer through the owner's read and
  //           focuses: surface_changed, source_opened, focus_changed, one
  //           receipt each;
  //   unmount — a binding gone from the tree closes kernel-side (closing
  //           the focused surface clears the focus relation, a second
  //           receipt).
  // In-flight mounts/unmounts are guarded so one state change never
  // double-emits.
  const pendingMount = useRef<Set<SurfaceId>>(new Set());
  const pendingClose = useRef<Set<SurfaceId>>(new Set());
  // BOOT-09: one binding's owner-mount attempt. Success clears any prior
  // recorded failure for this surface; a real owner failure (encounter
  // start/read, file/knowledge read, or the surface/source open itself)
  // is recorded instead of silently retaining a blank tab.
  // Surfaces that hold no owner identity are not reconciled against the
  // kernel: a fresh tab has not chosen anything yet, and an unplaced draft is
  // writing that deliberately has no owner ground. Registering either would
  // be claiming an owner that does not exist, and would fail loudly against
  // a kernel that is simply absent.
  const UNOWNED_SURFACE_KINDS = new Set(["draft", "blank"]);
  const mountSurface = useCallback(async (binding: SurfaceBinding) => {
    if (UNOWNED_SURFACE_KINDS.has(binding.kind) || binding.pending) { pendingMount.current.delete(binding.id); return; }
    try {
      if(binding.kind==="encounter" && binding.ref && binding.project){await encounter(kernel.transport,binding.project,{action:"start"});await encounter(kernel.transport,binding.project,{action:"read",agent_session:binding.ref,after:0,limit:1});}
      // The admission prerequisite shares ONE owner acquisition with the
      // renderer through the broker (WF2): text formats read as UTF-8 (the
      // renderer's own acquire joins the same in-flight read), binary
      // formats read bytes. A file binding with no ref yet — a retry of a
      // failed open — is admitted through the reading this obtains.
      let admissionRef = binding.ref;
      if (binding.kind === "file" && binding.location) {
        const format = detectFormat({ path: binding.location.path });
        if (format === "image" || format === "pdf" || format === "unsupported") {
          const bytes = await acquireFileBytes(kernel.transport, binding.location);
          admissionRef = bytes.location.ref;
        } else {
          const reading = await acquireFileReading(kernel.transport, binding.location);
          admissionRef = reading.location.ref;
        }
      }
      if (binding.kind === "knowledge" && binding.address) await knowledge(kernel.transport,binding.project,{action:"read",address:binding.address});
      const opened = await kernel.apply({ op: "surface_open", surface_id: binding.id, kind: binding.kind, ...(admissionRef ? { source_ref: admissionRef } : {}), title: binding.title });
      if (opened?.result !== "surface_opened") throw new Error("This surface could not be opened");
      if (binding.kind === "source" && binding.ref) {
        // For a root-register buffer (the Day, opened through the owner's Day
        // route) the kernel serves the held buffer here instead of re-reading
        // through the project-scoped source route, which cannot serve it.
        const sourceOpened = await kernel.apply({ op: "source_open", source_ref: binding.ref, project: binding.project });
        if (sourceOpened?.result !== "source_opened") throw new Error("Central did not return this source's reading");
        const draft = readDraft(binding.ref);
        if (draft) await kernel.apply({ op: "source_restore", source_ref: binding.ref, ...draft });
      }
      if (activeBindingId(stateRef.current) === binding.id && stateRef.current.surfaces[binding.id]?.ref === binding.ref && (kernel.transport.kind!=="tauri" || document.hasFocus())) await kernel.surfaceFocus(binding.id);
      setSurfaceErrors(held => {
        if (!(binding.id in held)) return held;
        const next = { ...held }; delete next[binding.id]; return next;
      });
    } catch (reason) {
      setSurfaceErrors(held => ({ ...held, [binding.id]: reason instanceof Error ? reason.message : String(reason) }));
    } finally {
      pendingMount.current.delete(binding.id);
    }
  }, [kernel]);
  const retrySurfaceOpen = useCallback((surfaceId: SurfaceId) => {
    const bindings={...Object.assign({},...workspaceRef.current.workspaces.map(w=>w.layout.surfaces)),...stateRef.current.surfaces} as typeof stateRef.current.surfaces;
    const binding = bindings[surfaceId];
    if (!binding || pendingMount.current.has(surfaceId)) return;
    pendingMount.current.add(surfaceId);
    void mountSurface(binding);
  }, [mountSurface]);
  useEffect(() => {
    // Logical membership vs presentation (WF5): the kernel's surface set is
    // the UNION of every workspace's tree tabs and detached placements, so
    // leaving a workspace or a mode never reads as native closure and a
    // return never re-admits what is already admitted. What MOUNTS — the
    // owner-mediated admission reads — is only what is presented now: the
    // active workspace's tree and detached surfaces. Saved tabs of inactive
    // workspaces stay logically open without being eagerly read or admitted.
    const openIds = new Set<SurfaceId>();
    const demanded = new Set<SurfaceId>();
    const bindings={...Object.assign({},...workspace.workspaces.map(w=>w.layout.surfaces)),...state.surfaces} as typeof state.surfaces;
    for (const w of workspace.workspaces) {
      for (const group of groupsOf(w.layout.root)) for (const tab of group.tabs) openIds.add(tab);
      for (const d of w.layout.detached ?? []) { openIds.add(d.surfaceId); demanded.add(d.surfaceId); }
    }
    for (const group of groupsOf(state.root)) for (const tab of group.tabs) demanded.add(tab);
    for (const surfaceId of openIds) {
      const binding = bindings[surfaceId];
      if (!binding || binding.pending) continue;
      if (kernelSurfaces[surfaceId] && kernelSurfaces[surfaceId].source_ref === binding.ref && kernelSurfaces[surfaceId].kind === binding.kind) continue;
      if (pendingMount.current.has(surfaceId)) continue;
      if (!demanded.has(surfaceId)) continue;
      pendingMount.current.add(surfaceId);
      void mountSurface(binding);
    }
    for (const surfaceId of Object.keys(kernelSurfaces)) {
      if (openIds.has(surfaceId) || pendingClose.current.has(surfaceId)) continue;
      pendingClose.current.add(surfaceId);
      void kernel
        .surfaceClose(surfaceId)
        .catch(() => undefined)
        .finally(() => pendingClose.current.delete(surfaceId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.root, state.surfaces, kernelSurfaces, workspace.workspaces]);

  // Focus follows the active binding (D16): the one global focus relation
  // moves with the frame's active surface — and only when it actually
  // moves (the kernel emits nothing for a re-focus of the same ref).
  const activeId = activeBindingId(state);
  const revealedSurface = useRef<string | null>(null);
  useEffect(() => {
    const binding=activeId ? state.surfaces[activeId] : undefined;
    const project=binding?.project ?? (binding?.ref ? kernel.snapshot.buffers[binding.ref]?.project : undefined);
    const key=activeId && project ? `${workspace.current.id}:${activeId}:${project}` : null;
    if (!key) {revealedSurface.current=null;return;}
    if (revealedSurface.current===key || !project) return;
    revealedSurface.current=key;
    workspace.browse(project);
    if(kernel.snapshot.navigator?.project?.project.name!==project) void kernel.apply({op:"project_browse",project});
  },[activeId,activeId ? state.surfaces[activeId]?.project : undefined,workspace.current.id,kernel.snapshot.buffers]);
  useEffect(() => {
    if (!activeId) return;
    if (lastFocusedSurface.current === activeId) return;
    if (!kernel.snapshot.surfaces[activeId]) return; // the mount path focuses it
    if(kernel.transport.kind==="tauri" && !document.hasFocus()) return;
    lastFocusedSurface.current = activeId;
    void kernel.surfaceFocus(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, kernel.snapshot.surfaces]);

  const detach = async (id:string) => {
    const binding=stateRef.current.surfaces[id];
    if(!binding) return;
    try {
      const {invoke}=await import("@tauri-apps/api/core");
      await invoke("window_detach",{workspaceId:workspaceRef.current.current.id,binding,bounds:stateRef.current.windowBounds?.[binding.id]??null});
      detachedRequests.current.add(`${workspaceRef.current.current.id}:${id}`);
      setState(s=>detachBinding(s,id));setWindowError(undefined);
    } catch(e) {setWindowError(String(e));}
  };
  const execute = (ref: string, arg?: ActionArg) => {
    if(ref === "surface.detach") {void detach(arg?.surfaceId??activeBindingId(stateRef.current)??"");return;}
    if(ref==="surface.open"){openFresh(arg?.groupId);return;}
    if(ref==="surface.open-sources"){summonWorld();return;}
    if(ref.startsWith("frame.mode:")){const next=ref.slice("frame.mode:".length);if(isWorkspaceMode(next))enterModeRef.current(next);return;}
    const change=()=>setState((s) => executeFrameAction(s, ref, arg, restorePoint.current));
    const transition=(document as Document & {startViewTransition?:(update:()=>void)=>unknown}).startViewTransition;
    if(ref==="surface.maximize"&&transition&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches)transition.call(document,()=>flushSync(change));
    else change();
  };

  /** THE CANVAS LAW (owner, 2026-09-19): an open lands in the canvas it was
   * asked from — the sidebar's own pane canvas when the request came from
   * there, the centre tree otherwise — and a fresh tab's own choice replaces
   * that tab in place, wherever it lives. A binding is hosted in exactly one
   * canvas: an open into one canvas of something the other hosts MOVES the
   * tab (same binding, same buffer — never a second host). */
  const openInSidePlace=(s:LayoutState,id:SurfaceId,binding?:SurfaceBinding):LayoutState=>{
    const pane=s.sidePane??{type:"group" as const,id:"side-panel",tabs:[],pinned:[],active:null};
    if(pane.tabs.includes(id))return {...s,sidePane:{...pane,active:id}};
    return {...s,surfaces:binding?{...s.surfaces,[binding.id]:binding}:s.surfaces,sidePane:{...pane,tabs:[...pane.tabs,id],active:id}};
  };
  /** Activation is canvas-scoped: the side canvas and the tree activate
   * independently, so landing a tab in one never drags the other's view. */
  const activateInHostCanvas=(s:LayoutState,id:SurfaceId):LayoutState=>{
    if(s.sidePane?.tabs.includes(id))return {...s,sidePane:{...s.sidePane,active:id}};
    if(groupsOf(s.root).some(g=>g.tabs.includes(id)))return executeFrameAction(s,"surface.activate",{surfaceId:id});
    return s;
  };
  /** The tree side of the single-host move: the binding's tab leaves its
   * group untouched except for the move — the buffer, the session and the
   * binding survive; a group left holding nothing stays for its own close. */
  const withoutTreeTab=(pane:Pane,id:SurfaceId):Pane=>
    pane.type==="split"
      ? {...pane,children:pane.children.map(child=>withoutTreeTab(child,id))}
      : {...pane,tabs:pane.tabs.filter(tab=>tab!==id),pinned:pane.pinned.filter(pin=>pin!==id),active:pane.active===id?(pane.tabs.filter(tab=>tab!==id)[0]??null):pane.active};
  const moveTreeTabToSide=(s:LayoutState,id:SurfaceId):LayoutState=>openInSidePlace(s.root?{...s,root:withoutTreeTab(s.root,id)}:s,id);
  /** The modes whose panel hosts the sidebar's own pane canvas: there the
   * canvas is the VISIBLE canvas — the mode's dedicated stage stands over
   * the tree — so a person-open asked without a canvas lands there. */
  const SIDE_CANVAS_MODES:readonly WorkspaceMode[]=["factory","expressions","techne"];
  const personCanvasAsk=(): "side"|undefined => SIDE_CANVAS_MODES.includes(stateRef.current.mode??"base") ? "side" : undefined;
  /** Find a surface twice, by the canvas that hosts it (single-host law). */
  const twinsByCanvas=(pred:(b:SurfaceBinding)=>boolean):{side?:SurfaceBinding;tree?:SurfaceBinding}=>{
    const current=stateRef.current;
    const sideTabs=current.sidePane?.tabs;
    return {
      side: sideTabs?Object.values(current.surfaces).find(b=>pred(b)&&sideTabs.includes(b.id)):undefined,
      tree: Object.values(current.surfaces).find(b=>pred(b)&&groupsOf(current.root).some(g=>g.tabs.includes(b.id))),
    };
  };
  /** Open a real source from the index listing: one layout binding carrying
   * the owner's canonical ref verbatim — the kernel mount effect opens the
   * buffer through the owner's read. Asked without a canvas it lands in the
   * visible canvas (the sidebar's own pane canvas in the dedicated-stage
   * modes), never the hidden tree behind the stage. */
  const openSource = async (source: ListedSource, project?: string, intoArg?: "side") => {
    if(kernel.transport.kind==="tauri") {
      const {invoke}=await import("@tauri-apps/api/core");
      if(await invoke<boolean>("window_focus_subject",{reference:source.ref})) return;
    }
    const current = stateRef.current;
    const into = intoArg ?? personCanvasAsk();
    if (into === "side") {
      const twins = twinsByCanvas(b => b.kind === "source" && b.ref === source.ref);
      if (twins.side) { setState(s => activateInHostCanvas(s, twins.side!.id)); return; }
      if (twins.tree) { setState(s => moveTreeTabToSide(s, twins.tree!.id)); return; }
      await openInSidePane({ id: crypto.randomUUID(), kind: "source", ref: source.ref, project, title: source.path.split("/").pop() || source.path }, "none");
      return;
    }
    const binding = makeSourceBinding(current, source.ref, source.path, project);
    if (groupsOf(current.root).some(g => g.tabs.includes(binding.id))) {
      execute("surface.activate", { surfaceId: binding.id });
      return;
    }
    setState((s) => openBinding({ ...s, closedStack: s.closedStack.filter(id => id !== binding.id) }, makeSourceBinding(s, source.ref, source.path, project)));
  };

  const openEncounter=async(row:EncounterRow,intoArg?: "side")=>{
    await encounter(kernel.transport,row.project,{action:"start"});
    await encounter(kernel.transport,row.project,{action:"read",agent_session:row.ref,after:0,limit:1});
    if(kernel.transport.kind==="tauri") {const {invoke}=await import("@tauri-apps/api/core");if(await invoke<boolean>("window_focus_subject",{reference:row.ref}))return;}
    const into = intoArg ?? personCanvasAsk();
    // Single-host law: one conversation, one tab — activate where it is,
    // move it to the asking canvas, or open it there fresh.
    const twins=twinsByCanvas(b=>b.kind==="encounter"&&b.ref===row.ref);
    const twinSide=twins.side; const twinTree=twins.tree;
    const binding:SurfaceBinding = twinSide ?? twinTree ?? {id:crypto.randomUUID(),kind:"encounter",ref:row.ref,title:row.title,project:row.project,encounter:{space:row.space}};
    if(!twinSide&&!twinTree){
      const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
      if(opened?.result!=="surface_opened")throw new Error("AIKit encounter surface could not be opened");
    }
    if(into==="side"){
      if(twinSide)setState(s=>activateInHostCanvas(s,twinSide.id));
      else if(twinTree)setState(s=>moveTreeTabToSide(s,twinTree.id));
      else setState(s=>openInSidePlace(s,binding.id,binding));
      return;
    }
    // A side-hosted tab is never re-hosted here: a tree ask mints its own.
    if(twinSide){const fresh={...binding,id:crypto.randomUUID()};const opened=await kernel.apply({op:"surface_open",surface_id:fresh.id,kind:fresh.kind,source_ref:fresh.ref,title:fresh.title});if(opened?.result!=="surface_opened")throw new Error("AIKit encounter surface could not be opened");setState(state=>openBinding({...state,closedStack:state.closedStack.filter(id=>id!==fresh.id)},fresh));return;}
    setState(state=>groupsOf(state.root).some(group=>group.tabs.includes(binding.id))?executeFrameAction(state,"surface.activate",{surfaceId:binding.id}):openBinding({...state,closedStack:state.closedStack.filter(id=>id!==binding.id)},binding));
  };

  const openFileRef=useRef<(location:CentralLocation)=>Promise<void>>(async()=>{});
  /** Open a real file. Two canvas refinements (owner, 2026-09-19):
   * `replaceId` — a fresh tab's own opener-page choice replaces THAT tab in
   * place, in whatever canvas it lives, never a second tab; `into:"side"` —
   * the open lands in the sidebar's own pane canvas, the canvas the request
   * came from. */
  const openFile = async (location:CentralLocation, opts?:{replaceId?:SurfaceId;into?:"side"}) => {
    // FND-04: a binary material format (image/pdf/an unsupported disposition)
    // reads through the binary-safe `FileBytes` op; text/HTML/Markdown read
    // as UTF-8 — and BOTH reads run once, through the shared broker, with
    // the renderer joining the same acquisition (WF2).
    const format = detectFormat({path: location.path});
    const isBinaryMaterial = format === "image" || format === "pdf" || format === "unsupported";
    const title = location.path.split("/").pop() ?? "File";
    const replaceId = opts?.replaceId;
    // The canvas is the person's choice; asked without one, a file opens in
    // the VISIBLE canvas — in a dedicated-stage mode that is the sidebar's
    // own pane canvas, never the hidden tree behind the stage.
    const into = replaceId ? undefined : (opts?.into ?? personCanvasAsk());
    const id = replaceId ?? crypto.randomUUID();
    if (!replaceId) {
      // A known binding opens by activation alone — never a second read; and
      // the activation is canvas-scoped, so a side-hosted copy activates in
      // the side canvas. A copy hosted in the OTHER canvas MOVES to the ask:
      // one file, one tab, one host.
      const currentAt = stateRef.current;
      // A file may already be hosted as kind "file" or, once its reading
      // yielded a bound source, as kind "source" — the ref is the identity.
      const known = location.ref ? Object.values(currentAt.surfaces).find(binding => (binding.kind === "file" || binding.kind === "source") && binding.ref === location.ref) : undefined;
      const sideTabs = currentAt.sidePane?.tabs;
      if (known && sideTabs?.includes(known.id)) {
        setState(s => activateInHostCanvas(s, known.id));
        return;
      }
      if (known && groupsOf(currentAt.root).some(g => g.tabs.includes(known.id))) {
        if (into !== "side") {
          setState(s => executeFrameAction(s, "surface.activate", { surfaceId: known.id }));
          return;
        }
        setState(s => moveTreeTabToSide(s, known.id));
        return;
      }
      if (kernel.transport.kind === "tauri" && location.ref) {
        const {invoke} = await import("@tauri-apps/api/core");
        if (await invoke<boolean>("window_focus_subject",{reference:location.ref}))return;
      }
    }
    // The destination is acknowledged BEFORE any owner round trip (WF2): a
    // pending binding — no owner identity yet — opens now and belongs to its
    // ORIGIN workspace. The acquisition that follows is the one the renderer
    // joins; completion fills the SAME tab in place, and lands in the origin
    // workspace even if the person has moved on — a late open never steals
    // another workspace's focus. The canvas is the person's choice: a
    // replaced fresh tab becomes the pending destination where it stands; a
    // new tab opens into the named canvas — the sidebar's own pane canvas
    // when the open came from there.
    const originWorkspaceId = workspaceRef.current.current.id;
    if (replaceId) setState(s => ({...s, surfaces: {...s.surfaces, [id]: {id, kind: "file", title, pending: true}}}));
    else if (into === "side") await openInSidePane({id, kind: "file", title, pending: true}, "none");
    else setState(s => openBinding({...s, closedStack: s.closedStack.filter(x => x !== id)}, {id, kind: "file", title, pending: true}));
    try {
      const reading = isBinaryMaterial
        ? await acquireFileBytes(kernel.transport, location)
        : await acquireFileReading(kernel.transport, location);
      const textReading = isBinaryMaterial ? undefined : reading as NativeFileReading;
      // A bound source opens as a source surface whether a project scope
      // holds it or not — a root-register Day document is a source with no
      // project (the open-source law). The pending file tab yields in place:
      // same tab, now a source binding, in the origin workspace.
      if (textReading?.source) {
        workspace.replaceSurface(originWorkspaceId, {id, kind: "source", ref: textReading.source.ref, title: textReading.source.path.split("/").pop() ?? title, project: textReading.project?.name});
        if (workspaceRef.current.current.id === originWorkspaceId) setState(s => activateInHostCanvas(s, id));
        return;
      }
      const ref = reading.location.ref;
      const opened = await kernel.apply({op:"surface_open",surface_id:id,kind:"file",source_ref:ref,title});
      if(opened?.result!=="surface_opened")throw new Error("Central file surface could not be opened");
      workspace.replaceSurface(originWorkspaceId, {id, kind: "file", ref, title, project: textReading?.project?.name, location: reading.location});
      if (workspaceRef.current.current.id === originWorkspaceId) setState(s => activateInHostCanvas(s, id));
    } catch (error) {
      // The pending tab becomes the failure's place (BOOT-09): the location
      // is kept, the error overlay + Retry render where the tab is, and
      // Retry re-acquires through the ordinary mount path.
      setSurfaceErrors(held => ({ ...held, [id]: error instanceof Error ? error.message : String(error) }));
      workspace.replaceSurface(originWorkspaceId, {id, kind: "file", title, location});
    }
  };

  openFileRef.current=openFile;

  /** The human's Day, through the owner's own route: `central.day.read`
   * discloses the Day source's canonical ref, and that disclosure is the
   * only identity the desktop opens it by (never a ref derived from a
   * path). The Day document is a root-register source; its strips route to
   * the root register's receiving field. */
  const openToday = async () => {
    // The Day's buffer comes from the owner's Day route (root-register
    // sources have no project-scoped source read); the surface then binds
    // to the ref that reading disclosed.
    const outcome = await kernel.dayOpen();
    const buffer = outcome?.result === "source_opened" ? outcome.buffer : undefined;
    if (!buffer) throw new Error("Central's Day reading did not yield a source to open");
    await openSource({ref: buffer.source_ref, path: buffer.path ?? "", treatment: "projectcentral-user", agent_retrieval_allowed: true, revision: buffer.base_revision}, undefined);
  };

  const openKnowledge = async (address: KnowledgeAddress, title: string, project?: string, placement: "tab"|"page"|"window" = "tab", graphOrigin?:string, intoArg?: "side") => {
    if(placement==="window"&&kernel.transport.kind!=="tauri")throw new Error("Native popout is available in the desktop app");
    // Project wiki ownership is an exact Central disclosure, never inferred
    // from a label or parsed out of an opaque wiki reference.
    project = kernel.snapshot.navigator?.root?.work.projects.find(p=>p.projectcentral.agent_wiki.wiki.space_ref===address.value)?.name ?? project;
    if (!["wiki", "source", "project-map"].includes(address.kind)) throw new Error("This native knowledge body is not yet supported by the desktop");
    const into = intoArg ?? personCanvasAsk();
    // A side-canvas open detaches nowhere: pop-out is a centre-tree act.
    if(into==="side"&&placement==="window")placement="tab";
    if(kernel.transport.kind==="tauri"&&placement==="tab") {
      const {invoke}=await import("@tauri-apps/api/core");
      if(await invoke<boolean>("window_focus_subject",{reference:address.value})) return;
    }
    const read = await knowledge<KnowledgeReading>(kernel.transport,project,{action:"read",address});
    const current = stateRef.current;
    // Single-host law: one knowledge page, one tab — activate where it is,
    // move it to the asking canvas, or open it there fresh.
    const same=(b:SurfaceBinding)=>b.kind==="knowledge"&&b.ref===read.resource&&(!graphOrigin||b.view?.graphOrigin===graphOrigin)&&(b.view?.knowledgePlane==="page")===(placement!=="tab");
    if(into==="side"){
      const twins=twinsByCanvas(same);
      if(twins.side){setState(s=>activateInHostCanvas(s,twins.side!.id));}
      else if(twins.tree){setState(s=>moveTreeTabToSide(s,twins.tree!.id));}
      else{
        const binding:SurfaceBinding={id:crypto.randomUUID(),kind:"knowledge",ref:read.resource,title,project,address,...(placement!=="tab"?{view:{knowledgePlane:"page" as const,graphOrigin}}:{})};
        const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"knowledge",source_ref:binding.ref,title:binding.title});
        if (opened?.result !== "surface_opened") throw new Error("The native knowledge surface could not be opened");
        setState(s=>openInSidePlace(s,binding.id,binding));
      }
    } else {
      // A side-hosted tab is never re-hosted here: a tree ask mints its own.
      const existing = Object.values(current.surfaces).find(b=>same(b)&&!current.sidePane?.tabs.includes(b.id));
      const binding:SurfaceBinding = existing ?? {id:crypto.randomUUID(),kind:"knowledge",ref:read.resource,title,project,address,...(placement!=="tab"?{view:{knowledgePlane:"page" as const,graphOrigin}}:{})};
      const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"knowledge",source_ref:binding.ref,title:binding.title});
      if (opened?.result !== "surface_opened") throw new Error("The native knowledge surface could not be opened");
      setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
      if(placement==="window") {
        try {
          const {invoke}=await import("@tauri-apps/api/core");
          await invoke("window_detach",{workspaceId:workspaceRef.current.current.id,binding,bounds:stateRef.current.windowBounds?.[binding.id]??null});
          detachedRequests.current.add(`${workspaceRef.current.current.id}:${binding.id}`);
          setState(s=>detachBinding(s,binding.id));
        }catch(error){setWindowError(String(error));throw error;}
      }
    }
    // Explicit successful navigation only. Refresh, restore and display do
    // not execute AIKit's route-use operation.
    await knowledge(kernel.transport,project,{action:"use",address});
  };

  /** SF1: Explore — the stable global entrance to the open/shared field
   * (SHARED-FIELD-DESKTOP §1). One Explore Surface per arrangement,
   * opened/focused like System; workspace-independent view state lives in
   * its own remembered travel, never in the workspace's project. Opening
   * it discloses nothing to anyone and starts no AgentSession. */
  const openExplore = async (select?: {ref:string;title?:string}, intoArg?: "side") => {
    if(select)navigateExplore({ref:select.ref});
    const into = intoArg ?? personCanvasAsk();
    // Single-host law: one Explore per canvas — activate, move, or open there.
    const twins=twinsByCanvas(b=>b.kind==="explore");
    const twinSide=twins.side; const twinTree=twins.tree;
    if(into==="side"){
      if(twinSide){setState(s=>activateInHostCanvas(s,twinSide.id));return;}
      if(twinTree){setState(s=>moveTreeTabToSide(s,twinTree.id));return;}
      const binding={id:crypto.randomUUID(),kind:"explore",title:"Explore"} as SurfaceBinding;
      if(!kernel.snapshot.surfaces[binding.id]){
        const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"explore",source_ref:undefined,title:binding.title});
        if (opened?.result !== "surface_opened") throw new Error("The Explore surface could not be opened");
      }
      setState(s=>openInSidePlace(s,binding.id,binding));
      return;
    }
    // A side-hosted Explore is never re-hosted here: a tree ask mints its own.
    const binding = twinTree ?? ({id:crypto.randomUUID(),kind:"explore",title:"Explore"} as SurfaceBinding);
    if(!kernel.snapshot.surfaces[binding.id]){
      const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"explore",source_ref:undefined,title:binding.title});
      if (opened?.result !== "surface_opened") throw new Error("The Explore surface could not be opened");
    }
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };
  /** SF1: one projected subject pinned as its own ordinary Surface, carrying
   * the exact refs it was opened with; split/full/detach/re-dock are the
   * frame's own grammar on this binding. */
  const openPresentation = async (ref:string,title:string,meta:PresentationMeta,intoArg?: "side") => {
    const into = intoArg ?? personCanvasAsk();
    // Single-host law: one presentation per canvas — activate, move, or open there.
    const twins=twinsByCanvas(b=>b.kind==="presentation"&&b.ref===ref);
    const twinSide=twins.side; const twinTree=twins.tree;
    if(into==="side"){
      if(twinSide){setState(s=>activateInHostCanvas(s,twinSide.id));return;}
      if(twinTree){setState(s=>moveTreeTabToSide(s,twinTree.id));return;}
      const binding:SurfaceBinding={id:crypto.randomUUID(),kind:"presentation",ref,title,presentation:meta};
      if(!kernel.snapshot.surfaces[binding.id]){
        const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"presentation",source_ref:ref,title});
        if (opened?.result !== "surface_opened") throw new Error("The presentation surface could not be opened");
      }
      setState(s=>openInSidePlace(s,binding.id,binding));
      return;
    }
    const existing = twinTree;
    const binding:SurfaceBinding = existing ? {...existing,title,presentation:meta} : {id:crypto.randomUUID(),kind:"presentation",ref,title,presentation:meta};
    if(!kernel.snapshot.surfaces[binding.id]){
      const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"presentation",source_ref:ref,title});
      if (opened?.result !== "surface_opened") throw new Error("The presentation surface could not be opened");
    }
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction({...s,surfaces:{...s.surfaces,[binding.id]:binding}},"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };
  const openExploreRef=useRef(openExplore);openExploreRef.current=openExplore;
  useEffect(()=>{
    const open=(event:Event)=>{const d=(event as CustomEvent<{ref?:string;title?:string}|undefined>).detail;void openExploreRef.current(d?.ref?{ref:d.ref,title:d.title}:undefined).catch(e=>setWindowError(String(e)));};
    window.addEventListener("oi:open-explore",open);
    return()=>window.removeEventListener("oi:open-explore",open);
  },[]);

  /** A mode's centre surface (workspace/mode.ts): a singleton presentation
   * binding in the ordinary pane system, opened or focused like System and
   * Explore. It holds no owner identity of its own — what it shows is read
   * through its own owners. */
  const openModeSurface = async (kind:"expressions"|"techne"|"epi-logos") => {
    const title = kind==="expressions" ? "Expressions" : kind==="techne" ? "Technè" : "Epi-Logos";
    const existing = Object.values(stateRef.current.surfaces).find(b=>b.kind===kind);
    const binding = existing ?? {id:crypto.randomUUID(),kind,title};
    if(!kernel.snapshot.surfaces[binding.id]){
      const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind,source_ref:undefined,title:binding.title});
      if (opened?.result !== "surface_opened") throw new Error(`The ${title} surface could not be opened`);
    }
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };
  /** Factory relocates the conversation to the centre: the accompanying
   * encounter opens as an ordinary encounter tab — the same binding kind, the
   * same owner session, never a second transcript. The first time it arrives
   * beside a lone Factory pane in a wide window it takes its own split. */
  const openConversationInCentre = async (accompanying:NonNullable<LayoutState["accompanying"]>,arrange=false,still:()=>boolean=()=>true) => {
    const before=stateRef.current;
    const wasOpen=Object.values(before.surfaces).some(binding=>binding.kind==="encounter"&&binding.ref===accompanying.ref&&groupsOf(before.root).some(group=>group.tabs.includes(binding.id)));
    if(!still())return;
    await openEncounter({ref:accompanying.ref,project:accompanying.project,space:accompanying.space,title:Object.values(before.surfaces).find(binding=>binding.kind==="encounter"&&binding.ref===accompanying.ref)?.title??"Conversation"});
    if(!arrange||wasOpen||window.innerWidth<1100)return;
    setState(s=>{
      const opened=Object.values(s.surfaces).find(binding=>binding.kind==="encounter"&&binding.ref===accompanying.ref);
      const groups=groupsOf(s.root);
      return opened&&groups.length===1&&groups[0].tabs.length>1&&groups[0].tabs.includes(opened.id) ? splitOff(s,opened.id,"h",true) : s;
    });
  };
  /** Enter a workspace mode. Each mode owns its own pane tree (workspace/
   * store.ts): the store leaves the current tree where it stands and stands
   * on the entered mode's — so only that mode's surfaces are mounted, and the
   * bodies left behind unmount (their kernel surfaces close through the same
   * reconciliation a workspace switch uses; unsaved source writing is held by
   * the draft store and restored on return). The shell, the side-region
   * widths, the live accompanying session and the world context ride
   * through. A mode entered on an empty tree — first visit, or everything
   * closed — opens its MODE_CURATION centre; entering the mode you are
   * already in focuses that centre. */
  const enterMode = (next:WorkspaceMode) => {
    const same=(stateRef.current.mode??"base")===next;
    if(!same){
      lastFocusedSurface.current=null;
      flushSync(()=>workspaceRef.current.switchMode(next));
    }
    const centre=MODE_CURATION[next].centreKind;
    // Owner correction 2026-09-18: Settings switches instantly like any other
    // mode — the shell changes now, the System panel composes inside (it reads
    // kernel state directly; the kernel learns of the binding through the
    // ordinary mount reconciliation). No awaited owner call gates the switch.
    if(!centre||(!same&&stateRef.current.root))return;
    // The centre opens in the SAME synchronous step as the switch, as a plain
    // layout binding: an awaited owner call here could resolve after a further
    // switch and land this mode's surface in another mode's tree. The kernel
    // learns of the binding through the ordinary mount reconciliation.
    const title={factory:"Factory",expressions:"Expressions",techne:"Technè","epi-logos":"Epi-Logos",system:"Settings"}[centre];
    setState(s=>{
      const existing=Object.values(s.surfaces).find(binding=>binding.kind===centre);
      const binding=existing??{id:crypto.randomUUID(),kind:centre,title};
      return groupsOf(s.root).some(group=>group.tabs.includes(binding.id))?executeFrameAction(s,"surface.activate",{surfaceId:binding.id}):openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding);
    });
    // Factory's centre is Desk/Tasks (handoff §11): the mode surface mounts
    // whichever presentation the left navigator's entries choose — the chat
    // (Tasks) is the shared AgentChat bound to the accompanying conversation,
    // so no encounter-tab relocation happens here.
  };
  const enterModeRef=useRef(enterMode);enterModeRef.current=enterMode;
  // The hosted application's deep cut can ask for the lived cut back: the
  // request lands in the shell's OWN mode pipeline — one mode system.
  useEffect(() => {
    const onHostMode = (event: Event) => {
      const mode = (event as CustomEvent<{mode?: string}>).detail?.mode;
      if (mode === "expressions" || mode === "techne") enterModeRef.current(mode);
    };
    window.addEventListener("oi:host-workspace-mode", onHostMode);
    return () => window.removeEventListener("oi:host-workspace-mode", onHostMode);
  }, []);
  // WORLD CONTEXT — drill-throughs leave a route back. A traversal out of a
  // reading (Epi-Logos passage → its Expression → Technè → exact source, or a
  // Library result → page → Expression → Instrument 0 → source) records where
  // it left from on the workspace's context trail; "return" pops it and lands
  // on the same mode, place and reading position. The world selected on
  // entering Epi-Logos is untouched by these hops: examining in Technè is
  // still within Epi-Logos. Refs and positions only ever enter the trail.
  useEffect(()=>{
    const fail=(reason:unknown)=>setWindowError(String(reason instanceof Error?reason.message:reason));
    const leave=(label:string,returnTo:unknown)=>{
      const from=returnTo as {place?:{ref?:string;title?:string};passageId?:string}|undefined;
      const mode=stateRef.current.mode??"base";
      workspaceRef.current.setContext(context=>({...context,
        reading:from?.place?.ref?{ref:from.place.ref,position:from.passageId}:context.reading,
        trail:[...(context.trail??[]),{mode,label:from?.place?.title??label,surfaceRef:from?.place?.ref,surfaceKind:mode==="epi-logos"?"epi-logos":undefined,position:from?.passageId}]}));
    };
    const detail=<T,>(event:Event)=>(event as CustomEvent<T>).detail;
    const expression=(event:Event)=>{const d=detail<{expressionRef?:string;returnTo?:unknown}>(event);if(!d?.expressionRef)return;leave("Reading",d.returnTo);enterModeRef.current("expressions");try{summonExpression(d.expressionRef);}catch(reason){fail(reason);}};
    const examine=(event:Event)=>{const d=detail<{returnTo?:unknown}>(event);leave("Reading",d?.returnTo);enterModeRef.current("techne");};
    const source=(event:Event)=>{const d=detail<{location?:CentralLocation;returnTo?:unknown}>(event);if(!d?.location)return;leave("Reading",d.returnTo);enterModeRef.current("base");void openFileRef.current(d.location).catch(fail);};
    // Knowledge opens are cross-mode by the same law as sources: leave a
    // reading trail first (the return chip brings the person back), then
    // open or focus the knowledge surface in the CURRENT mode's own tree —
    // a real pane placement the workbench's own grammar carries, never a
    // modal dead-end. Sources enter Base because files live there;
    // knowledge has no home mode, so it lands where the person stands.
    const knowledgeOpen=(event:Event)=>{const d=detail<{ref?:string;title?:string;project?:string;returnTo?:unknown}>(event);if(!d?.ref)return;leave("Reading",d.returnTo);void openKnowledgeRef.current({kind:"wiki",value:d.ref},d.title??"Wiki",d.project).catch(fail);};
    // Return: pop the newest stop, stand in its mode, hand the place back to its surface.
    const back=()=>{
      const trail=workspaceRef.current.current.context?.trail??[];const stop=trail[trail.length-1];if(!stop)return;
      workspaceRef.current.setContext(context=>({...context,trail:(context.trail??[]).slice(0,-1)}));
      enterModeRef.current(stop.mode);
      if(stop.surfaceKind==="library")setLibrary("open");
      if(stop.surfaceKind==="epi-logos"&&stop.surfaceRef)requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent("oi:epi-return",{detail:{place:{ref:stop.surfaceRef,title:stop.label},passageId:stop.position}})));
    };
    // Library → page → Expression → Instrument 0 → exact source → return to
    // the same place: every hop out of the Library leaves a Library stop.
    const libraryOpen=(event:Event)=>{
      const d=detail<{item?:{ref:string;title:string;project?:string;expressionRef?:string;sourceLocation?:CentralLocation;kind?:string};how?:string}>(event);const item=d?.item;if(!item)return;
      const mode=stateRef.current.mode??"base";
      workspaceRef.current.setContext(context=>({...context,subject:{ref:item.ref,kind:item.kind,title:item.title,project:item.project},trail:[...(context.trail??[]),{mode,label:"Library",surfaceKind:"library",surfaceRef:item.ref}]}));
      setLibrary("held");
      if(d.how==="expression"&&(item.expressionRef??item.ref).startsWith("expression:")){enterModeRef.current("expressions");try{summonExpression(item.expressionRef??item.ref);}catch(reason){fail(reason);}}
      else if(d.how==="instrument"){enterModeRef.current("techne");if(item.sourceLocation)requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent("oi:techne-add-material",{detail:{location:item.sourceLocation}})));}
      else if(d.how==="source"&&item.sourceLocation){enterModeRef.current("base");void openFileRef.current(item.sourceLocation).catch(fail);}
      else if(item.kind==="composition"){enterModeRef.current("expressions");try{summonExpression(item.ref);}catch(reason){fail(reason);}}
      else void openKnowledgeRef.current({kind:"wiki",value:item.ref},item.title,item.project).catch(fail);
    };
    const agencyOpen=(event:Event)=>{
      const project=detail<{project?:string}>(event)?.project??workspaceRef.current.current.project??undefined;
      const existing=Object.values(stateRef.current.surfaces).find(binding=>binding.kind==="agency"&&binding.project===project);
      const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:"agency",title:project?`Agency · ${project}`:"Agency",project};
      void kernel.apply({op:"surface_open",surface_id:binding.id,kind:"agency",source_ref:undefined,title:binding.title}).then(opened=>{
        if(opened?.result!=="surface_opened")throw new Error("The Agency surface could not be opened");
        setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id))?executeFrameAction(s,"surface.activate",{surfaceId:binding.id}):openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
      }).catch(fail);
    };
    const message=(event:Event)=>{const text=detail<{message?:string}>(event)?.message;if(text)setWindowError(text);};
    const settings=()=>enterModeRef.current("settings");
    // Results' "Open in centre": the subject's own tab if it is open here, else its file.
    const openSubject=(event:Event)=>{const subject=detail<{subject?:{ref?:string;location?:CentralLocation}}>(event)?.subject;if(!subject)return;if(subject.location){void openFileRef.current(subject.location).catch(fail);return;}const held=Object.values(stateRef.current.surfaces).find(binding=>!!subject.ref&&binding.ref===subject.ref);if(held)setState(s=>executeFrameAction(s,"surface.activate",{surfaceId:held.id}));};
    const pairs:[string,(event:Event)=>void][]=[["oi:open-agency",agencyOpen],["oi:panel-open-subject",openSubject],["oi:workspace-message",message],["oi:open-settings",settings],["oi:library-open",libraryOpen],["oi:epi-open-expression",expression],["oi:epi-examine",examine],["oi:epi-open-source",source],["oi:epi-open-knowledge",knowledgeOpen],["oi:context-return",back]];
    for(const [name,handler] of pairs)window.addEventListener(name,handler);
    return()=>{for(const [name,handler] of pairs)window.removeEventListener(name,handler);};
  },[]);
  // In Expressions mode the living application is the centre: a summon to
  // compose focuses that tab (the surface selects the summoned ref itself) and
  // the panel — Anima — is never displaced by it. Every other mode keeps the
  // panel's own Composition plane as the summon's answer.
  const openModeSurfaceRef=useRef(openModeSurface);openModeSurfaceRef.current=openModeSurface;
  useEffect(()=>{
    const summon=()=>{if((stateRef.current.mode??"base")==="expressions")void openModeSurfaceRef.current("expressions").catch(reason=>setWindowError(String(reason instanceof Error?reason.message:reason)));};
    window.addEventListener(EXPRESSION_COMPOSE_EVENT,summon);
    return()=>window.removeEventListener(EXPRESSION_COMPOSE_EVENT,summon);
  },[]);
  // Technè's scene opens a referenced file in the centre through the frame's
  // own file opener (⌘⏎ on a material item) — never a second open path.
  useEffect(()=>{
    const open=(event:Event)=>{const location=(event as CustomEvent<{location?:CentralLocation}>).detail?.location;if(location)void openFileRef.current(location).catch(reason=>setWindowError(String(reason instanceof Error?reason.message:reason)));};
    window.addEventListener("oi:techne-open-file",open);
    return()=>window.removeEventListener("oi:techne-open-file",open);
  },[]);

  const openFresh=(groupId?:string)=>{
    const binding:SurfaceBinding={id:crypto.randomUUID(),kind:"blank",title:"New tab",project:workspaceRef.current.current.project??undefined};
    setState(s=>openBinding(groupId?{...s,focusedGroupId:groupId}:s,binding));
  };
  const terminalCwd=(project?:string)=>{
    const root=kernel.snapshot.navigator?.root?.root;
    const path=kernel.snapshot.navigator?.root?.work.projects.find(candidate=>candidate.name===project)?.path
      ?? kernel.snapshot.navigator?.project?.project.path;
    if(path?.startsWith("/"))return path;
    if(root&&path)return `${root.replace(/\/$/,"")}/${path.replace(/^\//,"")}`;
    return root;
  };
  /** Local civil time only (Central names the Flow from it, per its own
   *  ProjectCentral/now/flows convention); never a UTC or scheduler stamp. */
  const localStamp=()=>{const d=new Date(),p=(n:number)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;};
  /** Writing opens on this device and never mints a placeholder: no Flow, no
   *  file, no Day, no NOW allocation as a side effect of opening. The ground
   *  is written only when the human explicitly saves real content
   *  (placeDraft): one dated 0/1 instance in Control/user/flows/ — the
   *  ratified carrier. */
  const startWriting=async()=>{
    setState(s=>openBinding(s,{id:crypto.randomUUID(),kind:"draft",title:"Draft"}));
  };
  /** Save unsaved writing: one dated 0/1 instance created in the user
   *  section's flows area through Central's own file operation, replacing
   *  the surface in place. Only real content reaches the ground — an empty
   *  draft has nothing to place, and no blank placeholder is ever minted in
   *  its name. The local copy is released only once the owner holds it. */
  const placeDraft=async(bindingId:string,content:string)=>{
    if(!content.trim())throw new Error("Nothing to place yet — write first, then save.");
    let area:import("./flow/instances").UserFlowsArea|undefined;
    try{area=await userFlowsArea(kernel.transport);}catch{area=undefined;}
    if(!area)throw new Error("No Central ground is reachable; the writing is still kept on this device.");
    const stamp=localStamp();
    let lastError:unknown;
    for(let n=0;n<8;n++){
      const name=instanceFileName(stamp,n);
      const location={schema:"central.path-ref/v1" as const,ref:`${area.baseRef}/flows/${name}`,root:area.root,path:`${area.basePath}/flows/${name}`};
      try{
        const html=mintInstance(content);
        const result=await fileOperation<FileMutation>(kernel.transport,location,{action:"write",expected_revision:"",content:html});
        if(result.outcome!=="created")throw new Error(`Central did not create the flow instance (${result.outcome}).`);
        const doc=parseInstance(html);
        const documentId=doc.meta.documentId??name;
        const title=name;
        const binding:SurfaceBinding={id:bindingId,kind:"flow",title,ref:location.ref,location,flow:{flowRef:documentId,path:location.path}};
        // The owner-mediated read registers the file ref for the surface-open
        // gate and hands back the live central revision.
        await readFile(kernel.transport,location);
        const opened=await kernel.apply({op:"surface_open",surface_id:bindingId,kind:"flow",title,source_ref:location.ref});
        if(opened?.result!=="surface_opened")throw new Error("Central created the flow document but the surface could not be opened; your writing is still kept on this device.");
        await kernel.apply({op:"surface_focus",surface_id:bindingId});
        setState(s=>({...s,surfaces:{...s.surfaces,[bindingId]:binding}}));
        try{localStorage.removeItem(DRAFT_KEY(bindingId));}catch{/* The owner holds it now. */}
        return;
      }catch(reason){
        lastError=reason;
        if(!/already exists|conflict/i.test(String(reason)))throw reason;
      }
    }
    throw new Error(`Central would not accept a new flow instance this minute: ${String(lastError)}`);
  };
  const placeDraftRef=useRef(placeDraft);placeDraftRef.current=placeDraft;
  useEffect(()=>{
    const place=(event:Event)=>{const d=(event as CustomEvent<{id:string;content:string}>).detail;
      void placeDraftRef.current(d.id,d.content)
        .then(()=>window.dispatchEvent(new CustomEvent("oi:place-draft-result",{detail:{id:d.id}})))
        .catch(reason=>window.dispatchEvent(new CustomEvent("oi:place-draft-result",{detail:{id:d.id,error:String(reason instanceof Error?reason.message:reason)}})));};
    window.addEventListener("oi:place-draft",place);
    return()=>window.removeEventListener("oi:place-draft",place);
  },[]);
  /** Open one flow instance from the navigator's user-section list: the
   *  document surface reads the file the owner holds. */
  const openFlowInstance=async(row:{name:string;location:import("./kernel/types").CentralLocation})=>{
    const existing=Object.values(stateRef.current.surfaces).find(binding=>binding.kind==="flow"&&binding.location?.ref===row.location.ref);
    const title=row.name;
    const binding=existing??{id:crypto.randomUUID(),kind:"flow",title,ref:row.location.ref,location:row.location,flow:{flowRef:row.name,path:row.location.path}};
    // The surface-open gate requires the ref be registered by a real
    // owner-mediated read; reading the instance is the open.
    await readFile(kernel.transport,row.location);
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"flow",title,source_ref:binding.location!.ref});
    if(opened?.result!=="surface_opened")throw new Error("The flow document surface could not be opened");
    await kernel.apply({op:"surface_focus",surface_id:binding.id});
    setState(state=>groupsOf(state.root).some(group=>group.tabs.includes(binding.id))?executeFrameAction(state,"surface.activate",{surfaceId:binding.id}):openBinding({...state,closedStack:state.closedStack.filter(id=>id!==binding.id)},binding));
  };
  const freshChoice=async(id:string,kind:string,project?:string)=>{
    const workspaceId=workspaceRef.current.current.id;
    const current=stateRef.current.surfaces[id];if(!current)return;
    project=project??current.project??workspaceRef.current.current.project??undefined;
    if(kind==="search"){setSearchOpen(true);return;}
    // The supplied document forms (0/1, 4+2) are not created here: their
    // real files are resolved through Central's file route and opened by
    // the same path the navigator uses (dedup + focus included). A missing
    // or withheld form surfaces its exact unavailable state in the tab.
    // The opener page's own tab is the destination (owner, 2026-09-19): the
    // chosen form replaces THIS fresh tab in place — wherever it lives, the
    // centre canvas or the sidebar's own pane canvas — never a second tab.
    const form=DOCUMENT_FORMS.find(candidate=>candidate.kind===kind);
    if(form){await openFile(await resolveDocumentForm(kernel.transport,form,kernel.snapshot.navigator?.root?.work.projects),{replaceId:id});return;}
    let binding:SurfaceBinding={...current,project,kind,title:kind==="terminal"?"Terminal":"Browser"};
    if(kind==="flow"){
      // Writing, not minting: the fresh tab's Write opens the retained draft
      // in place of the blank surface. No register refusal — blank writing is
      // valid, and the picker names where a Save will place it.
      binding={...current,project,kind:"draft",title:"Draft"};
    }else if(kind==="terminal"){
      binding.terminal={cwd:terminalCwd(project)};
    }else if(kind==="browser"){binding.browser={url:""};}else{return;}
    if(binding.kind==="draft"){
      // A draft is a client-side surface — the same shape the
      // transport-unavailable path has always opened. Nothing to register.
      workspaceRef.current.replaceSurface(workspaceId,binding);
      return;
    }
    const opened=await kernel.apply({op:"surface_open",surface_id:id,kind:binding.kind,title:binding.title,source_ref:binding.ref});
    if(opened?.result!=="surface_opened")throw new Error("The new surface could not be opened");
    workspaceRef.current.replaceSurface(workspaceId,binding);
  };
  const freshRef=useRef(freshChoice);freshRef.current=freshChoice;
  useEffect(()=>{
    const create=(event:Event)=>{
      const groupId=(event as CustomEvent<{groupId?:string}>).detail?.groupId;
      if(groupId==="side-panel"||groupId===stateRef.current.sidePane?.id){const b:SurfaceBinding={id:crypto.randomUUID(),kind:"blank",title:"New tab",project:workspaceRef.current.current.project};void openInSidePane(b,"none").catch(report);return;}
      openFresh(groupId);
    };
    const choose=(event:Event)=>{const d=(event as CustomEvent<{id:string;kind:string;project?:string}>).detail;void freshRef.current(d.id,d.kind,d.project).then(()=>window.dispatchEvent(new CustomEvent("oi:fresh-result",{detail:{id:d.id}}))).catch(reason=>window.dispatchEvent(new CustomEvent("oi:fresh-result",{detail:{id:d.id,error:String(reason)}})));};
    window.addEventListener("oi:new-tab",create);window.addEventListener("oi:fresh-choice",choose);
    return()=>{window.removeEventListener("oi:new-tab",create);window.removeEventListener("oi:fresh-choice",choose);};
  },[]);

  const openBrowser = async () => {
    const binding={id:crypto.randomUUID(),kind:"browser",title:"Browser",browser:{url:""}};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"browser",title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("Browser surface could not be opened");
    setState(s=>openBinding(s,binding));
  };
  /** A terminal pane in the centre canvas — the same open the shell's own
   * actions use, lent to the Ta-Onta Context plane. */
  const openTerminal = (project?:string) => {
    const id=crypto.randomUUID();
    const scope=project??workspaceRef.current.current.project??undefined;
    const binding:SurfaceBinding={id,kind:"terminal",title:"Terminal",project:scope,terminal:{cwd:terminalCwd(scope)}};
    setState(s=>openBinding(s,binding));
  };
  /** The right panel's own pane (the Context plane hosts it): a REAL
   * TabGroupPane from the existing pane logic — the same tab strip, +,
   * surfaces and chrome the centre panes use — never tiled. Opening gates
   * through the same kernel surface_open; pop-out moves a tab into the
   * centre tree through the ordinary openBinding docking path. */
  const openInSidePane = async (binding:SurfaceBinding, op:"surface_open"|"none") => {
    if(op==="surface_open"){
      const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
      if(opened?.result!=="surface_opened")throw new Error("The pane could not be opened in the sidebar");
    }
    setState(s=>openInSidePlace(s,binding.id,binding));
  };
  /** The pane actions of the side pane, against the side group — never the
   * centre tree. Anything the side pane does not own falls through to the
   * frame's own execute. */
  const sideExecute=(action:string,arg?:import("./surface/types").ActionArg)=>{
    const pane=stateRef.current.sidePane;if(!pane)return;
    const want=(arg as {surfaceId?:string})?.surfaceId;const surfaceId=typeof want==="string"?want:undefined;
    // The side pane owns its actions outright. Nothing it emits may reach the
    // centre tree — a stray group there would end the mode's dedicated stage.
    if(action==="surface.focus-group"||action==="frame.tabs-pin")return;
    if(action==="surface.activate"&&surfaceId&&pane.tabs.includes(surfaceId)){setState(s=>s.sidePane?{...s,sidePane:{...s.sidePane,active:surfaceId}}:s);return;}
    if(action==="surface.open"){const b:SurfaceBinding={id:crypto.randomUUID(),kind:"blank",title:"New tab",project:workspaceRef.current.current.project};void openInSidePane(b,"none").catch(report);return;}
    if(action==="surface.close"&&surfaceId){
      const id=surfaceId;if(!pane.tabs.includes(id))return;
      void kernel.apply({op:"surface_close",surface_id:id}).catch(()=>{});
      setState(s=>{
        if(!s.sidePane)return s;
        const tabs=s.sidePane.tabs.filter(t=>t!==id);
        const surfaces={...s.surfaces};delete surfaces[id];
        return {...s,surfaces,sidePane:tabs.length?{...s.sidePane,tabs,pinned:s.sidePane.pinned.filter(p=>p!==id),active:s.sidePane.active===id?(tabs[0]??null):s.sidePane.active}:undefined};
      });
      return;
    }
    if(action==="surface.detach"){
      const id=pane.active;if(!id)return;
      const binding=stateRef.current.surfaces[id];if(!binding)return;
      setState(s=>{
        if(!s.sidePane)return s;
        const tabs=s.sidePane.tabs.filter(t=>t!==id);
        return openBinding({...s,sidePane:tabs.length?{...s.sidePane,tabs,pinned:s.sidePane.pinned.filter(p=>p!==id),active:s.sidePane.active===id?(tabs[tabs.length-1]??null):s.sidePane.active}:undefined},binding);
      });
      return;
    }
  };
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri")return;
    const reconcile=()=>{
      const layouts=[stateRef.current,...workspaceRef.current.workspaces.filter(w=>w.id!==workspaceRef.current.current.id).map(w=>w.layout)];
      const live=layouts.flatMap(layout=>[...groupsOf(layout.root).flatMap(g=>g.tabs),...(layout.detached??[]).map(d=>d.surfaceId)]);
      if(stateRef.current.sidePane)live.push(...stateRef.current.sidePane.tabs);
      void import("@tauri-apps/api/core").then(({invoke})=>Promise.all([invoke("browser_reconcile",{live}),invoke("terminal_reconcile",{live})])).catch(reason=>setWindowError(String(reason)));
    };
    const title=(event:Event)=>{const reading=(event as CustomEvent<{id:string;title:string;url:string}>).detail;
      setState(s=>s.surfaces[reading.id]?.kind==="browser"?{...s,surfaces:{...s.surfaces,[reading.id]:{...s.surfaces[reading.id],title:reading.title||"Browser",browser:{url:reading.url}}}}:s);
    };
    const focus=(event:Event)=>setState(s=>executeFrameAction(s,"surface.activate",{surfaceId:(event as CustomEvent<string>).detail}));
    window.addEventListener("oi:browser-pane-focus",focus);
    reconcile();window.addEventListener("oi:terminal-attached",reconcile);window.addEventListener("oi:browser-attached",reconcile);window.addEventListener("oi:browser-title",title);
    return()=>{window.removeEventListener("oi:browser-pane-focus",focus);window.removeEventListener("oi:terminal-attached",reconcile);window.removeEventListener("oi:browser-attached",reconcile);window.removeEventListener("oi:browser-title",title);};
  },[state.root,state.detached,workspace.workspaces,kernel.transport.kind]);

  // The frame keyboard map (keys.ts) + Escape. Attached always, so ⌘T/⌘O
  // open from rest and every operation has its keyboard path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if ((e.metaKey||e.ctrlKey)&&e.code==="KeyL") {e.preventDefault();const address=document.querySelector<HTMLInputElement>('.pane[data-focused="true"] .browser-address');if(address){address.focus();address.select();}else void openBrowser().catch(reason=>setWindowError(String(reason)));return;}
      if ((e.target as HTMLElement)?.closest(".search-aperture")) return;
      if ((e.metaKey||e.ctrlKey) && e.altKey && !e.shiftKey && e.code==="KeyD" && kernel.transport.kind==="tauri") {e.preventDefault();void detach(activeBindingId(stateRef.current)??"");return;}
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === "KeyB") {
        e.preventDefault();
        if (navigatorRef.current) dismissWorld(); else summonWorld();
        return;
      }
      if (e.key === "Escape" && !menuRef.current && (stateRef.current.rightDepth === "full" || stateRef.current.maximizedGroupId || stateRef.current.focusedTabId)) {
        e.preventDefault();
        setState(s => s.focusedTabId ? {...s,focusedTabId:undefined} : s.rightDepth === "full" ? {...s, rightDepth:"panel"} : {...s, maximizedGroupId:undefined});
        return;
      }
      if (e.key === "Escape" && navigatorRef.current && (e.target as HTMLElement)?.closest(".world-navigator")) {
        e.preventDefault(); dismissWorld(); return;
      }
      if (e.key === "Escape") {
        if (menuRef.current) {
          setMenu(null);
          return;
        }
        if (stateRef.current.maximizedGroupId) {
          e.preventDefault(); setState(s => ({ ...s, maximizedGroupId: undefined })); return;
        }
        if (stateRef.current.rightDepth === "full" || stateRef.current.agencyDepth === "full") {
          e.preventDefault();
          setState((s) => s.rightDepth === "full" ? { ...s, rightDepth: "panel" } : stepDepthDown(s));
        }
        return;
      }
      // Frame window commands are matched in the capture phase above.
    };
    const onContext = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".agency-field,.agency-column")) return;
      e.preventDefault();
      rememberWorkFocus();
      setMenu({ x: e.clientX, y: e.clientY, items: [{ action_ref: "frame.world", title: "World (⌘B)", enabled: true }] });
    };
    // The one window-wide search aperture is matched in the CAPTURE phase.
    // A focused surface editor is a DOM handler inside the window, so on the
    // bubble path it sees the key first: CodeMirror's default keymap binds
    // Shift-Mod-k (deleteLine) and preventDefaults it, which both swallowed
    // the configured shifted leader and quietly deleted a line of the open
    // buffer. The aperture is application-level; no surface may claim it.
    const onLeader = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (matchesSearchLeader(e, leader.current.current)) {
        e.preventDefault(); e.stopPropagation();
        setSearchOpen(true);
        return;
      }
      // The frame's window commands (keys.ts: ⌘T/⌘O/⌘W/⌘D/⌘1-9, ⌘⇧T/⌘⇧D,
      // ⌘⌥…, ⌥…) belong to the application everywhere, so they are matched
      // here too. A focused editor is a DOM handler inside the window and
      // sees keys first on the bubble path: CodeMirror binds Mod-d
      // (selectNextOccurrence) and Shift-Mod-k (deleteLine) and
      // preventDefaults them, which silently swallowed split-right and the
      // search leader whenever the caret was in a document. The editor keeps
      // every key the frame does not claim — ⌘Z, ⌘S, ⌘F and the rest.
      if ((e.metaKey||e.ctrlKey)&&e.altKey&&!e.shiftKey&&e.code==="KeyL") { e.preventDefault(); e.stopPropagation(); setLibrary(value=>value==="open"?"held":"open"); return; }
      const act = frameActionForKey(e, !!menuRef.current);
      if (!act) return;
      e.preventDefault(); e.stopPropagation();
      if (act.ref === "surface.open") { openFresh(); return; }
      if (act.ref === "surface.open-sources") { summonWorld(); return; }
      execute(act.ref, act.arg);
    };
    window.addEventListener("keydown", onLeader, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);
    return () => { window.removeEventListener("keydown", onLeader, true); window.removeEventListener("keydown", onKey); window.removeEventListener("contextmenu", onContext); };
  }, []);

  // Context-menu plumbing (D15): open exactly what is disclosed — an object
  // with no disclosed Actions opens no menu at all.
  const menuContext = (): MenuContext => ({
    state: stateRef.current,
    snapshot: restorePoint.current,
  });

  const openBindingMenu = (surfaceId: SurfaceId, x: number, y: number) => {
    const items = bindingDisclosures(menuContext(), surfaceId);
    if(kernel.transport.kind==="tauri") items.push({action_ref:"surface.detach",title:"Detach into native window",enabled:true});
    if (items.length === 0) return;
    setMenu({ x, y, items, surfaceId });
  };

  const openFrameMenu = (x: number, y: number) => {
    const items = frameDisclosures(menuContext());
    if (items.length === 0) return;
    setMenu({ x, y, items });
  };

  const invoke = (item: ActionDisclosure, surfaceId?: SurfaceId) => {
    setMenu(null);
    if(item.action_ref === "surface.detach") {void detach(surfaceId??activeBindingId(stateRef.current)??"");return;}
    if (item.action_ref === "frame.world") { summonWorld(); return; }
    setState((s) =>
      executeFrameAction(s, item.action_ref, { surfaceId }, restorePoint.current),
    );
  };

  const openKnowledgeRef=useRef(openKnowledge);openKnowledgeRef.current=openKnowledge;
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri") return;
    let disposed=false;const cleanups:(()=>void)[]=[];
    void import("@tauri-apps/api/event").then(async({listen})=>{
      const a=await listen<{workspace_id:string;binding:{id:string}}>("oi:window-redock",async e=>{
        detachedRequests.current.delete(`${e.payload.workspace_id}:${e.payload.binding.id}`);
        try { await kernel.apply({op:"state"}); }
        catch (reason) { setWindowError(`The view returned; its latest owner state could not be read: ${String(reason)}`); }
        workspaceRef.current.activate(e.payload.workspace_id);
        workspaceRef.current.redock(e.payload.workspace_id,e.payload.binding.id);
        setRedockFocus(e.payload.binding.id);
        try { const {invoke}=await import("@tauri-apps/api/core"); await invoke("window_focus_main"); }
        catch (reason) { setWindowError(`The view returned; focus the main window to continue: ${String(reason)}`); }
      });
      const b=await listen<{workspace_id:string;address:KnowledgeAddress;title:string;project?:string;placement?:"tab"|"page"|"window";graphOrigin?:string;request_id?:string;origin?:string}>("oi:window-navigate",async e=>{
        workspaceRef.current.activate(e.payload.workspace_id);
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        let error:string|undefined;
        try {
          await openKnowledgeRef.current(e.payload.address,e.payload.title,e.payload.project,e.payload.placement,e.payload.graphOrigin);
          const {invoke}=await import("@tauri-apps/api/core");
          if(!await invoke("window_focus_subject",{reference:e.payload.address.value}))await invoke("window_focus_main");
        }catch(reason){error=String(reason);setWindowError(error);}
        if(e.payload.request_id&&e.payload.origin){const {emitTo}=await import("@tauri-apps/api/event");await emitTo(e.payload.origin,"oi:window-navigate-result",{request_id:e.payload.request_id,error});}
      });
      const v=await listen<{workspace_id:string;surface_id:string;view:NonNullable<import("./surface/types").SurfaceBinding["view"]>}>("oi:surface-view",e=>{if(["Conversation","Activity","Context","Inspect"].includes(e.payload.view?.encounterPlane??""))workspaceRef.current.surfaceView(e.payload.workspace_id,e.payload.surface_id,e.payload.view);});
      const c=await listen<{workspace_id:string;surface_id:string;bounds:import("./surface/types").NativeWindowBounds}>("oi:window-bounds",e=>workspaceRef.current.windowBounds(e.payload.workspace_id,e.payload.surface_id,e.payload.bounds));
      if(disposed){a();b();c();v();}else cleanups.push(a,b,c,v);
    });
    void import("@tauri-apps/api/window").then(async({getCurrentWindow})=>{
      const cleanup=await getCurrentWindow().onFocusChanged(e=>{const id=activeBindingId(stateRef.current);if(e.payload&&id)void kernel.surfaceFocus(id);});
      if(disposed)cleanup();else cleanups.push(cleanup);
    });
    return()=>{disposed=true;cleanups.forEach(cleanup=>cleanup());};
  },[kernel.transport]);
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri") return;
    for(const w of workspace.workspaces) for(const d of w.layout.detached??[]) {
      const binding=w.layout.surfaces[d.surfaceId];const key=`${w.id}:${d.surfaceId}`;
      if(!binding || !kernel.snapshot.surfaces[binding.id] || detachedRequests.current.has(key)) continue;
      detachedRequests.current.add(key);
      void import("@tauri-apps/api/core").then(({invoke})=>invoke("window_detach",{workspaceId:w.id,binding,bounds:w.layout.windowBounds?.[binding.id]??null})).catch(error=>{detachedRequests.current.delete(key);setWindowError(String(error));});
    }
  },[workspace.workspaces,kernel.snapshot.surfaces,kernel.transport]);

  useEffect(()=>{
    if(!redockFocus || activeBindingId(state)!==redockFocus)return;
    const focus=()=>{
      const tab=Array.from(document.querySelectorAll<HTMLElement>(".tab")).find(el=>el.dataset.surfaceId===redockFocus);
      const pane=tab?.closest(".pane.group");
      const kind=state.surfaces[redockFocus]?.kind;
      const target=pane?.querySelector<HTMLElement>(kind === "encounter" ? ".encounter textarea" : kind === "source" || kind === "file" || kind === "flow" ? ".cm-content" : kind === "explore" || kind === "presentation" ? ".explore-strip input, .explore-strip button:not(:disabled)" : "[role=tabpanel] button,[role=tabpanel] [tabindex='0']");
      if(!target || target.matches(":disabled") || !document.hasFocus())return;
      target.focus();if(document.activeElement===target)setRedockFocus(undefined);
    };
    window.addEventListener("focus",focus);
    const observer=new MutationObserver(focus);
    observer.observe(document.getElementById("root")!,{childList:true,subtree:true,attributes:true,attributeFilter:["disabled"]});
    const frame=requestAnimationFrame(focus);
    return()=>{window.removeEventListener("focus",focus);observer.disconnect();cancelAnimationFrame(frame);};
  },[redockFocus,state]);

  const arrangementDispatch = useRef<(action:string)=>void>(()=>{});
  arrangementDispatch.current = action => {
    if(action==="workspace.new-tab"){openFresh();return;}
    if(action==="workspace.terminal"){openTerminal();return;}
    if(action==="workspace.browser-address"){const address=document.querySelector<HTMLInputElement>('.pane[data-focused="true"] .browser-address');if(address){address.focus();address.select();}else void openBrowser().catch(reason=>setWindowError(String(reason)));return;}
    if(action==="workspace.browser"){void openBrowser().catch(reason=>setWindowError(String(reason)));return;}
    if(action==="workspace.recover"){workspace.showRecovery();return;}
    if (action === "workspace.create" || action === "workspace.rename") { setNamingRequest(action === "workspace.create" ? "create" : "rename"); return; }
    if (action.startsWith("workspace.activate:")) { workspace.activate(action.slice("workspace.activate:".length)); return; }
    if (action === "region.left") { window.dispatchEvent(new Event("oi:toggle-central")); return; }
    if (action === "region.right") { setState(s=>({...s,rightDepth:s.rightDepth === "panel" ? "collapsed" : "panel"})); return; }
    execute(action);
  };
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri") return;
    let disposed=false;let cleanup:(()=>void)|undefined;
    void import("@tauri-apps/api/event").then(async({listen})=>{
      const unlisten=await listen<string>("oi:arrangement-action",e=>arrangementDispatch.current(e.payload));
      if(disposed)unlisten();else cleanup=unlisten;
    });
    return()=>{disposed=true;cleanup?.();};
  },[kernel.transport.kind]);
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri")return;
    let disposed=false;let cleanup:(()=>void)|undefined;
    void import("@tauri-apps/api/event").then(async({listen})=>{
      const unlisten=await listen<{bindingId:string}>("oi:detached-context",event=>{
        const known=workspaceRef.current.workspaces.some(w=>(w.layout.detached??[]).some(d=>d.surfaceId===event.payload.bindingId));
        if(known){window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:event.payload}));void import("@tauri-apps/api/core").then(({invoke})=>invoke("window_focus_main")).catch(reason=>setWindowError(String(reason)));}
      });
      if(disposed)unlisten();else cleanup=unlisten;
    });
    return()=>{disposed=true;cleanup?.();};
  },[kernel.transport.kind]);
  const arrangementNames=JSON.stringify(workspace.workspaces.map(({id,name})=>({id,name})));
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri") return;
    void import("@tauri-apps/api/core").then(({invoke})=>invoke("arrangement_menu",{arrangements:JSON.parse(arrangementNames),active:workspace.current.id})).catch(error=>setWindowError(String(error)));
  },[kernel.transport.kind,arrangementNames,workspace.current.id]);
  const subjectRef=kernel.snapshot.focus.subject?.ref;
  const subjectBuffer=subjectRef ? kernel.snapshot.buffers[subjectRef] : undefined;
  const subjectBinding=state.surfaces[activeBindingId(state)??""];
  const subjectTitle=subjectBinding?.title ?? "Context";
  const subjectHistory=subjectRef && subjectBuffer ? <SourceHistory key={subjectRef} sourceRef={subjectRef} revision={subjectBuffer.base_revision}/> : subjectBinding?.location ? <FileHistory key={subjectRef} location={subjectBinding.location}/> : undefined;
  const subjectHistoryAvailable=subjectBinding?.kind==="source" || subjectBinding?.kind==="file";
  // Factory centre Chat (handoff §9/§10): the SAME AgentChat the base-mode
  // panel mounts, bound to the mode's accompanying conversation. The session
  // observer is the one shared instance (encounter/session.ts); choosing a
  // conversation is the ordinary start/read pair, then the binding — the
  // centre IS the chat, no encounter tab, no second presenter.
  const factoryChatSession=useEncounterSession(state.accompanying?{project:state.accompanying.project,ref:state.accompanying.ref,space:state.accompanying.space}:undefined);
  const [factoryChoosing,setFactoryChoosing]=useState(false);
  const factoryChoose=async(row:EncounterRow)=>{
    setFactoryChoosing(true);
    try{
      await encounter(kernel.transport,row.project,{action:"start"});
      await encounter(kernel.transport,row.project,{action:"read",agent_session:row.ref,after:0,limit:1});
      setState(s=>({...s,accompanying:{ref:row.ref,project:row.project,space:row.space}}));
      // Opening a task moves the centre to Tasks with exactly that
      // conversation selected — the one task-open path, from the navigator,
      // the Run detail's carried conversations, or the chat's own chooser.
      publishCentreView("tasks");
    }catch(error){setWindowError(String(error));}
    finally{setFactoryChoosing(false);}
  };
  const factoryCentreProps:{project?:string;accompanying?:{ref:string;project:string;space:string};onOpenTask:(row:EncounterRow)=>Promise<void>;onMessage:(message:string)=>void}={
    project:workspace.current.project??state.accompanying?.project,
    accompanying:state.accompanying??undefined,
    onOpenTask:row=>factoryChoose(row),
    onMessage:message=>setWindowError(message),
  };
  const factoryCentre=
    <AgentChat session={factoryChatSession} accompanying={state.accompanying??undefined}
      project={workspace.current.project??state.accompanying?.project}
      agentName="Factory agent"
      situating={workspace.current.project?`Situated in ${workspace.current.project}`:"Situated in Central"}
      choosing={factoryChoosing}
      variant="centre"
      subject={{title:subjectTitle,location:subjectBinding?.location}}
      onMessage={message=>setWindowError(message)}
      onNewChat={()=>setState(s=>({...s,accompanying:undefined}))}
      onChoose={row=>factoryChoose(row)}/>;
  // Sidebar C6: the chat row for the encounter that is the active surface
  // reads as selected — `subjectBinding` above is already that binding.
  const activeEncounterRef=subjectBinding?.kind==="encounter" ? subjectBinding.ref : undefined;
  const summonAgent=()=>setState(s=>({...s,rightDepth:"panel"}));
  const mode:WorkspaceMode=state.mode??"base";
  // The retention warm set (WF4): the warm trees of the active workspace and
  // the recently visited ones, rendered whole and hidden at stable positions —
  // a mode swap or a workspace swap flips visibility, it never unmounts a
  // tree that carries a live document or an editor session.
  const warmTrees = useMemo(
    () => warmWorkspaceTrees(workspace.workspaces, workspace.current.id, mode),
    [workspace.workspaces, workspace.current.id, mode],
  );
  useEffect(() => {
    const log = (window as unknown as {__oiWarmTreesLog?: unknown[]}).__oiWarmTreesLog = (window as unknown as {__oiWarmTreesLog?: unknown[]}).__oiWarmTreesLog ?? [];
    log.push(warmTrees.map(t => t.key + (t.presented ? '!' : '')));
  }, [warmTrees]);
  const curation=MODE_CURATION[mode];
  // Owner correction 2026-09-18: Base keeps the pane/tab workbench; every
  // other mode DEDICATES its view — the mode's own surface, full screen, no
  // tab chrome. The base tree is preserved in the store and simply not
  // mounted while a mode stands (its heavy bodies cost nothing idle).
  const modeCentreKind=curation.centreKind;
  // The per-mode stage law (2026-09-20): each mode with a centre kind owns
  // one always-present stage slot, and the slot presents the centre binding
  // living in THAT MODE'S OWN TREE (surface/retention.tsx centreBindingOf).
  // The slot mounts the body directly — no adoption, no DOM move — so a
  // mode round trip flips visibility and the hosted application keeps its
  // document and in-memory state. A centre opened outside its own mode's
  // tree is pane-tab-presented: the pane's own wrapper mounts the body in
  // place (surface/retention.tsx, spec §7.1 — the park is retired).
  const stageCentres=STAGE_MODES.map(stageMode=>({mode:stageMode,binding:centreBindingOf(workspace.current,mode,stageMode)}));
  const modeCentreBinding=stageCentres.find(centre=>centre.mode===mode)?.binding;
  // The hosted engine's checkpoint (§7.2): the stage slot follows the
  // application's own oi-app-state announcements and writes the current
  // expression ref onto the binding — debounced, and only on change —
  // through the store's surfaceEngine. The checkpoint is a REF into the
  // person's saved work (the id the app's own ?expression= boot grammar
  // resolves), never a copy of app content; writing it never gates or
  // blocks the application. The Technè centre is the same hosted
  // application in its deep cut, so the same checkpoint covers it; the
  // wiki-projection state elsewhere in Technè is kernel-backed and needs
  // no renderer checkpoint.
  const engineWrites=useRef(new Map<string,{timer?:number;last?:string}>());
  const writeEngineCheckpoint=useCallback((bindingId:string,state:HostedAppState)=>{
    const documentId=state.document?.id;
    if(!documentId)return;
    const checkpoint={expressionRef:documentId,documentId};
    const key=JSON.stringify(checkpoint);
    const entry=engineWrites.current.get(bindingId);
    if(entry?.last===key)return;
    if(entry?.timer)window.clearTimeout(entry.timer);
    const timer=window.setTimeout(()=>{
      engineWrites.current.set(bindingId,{timer:undefined,last:key});
      workspaceRef.current.surfaceEngine(workspaceRef.current.current.id,bindingId,checkpoint);
    },400);
    engineWrites.current.set(bindingId,{timer,last:entry?.last});
  },[]);
  const engineCallbacks=useRef(new Map<string,(state:HostedAppState)=>void>());
  const engineCallbackFor=useCallback((bindingId:string)=>{
    let callback=engineCallbacks.current.get(bindingId);
    if(!callback){callback=(state:HostedAppState)=>writeEngineCheckpoint(bindingId,state);engineCallbacks.current.set(bindingId,callback);}
    return callback;
  },[writeEngineCheckpoint]);
  // Owner ruling 2026-09-19 (portal prerequisites): the dedicated stage
  // stands while the mode's tree carries ONLY its centre. The moment the
  // tree holds any other surface — a knowledge page opened from Instrument
  // 0, a portal placement — the ordinary Workbench presents that tree: the
  // centre stays in it as a tab (the same SurfaceBody), and the opened
  // surface carries the workbench's own placement grammar — beside, full,
  // detach, re-dock — never a modal dead-end. Closing the extra surfaces
  // returns the mode to its dedicated stage.
  // Owner ruling 2026-09-19, second pass: the dedicated stage is UNCONDITIONAL
  // in the modes that have one. The tree keeps hosting mode-specific tabs as a
  // hidden state — the agent manages them — and they surface in the panel's
  // Active Context; the human's full-page mode experience never un-fullscreens.
  const modeSoloStage=!!modeCentreKind;
  const panelSubject={ref:subjectRef??subjectBinding?.ref,kind:subjectBinding?.kind,title:subjectTitle,project:subjectBinding?.project ?? subjectBuffer?.project,location:subjectBinding?.location};
  const report=(reason:unknown)=>setWindowError(String(reason instanceof Error?reason.message:reason));

  // Close the menu on any pointerdown outside it.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".ctx-menu")) setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  /** The ONE accompanying agent layer in the right region, every mode. */
  // Factory's sidebar host (handoff §4/§9): the real shell ways a sidebar
  // control reaches the rest of the app — focus the centre's full run view,
  // switch its own top-level plane, open a conversation as the centre Chat.
  // Factory's sidebar host (handoff §4/§9): the real shell ways a sidebar
  // control reaches the rest of the app — take the panel to full depth with
  // the Run plane forward (the fuller multi-lane monitor lives there, not on
  // a centre page), switch its own top-level plane, open a conversation as
  // the centre Chat.
  // The Epi-Logos world entrance (#375 amendment): entering binds the world
  // context (corpus/profile/navigation basis — the context every arrangement
  // then retains, with its return trail) and opens the curated Epi surface as
  // the mode centre; leaving is the explicit act that clears it. The footer
  // state follows the world context, so the two can never disagree.
  const epiWorldActive=()=>workspaceRef.current.current.context?.world==="epi-logos";
  const enterEpiWorld=()=>{
    workspaceRef.current.setContext(context=>({...context,world:"epi-logos"}));
    setState(s=>({...s,epiLogos:true}));
    void openModeSurface("epi-logos").catch(report);
  };
  const leaveEpiWorld=()=>{
    workspaceRef.current.setContext(context=>({...context,world:undefined}));
    setState(s=>({...s,epiLogos:undefined}));
  };
  const factoryPanelHost:FactoryPanelHost={onOpenFullRun:()=>{setState(s=>{const plane=s.panelPlanes?.factory==="run"?s:{...s,panelPlanes:{...s.panelPlanes,factory:"run"}};return s.rightDepth==="full"?plane:{...plane,rightDepth:"full"};});},
    onExpandPanel:()=>setState(s=>s.rightDepth==="full"?s:{...s,rightDepth:"full"}),
    onOpenPlane:plane=>setState(s=>s.panelPlanes?.factory===plane?s:{...s,panelPlanes:{...s.panelPlanes,factory:plane}}),
    onOpenEncounterRow:(row:EncounterRow)=>void openEncounter(row).catch(report)};
  // The centre canvas's own pane openings, lent to the Ta-Onta Context plane
  // (expressions / techne / factory): hold the open file in the panel, or
  // open a file, a browser or a terminal in the centre exactly as the shell
  // does. The canvas law (owner, 2026-09-19): an open asked from the sidebar
  // canvas lands THERE, and in these modes any person-open asked without a
  // canvas lands there too — never behind the mode's dedicated stage in the
  // workspace's hidden panes.
  const taPaneOpens:TaPaneOpens={
    sideTabs:(state.sidePane?.tabs??[]).map(id=>({id,title:state.surfaces[id]?.title??id,kind:state.surfaces[id]?.kind??"blank",active:state.sidePane?.active===id})),
    activateTab:(id)=>{if(state.sidePane?.tabs.includes(id))setState(s=>s.sidePane?{...s,sidePane:{...s.sidePane,active:id}}:s);},
    sideHost:(()=>{const sideGroup=state.sidePane??{type:"group" as const,id:"side-panel",tabs:[],pinned:[],active:null};return (
      <GroupPane group={sideGroup} pane={sideGroup} state={state} menuOpen={!!menu} execute={sideExecute}
        kernelDirty={ref=>!!ref&&!!kernel.snapshot.buffers[ref]?.dirty} openBindingMenu={openBindingMenu} openFrameMenu={openFrameMenu}
        openSource={source=>void openSource(source,undefined,"side").catch(report)}
        openKnowledge={(address,title,project,placement,graphOrigin)=>openKnowledge(address,title,project,placement,graphOrigin,"side")}
        openPresentation={(ref,title,meta)=>openPresentation(ref,title,meta,"side")}
        openExplore={select=>openExplore(select,"side")}
        onView={(id,view)=>workspace.surfaceView(workspace.current.id,id,view)}
        openEncounter={row=>openEncounter(row,"side").catch(report)}
        factoryCentre={factoryCentre} factoryTasks={factoryCentreProps}
        subject={workspace.current.context?.subject}
        nativeWindows={kernel.transport.kind==="tauri"}
        workspaceName={workspace.current.name}/>);})(),
  };
  const agentLayer=<AgentLayer mode={mode} plane={state.panelPlanes?.[mode]} onPlane={plane=>setState(s=>s.panelPlanes?.[mode]===plane?s:{...s,panelPlanes:{...s.panelPlanes,[mode]:plane}})} extraPlanes={modeExtraPlanes(mode,panelSubject,state.accompanying,message=>setWindowError(message),factoryPanelHost,state.rightDepth==="full",taPaneOpens)} onError={report}
    onOpenConversation={accompanying=>void openConversationInCentre(accompanying).catch(report)}
    onOpenSubject={subject=>{if(subject.location){void openFile(subject.location).catch(report);return;}const held=Object.values(stateRef.current.surfaces).find(binding=>!!subject.ref&&binding.ref===subject.ref);if(held)execute("surface.activate",{surfaceId:held.id});}}
    resolveSurface={id=>stateRef.current.surfaces[id]??Object.assign({},...workspace.workspaces.map(w=>w.layout.surfaces))[id]}
    project={workspace.current.project} subject={{ref:subjectRef,kind:subjectBinding?.kind,title:subjectTitle,project:subjectBinding?.project ?? subjectBuffer?.project,location:subjectBinding?.location,dirty:subjectBuffer?.dirty,revision:subjectBuffer?.base_revision}} history={subjectHistory} historyAvailable={subjectHistoryAvailable} accompanying={state.accompanying} onAccompanying={value=>setState(s=>({...s,accompanying:value}))}
    full={state.rightDepth==="full"} onFull={()=>setState(s=>({...s,rightDepth:s.rightDepth==="full"?"panel":"full"}))}/>;
  const worldNavigator=(workspaceSelector:ReactNode)=><WorldNavigator onAgent={summonAgent} onMessage={message=>setWindowError(message)} onExplore={()=>void openExplore().catch(e=>setWindowError(String(e)))} mode={mode} onMode={enterMode} onOpenEncounter={openEncounter} centralFiles={workspace.current.centralFiles??false} onCentralFilesChange={workspace.setCentralFiles} workspaceSelector={workspaceSelector} searchShortcut={leader.label} key={workspace.current.id} projectNavigation={workspace.current.projectNavigation ?? {}} onNavigationChange={(ref,change)=>workspace.setProjectNavigation(ref,change,workspace.current.id)} onOpenFile={openFile} onProjectChange={workspace.browse} onOpenToday={openToday} onOpenWiki={(ref,title,project)=>openKnowledge({kind:"wiki",value:ref},title,project)} onSearch={()=>setSearchOpen(true)} activeEncounterRef={activeEncounterRef} onOpenFlowInstance={row=>openFlowInstance(row)} onNewFlow={()=>startWriting()} />;

  return (
    <>
      <ExpressionLayout layout={state}/>
      <DesktopShell onLibrary={()=>setLibrary(value=>value==="open"?"held":"open")} world={workspace.current.context?.world} onLeaveWorld={leaveEpiWorld} returnTo={workspace.current.context?.trail?.slice(-1)[0]} onReturn={()=>window.dispatchEvent(new Event("oi:context-return"))} mode={mode} onMode={enterMode} onTabPresentation={presentation=>execute(`frame.tabs:${presentation}`)} onToggleNavigator={()=>navigatorRef.current ? dismissWorld() : summonWorld()} onCloseNavigator={dismissWorld} native={kernel.transport.kind==="tauri"} namingRequest={namingRequest} onNamingHandled={()=>setNamingRequest(null)}
        arrangementActions={<ArrangementActions state={state} execute={execute} openFrameMenu={openFrameMenu} nativeWindows={kernel.transport.kind==="tauri"}/>}
        subject={{ref:subjectRef,title:subjectTitle,context:<><h2>{subjectTitle}</h2>{subjectBinding?.flow&&<p data-subject-flow-ref={subjectBinding.flow.flowRef}>Working through <code>{subjectBinding.flow.flowRef}</code></p>}{subjectBuffer ? <p>{subjectBuffer.project} · {subjectBuffer.dirty ? "Unsaved changes" : "Saved"}</p> : subjectBinding?.project ? <p>{subjectBinding.project}</p> : <p>Select a surface to inspect its context.</p>}</>,history:subjectHistory}}
        right={agentLayer}
        layout={state} setLayout={setState} workspace={workspace.current} workspaces={workspace.workspaces} activate={workspace.activate} create={workspace.create} rename={workspace.rename} onRecover={workspace.showRecovery} error={workspace.error ?? windowError ?? kernel.opError ?? null} onErrorDismiss={()=>{setWindowError(undefined); workspace.dismissError(); kernel.dismissOpError();}}
        epiLogos={state.epiLogos===true} onEpiLogosToggle={()=>{epiWorldActive()?leaveEpiWorld():enterEpiWorld();}}
        recovery={workspace.recovery} onRecoverAvailable={workspace.recoverAvailable} onStartFresh={workspace.startFresh} onReload={()=>workspace.reload()}
        navigator={workspaceSelector => curation.left==="factory" ? <FactoryNavigator project={workspace.current.project} accompanying={state.accompanying} onProjectChange={workspace.browse} onOpenEncounter={openEncounter} activeEncounterRef={activeEncounterRef} onMessage={message=>setWindowError(message)}/> : curation.left!=="world" ? <ModeLeftBody mode={mode} onOpenPlace={()=>void openModeSurface("epi-logos").catch(report)} project={workspace.current.project} onOpenExpressions={()=>void openModeSurface("expressions").catch(report)} onOpenTechne={()=>enterMode("techne")} onOpenFile={openFile} onMessage={message=>setWindowError(message)}/> : worldNavigator(workspaceSelector)}>
      {/* The modes' dedicated stages (surface/retention.tsx, stage law
        * 2026-09-20): one ALWAYS-PRESENT keyed slot per centre mode. Each
        * slot presents the centre binding living in its OWN mode's tree,
        * mounted DIRECTLY through ModeCentreBody: hidden while another mode
        * stands, never unmounted, never moved — moving a subtree that
        * contains an iframe detaches it and the iframe re-navigates (the
        * measured defect this replaces: the park-adopt stage,
        * docs/experience/evidence/mode-engine-state.before.json). */}
      {stageCentres.map(({mode: stageMode, binding}) => {
        const presented = stageMode === mode && !!binding;
        return (
          <div key={`mode-stage-${stageMode}`} className="mode-stage" data-mode-stage={stageMode} data-window-corner="true" hidden={!presented || undefined}>
            {binding && <StageCentreMark binding={binding} presented={presented}/>}
            {binding && <ModeCentreBody key={binding.id} binding={binding} subject={workspace.current.context?.subject} factoryCentre={factoryCentre} factoryTasks={factoryCentreProps} onHostedState={engineCallbackFor(binding.id)}/>}
          </div>
        );
      })}
      {/* The centre region renders as ONE stable sibling list — the rest
        * frame, the warm trees, and the stages above — never a branch.
        * Branching on state.root put the hosts at the branch's position 0,
        * so the root flip on a first mode visit REMOUNTED them (a remounted
        * MaterialSurface that mounts concealed can never latch first
        * presentation, and its document never loads). The ACTIVE tree being
        * empty (a fresh mode tree or a brand-new workspace — freshLayout()
        * has no root) only decides whether the rest frame paints; the hosts
        * render beside it at positions that never move, hidden by the same
        * law as always — with no active root nothing in them is presented. */}
      <div className="rest-host" hidden={!!state.root || undefined}>
        <RestPane>
          <Rest project={workspace.current.project} onWrite={startWriting} title={workspace.current.name} onSearch={()=>setSearchOpen(true)} onExplore={()=>void openExplore().catch(e=>setWindowError(String(e)))} onWiki={(() => {
            const reading=kernel.snapshot.navigator;
            const project=reading?.project?.project;
            const ref=project ? project.projectcentral.agent_wiki.wiki.space_ref : reading?.root?.control.agent_wiki.wiki.space_ref;
            return ref ? () => { void openKnowledge({kind:"wiki",value:ref},project ? `${project.name} wiki` : "Central wiki",project?.name).catch(e=>setWindowError(String(e))); } : undefined;
          })()} />
        </RestPane>
      </div>
      {/* The warm trees (surface/retention.tsx): every tree of the warm set
        * renders here at a STABLE position — the presented one visible, the
        * others mounted-hidden — so a mode or workspace swap flips
        * visibility instead of unmounting anything. The modes' stages stand
        * beside them as always-present keyed slots (above): the same
        * never-move law the trees follow. */}
      {warmTrees.map(tree => (
        <div key={tree.key} className="warm-tree-host" hidden={!tree.presented || !!(modeSoloStage && modeCentreBinding) || undefined}>
          <Workbench
            onView={(id,view)=>workspace.surfaceView(tree.workspaceId,id,view)}
            workspaceName={workspace.current.name}
            state={tree.layout}
            menuOpen={!!menu}
            execute={execute}
            openBindingMenu={openBindingMenu}
            openFrameMenu={openFrameMenu}
            openSource={openSource}
            openKnowledge={openKnowledge}
            openPresentation={openPresentation}
            openExplore={openExplore}
            openEncounter={row=>openEncounter(row).catch(report)}
            factoryCentre={factoryCentre}
            factoryTasks={factoryCentreProps}
            subject={workspace.current.context?.subject}
            nativeWindows={kernel.transport.kind==="tauri"}
          />
        </div>
      ))}
      </DesktopShell>
      {WalkChannel&&<WalkChannel layout={state}/>}
      <ContextTray bindings={{...Object.assign({},...workspace.workspaces.map(w=>w.layout.surfaces)),...state.surfaces}} accompanying={state.accompanying}/>
      {/* T2 summon seam: answers "oi:techne-summon" (library / verso / search)
        * through the same Library overlay and the verso account overlay. */}
      <TechneSummonSurface subject={workspace.current.context?.subject} trail={workspace.current.context?.trail} onOpenLibrary={()=>setLibrary("open")}/>
      {library!=="closed"&&<Suspense fallback={null}><div className="library-overlay" hidden={library!=="open"} role="dialog" aria-modal="true" aria-label="Library" onKeyDown={event=>{if(event.key==="Escape"&&!event.defaultPrevented){event.stopPropagation();setLibrary("held");}}}>
        <button className="library-scrim" aria-label="Close the Library" onClick={()=>setLibrary("held")}/>
        <div className="library-sheet"><LibraryBrowser mode={mode} onMessage={message=>setWindowError(message)} onOpen={(item,how)=>window.dispatchEvent(new CustomEvent("oi:library-open",{detail:{item,how}}))}/></div>
      </div></Suspense>}
      {searchOpen && <SearchOverlay leader={leader.shift} onLeaderChange={leader.change} shortcutError={leader.error} project={workspace.current.project} onClose={()=>setSearchOpen(false)} onOpen={openKnowledge} />}
      {Object.entries(surfaceErrors).map(([id, error]) => (
        <SurfaceErrorOverlay key={id} surfaceId={id} error={error} onRetry={() => retrySurfaceOpen(id)} />
      ))}
      {menu ? (
        <ContextMenu menu={menu} onInvoke={invoke} onClose={() => setMenu(null)} />
      ) : null}
    </>
  );
}

/** The empty workspace keeps the exact page geometry of a tabbed pane —
 * owner ruling 2026-09-17: the same tab-strip band, the same pane card and
 * the same window-corner cutouts, so rest never reads as an incomplete
 * page. The strip carries no bindings and no invented controls; the moment
 * a surface opens, the Workbench renders this same frame with tabs in it. */
function RestPane({ children }: { children: ReactNode }) {
  return <div className="workbench"><main className="surface-host" aria-label="Canvas">
    <section className="pane group focused" data-pane="group" data-window-corner="true" aria-label="Surface group">
      <div className="tab-strip" aria-hidden="true"><div className="tab-scroll"/></div>
      <div className="surface-body">{children}</div>
      <footer className="pane-status pane-footer" aria-label="Pane status"/>
    </section>
  </main></div>;
}

/** BOOT-09: portals a labelled failure + Retry into the DOM tabpanel of
 * whichever surface currently owns this id, using the same stable
 * `[data-surface-id]`/`.pane.group` selectors the frame already relies on
 * elsewhere (e.g. the redock-focus effect above) — never a second render
 * path into Workbench's own pane tree. Renders nothing while that surface
 * is not the active tab of its pane (a background tab is not mounted). */
function SurfaceErrorOverlay({ surfaceId, error, onRetry }: { surfaceId: string; error: string; onRetry: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const locate = () => {
      const tab = document.querySelector<HTMLElement>(`[data-surface-id="${surfaceId}"][data-active="true"]`);
      const body = tab?.closest(".pane.group")?.querySelector<HTMLElement>(".surface-body") ?? null;
      setHost((current) => (current === body ? current : body));
    };
    locate();
    const root = document.getElementById("root");
    if (!root) return;
    const observer = new MutationObserver(locate);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-active"] });
    return () => observer.disconnect();
  }, [surfaceId]);
  useEffect(() => {
    if (host && getComputedStyle(host).position === "static") host.style.position = "relative";
  }, [host]);
  if (!host) return null;
  return createPortal(
    // A surface's own failure stays in that surface (the footer carries
    // workspace messaging, not one tab's material): the named state, the
    // owner's words verbatim, and the one real next action.
    <div role="alert" className="surface-open-failure">
      <p>This binding could not be opened: {error}</p>
      <button className="oi-action" onClick={onRetry}>Retry</button>
    </div>,
    host,
  );
}
