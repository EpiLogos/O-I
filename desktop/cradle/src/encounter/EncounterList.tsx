import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {readableSessionTitle} from "./sessionTitle";
import {formatRelativeTime} from "../shared/relativeTime";
export interface EncounterRow {space:string;ref:string;title:string;project:string}
/** A project's attached encounters, read through AIKit's SessionSpace reading.
 * `onOpen` absent = read-only: the rows render as a list with no control,
 * never a dead button. `variant="panel"` dresses rows in the shared dense-row
 * grammar for the accompanying panel and the Factory centre; the navigator
 * keeps its own row look. `onRows` reports the rows each reading disclosed. */
export function EncounterList({project,onOpen,activeRef,variant="navigator",onRows}:{project:string;onOpen?:(row:EncounterRow)=>Promise<void>|void;activeRef?:string;variant?:"navigator"|"panel";onRows?:(rows:EncounterRow[])=>void}) {
 const kernel=useKernel();const [rows,setRows]=useState<EncounterRow[]>();const [observedAt,setObservedAt]=useState<number>();const [error,setError]=useState<string>();
 // BOOT-14: last-observed rows and their own "observed" stamp are kept
 // visible while a fresh read is in flight — `rows`/`observedAt` are only
 // replaced once the new reading actually lands, never cleared first.
 const [pending,setPending]=useState(false);
 const [opening,setOpening]=useState<string>();
 const report=useRef(onRows);report.current=onRows;
 useEffect(()=>{let live=true;setPending(true);void kernelOp(kernel.transport,{op:"agency_read",project}).then(result=>{
  if(result.error||result.outcome?.result!=="agency_reading")throw new Error(result.error??"AIKit SessionSpace reading unavailable");
  const found:EncounterRow[]=[];
  for(const raw of result.outcome.spaces){const space=raw as {definition:{id:string};label?:string;agent_sessions:Record<string,{purpose?:string}>};for(const [ref,attachment] of Object.entries(space.agent_sessions))found.push({space:space.definition.id,ref,title:readableSessionTitle(attachment.purpose||space.label,project),project});}
  if(live){setRows(found);setObservedAt(result.outcome.observed_at_unix_ms);setError(undefined);report.current?.(found);}
 }).catch(error=>{if(live)setError(String(error));}).finally(()=>{if(live)setPending(false);});return()=>{live=false;};},[project]);
 const open=(row:EncounterRow)=>{if(!onOpen)return;setOpening(row.ref);void Promise.resolve(onOpen(row)).catch(error=>setError(String(error))).finally(()=>setOpening(current=>current===row.ref?undefined:current));};
 const rowClass=variant==="panel"?"encounter-row oi-row":"encounter-row";
 // No loading disclosure: the first reading lands in a beat and an empty
 // region beats a standing "reading…" message in the sidebar; errors speak.
 return <div className="project-encounters" data-variant={variant} aria-busy={pending}>{error?<p className="project-availability" role="status">{error}</p>:!rows?null:<>
  {observedAt!==undefined&&<p className="project-availability" role="status">Observed {formatRelativeTime(observedAt)}</p>}
  {rows.length?rows.map(row=>onOpen
   ?<button key={`${row.space}:${row.ref}`} className={rowClass} aria-current={row.ref===activeRef?"true":undefined} data-busy={opening===row.ref?"true":undefined} onClick={()=>open(row)}><span className="encounter-dot" aria-hidden="true"/><span className="encounter-title">{row.title}</span></button>
   :<div key={`${row.space}:${row.ref}`} className={rowClass} data-readonly="true" aria-current={row.ref===activeRef?"true":undefined}><span className="encounter-dot" aria-hidden="true"/><span className="encounter-title">{row.title}</span></div>):<p className="project-availability">No attached encounters.</p>}
 </>}</div>;
}
