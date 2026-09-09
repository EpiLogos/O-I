import {preservePresentation,latestRecovery} from "./recovery";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { redockBinding } from "../surface/engine";
import { decodeLayout } from "../surface/persist";
import { openBinding } from "../surface/engine";
import { freshLayout, type LayoutState } from "../surface/types";

export type ProjectMode = "chats" | "files" | "wiki";
export interface ProjectNavigation { expanded: boolean; scroll: number; directories?: string[]; mode?: ProjectMode; locationPath?: string }
export interface Workspace {
  id: string; name: string;
  /** Owner query restored by a native read; never imported as semantic focus. */
  project?: string;
  centralFiles?: boolean;
  layout: LayoutState; writing: string; writingMode?: boolean;
  /** Presentation keyed by the owner ProjectRef, never a cached authority reading. */
  projectNavigation?: Record<string, ProjectNavigation>;
}
interface WorkspaceBook { version: 1; active: string; workspaces: Workspace[] }
const KEY = "oi-cradle.workspaces.v1";
function scopeLegacyIds(layout:LayoutState,workspaceId:string,all=false):LayoutState {
  const id=(value:string)=>all||/^s[0-9]+$/.test(value)?`${workspaceId}:${value}`:value;
  const pane=(p:import("../surface/types").Pane):import("../surface/types").Pane=>p.type==="split"?{...p,children:p.children.map(pane)}:{...p,tabs:p.tabs.map(id),pinned:p.pinned.map(id),active:p.active?id(p.active):null};
  return {...layout,windowBounds:Object.fromEntries(Object.entries(layout.windowBounds??{}).map(([key,bounds])=>[id(key),bounds])),root:layout.root?pane(layout.root):null,surfaces:Object.fromEntries(Object.values(layout.surfaces).map(b=>[id(b.id),{...b,id:id(b.id)}])),closedStack:layout.closedStack.map(id),detached:layout.detached?.map(d=>({...d,surfaceId:id(d.surfaceId)}))};
}
/**
 * Writing used to live on the workspace record itself (`writing`), rendered by
 * a canvas that no longer exists. Any record still carrying that text — an old
 * saved arrangement, or one coming back through recovery — has its writing
 * carried into an unsaved-writing surface so it is actually restored and
 * visible, rather than surviving as a field nothing renders.
 */
