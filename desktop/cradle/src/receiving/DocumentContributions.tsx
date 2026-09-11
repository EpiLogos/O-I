import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage} from "./client";
/** The document's accepted source revision (Wave 7): contributions the owner
 * has already included, rendered beside the open document with their distinct
 * native facts — producer attribution, display role, human reviewer, entry
 * anchor — and the source revision that carries them. This is deliberately a
 * different register from the pending receiving field above: included material
 * is document source now, not a pending decision. Present (with its refresh
 * affordance) once the owner's receiving field targets this source, so an
 * inclusion that lands while the document sits open is one refresh away;
 * quietly absent when the bound owner does not expose receiving or nothing
 * targets this source. */
export function DocumentContributions({sourceRef,project}:{sourceRef:string;project:string}) {
 const kernel=useKernel();
 const [reading,setReading]=useState<DocumentReading>();
 const [known,setKnown]=useState(false);
 const [pending,setPending]=useState(false);
 const load=()=>{
  setPending(true);
  void receiving<ReceivingPage>(kernel.transport,project,{kind:"list",limit:50}).then(page=>{
   const row=page.returns.find(entry=>entry.source_ref===sourceRef);
   if(!row){setKnown(false);setReading(undefined);return;}
   setKnown(true);
   return receiving<DocumentReading>(kernel.transport,project,{kind:"document",source_ref:sourceRef,document_id:row.document_id})
    .then(read=>setReading(read))
    .catch(()=>setReading(undefined));
  }).catch(()=>{setKnown(false);setReading(undefined);}).finally(()=>setPending(false));
 };
 useEffect(()=>{setReading(undefined);setKnown(false);load();},[sourceRef,project,kernel.transport]);
 if(!known)return null;
 return <section className="document-contributions" aria-label="Accepted into this document">
  <header><span>Accepted into this document</span>{reading&&<small className="document-source-revision" data-revision={reading.revision.revision}>source revision {reading.revision.revision}</small>}<button className="returns-refresh" aria-label="Refresh this document's accepted revisions" disabled={pending} onClick={load}>↻</button></header>
  {reading&&reading.document.contributions.filter(c=>!c.removed).map(c=><div key={c.id} className="accepted-contribution" data-contribution-id={c.id}>
   <span className="accepted-contribution-author">{c.display_role==="H"?"Human":"Agent"} — {c.author_ref}</span>
   {c.entry_id&&<span className="accepted-contribution-anchor">entry {c.entry_id}</span>}
   {c.field_id&&<span className="accepted-contribution-anchor">field {c.field_id}</span>}
   {c.reviewed_by&&<span className="accepted-contribution-reviewer">reviewed by {c.reviewed_by}</span>}
   <div className="accepted-contribution-body">{c.html}</div>
  </div>)}
  {reading&&!reading.document.contributions.some(c=>!c.removed)&&<p className="accepted-contribution-empty">Nothing has been included into this document yet.</p>}
 </section>;
}
