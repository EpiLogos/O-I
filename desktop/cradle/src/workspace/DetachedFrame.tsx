import {TerminalSurface} from "../terminal/TerminalSurface";
import {DraftSurface} from "../flow/DraftSurface";
import {FlowSurface} from "../flow/FlowSurface";
import {BrowserSurface} from "../browser/BrowserSurface";
import {EncounterSurface} from "../encounter/EncounterSurface";
import {useCallback,useEffect,useRef,useState} from "react";
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
  useEffect(()=>{
    if(!record)return;
    const include=(event:Event)=>{const candidate=(event as CustomEvent<{bindingId?:string}>).detail;if(candidate?.bindingId!==record.binding.id)return;void emitTo("main","oi:detached-context",candidate).catch(reason=>setError(String(reason)));};
    window.addEventListener("oi:context-candidate",include);
    return()=>window.removeEventListener("oi:context-candidate",include);
  },[record]);
  const [loading,setLoading]=useState(true);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [redocking,setRedocking]=useState(false);
  const redockingRef=useRef(false);
  const bodyRef=useRef<HTMLElement>(null);
  const interacted=useRef(false);
  useEffect(()=>{
    const mark=()=>{interacted.current=true;};
    window.addEventListener("pointerdown",mark,true);
    window.addEventListener("keydown",mark,true);
    return()=>{window.removeEventListener("pointerdown",mark,true);window.removeEventListener("keydown",mark,true);};
  },[]);
  useEffect(()=>{
    if(!record||interacted.current)return;
    const root=document.getElementById("root");
    if(!root)return;
    let frame=0,finished=false;
    const stop=()=>{finished=true;cancelAnimationFrame(frame);observer.disconnect();clearTimeout(deadline);window.removeEventListener("pointerdown",stop,true);window.removeEventListener("keydown",stop,true);};
    const focus=()=>{
      if(finished||interacted.current){stop();return;}
      const body=bodyRef.current;
      if(!body||root.hasAttribute("inert"))return;
      const active=document.activeElement;
      // Boot deliberately focuses #root. It is still ambient focus, while
      // any control the person has already chosen must keep its focus.
      if(active&&active!==document.body&&active!==root&&active!==body){stop();return;}
      const selector=record.binding.kind==="source"||record.binding.kind==="file"
        ? ".cm-content, .material-surface iframe, .material-surface button:not(:disabled)"
        :record.binding.kind==="encounter"
          ?record.binding.view?.encounterPlane&&record.binding.view.encounterPlane!=="Conversation"
            ?'.encounter-planes button[aria-pressed="true"]'
            :'.encounter-composer textarea:not(:disabled)'
          :'.knowledge-graph svg[tabindex], .knowledge-content';
      const target=body.querySelector<HTMLElement>(selector);
      if(!target||!target.getClientRects().length||target.closest('[inert], [hidden]'))return;
      if(!target.hasAttribute("tabindex")&&target.matches(".knowledge-content"))target.tabIndex=-1;
      // Keep the editor's own restored caret and scroll coordinates intact.
      target.focus({preventScroll:true});
      if(document.activeElement===target)stop();
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(focus);};
    const observer=new MutationObserver(schedule);
    observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["inert","disabled","hidden","aria-busy"]});
    // Slow owner reads can complete later, but this startup observer must
    // never remain attached for the entire window lifetime.
    const deadline=setTimeout(stop,30000);
    window.addEventListener("pointerdown",stop,true);
    window.addEventListener("keydown",stop,true);
    schedule();
    return stop;
  },[record?.binding.id]);
  useEffect(()=>{
    let disposed=false;
    setLoading(true);setError(undefined);
    void invoke<{workspace_id:string;binding:SurfaceBinding}>("window_binding").then(async r=>{
      // The native binding supplies the initial view. The workspace may
      // hold a newer plane after interaction in this window and a reload.
      try {
        const book=JSON.parse(localStorage.getItem("oi-cradle.workspaces.v1")??"null");
        const view=book?.workspaces?.find((w:{id:string})=>w.id===r.workspace_id)?.layout?.surfaces?.[r.binding.id]?.view;
        if(["Conversation","Activity","Context","Inspect"].includes(view?.encounterPlane))r.binding={...r.binding,view};
      }catch{/* The main workspace owns recovery. */}
      if(disposed)return;
      setRecord(r);
      await kernel.surfaceFocus(r.binding.id);
    }).catch(e=>{if(!disposed)setError(String(e));}).finally(()=>{if(!disposed)setLoading(false);});
    return()=>{disposed=true;};
  },[loadAttempt]);
  const updateView=async(view:NonNullable<SurfaceBinding["view"]>)=>{
    if(!record)return;
    setRecord(current=>current?{...current,binding:{...current.binding,view}}:current);
    try{await emitTo("main","oi:surface-view",{workspace_id:record.workspace_id,surface_id:record.binding.id,view});}
    catch(error){setError(String(error));}
  };
  const redock=useCallback(()=>{
    if(redockingRef.current)return;
    redockingRef.current=true;setRedocking(true);setError(undefined);
    void invoke("window_redock").catch(e=>{
      redockingRef.current=false;setRedocking(false);setError(String(e));
    });
  },[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(matchesSearchLeader(e,leader.current.current)){e.preventDefault();setSearchOpen(true);return;}if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.code==="KeyD"){e.preventDefault();redock();}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[redock]);
  const navigate=async(address:KnowledgeAddress,title:string,project?:string,placement?:"tab"|"page"|"window",graphOrigin?:string)=>{
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
          void emitTo("main","oi:window-navigate",{workspace_id:record.workspace_id,address,title,project,placement,graphOrigin,request_id,origin:getCurrentWindow().label}).catch(reject);
        }).catch(reject);
      });
      await result;
    }finally{if(timer)clearTimeout(timer);cleanup();}
  };
  return <div className="desktop-shell detached-shell"><header className="desktop-bar"><strong className="desktop-brand">O-I</strong><span>{record?.binding.title}</span><button onClick={redock} disabled={redocking}>{redocking?"Re-docking…":"Re-dock"}</button></header>{error&&<p role="alert">{error} {!record&&<button onClick={()=>setLoadAttempt(n=>n+1)} disabled={loading}>Retry opening surface</button>}</p>}
    <main ref={bodyRef} className="desktop-centre">{record?.binding.kind==="terminal"?<TerminalSurface binding={record.binding}/>:record?.binding.kind==="flow"?<FlowSurface binding={record.binding}/>:record?.binding.kind==="draft"?<DraftSurface binding={record.binding}/>:record?.binding.kind==="browser"?<BrowserSurface key={record.binding.id} binding={record.binding}/>:record?.binding.kind==="encounter"?<EncounterSurface key={record.binding.id} binding={record.binding} onView={view=>void updateView(view)} presentation="tab"/>:record?.binding.kind==="file"?<FileSurface key={record.binding.id} binding={record.binding}/>:record?.binding.kind==="source"?<SourceSurface binding={record.binding}/>:record?.binding.kind==="system"?<SystemPanel key={record.binding.id} binding={record.binding}/>:record&&<KnowledgeSurface binding={record.binding} onOpen={navigate}/>}</main>
    {searchOpen&&<SearchOverlay leader={leader.shift} onLeaderChange={leader.change} shortcutError={leader.error} project={record?.binding.project} onClose={()=>setSearchOpen(false)} onOpen={navigate}/>}
  </div>;
}
