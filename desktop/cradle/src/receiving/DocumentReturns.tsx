import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
/** Returns for the OPEN document, rendered beside it (Wave 6E cut 2). The
 * same native receiving field as the project tray, reviewed and included
 * through the same owner operations — placed where the human is reading.
 * Arrival never edits the document. Quietly absent when the bound owner does
 * not expose receiving or when nothing targets this source: the desktop never
 * advertises a capability its owner cannot do. */
export function DocumentReturns({sourceRef,project}:{sourceRef:string;project:string|null}) {
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
 // Absent only when the bound owner does not expose receiving. With receiving
 // available the strip stays as this document's arrival point — refreshable
 // even at zero — because a Return can arrive at any moment after mount and
 // the project tray must not be the only place that notices.
 if(unavailable)return null;
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
 /** The Shared Field lineage a returning participant carried in the proposal
  * (owner-carried verbatim, non-reserved keys): the admitted projection this
  * material came from. Never desktop-derived — rendered only when present. */
 const sharedFieldLineage=(proposal:unknown):{projection_ref:string;projection_revision:number;disposition?:string;admission_ref?:string;withdrawn?:boolean}|undefined=>{
  const field=(proposal as {shared_field?:unknown})?.shared_field;
  if(!field||typeof field!=="object")return undefined;
  const lineage=field as {projection_ref?:unknown;projection_revision?:unknown;disposition?:unknown;admission_ref?:unknown;withdrawn?:unknown};
  if(typeof lineage.projection_ref!=="string"||typeof lineage.projection_revision!=="number")return undefined;
  return {projection_ref:lineage.projection_ref,projection_revision:lineage.projection_revision,
   disposition:typeof lineage.disposition==="string"?lineage.disposition:undefined,
   admission_ref:typeof lineage.admission_ref==="string"?lineage.admission_ref:undefined,
   withdrawn:lineage.withdrawn===true};
 };
 /** A2A lineage carried in the proposal by the returning side: the exchange
  * the admitted material came back over. Owner-carried verbatim, never
  * desktop-derived. */
 const a2aLineage=(proposal:unknown):{exchange_ref:string;transport_kind?:string;transport_ref?:string;binding_ref?:string;binding_revision?:number;exchange_grant_ref?:string}|undefined=>{
  const field=(proposal as {a2a?:unknown})?.a2a;
  if(!field||typeof field!=="object")return undefined;
  const lineage=field as {exchange_ref?:unknown;transport_kind?:unknown;transport_ref?:unknown;binding_ref?:unknown;binding_revision?:unknown;exchange_grant_ref?:unknown};
  if(typeof lineage.exchange_ref!=="string")return undefined;
  return {exchange_ref:lineage.exchange_ref,
   transport_kind:typeof lineage.transport_kind==="string"?lineage.transport_kind:undefined,
   transport_ref:typeof lineage.transport_ref==="string"?lineage.transport_ref:undefined,
   binding_ref:typeof lineage.binding_ref==="string"?lineage.binding_ref:undefined,
   binding_revision:typeof lineage.binding_revision==="number"?lineage.binding_revision:undefined,
   exchange_grant_ref:typeof lineage.exchange_grant_ref==="string"?lineage.exchange_grant_ref:undefined};
 };
 return <section className="document-returns" aria-label="Returns for this document">
  <header><span>Returns for this document</span>{rows&&<small>{rows.length} in the receiving field</small>}<button className="returns-refresh" aria-label="Refresh this document's returns" disabled={pending} onClick={load}>↻</button></header>
  {rows?.map(row=><button key={row.return_ref} className={`project-return document-return ${open?.return_ref===row.return_ref?"return-open":""}`} aria-expanded={open?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
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
      {/* Late Returns keep their own times: when the work happened and when
        the owner received it. Both are the owner's record, shown verbatim —
        arrival while the desktop was closed never rewrites either. */}
      {open.record.occurred_at_unix_seconds!=null&&<><dt>Occurred</dt><dd className="return-occurred">{new Date(open.record.occurred_at_unix_seconds*1000).toISOString()}</dd></>}
      <dt>Received</dt><dd className="return-received">{new Date(open.record.received_at_unix_seconds*1000).toISOString()}</dd>
      {basis&&<><dt>Current document basis</dt><dd>{basis.revision.revision}{basis.unreviewed_external_revision?" — externally edited since":""}</dd></>}
      {open.record.review&&<><dt>Review</dt><dd>{open.record.review.disposition} by {open.record.review.reviewer_ref} on {open.record.review.source_revision}</dd></>}
      {sharedFieldLineage(open.record.proposal)&&<><dt>Shared field</dt><dd className="return-shared-field" data-shared-field="true">admitted contribution — projection <code>{sharedFieldLineage(open.record.proposal)!.projection_ref}</code> rev {sharedFieldLineage(open.record.proposal)!.projection_revision}{sharedFieldLineage(open.record.proposal)!.withdrawn?" · withdrawn by the publisher, admitted material retained":""}{sharedFieldLineage(open.record.proposal)!.admission_ref?<> · admission <code>{sharedFieldLineage(open.record.proposal)!.admission_ref}</code></>:null}</dd></>}
      {a2aLineage(open.record.proposal)&&<><dt>A2A exchange</dt><dd className="return-a2a" data-a2a="true">admitted contribution — exchange <code>{a2aLineage(open.record.proposal)!.exchange_ref}</code>{a2aLineage(open.record.proposal)!.transport_kind&&a2aLineage(open.record.proposal)!.transport_ref?<>{a2aLineage(open.record.proposal)!.transport_kind} <code>{a2aLineage(open.record.proposal)!.transport_ref}</code></>:null}{a2aLineage(open.record.proposal)!.binding_ref?<> · binding <code>{a2aLineage(open.record.proposal)!.binding_ref}</code> rev {a2aLineage(open.record.proposal)!.binding_revision}</>:null}</dd></>}
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
