import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
import {NowRelations} from "./NowRelations";
import {Glyph} from "../workspace/Glyph";
import "./receiving.css";
/** Pending human Returns (Wave 6E): what arrived, from whom, against which
 * document — reviewed and included only through Central's native
 * revision-checked operations. Arrival never edits a document; this tray
 * neither mints identities nor widens disclosure. When the bound Central
 * owner does not expose receiving, the native failure remains visible — the desktop
 * never substitutes a failed read with successful emptiness. */
export function ReturnsTray({project,refresh,openReturnRef,onOpenSource}:{project:string|null;refresh:number;openReturnRef?:string;onOpenSource?:(ref:string)=>void}) {
 const kernel=useKernel();
 const [page,setPage]=useState<ReceivingPage>();
 const [loadError,setLoadError]=useState<string>();
 const generation=useRef(0);
 const detailGeneration=useRef(0);
 const [open,setOpen]=useState<ReturnReading>();
 const [basis,setBasis]=useState<DocumentReading>();
 const [error,setError]=useState<string>();
 const [pending,setPending]=useState(false);
 const call=<T,>(request:ReceivingRequest)=>receiving<T>(kernel.transport,project,request);
 const load=(after?:number)=>{
  const ticket=++generation.current;setPending(true);setLoadError(undefined);
  void call<ReceivingPage>({kind:"list",after,limit:50}).then(value=>{
   if(value.schema!=="central.receiving-page/v1"||!Array.isArray(value.returns))throw new Error("Unsupported native receiving page");
   if(ticket===generation.current)setPage(value);
  }).catch(reason=>{if(ticket===generation.current)setLoadError(String(reason));})
   .finally(()=>{if(ticket===generation.current)setPending(false);});
 };
 useEffect(()=>{setPage(undefined);setOpen(undefined);setBasis(undefined);setError(undefined);detailGeneration.current++;load();return()=>{generation.current++;detailGeneration.current++;};},[project,refresh,kernel.transport]);
 useEffect(()=>{if(openReturnRef)void expandRef(openReturnRef);},[openReturnRef,project]);
 const shown=page?.returns??[];
 const act=async(request:ReceivingRequest,label:string)=>{
  const ticket=generation.current;
  setPending(true);setError(undefined);
  try{
   const reading=await call<ReturnReading>(request);
   const page=await call<ReceivingPage>({kind:"list",limit:50});
   if(ticket!==generation.current)return;
   if(reading.schema!=="central.receiving-reading/v1"||page.schema!=="central.receiving-page/v1"||!Array.isArray(page.returns))throw new Error("Malformed native receiving acknowledgement");
   setOpen(reading);setPage(page);setBasis(undefined);
  }catch(err){if(ticket===generation.current)setError(`${label} did not complete: ${String(err)} — reread before any further action`);}
  finally{if(ticket===generation.current)setPending(false);}
 };
 async function expandRef(reference:string) {
  const ticket=generation.current;
  const detail=++detailGeneration.current;
  setPending(true);setError(undefined);setBasis(undefined);
  try {
   const value=await call<ReturnReading>({kind:"read",return_ref:reference});
   if(value.schema!=="central.receiving-reading/v1"||value.return_ref!==reference)throw new Error("Redirected native Return");
   if(ticket!==generation.current||detail!==detailGeneration.current)return;
   setOpen(value);
   const document=await call<DocumentReading>({kind:"document",source_ref:value.record.source_ref,document_id:value.record.document_id});
   if(document.schema!=="central.document-reading/v1"||document.source?.ref!==value.record.source_ref||document.document_id!==value.record.document_id)throw new Error("Redirected native document basis");
   if(ticket===generation.current&&detail===detailGeneration.current)setBasis(document);
  } catch(err){if(ticket===generation.current&&detail===detailGeneration.current)setError(String(err));}
  finally{if(ticket===generation.current&&detail===detailGeneration.current)setPending(false);}
 }
 const expand=(row:ReturnRow)=>expandRef(row.return_ref);
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
  <header><span>Returns</span>{page&&<small aria-label="Returns summary">{shown.length?`${shown.length} in this native page`:"no Returns in this native page"}</small>}<button className="returns-refresh" aria-label="Refresh returns" disabled={pending} onClick={()=>load()}><Glyph name="refresh" size={12}/></button></header>
  {loadError&&<p role="alert">Receiving read failed: {loadError}{page?" — last page retained, not current success.":""}</p>}
  {!page&&!loadError&&<p role="status">Reading native Returns…</p>}
  {!!page?.withheld_unavailable_sources&&<p role="status">{page.withheld_unavailable_sources} source readings withheld or unavailable.</p>}
  {page?.more&&<p role="status">More Returns exist beyond this page. <button disabled={pending} onClick={()=>load(page.next_after??undefined)}>Next native page</button></p>}
  {shown.map(row=><button key={row.return_ref} className={`project-return ${row.now_ref?"return-has-now":""}`} data-now-ref={row.now_ref??undefined} aria-expanded={open?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
    <span className={`return-status return-${row.status}`}>{row.status}</span>
    <span className="return-origin">{row.author.actor_kind==="human"?"H":"Agent"} · {row.document_id}{row.now_ref&&<span className="return-now-mark" data-now-ref={row.now_ref}> · now</span>}</span>
   </button>)}
  {open&&<div className="return-detail">
    <dl>
      <dt>Return</dt><dd>{open.return_ref}</dd>
      <dt>Document source</dt><dd>{onOpenSource?<button type="button" onClick={()=>onOpenSource(open.record.source_ref)}>{open.record.source_ref}</button>:open.record.source_ref}</dd>
      {(["run_ref","session_ref","task_ref","day_ref"] as const).map(key=>open.record[key]?<div key={key}><dt>{key}</dt><dd>{open.record[key]}</dd></div>:null)}
      <dt>Author</dt><dd>{open.record.author.actor_kind==="human"?"Human":"Agent"} — {open.record.author.principal_ref}</dd>
      <dt>Proposed operation</dt><dd>{String((open.record.proposal as {operation?:string}).operation??open.record.proposal)}{anchor&&<span className="return-anchor"> — {anchor}</span>}</dd>
      {"html" in open.record.proposal&&<><dt>Proposed content</dt><dd className="return-proposal">{String(open.record.proposal.html)}</dd></>}
      <dt>Basis at arrival</dt><dd>{open.record.proposed_source_revision}{open.record.stale_at_arrival?" — already stale when it arrived":""}</dd>
      {basis&&<><dt>Current document basis</dt><dd>{basis.revision.revision}{basis.unreviewed_external_revision?" — externally edited since":""}</dd></>}
      {open.record.review&&<><dt>Review</dt><dd>{open.record.review.disposition} by {open.record.review.reviewer_ref} on {open.record.review.source_revision}</dd></>}
      {open.record.applied_source_revision&&<><dt>Applied</dt><dd>{open.record.applied_source_revision}</dd></>}
      {open.record.now_ref&&<NowRelations nowRef={open.record.now_ref} project={project} onOpenSource={onOpenSource} onReturn={reference=>void expandRef(reference)}/>}
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
