import {exactFactoryReviewView} from "./contributions/factory/factory-review-snapshot";
import {presentConversation,returnConversationToSide} from "./surface/conversation-placement";
import {exactDevelopmentFieldView} from "./surface/development-field-snapshot";
import {enterComposition,leaveComposition,presentBinding,selectCompositionCollection} from "./surface/composition";
import {matchesSurfaceRequest} from "./surface/binding-reuse";
import {FactoryLiveProvider,FactoryUpdates} from "./contributions/factory/FactoryLive";
import {resolveWorkingSurface,type WorkingSurfaceSelection} from "./encounter/working-surface";
import {SessionIngress} from "./encounter/SessionIngress";
import {ExpressionProvider,ExpressionLayout} from "./shared/Expression";
import {ExpressionStageProvider} from "./stage/ExpressionStage";
import {mintInstance,parseInstance,instanceFileName} from "./flow/instance";
import {userFlowsArea} from "./flow/instances";
import {fileOperation,type FileMutation} from "./files/client";
import {VisualsProvider} from "./visuals/ParticleExpression";
import {WelcomeField} from "./visuals/WelcomeField";
import {DRAFT_KEY} from "./flow/DraftSurface";
import {DOCUMENT_FORMS,resolveDocumentForm} from "./flow/documentForms";
import {ContextTray} from "./context/ContextTray";
import {FileHistory} from "./files/FileHistory";
import {encounter} from "./encounter/client";
import type {EncounterRow} from "./encounter/EncounterList";
import {AgentLayer} from "./agent/AgentLayer";
import {navigateExplore,type PresentationMeta} from "./explore/ExploreSurface";
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

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { DetachedFrame } from "./workspace/DetachedFrame";
import { readFile, readFileBytes } from "./files/client";
import { detectFormat } from "./material/detect";
import type { CentralLocation } from "./kernel/types";
import { WorldNavigator } from "./surfaces/navigator/WorldNavigator";
import { readDraft } from "./workspace/drafts";
import { DesktopShell } from "./workspace/DesktopShell";
import { useWorkspaces } from "./workspace/store";
import { useSearchLeader, matchesSearchLeader } from "./knowledge/leader";
import { SearchOverlay } from "./knowledge/SearchOverlay";
import { knowledge } from "./knowledge/client";
import type { KnowledgeAddress, KnowledgeReading } from "./kernel/types";
import { Rest } from "./Rest";
import { KernelProvider, useKernel } from "./kernel/KernelProvider";
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
  stepDepthDown,
} from "./surface/engine";
import type {
  ActionArg,
  ActionDisclosure,
  LayoutState,
  RestorePoint,
  SurfaceBinding,
  SurfaceId,
} from "./surface/types";
import { createPortal, flushSync } from "react-dom";

