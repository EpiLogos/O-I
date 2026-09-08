import {ExpressionProvider,ExpressionLayout} from "./shared/Expression";
import {flow} from "./flow/client";
import {ContextTray} from "./context/ContextTray";
import {FileHistory} from "./files/FileHistory";
import {encounter} from "./encounter/client";
import type {EncounterRow} from "./encounter/EncounterList";
import {AgentLayer} from "./agent/AgentLayer";
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
      <ExpressionProvider>
      {window.__OI_DETACHED__ ? <DetachedFrame /> : <CradleFrame WalkChannel={WalkChannel} />}
    </ExpressionProvider>
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
  const { writing } = workspace.current;
  const setWriting = workspace.setWriting;
  const state = workspace.current.layout;
  const setState = workspace.setLayout;
  const navigatorOpen = state.agencyDepth === "panel" || state.agencyDepth === "full";
  const setNavigatorOpen = (open: boolean) => setState(s => ({ ...s, agencyDepth: open ? "panel" : "strip" }));
  const navigatorRef = useRef(false);
  navigatorRef.current = navigatorOpen;
  const returnFocus = useRef<HTMLElement | null>(null);
  const rememberWorkFocus = () => {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && active.closest(".workspace-canvas,.canvas-surface,.pane") && !active.closest(".ctx-menu,.world-navigator")) {
      returnFocus.current = active;
    } else if (!returnFocus.current?.isConnected) {
      returnFocus.current = document.querySelector<HTMLElement>(".pane.focused .source-textarea,.canvas-surface");
    }
  };
  const summonWorld = () => {
    rememberWorkFocus();
    setNavigatorOpen(true);
  };
  const dismissWorld = () => {
    setNavigatorOpen(false);
    requestAnimationFrame(() => {
      const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>(".pane.focused .source-textarea,.canvas-surface");
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
  const mountSurface = useCallback(async (binding: SurfaceBinding) => {
    try {
      if(binding.kind==="encounter" && binding.ref && binding.project){await encounter(kernel.transport,binding.project,{action:"start"});await encounter(kernel.transport,binding.project,{action:"read",agent_session:binding.ref,after:0,limit:1});}
      if (binding.kind === "file" && binding.location) await readFileBytes(kernel.transport,binding.location);
      if (binding.kind === "knowledge" && binding.address) await knowledge(kernel.transport,binding.project,{action:"read",address:binding.address});
      const opened = await kernel.apply({ op: "surface_open", surface_id: binding.id, kind: binding.kind, ...(binding.ref ? { source_ref: binding.ref } : {}), title: binding.title });
      if (opened?.result !== "surface_opened") throw new Error("This surface could not be opened");
      if (binding.kind === "source" && binding.ref) {
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
    setState((s) => openBinding({ ...s, closedStack: s.closedStack.filter(id => id !== binding.id) }, makeSourceBinding(s, source.ref, source.path, project)));
  };

  const openEncounter=async(row:EncounterRow)=>{
    await encounter(kernel.transport,row.project,{action:"start"});
    await encounter(kernel.transport,row.project,{action:"read",agent_session:row.ref,after:0,limit:1});
    if(kernel.transport.kind==="tauri") {const {invoke}=await import("@tauri-apps/api/core");if(await invoke<boolean>("window_focus_subject",{reference:row.ref}))return;}
    const existing=Object.values(stateRef.current.surfaces).find(binding=>binding.kind==="encounter"&&binding.ref===row.ref);
    const binding=existing??{id:crypto.randomUUID(),kind:"encounter",ref:row.ref,title:row.title,project:row.project,encounter:{space:row.space}};
    const opened=await kernel.apply({op:"surface_open",surface_id:binding.id,kind:binding.kind,source_ref:binding.ref,title:binding.title});
    if(opened?.result!=="surface_opened")throw new Error("AIKit encounter surface could not be opened");
    setState(state=>groupsOf(state.root).some(group=>group.tabs.includes(binding.id))?executeFrameAction(state,"surface.activate",{surfaceId:binding.id}):openBinding({...state,closedStack:state.closedStack.filter(id=>id!==binding.id)},binding));
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
      if(read.source && read.project) {openSource({...read.source,revision:read.revision},read.project.name);return;}
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
    setState(state=>groupsOf(state.root).some(group=>group.tabs.includes(binding.id))?executeFrameAction(state,"surface.activate",{surfaceId:binding.id}):openBinding({...state,closedStack:state.closedStack.filter(id=>id!==binding.id)},binding));
  };

  const openKnowledge = async (address: KnowledgeAddress, title: string, project?: string) => {
    // Project wiki ownership is an exact Central disclosure, never inferred
    // from a label or parsed out of an opaque wiki reference.
    project = kernel.snapshot.navigator?.root?.work.projects.find(p=>p.projectcentral.agent_wiki.wiki.space_ref===address.value)?.name ?? project;
    if (!["wiki", "source", "project-map"].includes(address.kind)) throw new Error("This native knowledge body is not yet supported by the desktop");
    if(kernel.transport.kind==="tauri") {
      const {invoke}=await import("@tauri-apps/api/core");
      if(await invoke<boolean>("window_focus_subject",{reference:address.value})) return;
    }
    const read = await knowledge<KnowledgeReading>(kernel.transport,project,{action:"read",address});
    const current = stateRef.current;
    const existing = Object.values(current.surfaces).find(b=>b.kind==="knowledge"&&b.ref===read.resource);
    const binding = existing ?? {id:crypto.randomUUID(),kind:"knowledge",ref:read.resource,title,project,address};
    const opened = await kernel.apply({op:"surface_open",surface_id:binding.id,kind:"knowledge",source_ref:binding.ref,title:binding.title});
    if (opened?.result !== "surface_opened") throw new Error("The native knowledge surface could not be opened");
    setState(s=>groupsOf(s.root).some(g=>g.tabs.includes(binding.id)) ? executeFrameAction(s,"surface.activate",{surfaceId:binding.id}) : openBinding({...s,closedStack:s.closedStack.filter(id=>id!==binding.id)},binding));
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
  const freshChoice=async(id:string,kind:string,project?:string)=>{
    const workspaceId=workspaceRef.current.current.id;
    const current=stateRef.current.surfaces[id];if(!current)return;
    project=project??current.project??workspaceRef.current.current.project??undefined;
    if(kind==="search"){setSearchOpen(true);return;}
    let binding:SurfaceBinding={...current,project,kind,title:kind==="terminal"?"Terminal":"Browser"};
    if(kind==="flow"){
      if(!project)throw new Error("Choose a project for this Flow first");
      const created=await flow(kernel.transport,{action:"flow_create",project,actor:"desktop-user",actor_kind:"human",title:"Flow.md",path:`ProjectCentral/now/flows/${crypto.randomUUID()}/flow.md`});
      binding={...binding,title:"Flow.md",ref:created.flow.source_ref,flow:{flowRef:created.flow.flow_ref,path:created.flow.path}};
    }else if(kind==="terminal"){
      binding.terminal={cwd:terminalCwd(project)};
    }else if(kind==="browser"){binding.browser={url:""};}else{return;}
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
      if (matchesSearchLeader(e, leader.current.current)) { e.preventDefault(); setSearchOpen(true); return; }
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
      const act = frameActionForKey(e, !!menuRef.current);
      if (!act) return;
      e.preventDefault();
      if(act.ref==="surface.open"){openFresh();return;}
      if(act.ref==="surface.open-sources"){summonWorld();return;}
      execute(act.ref,act.arg);
    };
    const onContext = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".agency-field,.agency-column")) return;
      e.preventDefault();
      rememberWorkFocus();
      setMenu({ x: e.clientX, y: e.clientY, items: [{ action_ref: "frame.world", title: "World (⌘B)", enabled: true }] });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("contextmenu", onContext); };
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
      const b=await listen<{workspace_id:string;address:KnowledgeAddress;title:string;project?:string;request_id?:string;origin?:string}>("oi:window-navigate",async e=>{
        workspaceRef.current.activate(e.payload.workspace_id);
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        let error:string|undefined;
        try {
          await openKnowledgeRef.current(e.payload.address,e.payload.title,e.payload.project);
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
      const target=pane?.querySelector<HTMLElement>(kind === "encounter" ? ".encounter textarea" : kind === "source" || kind === "file" ? ".source-textarea" : "[role=tabpanel] button,[role=tabpanel] [tabindex='0']");
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
  const summonAgent=()=>setState(s=>({...s,rightDepth:"panel"}));

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

  return (
    <>
      <ExpressionLayout layout={state}/>
      {windowError && <p role="alert">{windowError}</p>}
      {workspace.recovery&&<section className="workspace-recovery" aria-label="Workspace recovery"><p>The saved arrangement could not be restored. Its original data is retained.</p><button disabled={!workspace.recovery.key} onClick={workspace.recoverAvailable}>Recover available workspaces</button><button disabled={!workspace.recovery.key} onClick={workspace.startFresh}>Start a fresh arrangement</button></section>}
      <DesktopShell onToggleNavigator={()=>navigatorRef.current ? dismissWorld() : summonWorld()} onCloseNavigator={dismissWorld} native={kernel.transport.kind==="tauri"} namingRequest={namingRequest} onNamingHandled={()=>setNamingRequest(null)}
        arrangementActions={<ArrangementActions state={state} execute={execute} openFrameMenu={openFrameMenu} nativeWindows={kernel.transport.kind==="tauri"}/>}
        subject={{ref:subjectRef,title:subjectTitle,context:<><h2>{subjectTitle}</h2>{subjectBuffer ? <p>{subjectBuffer.project} · {subjectBuffer.dirty ? "Unsaved changes" : "Saved"}</p> : subjectBinding?.project ? <p>{subjectBinding.project}</p> : <p>Select a surface to inspect its context.</p>}</>,history:subjectHistory}}
        right={<AgentLayer project={workspace.current.project} subject={{ref:subjectRef,kind:subjectBinding?.kind,title:subjectTitle,project:subjectBinding?.project ?? subjectBuffer?.project,location:subjectBinding?.location,dirty:subjectBuffer?.dirty,revision:subjectBuffer?.base_revision}} history={subjectHistory} historyAvailable={subjectHistoryAvailable} accompanying={state.accompanying} onAccompanying={value=>setState(s=>({...s,accompanying:value}))} full={state.rightDepth==="full"} onFull={()=>setState(s=>({...s,rightDepth:s.rightDepth==="full"?"panel":"full"}))} onClose={()=>setState(s=>({...s,rightDepth:"collapsed"}))}/>}
        layout={state} setLayout={setState} workspace={workspace.current} workspaces={workspace.workspaces} activate={workspace.activate} create={workspace.create} rename={workspace.rename} onRecover={workspace.showRecovery} error={workspace.error}
        navigator={workspaceSelector => <WorldNavigator onAgent={summonAgent} onSystem={()=>void openSystem().catch(e=>setWindowError(String(e)))} onOpenEncounter={openEncounter} centralFiles={workspace.current.centralFiles??false} onCentralFilesChange={workspace.setCentralFiles} workspaceSelector={workspaceSelector} searchShortcut={leader.label} key={workspace.current.id} projectNavigation={workspace.current.projectNavigation ?? {}} onNavigationChange={(ref,change)=>workspace.setProjectNavigation(ref,change,workspace.current.id)} onOpenFile={openFile} onProjectChange={workspace.browse} onOpenWiki={(ref,title,project)=>openKnowledge({kind:"wiki",value:ref},title,project)} onSearch={()=>setSearchOpen(true)} activeEncounterRef={activeEncounterRef} />}>
      {state.root ? (
        <Workbench
          onView={(id,view)=>workspace.surfaceView(workspace.current.id,id,view)}
          workspaceName={workspace.current.name}
          state={state}
          menuOpen={!!menu}
          execute={execute}
          openBindingMenu={openBindingMenu}
          openFrameMenu={openFrameMenu}
          openSource={openSource}
          openKnowledge={openKnowledge}
          nativeWindows={kernel.transport.kind==="tauri"}
        />
      ) : (
        <Rest value={writing} onChange={setWriting} writingMode={!!workspace.current.writingMode} onWritingMode={workspace.setWritingMode} title={workspace.current.name} onSearch={()=>setSearchOpen(true)} onWiki={(() => {
          const reading=kernel.snapshot.navigator;
          const project=reading?.project?.project;
          const ref=project ? project.projectcentral.agent_wiki.wiki.space_ref : reading?.root?.control.agent_wiki.wiki.space_ref;
          return ref ? () => { void openKnowledge({kind:"wiki",value:ref},project ? `${project.name} wiki` : "Central wiki",project?.name).catch(e=>setWindowError(String(e))); } : undefined;
        })()} />
      )}
      </DesktopShell>
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
