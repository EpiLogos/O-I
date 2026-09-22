/**
 * Factory's left body. Three bands, one project, compact:
 *
 *   project space   the meta-project grounding of this mode — one picker for
 *                   the project, the agent activity recorded in it (its newest
 *                   agent arrivals), one quiet line for activity landing in
 *                   other projects since yesterday, and the provider the
 *                   accompanying conversation runs on;
 *   Desk            the mode's first entry: it takes the centre to the live
 *                   whole-Run board (desk.ts). The person's receiving field
 *                   renders where they work with it — beside the open document
 *                   and on the Desk board's receiving strip, opened into the
 *                   panel's Inspect on demand (owner ruling 7: no returns band
 *                   in the navigator). This band carries live NOW records and
 *                   remembered notes, read through the owner.
 *   Tasks           the sessions and chats the centre conversation passes
 *                   through — the same attached encounters, opened the same
 *                   way; choosing one takes the centre to Tasks.
 *
 * Presentation only. Every row is an owner reading carried verbatim; a
 * register that exposes none of a kind renders that absence, never a stub.
 * Factory run notices from other projects need the developmental state path
 * the Factory surface asks for; until the owner discloses one durably, the
 * cross-project band reads the NOW fields, which is what a run delivers into.
 */
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus,WorldProject} from "../../kernel/types";
import {Glyph} from "../../workspace/Glyph";
import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import {useEncounterSession} from "../../encounter/session";
import {RememberedList} from "../../context/RememberedList";
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
    <ProjectSpace projects={projects} current={current} pending={pending} accompanying={accompanying} onBrowse={browse} onMessage={onMessage} refresh={refresh}/>
    <div className="factory-views oi-segment" role="radiogroup" aria-label="Factory view">
      <button role="radio" aria-checked={centreView==="desk"} onClick={()=>choose("desk")}><Glyph name="factory" size={12}/><span>Desk</span></button>
      <button role="radio" aria-checked={centreView==="tasks"} onClick={()=>choose("tasks")}><Glyph name="chat" size={12}/><span>Tasks</span></button>
    </div>
    <div className="factory-body oi-scroll">
      {!current&&<p className="factory-note oi-note">{projects.length?"Choose a project above.":reading?.root?"No projects under Work.":"Reading Central…"}</p>}
      {current&&centreView==="desk"&&<DeskReceiving project={current.name} refresh={refresh}/>}
      {current&&centreView==="tasks"&&<EncounterList project={current.name} onOpen={onOpenEncounter} activeRef={activeEncounterRef}/>}
    </div>
  </nav>;
}

// ---------------------------------------------------------------------------
// project space: the meta-project grounding of the mode

/** One agent arrival as recorded in a project's NOW field
 * (`ProjectCentral/now/agents/<slug>-<date>.json`, schema
 * central.project-now.handoff/v1) — the owner's own fields, verbatim. */
