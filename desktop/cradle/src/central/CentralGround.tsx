import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation} from "../kernel/types";
import {NowRelations} from "../receiving/NowRelations";
import {readGround,openDay,sourceLocation,type CentralGroundReading,type Reading} from "./client";

/** Root is an actual native work context. This body uses the same file/source
 * callbacks and document host as every other source; it owns no working store. */
export function CentralGround({project=null,refresh=0,onOpenFile}:{project?:string|null;refresh?:number;onOpenFile:(location:CentralLocation)=>Promise<void>}) {
 const {transport}=useKernel();
 const [held,setHeld]=useState<CentralGroundReading>();
 const [error,setError]=useState<string>();
 const [pending,setPending]=useState(false);
 const [version,setVersion]=useState(0);
 const [now,setNow]=useState<string>();
 const [limit,setLimit]=useState(20);
 const generation=useRef(0);
 const scope=useRef(project);scope.current=project;
 useEffect(()=>{setNow(undefined);setLimit(20);},[project]);
 const reload=()=>setVersion(v=>v+1);
 useEffect(()=>{
  const ticket=++generation.current;setPending(true);setError(undefined);
  readGround(transport,project).then(value=>{if(ticket===generation.current)setHeld(value);})
   .catch(reason=>{if(ticket===generation.current)setError(String(reason));})
   .finally(()=>{if(ticket===generation.current)setPending(false);});
  return()=>{generation.current++;};
 },[transport,project,refresh,version]);
 // A previous scope is never shown under a new scope's heading.
 const reading=held?.project===project?held:undefined;
 const perform=async(action:()=>Promise<unknown>)=>{
  const ticket=generation.current;setError(undefined);setPending(true);
  try{await action();if(ticket===generation.current)reload();}
  catch(reason){if(ticket===generation.current)setError(String(reason));}
  finally{if(ticket===generation.current)setPending(false);}
 };
 const openLocated=async(resolve:()=>Promise<CentralLocation>)=>{
  const originalScope=project;const location=await resolve();
  if(originalScope!==scope.current)throw new Error("Work context changed during source resolution; no destination was opened");
  await onOpenFile(location);
 };
 const openSource=(reference:string)=>perform(()=>openLocated(()=>sourceLocation(transport,project,reference)));
 const openCurrent=()=>perform(()=>openLocated(async()=>(await openDay(transport,project)).location));
 const day=reading?.day.data;
 const showFailure=(title:string,value:Reading<unknown>|undefined)=>value&&value.state!=="ready"?<p role="status" data-reading-state={value.state}>{title} — {value.state}: {value.error?.message??"Native reading unavailable"}</p>:null;
 return <section className="central-ground project-reading" aria-label={project?`${project} Day and NOW`:"Central root working ground"} aria-busy={pending}>
  <header><strong>{project?project:"Central · root meta-project"}</strong><button type="button" onClick={reload} aria-label="Refresh current ground" disabled={pending}>Refresh</button></header>
  {!project&&<p>Control is the durable authored ground. Work projects keep their own context; no child Project is required here.</p>}
  {error&&<p role="alert">{error}{reading?" — the last reading is retained, not current success.":""}</p>}
  {!reading&&<p role="status">{pending?"Reading native ground…":"Native ground has not been read."}</p>}
  {reading&&<>
   {showFailure("Civil time",reading.time)}
   {reading.time.data&&<p><time>{reading.time.data.civil_date}</time> · {reading.time.data.policy.timezone} · native civil boundary {reading.time.data.policy.day_boundary_minutes} minutes</p>}
   <div className="central-current-day">
    {showFailure("Day",reading.day)}
    {reading.day.state==="ready"&&day&&<>
     {day.document_state==="ready"?<button type="button" aria-label={project?`Open ${project} current Day`:"Open current Daily Die"} disabled={pending} onClick={openCurrent}>Open Daily Die · {day.temporal.civil_date}</button>:<p role="status">The current Day exists, but its Daily Die page is not made yet: Central makes it from the Day form at the Day's turn (O-I 1005). The temporal artifact is not the form.</p>}
     <small>{day.day_ref}</small>
    </>}
    {reading.day.state==="stale"&&day?.document_state==="ready"&&<button type="button" onClick={()=>void perform(()=>openLocated(async()=>(await openDay(transport,project,day.day_ref)).location))}>Open retained Day · {day.temporal.civil_date}</button>}
   </div>
   <details><summary>Authored ground and native sources</summary>
    {showFailure("Sources",reading.sources)}
    {reading.sources.state==="ready"&&<><p>User authorship, agent material and generated projections retain their native provenance and standing. Editing is not Recognition.</p>
     <ul>{reading.sources.data!.sources.slice(0,limit).map(row=><li key={row.binding.ref}>
      <button type="button" disabled={!row.binding.agent_retrieval_allowed||pending} onClick={()=>void openSource(row.binding.ref)}>{row.binding.path}</button>
      <small>{row.binding.treatment} · {row.binding.provenance} · {row.binding.standing}{!row.binding.agent_retrieval_allowed?" · denied":""}</small>
     </li>)}</ul>
     {reading.sources.data!.sources.length>limit&&<button onClick={()=>setLimit(n=>n+30)}>More native sources</button>}
     {!reading.sources.data!.sources.length&&<p>No participating sources returned by this native horizon.</p>}
    </>}
   </details>
   <details><summary>NOW · current work and history</summary>
    {showFailure("NOW",reading.now)}
    {reading.now.state==="ready"&&<>
     <ul>{reading.now.data!.records.map(row=><li key={row.now_ref}><button type="button" aria-expanded={now===row.now_ref} onClick={()=>setNow(now===row.now_ref?undefined:row.now_ref)}>{row.purpose} · {row.lifecycle}</button></li>)}</ul>
     {!reading.now.data!.records.length&&<p>No NOW allocations returned for this scope.</p>}
     {now&&<NowRelations key={`${project}:${now}`} nowRef={now} project={project} refresh={version+refresh} onOpenSource={reference=>openSource(reference)}/>}
    </>}
   </details>
  </>}
 </section>;
}
