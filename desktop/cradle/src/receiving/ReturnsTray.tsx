import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
/** Pending human Returns (Wave 6E): what arrived, from whom, against which
 * document — reviewed and included only through Central's native
 * revision-checked operations. Arrival never edits a document; this tray
 * neither mints identities nor widens disclosure. When the bound Central
 * owner does not expose receiving, the tray is quietly absent — the desktop
 * never advertises a capability its owner cannot do. */
export function ReturnsTray({project,refresh}:{project:string;refresh:number}) {
 const kernel=useKernel();
 const [page,setPage]=useState<ReceivingPage>();
 const [unavailable,setUnavailable]=useState(false);
 const [open,setOpen]=useState<ReturnReading>();
 const [basis,setBasis]=useState<DocumentReading>();
 const [error,setError]=useState<string>();
 const [pending,setPending]=useState(false);
 const call=<T,>(request:ReceivingRequest)=>receiving<T>(kernel.transport,project,request);
 const load=()=>{
  void call<ReceivingPage>({kind:"list",limit:50}).then(page=>{setPage(page);setUnavailable(false);}).catch(()=>{
   // The bound owner cut does not expose receiving — quiet absence.
   setUnavailable(true);setPage(undefined);
  });
 };
 useEffect(()=>{load();},[project,refresh,kernel.transport]);
 if(unavailable)return null;
 const shown=page?.returns??[];
 const act=async(request:ReceivingRequest,label:string)=>{
  setPending(true);setError(undefined);
  try{
   const reading=await call<ReturnReading>(request);
   setOpen(reading);setPage(await call<ReceivingPage>({kind:"list",limit:50}));
  }catch(err){setError(`${label} was refused: ${String(err)}`);}
  finally{setPending(false);}
 };
 const expand=async(row:ReturnRow)=>{
  setPending(true);setError(undefined);setBasis(undefined);
  try{setOpen(await call<ReturnReading>({kind:"read",return_ref:row.return_ref}));
   setBasis(await call<DocumentReading>({kind:"document",source_ref:row.source_ref,document_id:row.document_id}));}
  catch(err){setError(String(err));}
  finally{setPending(false);}
 };
 const review=(disposition:"accepted"|"rejected")=>{
  if(!open)return;
  const expected=disposition==="accepted"?basis?.revision.revision:undefined;
  void act({kind:"review",return_ref:open.return_ref,expected_return_revision:open.revision,disposition,expected_source_revision:expected},disposition==="accepted"?"Acceptance":"Rejection");
 };
 const include=()=>{
  if(!open?.record.review)return;
  void act({kind:"include",return_ref:open.return_ref,expected_return_revision:open.revision,expected_source_revision:open.record.review.source_revision},"Inclusion");
 };
 const recover=()=>{
  if(!open)return;
  void act({kind:"recover",return_ref:open.return_ref,expected_return_revision:open.revision},"Recovery");
 };
 // The proposal's exact document anchor — the entry/field the operation
 // targets — shown beside the operation, never paraphrased.
 const proposal=open?.record.proposal as {operation?:string;entry_id?:string;field_id?:string;reply_to?:string};
 const anchor=[proposal?.entry_id&&`entry ${proposal.entry_id}`,proposal?.field_id&&`field ${proposal.field_id}`,proposal?.reply_to&&`reply anchor ${proposal.reply_to}`].filter(Boolean).join(" · ");
 return <section className="project-returns" aria-label="Returns">
  <header><span>Returns</span>{page&&<small aria-label="Returns summary">{shown.length?`${shown.length} in the receiving field`:"receiving field is clear"}</small>}<button className="returns-refresh" aria-label="Refresh returns" disabled={pending} onClick={load}>↻</button></header>
  {shown.map(row=><button key={row.return_ref} className="project-return" aria-expanded={open?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
    <span className={`return-status return-${row.status}`}>{row.status}</span>
    <span className="return-origin">{row.author.actor_kind==="human"?"H":"Agent"} · {row.document_id}</span>
   </button>)}
  {open&&<div className="return-detail">
    <dl>
      <dt>Return</dt><dd>{open.return_ref}</dd>
      <dt>Author</dt><dd>{open.record.author.actor_kind==="human"?"Human":"Agent"} — {open.record.author.principal_ref}</dd>
      <dt>Proposed operation</dt><dd>{String((open.record.proposal as {operation?:string}).operation??open.record.proposal)}{anchor&&<span className="return-anchor"> — {anchor}</span>}</dd>
      {"html" in open.record.proposal&&<><dt>Proposed content</dt><dd className="return-proposal">{String(open.record.proposal.html)}</dd></>}
      <dt>Basis at arrival</dt><dd>{open.record.proposed_source_revision}{open.record.stale_at_arrival?" — already stale when it arrived":""}</dd>
      {basis&&<><dt>Current document basis</dt><dd>{basis.revision.revision}{basis.unreviewed_external_revision?" — externally edited since":""}</dd></>}
      {open.record.review&&<><dt>Review</dt><dd>{open.record.review.disposition} by {open.record.review.reviewer_ref} on {open.record.review.source_revision}</dd></>}
      {open.record.applied_source_revision&&<><dt>Applied</dt><dd>{open.record.applied_source_revision}</dd></>}
    </dl>
    {!open.included&&open.record.status!=="included"&&<div className="return-actions">
      {(open.record.status==="pending"||open.record.status==="needs-review")&&<>
        <button className="return-accept" disabled={pending||!basis} title={basis?undefined:"Read the document's current basis first"} onClick={()=>review("accepted")}>Accept current basis</button>
        <button className="return-reject" disabled={pending} onClick={()=>review("rejected")}>Reject</button>
      </>}
      {open.record.status==="accepted"&&<button className="return-accept" disabled={pending} onClick={include}>Include into the document</button>}
      {(open.record.status==="including"||open.record.status==="uncertain")&&<button className="return-recover" disabled={pending} onClick={recover}>Recover inclusion</button>}
    </div>}
    {open.record.last_error&&<p className="return-last-error" role="status">The owner recorded: {open.record.last_error}</p>}
    {open.included&&<p role="status" className="return-included">Included into the document.</p>}
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
