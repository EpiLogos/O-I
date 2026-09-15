import {listFiles} from "../../files/client";
import type {CentralLocation} from "../../kernel/types";
import {useEffect,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {inspectProjectInbox,inspectProjectNow,type ProjectNowInspection,type ProjectNowItem} from "./client";
import type {ReceivingPage} from "../../receiving/client";
import "./project-now.css";

export interface ProjectNowSurfaceProps { project:string; projectRef:string; onOpenFile?: (location:CentralLocation)=>Promise<void>; }
/** Project NOW is read through Central. It opens only exact DAY file locations
 * the owner has disclosed; foreign Run/session/artifact refs stay visible but
 * inert until their owners disclose a resolver target. */
export function ProjectNowSurface({project,projectRef,onOpenFile}:ProjectNowSurfaceProps) {
  const kernel=useKernel();
  const [reading,setReading]=useState<ProjectNowInspection>();
  const [inbox,setInbox]=useState<ReceivingPage>();
  const [error,setError]=useState<string>();
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let live=true;setLoading(true);setError(undefined);setReading(undefined);setInbox(undefined);
    void Promise.allSettled([inspectProjectNow(kernel.transport,project),inspectProjectInbox(kernel.transport,project)]).then(([now,returns])=>{
      if(!live)return;
      if(now.status==="fulfilled")setReading(now.value);
      if(returns.status==="fulfilled")setInbox(returns.value);
      const errors=[now.status==="rejected"?`NOW: ${message(now.reason)}`:"",returns.status==="rejected"?`Inbox: ${message(returns.reason)}`:""].filter(Boolean);
      setError(errors.length?errors.join(" · "):undefined);
    }).finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  },[kernel.transport,project,projectRef,refresh]);
  const openDay=onOpenFile?async(path:string)=>{
    if(!reading?.project_root||!reading.day_records.includes(path)||path.startsWith("/")||path.split("/").includes(".."))throw new Error("Central did not disclose this Project DAY file");
    const slash=path.lastIndexOf("/"),name=path.slice(slash+1),root=kernel.snapshot.navigator?.root?.root?.replace(/\/$/,"");
    if(!root||!reading.project_root.startsWith(`${root}/`))throw new Error("Central did not disclose this Project under the current file root");
    const projectPath=reading.project_root.slice(root.length+1),directory=await listFiles(kernel.transport,`${projectPath}/${path.slice(0,slash)}`),file=directory.entries.find(entry=>entry.name===name&&entry.kind==="file");
    if(!file)throw new Error("The disclosed DAY file is no longer available");
    await onOpenFile(file.location);
  }:undefined;
  return <section className="project-now-surface" aria-label="Project NOW and Inbox">
    <header><h2>{project} · NOW</h2><button type="button" onClick={()=>setRefresh(value=>value+1)} disabled={loading}>Refresh</button></header>
    {loading&&<p role="status">Reading the Project field…</p>}{error&&<p role="alert">{error}</p>}
    {reading&&<>
      <NowList title="Active work" items={reading.active_items}/>
      {reading.inactive_items.length>0&&<details className="project-now-inactive"><summary>Inactive retained work ({reading.inactive_items.length})</summary><NowList title="Inactive work" items={reading.inactive_items} heading="h4"/></details>}
      <section aria-label="DAY records"><h3>DAY records <small>{reading.day_records.length}</small></h3>{reading.day_records.length?<ul>{reading.day_records.map(path=>{const date=path.match(/(\d{4}-\d{2}-\d{2})/)?.[1];return <li key={path}>{openDay?<button type="button" onClick={()=>void openDay(path).catch(reason=>setError(message(reason)))}><strong>{date?`DAY ${date}`:"Open DAY record"}</strong></button>:<strong>{date?`DAY ${date}`:"DAY record"}</strong>}<code>{path}</code></li>;})}</ul>:<p>No Project DAY records disclosed.</p>}</section>
      <section aria-label="Human scratch and open questions"><h3>Open questions <small>{reading.open_questions.length}</small></h3>{reading.open_questions.length?<ul>{reading.open_questions.map((item,index)=><li key={index}><span>{typeof item==="string"?item:JSON.stringify(item)}</span></li>)}</ul>:<p>No open questions disclosed.</p>}{reading.human_scratch.length>0&&<p>Human scratch is present in the owner field.</p>}</section>
      <details><summary>Project field boundaries</summary><ul>{(reading.boundaries??[]).map(boundary=><li key={boundary}>{boundary}</li>)}</ul></details>
    </>}
    {inbox&&<section aria-label="Project Inbox"><h3>Inbox <small>{inbox.returns.length}</small></h3>{inbox.returns.length?<ul>{inbox.returns.map(row=><li key={row.return_ref}><strong>{row.status}</strong><span>{row.document_id}</span><small>{row.return_ref} · {row.author.actor_kind}</small></li>)}</ul>:<p>Inbox is clear.</p>}</section>}
  </section>;
}
function NowList({title,items,heading="h3"}:{title:string;items:ProjectNowItem[];heading?:"h3"|"h4"}) {
  const Heading=heading;return <section aria-label={title}><Heading>{title} <small>{items.length}</small></Heading>{items.length?<ul>{items.map(item=><li key={item.id}><strong>{item.subject}</strong><span>{item.kind} · {item.status}</span><details className="project-now-return"><summary>Return details</summary><p>{item.result}</p><small>{item.actor}</small><ReferenceDetails item={item}/></details></li>)}</ul>:<p>No {title.toLowerCase()} disclosed.</p>}</section>;
}
function ReferenceDetails({item}:{item:ProjectNowItem}) {
  const rows=[...[item.run_ref?["Run",item.run_ref] as const:[]],...[item.session_ref?["Session",item.session_ref] as const:[]],...[item.focus_ref?["Focus",item.focus_ref] as const:[]],...[item.attributed_to?["Attributed subject",item.attributed_to] as const:[]]];
  const lists=[["Source references",item.source_refs],["Evidence references",item.evidence_refs],["Preserved references",item.preserve_refs],["Promoted to",item.promoted_to]] as const;
  return <div className="project-now-references">{rows.map(([label,reference])=><dl key={label+reference}><dt>{label}</dt><dd><code>{reference}</code></dd></dl>)}{lists.filter(([,refs])=>refs?.length).map(([label,refs])=><details key={label}><summary>{label} ({refs!.length})</summary><ul>{refs!.map(ref=><li key={ref}><code>{ref}</code></li>)}</ul></details>)}</div>;
}
function message(reason:unknown) { return reason instanceof Error&&reason.message?reason.message:String(reason); }