interface AgentArrival {id:string;actor:string;kind:string;subject:string;status:string;recorded_at_unix_seconds:number;project:string}
const RETURN_DATE=/-(\d{4}-\d{2}-\d{2})\.json$/;
const localDate=(offsetDays=0)=>{const d=new Date();d.setDate(d.getDate()-offsetDays);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
async function listReturns(transport:KernelTransportStatus,project:string):Promise<{name:string;location:{ref:string;path:string}}[]> {
  const result=await kernelOp(transport,{op:"files_list",path:`Work/${project}/ProjectCentral/now/agents`});
  if(result.error||result.outcome?.result!=="directory_read")throw new Error(result.error??"the listing did not serve");
  return result.outcome.directory.entries.filter(entry=>entry.kind==="file"&&entry.name.endsWith(".json")).map(entry=>({name:entry.name,location:entry.location as {ref:string;path:string}}));
}
async function readReturn(transport:KernelTransportStatus,project:string,entry:{name:string;location:{ref:string;path:string}}):Promise<AgentArrival|undefined> {
  const response=await kernelOp(transport,{op:"invoke_action",invocation:{action:"central.files.read",target_ref:entry.location.ref,input:{location:entry.location,encoding:"utf-8"}}});
  if(response.outcome?.result!=="action_dispatched")return undefined;
  const dispatch=response.outcome.dispatch as {state?:string;data?:{content?:string}};
  if(dispatch.state!=="invoked"||!dispatch.data?.content)return undefined;
  try{const raw=JSON.parse(dispatch.data.content) as Partial<AgentArrival>;if(typeof raw.subject!=="string")return undefined;return {id:raw.id??entry.name,actor:raw.actor??"agent",kind:raw.kind??"return",subject:raw.subject,status:raw.status??"",recorded_at_unix_seconds:raw.recorded_at_unix_seconds??0,project};}
  catch{return undefined;}
}

/** The project space: a picker for the project Factory works in, the agent
 * activity in that project (its newest agent arrivals), and a quiet line for
 * activity landing elsewhere today or yesterday — dated by the arrivals' own
 * file names, so nothing is read for the projects not chosen. */
function ProjectSpace({projects,current,pending,accompanying,onBrowse,onMessage,refresh}:{projects:WorldProject[];current?:WorldProject;pending:boolean;accompanying?:{ref:string;project:string;space:string};onBrowse:(name?:string)=>Promise<void>;onMessage?:(message:string)=>void;refresh:number}) {
  const kernel=useKernel();
  const [activity,setActivity]=useState<AgentArrival[]>();
  const [activityState,setActivityState]=useState<"reading"|"read"|"absent">("reading");
  const [elsewhere,setElsewhere]=useState<{project:string;recent:number}[]>([]);
  useEffect(()=>{
    let alive=true;
    if(!current){setActivity(undefined);return;}
    setActivityState("reading");
    void (async()=>{
      try{
        const entries=await listReturns(kernel.transport,current.name);
        const newest=entries.sort((a,b)=>(RETURN_DATE.exec(b.name)?.[1]??"").localeCompare(RETURN_DATE.exec(a.name)?.[1]??"")).slice(0,8);
        const read=(await Promise.all(newest.map(entry=>readReturn(kernel.transport,current.name,entry)))).filter((row):row is AgentArrival=>!!row).sort((a,b)=>b.recorded_at_unix_seconds-a.recorded_at_unix_seconds).slice(0,5);
        if(alive){setActivity(read);setActivityState("read");}
      }catch{if(alive){setActivity(undefined);setActivityState("absent");}}
    })();
    return()=>{alive=false;};
  },[kernel.transport,current?.name,refresh]);
  useEffect(()=>{
    let alive=true;
    const today=localDate(0),yesterday=localDate(1);
    void Promise.all(projects.filter(entry=>entry.name!==current?.name).map(async entry=>{
      try{const files=await listReturns(kernel.transport,entry.name);const recent=files.filter(file=>{const date=RETURN_DATE.exec(file.name)?.[1];return date===today||date===yesterday;}).length;return {project:entry.name,recent};}
      catch{return {project:entry.name,recent:0};}
    })).then(rows=>{if(alive)setElsewhere(rows.filter(row=>row.recent>0).sort((a,b)=>b.recent-a.recent));});
    return()=>{alive=false;};
  },[kernel.transport,projects.map(entry=>entry.name).join("|"),current?.name,refresh]);
  return <section className="factory-space" aria-label="Project space" data-bound={!!current}>
    <div className="factory-space-row">
      <span className="factory-space-mark" aria-hidden="true"><Glyph name="factory" size={13}/></span>
      <label className="factory-picker" data-empty={!current}>
        <select aria-label="Project" value={current?.name??""} disabled={pending||!projects.length} onChange={event=>void onBrowse(event.target.value||undefined)}>
          <option value="">{projects.length?"Choose a project":"Reading Work…"}</option>
          {projects.map(entry=><option key={entry.path} value={entry.name}>{entry.name}</option>)}
        </select>
        <span className="factory-picker-face"><strong>{current?.name??(projects.length?"Choose a project":"Reading Work…")}</strong><Glyph name="down" size={10}/></span>
      </label>
      <button className="oi-tool" aria-label="Refresh" title="Refresh" disabled={pending} onClick={()=>void onBrowse(current?.name)}><Glyph name="refresh" size={12}/></button>
    </div>
    {current&&<div className="factory-activity" aria-label={`Agent activity in ${current.name}`} data-state={activityState}>
      {activityState==="reading"&&<p className="factory-activity-empty oi-note">Reading agent activity…</p>}
      {activityState==="absent"&&<p className="factory-activity-empty oi-note">No agent arrivals recorded here yet.</p>}
      {activityState==="read"&&!activity?.length&&<p className="factory-activity-empty oi-note">No agent arrivals recorded here yet.</p>}
      {activity?.map(row=><button key={row.id} className="factory-activity-row" data-kind={row.kind} data-status={row.status} title={`${row.actor} · ${row.kind} · ${row.status}`} onClick={()=>handToPanelInspect({kind:"agent-return",ref:`${row.project}:${row.id}`,title:row.subject,payload:row,source:"Project space"})}>
        <span className="factory-activity-kind">{row.kind}</span>
        <span className="factory-activity-subject">{row.subject}</span>
        <span className="factory-activity-when">{row.recorded_at_unix_seconds?formatRelativeTime(row.recorded_at_unix_seconds*1000):""}</span>
      </button>)}
    </div>}
    {elsewhere.length>0&&<p className="factory-elsewhere" aria-label="Agent activity elsewhere">
      <span className="factory-elsewhere-label">Elsewhere</span>
      {elsewhere.map(row=><button key={row.project} className="factory-elsewhere-item" title={`${row.recent} agent arrival${row.recent===1?"":"s"} in ${row.project} since yesterday`} onClick={()=>void onBrowse(row.project)}>{row.project} <b>{row.recent}</b></button>)}
    </p>}
    <ProviderPick accompanying={accompanying} onMessage={onMessage}/>
  </section>;
}

/** The provider the accompanying conversation runs on — the real ACP
 * providers the owner lists, as a compact pill row. Choosing one connects a
 * disconnected session; a connected session names its provider and stays
 * put (the owner exposes no switch-in-place). The model catalogue is not yet
 * read through the desktop seam, so this picks the provider, honestly. */
function ProviderPick({accompanying,onMessage}:{accompanying?:{ref:string;project:string;space:string};onMessage?:(message:string)=>void}) {
  const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
  const state=session?.state;
  const status=state?.status;
  const connected=!!status&&status.state!=="Disconnected";
  const current=status?.provider?.id;
  const providers=state?.providers??[];
  if(!accompanying)return <div className="factory-provider" data-state="unbound"><span className="factory-provider-label">Provider</span><span className="oi-note">Bind a conversation to pick</span></div>;
  const pick=(id:string)=>{
    if(connected){if(id!==current)onMessage?.(`This conversation is connected to ${status?.provider?.label??current}; the owner exposes no switch in place — stop and reconnect to change provider.`);return;}
    if(!session?.actions.allowed("open")){onMessage?.("The owner does not allow opening a provider for this conversation yet.");return;}
    void session.actions.connect(id);
  };
  return <div className="factory-provider" data-state={connected?"connected":"disconnected"} role="radiogroup" aria-label="Provider">
    <span className="factory-provider-label">{connected?"Running on":"Provider"}</span>
    <div className="factory-provider-pills">
      {providers.map(provider=><button key={provider.id} role="radio" aria-checked={provider.id===current} className="factory-provider-pill" data-current={provider.id===current?"true":undefined} disabled={!!state?.pending} title={connected&&provider.id!==current?"Connected elsewhere — stop and reconnect to change":provider.label} onClick={()=>pick(provider.id)}>{provider.label}</button>)}
      {!providers.length&&<span className="oi-note">{state?.reading?"No ACP provider configured in AIKit.":"Reading…"}</span>}
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// Desk's receiving bands: what arrived for the person's eyes, Run or not
// (the old Inbox entry's content, preserved under the Desk entry)

function DeskReceiving({project,refresh}:{project:string;refresh:number}) {
  const kernel=useKernel();
  // Owner ruling 7 (DESKTOP-LANGUAGE.md, 2026-09-22): no returns band in the
  // navigator. The project's receiving field renders where the person works
  // with it — beside the open document (DocumentReceiving), on the Desk
  // board's own receiving strip, and on demand through the panel's Inspect
  // hand-off — never as a navigator box of its own.
  return <div className="factory-inbox">
    <NowBand transport={kernel.transport} project={project} refresh={refresh}/>
    <section className="factory-band" aria-label="Remembered"><header className="factory-band-head"><span className="oi-eyebrow">Remembered</span></header><RememberedList path={`Work/${project}/ProjectCentral/agents/remembered`} label={project}/></section>
  </div>;
}

const seconds=(value?:number|null)=>typeof value==="number"?formatRelativeTime(value*1000):"";

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
