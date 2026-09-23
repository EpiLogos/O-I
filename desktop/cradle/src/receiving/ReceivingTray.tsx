import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
import {NowRelations} from "./NowRelations";
import {Glyph} from "../workspace/Glyph";
import {formatRelativeTime} from "../shared/relativeTime";
import "./receiving.css";
/** THE INBOX (10-SIDEBARS §3.1, ruling D3): the app's one queue of material
 * waiting for the person's judgement, reachable from the left foot in every
 * mode. It reads Central's native receiving field of every register — the
 * root (Central) and each Work project — and replaces every scattered
 * receiving mount the left used to carry (a tray inside each project branch,
 * Factory's Now/Remembered bands).
 *
 * What arrived, from whom, against which document — reviewed and included
 * only through Central's native revision-checked operations. Arrival never
 * edits a document; this body neither mints identities nor widens
 * disclosure. Opening an item opens its material in a pane (the frame's
 * route) and keeps the item's review controls here, beside it. Owner ruling
 * 7: nothing here says "returns" — the rows are named by what they carry.
 *
 * The count is the native count, or a true lower bound ("20+") when a
 * register's page reports `more`. A register whose owner does not expose
 * receiving is quietly absent from the count — never a fabricated zero. */

/** Statuses still waiting for a human act (review, include or recover). */
export const WAITING=new Set(["pending","needs-review","accepted","including","uncertain"]);
const PAGE=20;

export interface InboxRegister {project?:string;label:string}
export interface InboxRow extends ReturnRow {register:InboxRegister}
export interface InboxReading {
 rows:InboxRow[];
 /** Waiting rows only, newest first. */
 waiting:InboxRow[];
 /** A register's page reported more rows than it served: the count is a lower bound. */
 lowerBound:boolean;
 state:"reading"|"ready"|"unavailable";
 readAt?:number;
}

/** Read every register's receiving field. Registers that refuse are skipped. */
export function useInbox(registers:InboxRegister[],refresh:number):InboxReading&{reload:()=>void}{
 const kernel=useKernel();
 const [reading,setReading]=useState<InboxReading>({rows:[],waiting:[],lowerBound:false,state:"reading"});
 const [attempt,setAttempt]=useState(0);
 const key=registers.map(r=>r.project??"").join("|");
 const held=useRef(registers);held.current=registers;
 useEffect(()=>{
  let live=true;
  const read=async()=>{
   const pages=await Promise.all(held.current.map(async register=>{
    try{return {register,page:await receiving<ReceivingPage>(kernel.transport,register.project??null,{kind:"list",limit:PAGE})};}
    catch{return {register,page:undefined};}
   }));
   if(!live)return;
   const served=pages.filter(entry=>!!entry.page);
   const rows=served.flatMap(({register,page})=>page!.returns.map(row=>({...row,register})));
   rows.sort((a,b)=>b.received_at_unix_seconds-a.received_at_unix_seconds);
   const lowerBound=served.some(({page})=>page!.more);
   setReading({rows,waiting:rows.filter(row=>WAITING.has(row.status)),lowerBound,state:served.length?"ready":"unavailable",readAt:Date.now()});
  };
  void read();
  // The queue is live: re-read on a quiet cadence and whenever the window
  // regains focus (an agent may have delivered while the person was away).
  const timer=setInterval(()=>{if(document.visibilityState==="visible")void read();},60_000);
  const focus=()=>void read();
  window.addEventListener("focus",focus);
  return()=>{live=false;clearInterval(timer);window.removeEventListener("focus",focus);};
 },[kernel.transport,key,refresh,attempt]);
 const reload=useCallback(()=>setAttempt(value=>value+1),[]);
 return {...reading,reload};
}

/** The badge text: absent at zero; the native count or a true lower bound. */
export function inboxBadge(reading:Pick<InboxReading,"waiting"|"lowerBound">):string|undefined{
 const count=reading.waiting.length;
 if(!count&&!reading.lowerBound)return undefined;
 return reading.lowerBound?`${count}+`:String(count);
}

