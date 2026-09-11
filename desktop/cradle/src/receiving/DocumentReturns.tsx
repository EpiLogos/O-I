import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
/** Returns for the OPEN document, rendered beside it (Wave 6E cut 2). The
 * same native receiving field as the project tray, reviewed and included
 * through the same owner operations — placed where the human is reading.
 * Arrival never edits the document. Quietly absent when the bound owner does
 * not expose receiving or when nothing targets this source: the desktop never
 * advertises a capability its owner cannot do. */
export function DocumentReturns({sourceRef,project}:{sourceRef:string;project:string}) {
 const kernel=useKernel();
 const [rows,setRows]=useState<ReturnRow[]>();
 const [unavailable,setUnavailable]=useState(false);
 const [open,setOpen]=useState<ReturnReading>();
 const [basis,setBasis]=useState<DocumentReading>();
 const [error,setError]=useState<string>();
 const [pending,setPending]=useState(false);
 const call=<T,>(request:ReceivingRequest)=>receiving<T>(kernel.transport,project,request);
 const load=()=>{
  void call<ReceivingPage>({kind:"list",limit:50}).then(page=>{
   setUnavailable(false);
   setRows(page.returns.filter(row=>row.source_ref===sourceRef));
  }).catch(()=>{setUnavailable(true);setRows(undefined);});
 };
 useEffect(()=>{setOpen(undefined);setBasis(undefined);setError(undefined);load();},[sourceRef,project,kernel.transport]);
 if(unavailable||!rows?.length)return null;
 const act=async(request:ReceivingRequest,label:string)=>{
  setPending(true);setError(undefined);
  try{
   setOpen(await call<ReturnReading>(request));
   setBasis(await call<DocumentReading>({kind:"document",source_ref:sourceRef,document_id:open!.record.document_id}));
  }catch(err){
   setError(`${label} was refused: ${String(err)}`);
   // The owner may have advanced the return's state even when the call was
   // refused (an inclusion can land `uncertain`) — show the true record.
   if(open){try{setOpen(await call<ReturnReading>({kind:"read",return_ref:open.return_ref}));}catch{/* the list reload below still carries the state */}}
  }
  finally{setPending(false);load();}
 };
 const expand=async(row:ReturnRow)=>{
  setPending(true);setError(undefined);setBasis(undefined);
  try{setOpen(await call<ReturnReading>({kind:"read",return_ref:row.return_ref}));
   setBasis(await call<DocumentReading>({kind:"document",source_ref:row.source_ref,document_id:row.document_id}));}
  catch(err){setError(String(err));}
  finally{setPending(false);}
 };
 const review=(reading:ReturnReading,disposition:"accepted"|"rejected")=>{
  const expected=disposition==="accepted"?basis?.revision.revision:undefined;
  void act({kind:"review",return_ref:reading.return_ref,expected_return_revision:reading.revision,disposition,expected_source_revision:expected},disposition==="accepted"?"Acceptance":"Rejection");
 };
 const include=(reading:ReturnReading)=>{
  if(!reading.record.review)return;
  void act({kind:"include",return_ref:reading.return_ref,expected_return_revision:reading.revision,expected_source_revision:reading.record.review.source_revision},"Inclusion");
 };
 const recover=(reading:ReturnReading)=>{void act({kind:"recover",return_ref:reading.return_ref,expected_return_revision:reading.revision},"Recovery");};
 const anchor=(proposal:{operation?:string;entry_id?:string;field_id?:string;reply_to?:string})=>[proposal.entry_id&&`entry ${proposal.entry_id}`,proposal.field_id&&`field ${proposal.field_id}`,proposal.reply_to&&`reply anchor ${proposal.reply_to}`].filter(Boolean).join(" · ");
 return <section className="document-returns" aria-label="Returns for this document">
  <header><span>Returns for this document</span>{rows.length>0&&<small>{rows.length} in the receiving field</small>}<button className="returns-refresh" aria-label="Refresh this document's returns" disabled={pending} onClick={load}>↻</button></header>
  {rows.map(row=><button key={row.return_ref} className={`project-return document-return ${open?.return_ref===row.return_ref?"return-open":""}`} aria-expanded={open?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
    <span className={`return-status return-${row.status}`}>{row.status}</span>
    <span className="return-origin">{row.author.actor_kind==="human"?"H":"Agent"} · {row.document_id}</span>
  </button>)}
  {open&&<div className="return-detail">
    <dl>
      <dt>Return</dt><dd>{open.return_ref}</dd>
      <dt>Author</dt><dd>{open.record.author.actor_kind==="human"?"Human":"Agent"} — {open.record.author.principal_ref}</dd>
      <dt>Proposed operation</dt><dd>{String((open.record.proposal as {operation?:string}).operation??open.record.proposal)}{anchor(open.record.proposal as {entry_id?:string;field_id?:string;reply_to?:string})&&<span className="return-anchor"> — {anchor(open.record.proposal as {entry_id?:string;field_id?:string;reply_to?:string})}</span>}</dd>
      {"html" in open.record.proposal&&<><dt>Proposed content</dt><dd className="return-proposal">{String(open.record.proposal.html)}</dd></>}
      <dt>Basis at arrival</dt><dd>{open.record.proposed_source_revision}{open.record.stale_at_arrival?" — already stale when it arrived":""}</dd>
      {basis&&<><dt>Current document basis</dt><dd>{basis.revision.revision}{basis.unreviewed_external_revision?" — externally edited since":""}</dd></>}
      {open.record.review&&<><dt>Review</dt><dd>{open.record.review.disposition} by {open.record.review.reviewer_ref} on {open.record.review.source_revision}</dd></>}
      {open.record.applied_source_revision&&<><dt>Applied</dt><dd>{open.record.applied_source_revision}</dd></>}
    </dl>
    {!open.included&&open.record.status!=="included"&&<div className="return-actions">
      {(open.record.status==="pending"||open.record.status==="needs-review")&&<>
        <button className="return-accept" disabled={pending||!basis} title={basis?undefined:"Read the document's current basis first"} onClick={()=>review(open,"accepted")}>Accept current basis</button>
        <button className="return-reject" disabled={pending} onClick={()=>review(open,"rejected")}>Reject</button>
      </>}
      {open.record.status==="accepted"&&<button className="return-accept" disabled={pending} onClick={()=>include(open)}>Include into the document</button>}
      {(open.record.status==="including"||open.record.status==="uncertain")&&<button className="return-recover" disabled={pending} onClick={()=>recover(open)}>Recover inclusion</button>}
    </div>}
    {open.record.last_error&&<p className="return-last-error" role="status">The owner recorded: {open.record.last_error}</p>}
    {open.included&&<p role="status" className="return-included">Included into the document.</p>}
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