function carryLegacyWriting(workspace: Workspace): Workspace {
  const text = typeof workspace.writing === "string" ? workspace.writing : "";
  if (!text.trim()) return workspace;
  const held = Object.values(workspace.layout.surfaces).some(binding => binding.kind === "draft");
  if (held) return workspace;
  const id = `${workspace.id}:carried-writing`;
  try { localStorage.setItem(`oi-cradle.unplaced-draft.v1:${id}`, JSON.stringify({ text, at: Date.now() })); }
  catch { return workspace; }
  const binding = { id, kind: "draft", title: "Draft", project: workspace.project };
  const layout = openBinding(workspace.layout, binding);
  return { ...workspace, writing: "", writingMode: false, layout };
}
const initialLayout = (): LayoutState => ({ ...freshLayout(), agencyDepth: "panel", rightDepth: "collapsed", leftWidth: 240, rightWidth: 320 });
function load(): WorkspaceBook {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.workspaces)) throw new Error("Unrecognized workspace format");
    const workspaces = parsed.workspaces.map((w: Workspace) => {
      if (typeof w.id !== "string" || typeof w.name !== "string" || typeof w.writing !== "string" || (w.project !== undefined && typeof w.project !== "string")) throw new Error("Invalid workspace record");
      const layout=decodeLayout(w.layout);
      if(!w.layout || typeof w.layout!=="object" || !w.layout.surfaces || Object.keys(w.layout.surfaces).length!==Object.keys(layout.surfaces).length || (w.layout.root && !layout.root))throw new Error("Some saved surface bindings could not be restored");
      const projectNavigation = Object.fromEntries(Object.entries(w.projectNavigation ?? {}).map(([ref, state]) => {
        if (!state || typeof state.expanded !== "boolean" || !Number.isFinite(state.scroll) || state.scroll < 0) throw new Error("Invalid project navigation state");
        if(state.directories !== undefined && (!Array.isArray(state.directories) || state.directories.some(path=>typeof path!=="string"))) throw new Error("Invalid directory expansion state");
        if (state.mode !== undefined && !["chats", "files", "wiki"].includes(state.mode)) throw new Error("Invalid project mode");
        return [ref, { expanded: state.expanded, scroll: state.scroll, directories: state.directories, mode: state.mode ?? "files", locationPath: state.locationPath }];
      }));
      return carryLegacyWriting({ projectNavigation, centralFiles: w.centralFiles === true, id: w.id, name: w.name, project: w.project, writing: w.writing, writingMode: false, layout: scopeLegacyIds(layout,w.id) });
    });
    if (!workspaces.length || new Set(workspaces.map((w: Workspace) => w.id)).size !== workspaces.length || !workspaces.some((w: Workspace) => w.id === parsed.active)) throw new Error("Invalid workspace selection");
    return { version: 1, active: parsed.active, workspaces };
  }
  const legacyRaw=localStorage.getItem("oi-cradle.layout.v1");
  let legacy=initialLayout();
  if(legacyRaw){
    const parsed=JSON.parse(legacyRaw);legacy=decodeLayout(parsed);
    if(!parsed || typeof parsed!=="object" || !parsed.surfaces || Object.keys(parsed.surfaces).length!==Object.keys(legacy.surfaces).length || (parsed.root&&!legacy.root))throw new Error("Legacy arrangement could not be restored");
  }
  return { version: 1, active: "root", workspaces: [{ id: "root", name: "Central", writing: "", layout: { ...initialLayout(), ...(legacy.root ? scopeLegacyIds(legacy,"root") : {}) } }] };
}
export function useWorkspaces() {
  const [error, setError] = useState<string | null>(null);
  const [recovery,setRecovery]=useState<{reason:string;key?:string}|null>(null);
  const [book, setBook] = useState<WorkspaceBook>(() => {
    try { return load(); } catch(error) { try{const record=preservePresentation(localStorage.getItem(KEY)?KEY:"oi-cradle.layout.v1",String(error));setRecovery({reason:String(error),key:record.key});}catch{setRecovery({reason:"Recovery data could not be copied. Original workspace storage is protected."});} return { version: 1, active: "recovery", workspaces: [{ id: "recovery", name: "Recovery workspace", writing: "", layout: initialLayout() }] }; }
  });
  const current = book.workspaces.find(w => w.id === book.active)!;
  const held = useRef(book); held.current = book;
  useEffect(() => {
    // A corrupt store is retained for recovery, never overwritten by fallback.
    if (book.active === "recovery" || (recovery && !recovery.key)) { setError("Saved workspaces could not be restored. The original data has been retained."); return; }
    try { localStorage.setItem(KEY, JSON.stringify(book)); setError(null); }
    catch { setError("Workspace changes could not be saved on this device."); }
  }, [book,recovery]);
  const update = (change: (w: Workspace) => Workspace) => setBook(b => ({ ...b, workspaces: b.workspaces.map(w => w.id === b.active ? change(w) : w) }));
  const setLayout = (change: SetStateAction<LayoutState>) => update(w => ({ ...w, layout: typeof change === "function" ? change(w.layout) : change }));
  const setWritingMode = (writingMode: boolean) => update(w => ({ ...w, writingMode }));
  const setWriting = (writing: string) => update(w => ({ ...w, writing }));
  const activate = (id: string) => setBook(b => b.workspaces.some(w => w.id === id) ? { ...b, active: id } : b);
  const create = (name: string) => {
    if (!name.trim() || (recovery && !recovery.key)) return;
    setBook(b => { const w: Workspace = { id: crypto.randomUUID(), name: name.trim(), writing: "", layout: initialLayout() }; return { ...b, active: w.id, workspaces: [...b.workspaces, w] }; });
  };
  const rename = (name: string) => { if (name.trim()) update(w => ({ ...w, name: name.trim() })); };
  const setCentralFiles = (centralFiles:boolean) => update(w=>({...w,centralFiles}));
  const browse = (project?: string) => update(w => ({ ...w, project }));
  /** Presentation writes name the workspace they were made in: a disclosure
   * or scroll that resolves after an owner round trip must land in that
   * workspace even when the active one has moved on. Defaults to the active
   * workspace only for callers that have no such origin. */
  const setProjectNavigation = (projectRef: string, change: Partial<ProjectNavigation>, workspaceId?: string) => setBook(b => ({
    ...b, workspaces: b.workspaces.map(w => w.id === (workspaceId ?? b.active) ? {
      ...w, projectNavigation: { ...w.projectNavigation, [projectRef]: { expanded: true, scroll: 0, ...w.projectNavigation?.[projectRef], ...change } }
    } : w)
  }));
  const windowBounds = (workspaceId:string,surfaceId:string,bounds:import("../surface/types").NativeWindowBounds) => setBook(b=>({...b,workspaces:b.workspaces.map(w=>w.id===workspaceId&&w.layout.surfaces[surfaceId]?{...w,layout:{...w.layout,windowBounds:{...w.layout.windowBounds,[surfaceId]:bounds}}}:w)}));
  const replaceSurface=(workspaceId:string,binding:import("../surface/types").SurfaceBinding)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>w.id===workspaceId&&w.layout.surfaces[binding.id]?{...w,layout:{...w.layout,surfaces:{...w.layout.surfaces,[binding.id]:binding}}}:w)}));
  const surfaceView=(workspaceId:string,id:string,view:NonNullable<import("../surface/types").SurfaceBinding["view"]>)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>w.id===workspaceId&&w.layout.surfaces[id]?{...w,layout:{...w.layout,surfaces:{...w.layout.surfaces,[id]:{...w.layout.surfaces[id],view}}}}:w)}));
  const redock = (workspaceId:string,surfaceId:string) => setBook(b=>({...b,workspaces:b.workspaces.map(w=>w.id===workspaceId?{...w,layout:redockBinding(w.layout,surfaceId)}:w)}));
  const startFresh=()=>{if(recovery&&!recovery.key)return;setBook({version:1,active:"root",workspaces:[{id:"root",name:"Central",writing:"",layout:initialLayout()}]});setRecovery(null);};
  const recoverAvailable=()=>{
    const saved=latestRecovery();if(!saved)return;
    try {
      const raw=JSON.parse(saved.raw);const candidates=Array.isArray(raw.workspaces)?raw.workspaces:saved.sourceKey==="oi-cradle.layout.v1"?[{name:"Recovered arrangement",layout:raw}]:[];
      const restored:Workspace[]=candidates.filter((w:unknown)=>w&&typeof w==="object").map((w:Workspace,index:number)=>{
        const id=crypto.randomUUID();
        const projectNavigation=Object.fromEntries(Object.entries(w.projectNavigation??{}).filter(([,state])=>state&&typeof state.expanded==="boolean"&&Number.isFinite(state.scroll)&&state.scroll>=0).map(([ref,state])=>[ref,{expanded:state.expanded,scroll:state.scroll,mode:state.mode&&["chats","files","wiki"].includes(state.mode)?state.mode:"chats",directories:Array.isArray(state.directories)?state.directories.filter(path=>typeof path==="string"):undefined,locationPath:typeof state.locationPath==="string"?state.locationPath:undefined}]));
        return carryLegacyWriting({id,name:typeof w.name==="string"?w.name:`Recovered ${index+1}`,project:typeof w.project==="string"?w.project:undefined,centralFiles:w.centralFiles===true,projectNavigation,writing:typeof w.writing==="string"?w.writing:"",writingMode:false,layout:scopeLegacyIds(decodeLayout(w.layout),id,true)});
      });
      if(!restored.length){setError("No complete workspace records could be recovered. The original bytes remain retained.");return;}
      setBook(book=>({version:1,active:restored[0].id,workspaces:[...book.workspaces.filter(workspace=>workspace.id!=="recovery"||!!workspace.writing),...restored]}));setRecovery(null);
    }catch{setError("The retained data is not readable as workspace records. It remains preserved for recovery.");}
  };
  const showRecovery=()=>{const saved=latestRecovery();if(saved)setRecovery({reason:saved.reason,key:saved.key});else setError("There is no retained workspace recovery record on this device.");};
  return { replaceSurface, surfaceView, showRecovery,recovery,startFresh,recoverAvailable, setCentralFiles, setProjectNavigation, windowBounds, redock, current, setWritingMode, workspaces: book.workspaces, setLayout, setWriting, activate, browse, create, rename, error };
}
