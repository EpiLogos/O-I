/** Factory navigation uses the shared project scope and native conversations.
 * Harness controls live with the conversation; inspecting unrelated project
 * ledgers must not delay switching the working scope (22 September shell law).
 */
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {KernelTransportStatus,WorldProject} from "../../kernel/types";
import {Glyph} from "../../workspace/Glyph";
import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import {RememberedList} from "../../context/RememberedList";
import {receiving,type ReceivingPage,type ReturnRow} from "../../receiving/client";
import {nowReading,type NowListing,type NowRow} from "../../receiving/now";
import {handToPanelInspect} from "../../agent/planes/panelInspect";
import {formatRelativeTime} from "../../shared/relativeTime";
import {publishCentreView,useCentreView} from "../../contributions/factory/desk/deskModel";
import "./factory-navigator.css";

type View="desk"|"tasks";

export function FactoryNavigator({project,accompanying,onProjectChange,onOpenEncounter,activeEncounterRef,onMessage}:{
  project?:string;
  accompanying?:{ref:string;project:string;space:string};
  onProjectChange?:(project?:string)=>void;
  onOpenEncounter:(row:EncounterRow)=>Promise<void>;
  activeEncounterRef?:string;
  onMessage?:(message:string)=>void;
}) {
  const kernel=useKernel();
  const reading=kernel.snapshot.navigator;
  const projects:WorldProject[]=reading?.root?.work.projects??[];
  const selected=reading?.project?.project;
  const current=project?projects.find(entry=>entry.name===project)??(selected?.name===project?selected:undefined):undefined;
  const centreView=useCentreView();
  const [refresh,setRefresh]=useState(0);
  const [pending,setPending]=useState(false);
  const entered=useRef(false);
  useEffect(()=>{if(!entered.current){entered.current=true;if(!reading?.root)void kernel.apply({op:"world_browse"}).catch(error=>onMessage?.(String(error)));}},[]);
  const browse=async(name?:string)=>{
    setPending(true);onProjectChange?.(name);
    try{await kernel.apply(name?{op:"project_browse",project:name}:{op:"world_browse"});}
    catch(error){onMessage?.(String(error));}
    finally{setPending(false);setRefresh(value=>value+1);}
  };
  const choose=(next:View)=>publishCentreView(next);
  return <nav className="factory-navigator" aria-label="Factory project" aria-busy={pending}>
    <ProjectSpace projects={projects} current={current} pending={pending} onBrowse={browse}/>
    <div className="factory-views oi-segment" role="radiogroup" aria-label="Factory view">
      <button role="radio" aria-checked={centreView==="desk"} onClick={()=>choose("desk")}><Glyph name="factory" size={12}/><span>Desk</span></button>
      <button role="radio" aria-checked={centreView==="tasks"} onClick={()=>choose("tasks")}><Glyph name="chat" size={12}/><span>Tasks</span></button>
    </div>
    <div className="factory-body oi-scroll">
      {current&&centreView==="desk"&&<DeskReceiving project={current.name} refresh={refresh}/>}
      {centreView==="tasks"&&<EncounterList key={`${project ?? ""}:${accompanying?.ref ?? ""}:${refresh}`} project={project ?? ""} onOpen={onOpenEncounter} activeRef={accompanying?.project===(project ?? "") ? activeEncounterRef : undefined}/>}
    </div>
  </nav>;
}

function ProjectSpace({projects,current,pending,onBrowse}:{projects:WorldProject[];current?:WorldProject;pending:boolean;onBrowse:(name?:string)=>Promise<void>}) {
  return <section className="factory-space" aria-label="Project space" data-bound={!!current}>
    <div className="factory-space-row">
      <span className="factory-space-mark" aria-hidden="true"><Glyph name="factory" size={13}/></span>
      <label className="factory-picker">
        <select aria-label="Project" value={current?.name??""} disabled={pending} onChange={event=>void onBrowse(event.target.value||undefined)}>
          <option value="">Central — personal ground</option>
          {projects.map(entry=><option key={entry.path} value={entry.name}>{entry.name}</option>)}
        </select>
        <span className="factory-picker-face"><strong>{current?.name??"Central"}</strong><Glyph name="down" size={10}/></span>
      </label>
      <button className="oi-tool" aria-label="Refresh project" title="Refresh project" disabled={pending} onClick={()=>void onBrowse(current?.name)}><Glyph name="refresh" size={12}/></button>
    </div>
  </section>;
}

