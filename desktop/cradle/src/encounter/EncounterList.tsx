import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {Loading} from "../shared/Loading";
import {formatRelativeTime} from "../shared/relativeTime";
export interface EncounterRow {space:string;ref:string;title:string;project:string}
export function EncounterList({project,onOpen,activeRef}:{project:string;onOpen:(row:EncounterRow)=>Promise<void>;activeRef?:string}) {
 const kernel=useKernel();const [rows,setRows]=useState<EncounterRow[]>();const [observedAt,setObservedAt]=useState<number>();const [error,setError]=useState<string>();
 // BOOT-14: last-observed rows and their own "observed" stamp are kept
 // visible while a fresh read is in flight — `rows`/`observedAt` are only
 // replaced once the new reading actually lands, never cleared first.
 const [pending,setPending]=useState(false);
 useEffect(()=>{let live=true;setPending(true);void kernelOp(kernel.transport,{op:"agency_read",project}).then(result=>{
  if(result.error||result.outcome?.result!=="agency_reading")throw new Error(result.error??"AIKit SessionSpace reading unavailable");
  const found:EncounterRow[]=[];
  for(const raw of result.outcome.spaces){const space=raw as {definition:{id:string};label?:string;agent_sessions:Record<string,{purpose?:string}>};for(const [ref,attachment] of Object.entries(space.agent_sessions))found.push({space:space.definition.id,ref,title:attachment.purpose||space.label||ref,project});}
  if(live){setRows(found);setObservedAt(result.outcome.observed_at_unix_ms);setError(undefined);}
 }).catch(error=>{if(live)setError(String(error));}).finally(()=>{if(live)setPending(false);});return()=>{live=false;};},[project]);
 return <div className="project-encounters" aria-busy={pending}>{error?<p className="project-availability" role="status">{error}</p>:!rows?<Loading label="Reading chats and tasks…" scope="surface"/>:<>
  {pending&&<Loading label="Refreshing chats and tasks…" detail="Keeping the last observed list visible" scope="surface"/>}
  {observedAt!==undefined&&<p className="project-availability" role="status">Observed {formatRelativeTime(observedAt)}</p>}
  {rows.length?rows.map(row=><button key={`${row.space}:${row.ref}`} className="encounter-row" aria-current={row.ref===activeRef?"true":undefined} onClick={()=>void onOpen(row).catch(error=>setError(String(error)))}><span className="encounter-dot" aria-hidden="true"/><span className="encounter-title">{row.title}</span></button>):<p className="project-availability">No attached encounters.</p>}
 </>}</div>;
}
