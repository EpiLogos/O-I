import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {listFlows,type FlowRecord} from "./client";
import {Loading} from "../shared/Loading";
/** U4.1 §2: Flows integrate into the project/NOW navigation field. Several
 * Flows may be active in one project; sorting is presentation, never identity —
 * the row's identity is the owner's FlowRef and opening continues the same
 * source. Rows carry the owner's own record; no contents are summarised here
 * (privacy/disclosure stays with the surface). */
export function FlowList({project,onOpen,onNewFlow}:{project:string;onOpen:(row:FlowRecord)=>Promise<void>;onNewFlow?:()=>Promise<void>}) {
 const kernel=useKernel();const [rows,setRows]=useState<FlowRecord[]>();const [error,setError]=useState<string>();const [pending,setPending]=useState(false);
 useEffect(()=>{let live=true;setPending(true);void listFlows(kernel.transport,project).then(flows=>{if(live){setRows(flows);setError(undefined);}}).catch(reason=>{if(live)setError(String(reason));}).finally(()=>{if(live)setPending(false);});return()=>{live=false;};},[project]);
 const label=(row:FlowRecord)=>row.title||row.path.split("/").pop()||row.flow_ref;
 return <div className="project-flows" aria-busy={pending}>
  {error?<p className="project-availability" role="status">{error}</p>:!rows?<Loading label="Reading Flows…" scope="surface"/>:<>
   {rows.length?rows.map(row=><button key={row.flow_ref} className="flow-row" data-flow-ref={row.flow_ref} title={`${row.path}\n${row.flow_ref}`} onClick={()=>void onOpen(row).catch(cause=>setError(String(cause)))}><span className="encounter-dot" aria-hidden="true"/><span className="encounter-title">{label(row)}</span></button>):<p className="project-availability">No Flows in this project yet.</p>}
   {onNewFlow&&<button className="flow-new" onClick={()=>void onNewFlow().catch(cause=>setError(String(cause)))}>New flow</button>}
  </>}</div>;
}