/** The Inbox body. */
export function ReceivingTray({inbox,onOpenMaterial}:{inbox:InboxReading&{reload:()=>void};onOpenMaterial?:(material:{ref:string;path:string;project?:string;document_id:string;return_ref:string})=>Promise<void>|void}) {
 const kernel=useKernel();
 const [open,setOpen]=useState<{reading:ReturnReading;register:InboxRegister}>();
 const [basis,setBasis]=useState<DocumentReading>();
 const [error,setError]=useState<string>();
 const [pending,setPending]=useState(false);
 const call=<T,>(register:InboxRegister,request:ReceivingRequest)=>receiving<T>(kernel.transport,register.project??null,request);
 const act=async(request:ReceivingRequest,label:string)=>{
  if(!open)return;
  setPending(true);setError(undefined);
  try{
   const reading=await call<ReturnReading>(open.register,request);
   setOpen({reading,register:open.register});inbox.reload();
  }catch(err){setError(`${label} was refused: ${String(err)}`);}
  finally{setPending(false);}
 };
 const expand=async(row:InboxRow)=>{
  setPending(true);setError(undefined);setBasis(undefined);
  try{
   const reading=await call<ReturnReading>(row.register,{kind:"read",return_ref:row.return_ref});
   setOpen({reading,register:row.register});
   const document=await call<DocumentReading>(row.register,{kind:"document",source_ref:row.source_ref,document_id:row.document_id});
   setBasis(document);
   // The material opens in a pane; the review controls stay here, beside it.
   await onOpenMaterial?.({ref:document.source.ref,path:document.source.path,project:row.register.project,document_id:row.document_id,return_ref:row.return_ref});
  }
  catch(err){setError(String(err));}
  finally{setPending(false);}
 };
 const review=(disposition:"accepted"|"rejected")=>{
  if(!open)return;
  const expected=disposition==="accepted"?basis?.revision.revision:undefined;
  void act({kind:"review",return_ref:open.reading.return_ref,expected_return_revision:open.reading.revision,disposition,expected_source_revision:expected},disposition==="accepted"?"Acceptance":"Rejection");
 };
 const include=()=>{
  if(!open?.reading.record.review)return;
  void act({kind:"include",return_ref:open.reading.return_ref,expected_return_revision:open.reading.revision,expected_source_revision:open.reading.record.review.source_revision},"Inclusion");
 };
 const recover=()=>{
  if(!open)return;
  void act({kind:"recover",return_ref:open.reading.return_ref,expected_return_revision:open.reading.revision},"Recovery");
 };
 const current=open?.reading;
 // The proposal's exact document anchor — the entry/field the operation
 // targets — shown beside the operation, never paraphrased.
 const proposal=current?.record.proposal as {operation?:string;entry_id?:string;field_id?:string;reply_to?:string}|undefined;
 const anchor=[proposal?.entry_id&&`entry ${proposal.entry_id}`,proposal?.field_id&&`field ${proposal.field_id}`,proposal?.reply_to&&`reply anchor ${proposal.reply_to}`].filter(Boolean).join(" · ");
 // The waiting queue, plus the item open here whatever its status — so the
 // outcome of an act stays readable where it was taken.
 const shown=inbox.rows.filter(row=>WAITING.has(row.status)||row.return_ref===current?.return_ref);
 const multi=new Set(inbox.rows.map(row=>row.register.project??"")).size>1;
 return <section className="project-receiving left-inbox" aria-label="Inbox">
  <header><span>Inbox</span><small aria-label="Inbox summary">{inbox.state==="reading"?"Reading…":inbox.state==="unavailable"?"Receiving isn't available here":shown.length?`${inbox.waiting.length}${inbox.lowerBound?"+":""} waiting`:"Nothing waiting"}</small><button className="receiving-refresh" aria-label="Refresh receiving" disabled={pending} onClick={inbox.reload}><Glyph name="refresh" size={12}/></button></header>
  {shown.map(row=><button key={`${row.register.project??""}:${row.return_ref}`} className={`receiving-row ${row.now_ref?"receiving-has-now":""}`} data-now-ref={row.now_ref??undefined} data-register={row.register.project??"Central"} aria-expanded={current?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
    <span className={`receiving-status receiving-${row.status}`}>{row.status}</span>
    <span className="receiving-origin">{row.author.actor_kind==="human"?"Human":"Agent"} · {row.document_id}{multi?<span className="receiving-register"> · {row.register.label}</span>:null}{row.now_ref&&<span className="receiving-now-mark" data-now-ref={row.now_ref}> · now</span>}</span>
    <time className="receiving-when">{formatRelativeTime(row.received_at_unix_seconds*1000).replace(/ ago$/,"")}</time>
   </button>)}
  {current&&<div className="receiving-detail">
    <dl>
      <dt>Author</dt><dd>{current.record.author.actor_kind==="human"?"Human":"Agent"} — {current.record.author.principal_ref}</dd>
      <dt>Proposed operation</dt><dd>{String((current.record.proposal as {operation?:string}).operation??"a change")}{anchor&&<span className="receiving-anchor"> — {anchor}</span>}</dd>
      {"html" in current.record.proposal&&<><dt>Proposed content</dt><dd className="receiving-proposal">{String(current.record.proposal.html)}</dd></>}
      <dt>Basis at arrival</dt><dd>{current.record.proposed_source_revision}{current.record.stale_at_arrival?" — already stale when it arrived":""}</dd>
      {basis&&<><dt>Current document basis</dt><dd>{basis.revision.revision}{basis.unreviewed_external_revision?" — externally edited since":""}</dd></>}
      {current.record.review&&<><dt>Review</dt><dd>{current.record.review.disposition} by {current.record.review.reviewer_ref} on {current.record.review.source_revision}</dd></>}
      {current.record.applied_source_revision&&<><dt>Applied</dt><dd>{current.record.applied_source_revision}</dd></>}
      {current.record.now_ref&&<NowRelations nowRef={current.record.now_ref} project={open?.register.project??null}/>}
    </dl>
    {!current.included&&current.record.status!=="included"&&<div className="receiving-actions">
      {(current.record.status==="pending"||current.record.status==="needs-review")&&<>
        <button className="receiving-accept" disabled={pending||!basis} title={basis?undefined:"Read the document's current basis first"} onClick={()=>review("accepted")}>Accept current basis</button>
        <button className="receiving-reject" disabled={pending} onClick={()=>review("rejected")}>Reject</button>
      </>}
      {current.record.status==="accepted"&&<button className="receiving-accept" disabled={pending} onClick={include}>Include into the document</button>}
      {(current.record.status==="including"||current.record.status==="uncertain")&&<button className="receiving-recover" disabled={pending} onClick={recover}>Recover inclusion</button>}
    </div>}
    {current.record.last_error&&<p className="receiving-last-error" role="status">The owner recorded: {current.record.last_error}</p>}
    {current.included&&<p role="status" className="receiving-included">Included into the document.</p>}
    <details className="receiving-raw"><summary>Show raw</summary><pre className="oi-scroll-quiet">{JSON.stringify(current.record,null,2)}</pre></details>
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
