import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {listFlowInstances,type FlowInstanceRow} from "./instances";
/** The user section's flow documents (queue cell E, the ratified carrier):
 * dated 0/1 instances living in `Control/user/flows/`, accumulated through
 * the day, filed by the owner into `/day` folders when their day closes.
 * Identity is the file's own; sorting is presentation. An absent flows
 * directory renders honest absence — nothing is invented, nothing polls. */
export function UserFlowsList({onOpen,onNewFlow}:{onOpen:(row:FlowInstanceRow)=>Promise<void>;onNewFlow?:()=>void}) {
 const kernel=useKernel();
 const [rows,setRows]=useState<FlowInstanceRow[]>();const [error,setError]=useState<string>();const [pending,setPending]=useState(false);
 useEffect(()=>{let live=true;setPending(true);void listFlowInstances(kernel.transport).then(rows=>{if(live){setRows(rows);setError(undefined);}}).catch(reason=>{if(live)setError(String(reason));}).finally(()=>{if(live)setPending(false);});return()=>{live=false;};},[kernel.transport]);
 return <div className="project-flows user-flows" aria-busy={pending} data-user-flows="true">
  {error?<p className="project-availability" role="status">{error}</p>:!rows?null:<>
   {rows.length?rows.map(row=><button key={row.location.ref} className="flow-row" data-flow-instance={row.name} title={row.location.path} onClick={()=>void onOpen(row).catch(cause=>setError(String(cause)))}><span className="encounter-dot" aria-hidden="true"/><span className="encounter-title">{row.name}</span></button>):<p className="project-availability" data-flows-absent="true">No flows yet.</p>}
   {onNewFlow&&<button className="flow-new" onClick={onNewFlow}>New flow</button>}
  </>}</div>;
}
