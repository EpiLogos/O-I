import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
import {htmlToText} from "../flow/instance";
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
const REVIEW_STATUS:Record<string,string>={pending:"Waiting for review","needs-review":"Needs review",accepted:"Accepted for inclusion",rejected:"Rejected",including:"Including…",uncertain:"Needs recovery",included:"Included"};
const reviewStatus=(status:string)=>REVIEW_STATUS[status]??"Review status unavailable";
/** Labels come from the native document, never from transport identifiers. */
const named=(label:unknown,id?:string)=>typeof label==="string"&&label.trim()&&label!==id?label.trim():undefined;

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
   setOpen({reading,register:open.register});
   setBasis(await call<DocumentReading>(open.register,{kind:"document",source_ref:reading.record.source_ref,document_id:reading.record.document_id}));
  }catch(err){
   setError(`${label} was refused: ${String(err)}`);
   // A failed inclusion may have recorded an uncertain intent. Re-read that
   // owner's state so Recover is offered without repeating the inclusion.
   try{setOpen({reading:await call<ReturnReading>(open.register,{kind:"read",return_ref:open.reading.return_ref}),register:open.register});}catch{/* Keep the original refusal visible; the queue still refreshes. */}
  }
  finally{setPending(false);inbox.reload();}
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
 const proposal=current?.record.proposal;
 const document=basis?.document as (DocumentReading["document"]&{fields?:{id:string;label?:string}[];entries?:{id:string;title?:string;label?:string}[]})|undefined;
 const field=document?.fields?.find(item=>item.id===proposal?.field_id);
 const entry=document?.entries?.find(item=>item.id===proposal?.entry_id);
 const target=[named(document?.title,document?.document_id),named(field?.label,field?.id)??named(entry?.title??entry?.label,entry?.id)].filter(Boolean).join(" · ");
 const changedSinceReview=!!current&&!!basis&&!current.included&&basis.revision.revision!==(current.record.review?.source_revision??current.record.proposed_source_revision);
 // The waiting queue, plus the item open here whatever its status — so the
 // outcome of an act stays readable where it was taken.
 const shown=inbox.rows.filter(row=>WAITING.has(row.status)||row.return_ref===current?.return_ref);
 const multi=new Set(inbox.rows.map(row=>row.register.project??"")).size>1;
 return <section className="project-receiving left-inbox" aria-label="Inbox">
  <header><span>Inbox</span><small aria-label="Inbox summary">{inbox.state==="reading"?"Reading…":inbox.state==="unavailable"?"Receiving isn't available here":shown.length?`${inbox.waiting.length}${inbox.lowerBound?"+":""} waiting`:"Nothing waiting"}</small><button className="receiving-refresh" aria-label="Refresh receiving" disabled={pending} onClick={inbox.reload}><Glyph name="refresh" size={12}/></button></header>
  {shown.map(row=><button key={`${row.register.project??""}:${row.return_ref}`} className={`receiving-row ${row.now_ref?"receiving-has-now":""}`} data-now-ref={row.now_ref??undefined} data-register={row.register.project??"Central"} aria-expanded={current?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
    <span className={`receiving-status receiving-${row.status}`} data-status={row.status}>{reviewStatus(row.status)}</span>
    <span className="receiving-origin">{row.author.actor_kind==="human"?"Human":"Agent"} · {current?.return_ref===row.return_ref?named(basis?.document.title,row.document_id)??"Contribution":"Contribution"}{multi?<span className="receiving-register"> · {row.register.label}</span>:null}</span>
    <time className="receiving-when">{formatRelativeTime(row.received_at_unix_seconds*1000).replace(/ ago$/,"")}</time>
   </button>)}
  {pending&&!current&&<p className="left-reading" role="status">Opening…</p>}
  {current&&<div className="receiving-detail">
    <p className="receiving-origin">{current.record.author.actor_kind==="human"?"Human":"Agent"} contribution</p>
    {target&&<p className="receiving-target">For {target}</p>}
    {"html" in current.record.proposal&&<div className="receiving-proposal">{htmlToText(String(current.record.proposal.html))}</div>}
    <p className="receiving-review" role="status">{reviewStatus(current.record.status)}</p>
    {current.record.stale_at_arrival&&<p className="receiving-warning" role="status">This contribution arrived against an earlier version of the document.</p>}
    {!current.included&&current.record.status!=="included"&&(changedSinceReview||basis?.unreviewed_external_revision)&&<p className="receiving-warning" role="status">The document has changed{basis?.unreviewed_external_revision?" outside the app":" since this contribution was prepared or reviewed"}. Review the current document before including it.</p>}
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