function snapshotOf(state: LayoutState): RestorePoint {
  return {
    composition: state.composition,
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

export function Cradle() {
  const [WalkChannel, setWalkChannel] = useState<ComponentType<{layout:LayoutState}> | null>(null);
  useEffect(() => {
    if (__CRADLE_WALK__) {
      void import("./walk/WalkChannel").then((module) => {
        setWalkChannel(() => module.WalkChannel);
      });
    }
  }, []);
  return (
    <KernelProvider>
      <VisualsProvider>
        <ExpressionStageProvider>
          <ExpressionProvider>
            {window.__OI_DETACHED__ ? <DetachedFrame /> : <CradleFrame WalkChannel={WalkChannel} />}
          </ExpressionProvider>
        </ExpressionStageProvider>
      </VisualsProvider>
    </KernelProvider>
  );
}

function CradleFrame({WalkChannel}:{WalkChannel:ComponentType<{layout:LayoutState}>|null}) {
  const kernel = useKernel();
  const leader = useSearchLeader();
  const [searchOpen,setSearchOpen] = useState(false);
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
  }, [workspace.current.id]);


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
    if (UNOWNED_SURFACE_KINDS.has(binding.kind)) { pendingMount.current.delete(binding.id); return; }
    try {
      if(binding.kind==="encounter" && binding.ref && binding.project){await encounter(kernel.transport,binding.project,{action:"start"});await encounter(kernel.transport,binding.project,{action:"read",agent_session:binding.ref,after:0,limit:1});}
      if (binding.kind === "file" && binding.location) await readFileBytes(kernel.transport,binding.location);
      if (binding.kind === "knowledge" && binding.address) await knowledge(kernel.transport,binding.project,{action:"read",address:binding.address});
      const opened = await kernel.apply({ op: "surface_open", surface_id: binding.id, kind: binding.kind, ...(binding.ref ? { source_ref: binding.ref } : {}), title: binding.title });
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
    const openIds = new Set([...groupsOf(state.root).flatMap((group) => group.tabs),...workspace.workspaces.flatMap(w=>(w.layout.detached??[]).map(d=>d.surfaceId))]);
    const bindings={...Object.assign({},...workspace.workspaces.map(w=>w.layout.surfaces)),...state.surfaces} as typeof state.surfaces;
    for (const surfaceId of openIds) {
      const binding = bindings[surfaceId];
      if (!binding || (kernelSurfaces[surfaceId] && kernelSurfaces[surfaceId].source_ref === binding.ref && kernelSurfaces[surfaceId].kind === binding.kind) || pendingMount.current.has(surfaceId)) {
        continue;
      }
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
    const change=()=>setState((s) => executeFrameAction(s, ref, arg, restorePoint.current));
    const transition=(document as Document & {startViewTransition?:(update:()=>void)=>unknown}).startViewTransition;
    if(ref==="surface.maximize"&&transition&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches)transition.call(document,()=>flushSync(change));
    else change();
  };

  /** Open a real source from the index listing: one layout binding carrying
   * the owner's canonical ref verbatim — the kernel mount effect opens the
   * buffer through the owner's read. */
  const openSource = async (source: ListedSource, project?: string) => {
    if(kernel.transport.kind==="tauri") {
      const {invoke}=await import("@tauri-apps/api/core");
      if(await invoke<boolean>("window_focus_subject",{reference:source.ref})) return;
    }
    const current = stateRef.current;
    const binding = makeSourceBinding(current, source.ref, source.path, project);
    if (groupsOf(current.root).some(g => g.tabs.includes(binding.id))) {
      execute("surface.activate", { surfaceId: binding.id });
      return;
    }
    setState((s) => presentBinding({ ...s, closedStack: s.closedStack.filter(id => id !== binding.id) }, makeSourceBinding(s, source.ref, source.path, project)));
  };

  const openEncounter=async(row:EncounterRow)=>{
    await encounter(kernel.transport,row.project,{action:"start"});
    await encounter(kernel.transport,row.project,{action:"read",agent_session:row.ref,after:0,limit:1});
    if(kernel.transport.kind==="tauri") {const {invoke}=await import("@tauri-apps/api/core");if(await invoke<boolean>("window_focus_subject",{reference:row.ref,project:row.project,space:row.space}))return;}
    const existing=Object.values(stateRef.current.surfaces).find(binding=>binding.kind==="encounter"&&binding.ref===row.ref&&binding.project===row.project&&binding.encounter?.space===row.space);
    const binding=existing??{id:crypto.randomUUID(),kind:"encounter",ref:row.ref,title:row.title,project:row.project,encounter:{space:row.space}};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("AIKit encounter surface could not be opened");
    setState(s=>presentConversation(s,binding));
  };

  const openFile = async (location:CentralLocation) => {
    // FND-04: a binary material format (image/pdf/an unsupported disposition)
    // would refuse `central.files.read`'s default UTF-8 contract outright,
    // so it is opened through the binary-safe `FileBytes` op instead of the
    // text `FileRead` one (the pre-read extension fallback — `detect.ts`'s
    // own documented purpose: "the pre-read decision — FileSurface must
    // choose a renderer before any owner round trip has happened" — is
    // exactly the tool for this choice). Either read still has to happen:
    // the kernel's `SurfaceOpen` gate requires the ref be registered by a
    // real owner-mediated read (`file_refs`, `kernel/src/lib.rs`) before a
    // surface for it may open, regardless of which read resolved it.
    // Text/HTML/Markdown keep the original owner-source dedup path
    // unchanged (only a text `FileReading` ever carries `source`).
    const format = detectFormat({path: location.path});
    const isBinaryMaterial = format === "image" || format === "pdf" || format === "unsupported";
    let ref = location.ref, project: string | undefined, resolvedLocation = location;
    if (isBinaryMaterial) {
      const read = await readFileBytes(kernel.transport,location);
      ref = read.location.ref; resolvedLocation = read.location;
    } else {
      const read = await readFile(kernel.transport,location);
      // A bound source opens as a source surface whether a project scope
      // holds it or not — a root-register Day document is a source with no
      // project, and its strips route by the ref's own register (null
      // project = the root register's receiving field).
      if(read.source) {openSource({...read.source,revision:read.revision},read.project?.name);return;}
      ref = read.location.ref; project = read.project?.name; resolvedLocation = read.location;
    }
    if(kernel.transport.kind==="tauri") {
      const {invoke}=await import("@tauri-apps/api/core");
      if(await invoke<boolean>("window_focus_subject",{reference:ref}))return;
    }
    const current=stateRef.current;
    const existing=Object.values(current.surfaces).find(binding=>binding.kind==="file"&&binding.ref===ref);
    const binding=existing??{id:crypto.randomUUID(),kind:"file",ref,title:resolvedLocation.path.split("/").pop()??"File",project,location:resolvedLocation};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"file",source_ref:binding.ref,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("Central file surface could not be opened");
    setState(state=>groupsOf(state.root).some(group=>group.tabs.includes(binding.id))?executeFrameAction(state,"surface.activate",{surfaceId:binding.id}):presentBinding({...state,closedStack:state.closedStack.filter(id=>id!==binding.id)},binding));
  };

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

  const openKnowledge = async (address: KnowledgeAddress, title: string, project?: string, placement: "tab"|"page"|"window" = "tab", graphOrigin?:string) => {
    if(placement==="window"&&kernel.transport.kind!=="tauri")throw new Error("Native popout is available in the desktop app");
    // Project wiki ownership is an exact Central disclosure, never inferred
    // from a label or parsed out of an opaque wiki reference.
    project = kernel.snapshot.navigator?.root?.work.projects.find(p=>p.projectcentral.agent_wiki.wiki.space_ref===address.value)?.name ?? project;
    if (!["wiki", "source", "project-map"].includes(address.kind)) throw new Error("This native knowledge body is not yet supported by the desktop");
    if(kernel.transport.kind==="tauri"&&placement==="tab") {
      const {invoke}=await import("@tauri-apps/api/core");
      if(await invoke<boolean>("window_focus_subject",{reference:address.value})) return;
    }
    const read = await knowledge<KnowledgeReading>(kernel.transport,project,{action:"read",address});
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="knowledge"&&b.ref===read.resource&&(!graphOrigin||b.view?.graphOrigin===graphOrigin)&&(b.view?.knowledgePlane==="page")===(placement!=="tab"));
    const binding:SurfaceBinding = existing ?? {id:crypto.randomUUID(),kind:"knowledge",ref:read.resource,title,project,address,...(placement!=="tab"?{view:{knowledgePlane:"page" as const,graphOrigin}}:{})};
    const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"knowledge",source_ref:binding.ref,title:binding.title});
    if (opened?.result !== "surface_opened") throw new Error("The native knowledge surface could not be opened");
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : presentBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
    if(placement==="window") {
      try {
        const {invoke}=await import("@tauri-apps/api/core");
        await invoke("window_detach",{workspaceId:workspaceRef.current.current.id,binding,bounds:stateRef.current.windowBounds?.[binding.id]??null});
        detachedRequests.current.add(`${workspaceRef.current.current.id}:${binding.id}`);
        setState(s=>detachBinding(s,binding.id));
      }catch(error){setWindowError(String(error));throw error;}
    }
    // Explicit successful navigation only. Refresh, restore and display do
    // not execute AIKit's route-use operation.
    await knowledge(kernel.transport,project,{action:"use",address});
  };

  /** D11: System is a canvas surface opened from the sidebar, never a
   * right-plane inspector — the accompanying agent is never displaced by it. */
  const openSystem = async () => {
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="system");
    const binding = existing ?? {id:crypto.randomUUID(),kind:"system",title:"System"};
    const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"system",source_ref:undefined,title:binding.title});
    if (opened?.result !== "surface_opened") throw new Error("The System surface could not be opened");
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };

  /** SF1: Explore — the stable global entrance to the open/shared field
   * (SHARED-FIELD-DESKTOP §1). One Explore Surface per arrangement,
   * opened/focused like System; workspace-independent view state lives in
   * its own remembered travel, never in the workspace's project. Opening
   * it discloses nothing to anyone and starts no AgentSession. */
  const openExplore = async (select?: {ref:string;title?:string}) => {
    if(select)navigateExplore({ref:select.ref});
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="explore");
    const binding = existing ?? {id:crypto.randomUUID(),kind:"explore",title:"Explore"};
    if(!kernel.snapshot.surfaces[binding.id]){
      const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"explore",source_ref:undefined,title:binding.title});
      if (opened?.result !== "surface_opened") throw new Error("The Explore surface could not be opened");
    }
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };
  /** SF1: one projected subject pinned as its own ordinary Surface, carrying
   * the exact refs it was opened with; split/full/detach/re-dock are the
   * frame's own grammar on this binding. */
  const openPresentation = async (ref:string,title:string,meta:PresentationMeta) => {
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="presentation"&&b.ref===ref);
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

  /// The Factory development reads surface (queue cell 3): the first 6D
  /// consumer, opened from the navigator like every global surface.
  const openFactoryDevelopment = async (project: string, projectRef?: string) => {
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="factory" && b.project===project);
    const binding: SurfaceBinding = existing ?? {id:crypto.randomUUID(),kind:"factory",title:`${project} · Runs`,project,ref:projectRef};
    const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"factory",source_ref:undefined,title:binding.title});
    if (opened?.result !== "surface_opened") throw new Error("The Factory development surface could not be opened");
    setState(s=>enterComposition(s,binding));
  };

  const openObservatory = async (row: import("./encounter/EncounterList").EncounterRow) => {
    const current=stateRef.current;
    const existing=Object.values(current.surfaces).find(b=>b.kind==="observatory"&&b.ref===row.ref&&b.project===row.project);
    const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:"observatory",ref:row.ref,project:row.project,title:row.title,encounter:{space:row.space}};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("Session Observatory could not be opened");
    setState(s=>presentBinding(s,binding));
  };

  const openWorkingSurface = async (selection:WorkingSurfaceSelection) => {
    const resolved=await resolveWorkingSurface(kernel.transport,selection);
    const existing=Object.values(stateRef.current.surfaces).find(surface=>surface.kind==="terminal"&&surface.ref===resolved.binding.surface&&surface.project===selection.project&&surface.terminal?.attachment?.binding===resolved.binding.binding);
    const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:"terminal",title:"Working Surface",project:selection.project,ref:resolved.binding.surface,terminal:{attachment:{kind:"aikit-session-space-working-surface",space:selection.space,binding:resolved.binding.binding,serviceCwd:resolved.service_cwd}}};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("Working Surface could not be opened");
    setState(s=>presentBinding(s,binding));
  };

  const openSurfaceBinding = async (requested:SurfaceBinding, region:"centre"|"right"="centre") => {
    const existing=Object.values(stateRef.current.surfaces).find(surface=>matchesSurfaceRequest(surface,requested));
    const binding=existing??requested;
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("The selected Surface could not be opened");
    setState(s=>presentBinding(s,binding,region));
  };

  const openProjectNow = async (project:string,projectRef?:string) => {
    if(!projectRef)throw new Error("Central did not resolve this Project");
    const existing=Object.values(stateRef.current.surfaces).find(b=>b.kind==="project-now"&&b.ref===projectRef);
    const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:"project-now",title:`${project} · NOW`,project,ref:projectRef};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:undefined,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("Project NOW could not be opened");
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id))?executeFrameAction(s,"surface.activate",{surfaceId:binding.id}):presentBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };

  const openWorkingChanges=async(project:string,projectRef?:string)=>{
    const cwd=terminalCwd(project);
    if(!cwd||!projectRef)throw new Error("Central did not disclose this Project location.");
    const existing=Object.values(stateRef.current.surfaces).find(binding=>binding.kind==="development-field"&&binding.project===project&&binding.view?.developmentField?.cwd===cwd);
    const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:"development-field",title:"Working changes",project,ref:projectRef,view:{developmentField:{cwd}}};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("The working changes Surface could not be opened.");
    setState(state=>presentBinding(state,binding,state.composition?"right":"centre"));
  };

  const openProjectAgents = async (project: string, projectRef?: string) => {
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="agents" && b.project===project);
    const binding: SurfaceBinding = existing ?? {id:crypto.randomUUID(),kind:"agents",title:`${project} · Agents`,project,ref:projectRef};
    const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
    if (opened?.result !== "surface_opened") throw new Error("The Project Agents surface could not be opened");
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : presentBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
  };

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
    const form=DOCUMENT_FORMS.find(candidate=>candidate.kind===kind);
    if(form){await openFile(await resolveDocumentForm(kernel.transport,form,kernel.snapshot.navigator?.root?.work.projects));return;}
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
    const create=(event:Event)=>openFresh((event as CustomEvent<{groupId?:string}>).detail?.groupId);
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
  useEffect(()=>{
    if(kernel.transport.kind!=="tauri")return;
    const reconcile=()=>{
      const layouts=[stateRef.current,...workspaceRef.current.workspaces.filter(w=>w.id!==workspaceRef.current.current.id).map(w=>w.layout)];
      const live=layouts.flatMap(layout=>[...groupsOf(layout.root).flatMap(g=>g.tabs),...(layout.detached??[]).map(d=>d.surfaceId)]);
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
      const v=await listen<{workspace_id:string;surface_id:string;view:NonNullable<import("./surface/types").SurfaceBinding["view"]>}>("oi:surface-view",e=>{
        const held=workspaceRef.current.workspaces.find(workspace=>workspace.id===e.payload.workspace_id)?.layout.surfaces[e.payload.surface_id];
        const heldFactory=held?.view?.factory;
        const factory=heldFactory?.runRef&&(held?.kind==="factory-material"||held?.kind==="factory-handoff")
          ? exactFactoryReviewView(e.payload.view?.factory,{kind:held.kind,statePath:heldFactory.statePath,runRef:heldFactory.runRef,subjectRef:held.kind==="factory-material"?held.ref:undefined})
          : undefined;
        const heldDevelopment=held?.kind==="development-field"?held.view?.developmentField:undefined;
        const development=heldDevelopment&&typeof held?.project==="string"
          ? exactDevelopmentFieldView(e.payload.view?.developmentField,{project:held.project,cwd:heldDevelopment.cwd,requestedBase:heldDevelopment.baseRevision??"HEAD"})
          : undefined;
        if (development) workspaceRef.current.surfaceView(e.payload.workspace_id,e.payload.surface_id,{...held!.view,developmentField:development});
        else if(factory) workspaceRef.current.surfaceView(e.payload.workspace_id,e.payload.surface_id,{...held!.view,factory});
        else if(held?.kind==="encounter"&&["Conversation","Activity","Context","Inspect"].includes(e.payload.view?.encounterPlane??"")) workspaceRef.current.surfaceView(e.payload.workspace_id,e.payload.surface_id,{...held.view,encounterPlane:e.payload.view.encounterPlane});
      });
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
    if(action==="workspace.terminal"){const id=crypto.randomUUID();const project=workspaceRef.current.current.project??undefined;const binding:SurfaceBinding={id,kind:"terminal",title:"Terminal",project,terminal:{cwd:terminalCwd(project)}};setState(s=>openBinding(s,binding));return;}
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
  // Sidebar C6: the chat row for the encounter that is the active surface
  // reads as selected — `subjectBinding` above is already that binding.
  const activeEncounterRef=subjectBinding?.kind==="encounter" ? subjectBinding.ref : undefined;
  const [returnedHost,setReturnedHost]=useState<HTMLDivElement|null>(null);
  const [companionHost,setCompanionHost]=useState<HTMLDivElement|null>(null);
  const accompanyingBinding=groupsOf(state.root).map(group=>state.surfaces[group.active??""]).find(binding=>binding?.kind==="encounter"&&binding.ref===state.accompanying?.ref&&binding.project===state.accompanying?.project&&binding.encounter?.space===state.accompanying?.space);
  const accompanyingDetached=state.detached?.some(entry=>{const binding=state.surfaces[entry.surfaceId];return binding?.kind==="encounter"&&binding.ref===state.accompanying?.ref&&binding.project===state.accompanying?.project&&binding.encounter?.space===state.accompanying?.space;});
  const accompanyingTarget=accompanyingBinding?`[data-accompanying-host="${accompanyingBinding.id}"]`:state.composition||accompanyingDetached?"[data-accompanying-parking]":undefined;
  const summonAgent=()=>{
    if(state.composition&&state.accompanying)void openEncounter({...state.accompanying,title:"Conversation"}).catch(reason=>setWindowError(String(reason)));
    else setState(s=>({...s,rightDepth:"panel"}));
  };
  const leaveFactory=()=>setState(leaveComposition);
  const compositionControls=state.composition?<span className="composition-actions">
    {state.accompanying&&<button onClick={summonAgent}>Conversation</button>}
    <button onClick={leaveFactory}>Leave Factory</button>
  </span>:null;

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

  // Whether the welcome frontstate still stands between the app and the
  // person. It dissolves on the first click (or Escape); the workspace is
  // interactive the moment it lifts.
  const [welcomeUp, setWelcomeUp] = useState(true);

  return (
    <>
      <div data-accompanying-parking hidden/>
      <ExpressionLayout layout={state}/>
      {welcomeUp && <WelcomeField onEntered={()=>setWelcomeUp(false)}/>}
      {windowError && <p role="alert">{windowError}</p>}
      {workspace.recovery&&<section className="workspace-recovery" aria-label="Workspace recovery"><p>The saved arrangement could not be restored. Its original data is retained.</p><button disabled={!workspace.recovery.key} onClick={workspace.recoverAvailable}>Recover available workspaces</button><button disabled={!workspace.recovery.key} onClick={workspace.startFresh}>Start a fresh arrangement</button></section>}
      <FactoryLiveProvider binding={state.composition?state.surfaces[state.composition.bindingId]:undefined}>
      <DesktopShell companionHost={setCompanionHost} complementary={!!accompanyingBinding&&!state.composition} returnedHost={setReturnedHost} accompanyingTarget={accompanyingTarget} sessionIngress={<><FactoryUpdates onOpenRun={binding=>openFactoryDevelopment(binding.project!,binding.ref)} onOpenMaterial={(binding,selection)=>openSurfaceBinding({id:crypto.randomUUID(),kind:"factory-material",title:selection.label,project:binding.project,ref:selection.subjectRef,view:{factory:{statePath:binding.view!.factory!.statePath,runRef:binding.view!.factory!.runRef}}},"right")}/>{compositionControls}<SessionIngress project={workspace.current.project} selected={state.accompanying} onOpen={openObservatory}/></>} onToggleNavigator={()=>navigatorRef.current ? dismissWorld() : summonWorld()} onCloseNavigator={dismissWorld} native={kernel.transport.kind==="tauri"} namingRequest={namingRequest} onNamingHandled={()=>setNamingRequest(null)}
        arrangementActions={<ArrangementActions state={state} execute={execute} openFrameMenu={openFrameMenu} nativeWindows={kernel.transport.kind==="tauri"}/>}
        subject={{ref:subjectRef,title:subjectTitle,context:<><h2>{subjectTitle}</h2>{subjectBinding?.flow&&<p data-subject-flow-ref={subjectBinding.flow.flowRef}>Working through <code>{subjectBinding.flow.flowRef}</code></p>}{subjectBuffer ? <p>{subjectBuffer.project} · {subjectBuffer.dirty ? "Unsaved changes" : "Saved"}</p> : subjectBinding?.project ? <p>{subjectBinding.project}</p> : <p>Select a surface to inspect its context.</p>}</>,history:subjectHistory}}
        right={<AgentLayer onOpenWorkingSurface={openWorkingSurface} complementaryHost={accompanyingBinding&&!state.composition?companionHost:undefined} onReturnConversation={()=>accompanyingBinding&&setState(state=>returnConversationToSide(state,accompanyingBinding.id))} region={accompanyingTarget?"centre":"right"} project={workspace.current.project} subject={{ref:subjectRef,kind:subjectBinding?.kind,title:subjectTitle,project:subjectBinding?.project ?? subjectBuffer?.project,location:subjectBinding?.location,dirty:subjectBuffer?.dirty,revision:subjectBuffer?.base_revision}} history={subjectHistory} historyAvailable={subjectHistoryAvailable} accompanying={state.accompanying} onAccompanying={value=>setState(s=>({...s,accompanying:value}))} full={state.rightDepth==="full"} onFull={()=>setState(s=>({...s,rightDepth:s.rightDepth==="full"?"panel":"full"}))} onClose={()=>setState(s=>({...s,rightDepth:"collapsed"}))}/>}
        layout={state} setLayout={setState} workspace={workspace.current} workspaces={workspace.workspaces} activate={workspace.activate} create={workspace.create} rename={workspace.rename} onRecover={workspace.showRecovery} error={workspace.error}
        navigator={workspaceSelector => <WorldNavigator onOpenWorkingChanges={openWorkingChanges} onOpenProjectNow={openProjectNow} onOpenAgents={openProjectAgents} onAgent={summonAgent} onSystem={()=>void openSystem().catch(e=>setWindowError(String(e)))} onExplore={()=>void openExplore().catch(e=>setWindowError(String(e)))} onFactoryDevelopment={(project,ref)=>openFactoryDevelopment(project,ref)} onOpenEncounter={openEncounter} centralFiles={workspace.current.centralFiles??false} onCentralFilesChange={workspace.setCentralFiles} workspaceSelector={workspaceSelector} searchShortcut={leader.label} key={workspace.current.id} projectNavigation={workspace.current.projectNavigation ?? {}} onNavigationChange={(ref,change)=>workspace.setProjectNavigation(ref,change,workspace.current.id)} onOpenFile={openFile} onProjectChange={workspace.browse} onOpenToday={openToday} onOpenWiki={(ref,title,project)=>openKnowledge({kind:"wiki",value:ref},title,project)} onSearch={()=>setSearchOpen(true)} activeEncounterRef={activeEncounterRef} onOpenFlowInstance={row=>openFlowInstance(row)} onNewFlow={()=>startWriting()} />}>
      {state.root ? (
        <Workbench
          onOpenEncounter={openEncounter} onOpenWorkingSurface={openWorkingSurface} onOpenFile={openFile} onOpenBinding={binding=>openSurfaceBinding(binding,["factory-handoff","factory-material"].includes(binding.kind)?"right":"centre")} returnedHost={returnedHost} accompanying={state.accompanying}
          onView={(id,view)=>{
            workspace.surfaceView(workspace.current.id,id,view);
            if(state.surfaces[id]?.kind==="factory")setState(current=>selectCompositionCollection(current,id,view.factory?.runRef));
          }}
          workspaceName={workspace.current.name}
          state={state}
          menuOpen={!!menu}
          execute={execute}
          openBindingMenu={openBindingMenu}
          openFrameMenu={openFrameMenu}
          openSource={openSource}
          openKnowledge={openKnowledge}
          openPresentation={openPresentation}
          openExplore={openExplore}
          nativeWindows={kernel.transport.kind==="tauri"}
        />
      ) : (
        <Rest project={workspace.current.project} onWrite={startWriting} title={workspace.current.name} onSearch={()=>setSearchOpen(true)} onExplore={()=>void openExplore().catch(e=>setWindowError(String(e)))} onWiki={(() => {
          const reading=kernel.snapshot.navigator;
          const project=reading?.project?.project;
          const ref=project ? project.projectcentral.agent_wiki.wiki.space_ref : reading?.root?.control.agent_wiki.wiki.space_ref;
          return ref ? () => { void openKnowledge({kind:"wiki",value:ref},project ? `${project.name} wiki` : "Central wiki",project?.name).catch(e=>setWindowError(String(e))); } : undefined;
        })()} />
      )}
      </DesktopShell>
      </FactoryLiveProvider>
      {WalkChannel&&<WalkChannel layout={state}/>}
      <ContextTray bindings={{...Object.assign({},...workspace.workspaces.map(w=>w.layout.surfaces)),...state.surfaces}} accompanying={state.accompanying}/>
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
    <div
      role="alert"
      className="surface-open-failure"
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "1.5rem", textAlign: "center" }}
    >
      <p>This binding could not be opened: {error}</p>
      <button onClick={onRetry}>Retry</button>
    </div>,
    host,
  );
}