// ---------------------------------------------------------------------------
// Desk's receiving bands: what arrived for the person's eyes, Run or not
// (the old Inbox entry's content, preserved under the Desk entry)

function DeskReceiving({project,refresh}:{project:string;refresh:number}) {
  const kernel=useKernel();
  return <div className="factory-inbox">
    <ReturnsBand transport={kernel.transport} project={project} refresh={refresh}/>
    <NowBand transport={kernel.transport} project={project} refresh={refresh}/>
    <section className="factory-band" aria-label="Remembered"><header className="factory-band-head"><span className="oi-eyebrow">Remembered</span></header><RememberedList path={`Work/${project}/ProjectCentral/agents/remembered`} label={project}/></section>
  </div>;
}

const seconds=(value?:number|null)=>typeof value==="number"?formatRelativeTime(value*1000):"";

function ReturnsBand({transport,project,refresh}:{transport:KernelTransportStatus;project:string;refresh:number}) {
  const [page,setPage]=useState<ReceivingPage>();
  const [state,setState]=useState<"reading"|"read"|"absent">("reading");
  useEffect(()=>{let live=true;setState("reading");
    receiving<ReceivingPage>(transport,project,{kind:"list",limit:30}).then(next=>{if(live){setPage(next);setState("read");}}).catch(()=>{if(live)setState("absent");});
    return()=>{live=false;};},[transport,project,refresh]);
  if(state==="absent")return null; // the bound owner exposes no receiving here — quiet absence
  const rows=(page?.returns??[]).filter(row=>row.status!=="included"&&row.status!=="rejected");
  const open=(row:ReturnRow)=>handToPanelInspect({kind:"return",ref:row.return_ref,title:row.document_id,payload:row,source:"Desk"});
  return <section className="factory-band" aria-label="Documents awaiting review">
    <header className="factory-band-head"><span className="oi-eyebrow">Documents</span><span className="oi-state">{state==="reading"?"reading…":rows.length?`${rows.length} to review`:"none waiting"}</span></header>
    {rows.map(row=><button key={row.return_ref} className="factory-inbox-row" data-status={row.status} onClick={()=>open(row)} title={row.return_ref}>
      <span className="factory-inbox-dot" aria-hidden="true"/>
      <span className="factory-inbox-text"><span className="factory-inbox-title">{row.document_id}</span><small>{row.author.principal_ref} · {row.status}{row.received_at_unix_seconds?` · ${seconds(row.received_at_unix_seconds)}`:""}</small></span>
    </button>)}
  </section>;
}

function NowBand({transport,project,refresh}:{transport:KernelTransportStatus;project:string;refresh:number}) {
  const [rows,setRows]=useState<NowRow[]>();
  const [state,setState]=useState<"reading"|"read"|"absent">("reading");
  useEffect(()=>{let live=true;setState("reading");
    nowReading<NowListing>(transport,project,{kind:"list"}).then(listing=>{if(live){setRows([...listing.records].sort((a,b)=>b.created_at_unix_seconds-a.created_at_unix_seconds));setState("read");}}).catch(()=>{if(live)setState("absent");});
    return()=>{live=false;};},[transport,project,refresh]);
  if(state==="absent")return null;
  const shown=(rows??[]).filter(row=>row.lifecycle==="active").slice(0,24);
  const open=(row:NowRow)=>handToPanelInspect({kind:"now",ref:row.now_ref,title:row.purpose.split("\n")[0].slice(0,80),payload:row,source:"Desk"});
  return <section className="factory-band" aria-label="Live NOW records">
    <header className="factory-band-head"><span className="oi-eyebrow">Now</span><span className="oi-state">{state==="reading"?"reading…":shown.length?`${shown.length} live`:"nothing live"}</span></header>
    {shown.map(row=><button key={row.now_ref} className="factory-inbox-row" data-lifecycle={row.lifecycle} onClick={()=>open(row)} title={row.task_ref}>
      <span className="factory-inbox-dot" aria-hidden="true"/>
      <span className="factory-inbox-text"><span className="factory-inbox-title">{row.purpose.split("\n")[0]}</span><small>{row.task_ref.replace(/^control:task:|^project:task:/,"")} · {seconds(row.created_at_unix_seconds)}</small></span>
    </button>)}
  </section>;
}
