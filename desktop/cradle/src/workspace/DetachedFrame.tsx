import {EncounterSurface} from "../encounter/EncounterSurface";
import {useEffect,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {emitTo,listen} from "@tauri-apps/api/event";
import {getCurrentWindow} from "@tauri-apps/api/window";
import {SearchOverlay} from "../knowledge/SearchOverlay";
import {useSearchLeader,matchesSearchLeader} from "../knowledge/leader";
import type {KnowledgeAddress} from "../kernel/types";
import {useKernel} from "../kernel/KernelProvider";
import {FileSurface} from "../files/FileSurface";
import {SourceSurface} from "../surface/SourceSurface";
import {KnowledgeSurface} from "../knowledge/KnowledgeSurface";
import {SystemPanel} from "./SystemPanel";
import type {SurfaceBinding} from "../surface/types";
import "./shell.css";
declare global { interface Window { __OI_DETACHED__?: boolean } }
export function DetachedFrame() {
  const kernel=useKernel();
  const leader=useSearchLeader();
  const [searchOpen,setSearchOpen]=useState(false);
  const [record,setRecord]=useState<{workspace_id:string;binding:SurfaceBinding}>();
  const [error,setError]=useState<string>();
  useEffect(()=>{void invoke<{workspace_id:string;binding:SurfaceBinding}>("window_binding").then(r=>{try {const book=JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1")??"null");const view=book?.workspaces?.find((w:{id:string})=>w.id===r.workspace_id)?.layout?.surfaces?.[r.binding.id]?.view;if(["Conversation","Activity","Context","Inspect"].includes(view?.encounterPlane))r.binding={...r.binding,view};}catch{/* The main workspace owns recovery. */}setRecord(r);void kernel.surfaceFocus(r.binding.id);}).catch(e=>setError(String(e)));},[]);
  const updateView=async(view:NonNullable<SurfaceBinding["view"]>)=>{
    if(!record)return;
    try{await emitTo("main","oi:surface-view",{workspace_id:record.workspace_id,surface_id:record.binding.id,view});setRecord({...record,binding:{...record.binding,view}});}catch(error){setError(String(error));}
  };
  const redock=()=>{void invoke("window_redock").catch(e=>setError(String(e)));};
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(matchesSearchLeader(e,leader.current.current)){e.preventDefault();setSearchOpen(true);return;}if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.code==="KeyD"){e.preventDefault();redock();}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
  const navigate=async(address:KnowledgeAddress,title:string,project?:string)=>{
    if(!record)throw new Error("Detached workspace is unavailable");
    const request_id=crypto.randomUUID();
    let cleanup=()=>{};let timer:ReturnType<typeof setTimeout>|undefined;
    try {
      const result=new Promise<void>((resolve,reject)=>{
        void listen<{request_id:string;error?:string}>("oi:window-navigate-result",event=>{
          if(event.payload.request_id!==request_id)return;
          event.payload.error?reject(new Error(event.payload.error)):resolve();
        }).then(unlisten=>{
          cleanup=unlisten;
          timer=setTimeout(()=>reject(new Error("Workspace navigation has not been confirmed. Check the main window before retrying.")),30000);
          void emitTo("main","oi:window-navigate",{workspace_id:record.workspace_id,address,title,project,request_id,origin:getCurrentWindow().label}).catch(reject);
        }).catch(reject);
      });
      await result;
    }finally{if(timer)clearTimeout(timer);cleanup();}
  };
  return <div className="desktop-shell detached-shell"><header className="desktop-bar"><strong className="desktop-brand">O-I</strong><span>{record?.binding.title}</span><button onClick={redock}>Re-dock</button></header>{error&&<p role="alert">{error}</p>}
    <main className="desktop-centre">{record?.binding.kind==="encounter"?<EncounterSurface key={record.binding.id} binding={record.binding} onView={view=>void updateView(view)} presentation="tab"/>:record?.binding.kind==="file"?<FileSurface key={record.binding.id} binding={record.binding}/>:record?.binding.kind==="source"?<SourceSurface binding={record.binding}/>:record?.binding.kind==="system"?<SystemPanel key={record.binding.id} binding={record.binding}/>:record&&<KnowledgeSurface binding={record.binding} onOpen={navigate}/>}</main>
    {searchOpen&&<SearchOverlay leader={leader.shift} onLeaderChange={leader.change} shortcutError={leader.error} project={record?.binding.project} onClose={()=>setSearchOpen(false)} onOpen={navigate}/>}
  </div>;
}
