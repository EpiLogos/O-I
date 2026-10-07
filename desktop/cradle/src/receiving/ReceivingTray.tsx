import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {isRequest,receiving,type DocumentReading,type ReceivingPage,type ReceivingRequest,type ReturnReading,type ReturnRow} from "./client";
import {awaitsFactory,CARRYING_FAMILY,commissionRequest} from "./commission";
import {central,type AgentSetReading} from "../central/client";
import {commission,discoverSources} from "../contributions/factory/desk/factoryReads";
import {CENTRAL_SCOPE} from "../workspace/scope";
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
 * Two kinds of item arrive. A contribution proposes an edit to a document.
 * A request asks the person to decide — a proposal of work or a question —
 * and targets no document: the decision is recorded on the item and travels
 * back to the asking Agent's NOW. An accepted proposal for Factory becomes a
 * Run through Factory's own intake (commission.ts).
 *
 * The count is the owner's exact `open_total` when every register reports
 * it; otherwise the rows still waiting, or a true lower bound ("20+") when a
 * register's page reports `more`. A register whose owner does not expose
 * receiving is quietly absent from the count — never a fabricated zero. */

/** Statuses still waiting for a human act (review, include or recover), for
 * owner cuts that do not yet report `settled` themselves. */
export const WAITING=new Set(["pending","needs-review","accepted","including","uncertain"]);
/** Whether a row still waits for the person: the owner's word when given. */
export const isWaiting=(row:Pick<ReturnRow,"settled"|"status">)=>typeof row.settled==="boolean"?!row.settled:WAITING.has(row.status);
const PAGE=20;
const MIN_GAP_MS=15_000;
const REVIEW_STATUS:Record<string,string>={pending:"Waiting for review","needs-review":"Needs review",accepted:"Accepted for inclusion",rejected:"Rejected",including:"Including…",uncertain:"Needs recovery",included:"Included"};
const reviewStatus=(status:string)=>REVIEW_STATUS[status]??"Review status unavailable";
/** What a request's status means to the person who decides it. */
export function requestStatus(record:Pick<ReturnReading["record"],"status"|"request"|"realisation">):string{
 const forFactory=record.request?.proposed_owner_ref==="factory";
 switch(record.status){
  case"pending":case"needs-review":return record.request?.kind==="question"?"Waiting for your answer":"Waiting for your decision";
  case"accepted":return forFactory&&!record.realisation?"Accepted — not yet commissioned in Factory":"Accepted";
  case"rejected":return "Declined";
  case"answered":return "Answered";
  case"included":return forFactory?"Commissioned in Factory":"Carried out";
  default:return "Status unavailable";
 }
}
/** The row's short word for a request: what the person has left to do. */
export function requestRowStatus(row:Pick<ReturnRow,"status"|"request"|"settled">):string{
 if(row.status==="pending"||row.status==="needs-review")return row.request?.kind==="question"?"To answer":"To decide";
 if(row.status==="accepted"&&row.settled===false)return "To commission";
 return {accepted:"Accepted",rejected:"Declined",answered:"Answered",included:"Commissioned"}[row.status]??"—";
}
/** Who is asking: the declared producer a carrier delivered for, else the
 * credentialed author. A claimed attribution is said so. */
export function askedBy(row:Pick<ReturnRow,"author"|"declared_producer">):string{
 const producer=row.declared_producer;
 if(producer)return `${producer.ref}${producer.attribution==="claimed"?" (as its carrier claims)":""}`;
 return row.author.actor_kind==="human"?"you":row.author.principal_ref;
}
/** Labels come from the native document, never from transport identifiers. */
const named=(label:unknown,id?:string)=>typeof label==="string"&&label.trim()&&label!==id?label.trim():undefined;

export interface InboxRegister {project?:string;label:string}
export interface InboxRow extends ReturnRow {register:InboxRegister}
export interface InboxReading {
 rows:InboxRow[];
 /** Waiting rows only, newest first. */
 waiting:InboxRow[];
 /** How many items wait: the owner's exact count when every register gives it. */
 count:number;
 /** A register's page reported more rows than it served: the count is a lower bound. */
 lowerBound:boolean;
 state:"reading"|"ready"|"unavailable";
 readAt?:number;
}

/** Read every register's receiving field. Registers that refuse are skipped. */
export function useInbox(registers:InboxRegister[],refresh:number):InboxReading&{reload:()=>void}{
 const kernel=useKernel();
 const [reading,setReading]=useState<InboxReading>({rows:[],waiting:[],count:0,lowerBound:false,state:"reading"});
 const [attempt,setAttempt]=useState(0);
 const key=registers.map(r=>r.project??"").join("|");
 const held=useRef(registers);held.current=registers;
 useEffect(()=>{
  let live=true,inflight=false,lastAt=0;
  // Each register read is a `ctrl central.receiving.list`, and Central rescans its whole source horizon under one lock per call: reads
  // run one register at a time, never overlap (a read in flight absorbs the next trigger), and a focus event cannot re-read within
  // MIN_GAP_MS of the last. Overlapping parallel reads once queued ~80 ctrl processes behind that lock and saturated the machine.
  const read=async(force=false)=>{
   if(inflight||(!force&&Date.now()-lastAt<MIN_GAP_MS))return;
   inflight=true;
   const pages:{register:InboxRegister;page:ReceivingPage|undefined}[]=[];
   try{
    for(const register of held.current){
     if(!live)return;
     try{pages.push({register,page:await receiving<ReceivingPage>(kernel.transport,register.project??null,{kind:"list",limit:PAGE,open:true})});}
     catch{pages.push({register,page:undefined});}
    }
   }finally{inflight=false;lastAt=Date.now();}
   if(!live)return;
   const served=pages.filter(entry=>!!entry.page);
   const rows=served.flatMap(({register,page})=>page!.returns.map(row=>({...row,register})));
   rows.sort((a,b)=>b.received_at_unix_seconds-a.received_at_unix_seconds);
   const waiting=rows.filter(isWaiting);
   const exact=served.length>0&&served.every(({page})=>typeof page!.open_total==="number");
   const count=exact?served.reduce((sum,{page})=>sum+page!.open_total!,0):waiting.length;
   const lowerBound=!exact&&served.some(({page})=>page!.more);
   setReading({rows,waiting,count,lowerBound,state:served.length?"ready":"unavailable",readAt:Date.now()});
  };
  void read(true);
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
export function inboxBadge(reading:Pick<InboxReading,"count"|"lowerBound">):string|undefined{
 const count=reading.count;
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
 const [words,setWords]=useState("");
 const call=<T,>(register:InboxRegister,request:ReceivingRequest)=>receiving<T>(kernel.transport,register.project??null,request);
 /** A contribution's document basis; a request has no document. */
 const readBasis=async(register:InboxRegister,record:ReturnReading["record"])=>
  record.source_ref&&record.document_id?call<DocumentReading>(register,{kind:"document",source_ref:record.source_ref,document_id:record.document_id}):undefined;
 const act=async(request:ReceivingRequest,label:string)=>{
  if(!open)return;
  setPending(true);setError(undefined);
  try{
   const reading=await call<ReturnReading>(open.register,request);
   setOpen({reading,register:open.register});
   setBasis(await readBasis(open.register,reading.record));
   setWords("");
  }catch(err){
   setError(`${label} was refused: ${String(err)}`);
   // A failed inclusion may have recorded an uncertain intent. Re-read that
   // owner's state so Recover is offered without repeating the inclusion.
   try{setOpen({reading:await call<ReturnReading>(open.register,{kind:"read",return_ref:open.reading.return_ref}),register:open.register});}catch{/* Keep the original refusal visible; the queue still refreshes. */}
  }
  finally{setPending(false);inbox.reload();}
 };
 const expand=async(row:InboxRow)=>{
  setPending(true);setError(undefined);setBasis(undefined);setWords("");
  try{
   const reading=await call<ReturnReading>(row.register,{kind:"read",return_ref:row.return_ref});
   setOpen({reading,register:row.register});
   const document=await readBasis(row.register,reading.record);
   setBasis(document);
   // The material opens in a pane; the review controls stay here, beside it.
   if(document&&row.document_id)await onOpenMaterial?.({ref:document.source.ref,path:document.source.path,project:row.register.project,document_id:row.document_id,return_ref:row.return_ref});
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
  if(!open?.reading.record.review?.source_revision)return;
  void act({kind:"include",return_ref:open.reading.return_ref,expected_return_revision:open.reading.revision,expected_source_revision:open.reading.record.review.source_revision},"Inclusion");
 };
 /** A request's decision: the person's words travel back to the asking NOW. */
 const decide=(disposition:"accepted"|"rejected"|"answered")=>{
  if(!open)return;
  const text=words.trim()||undefined;
  void act({kind:"review",return_ref:open.reading.return_ref,expected_return_revision:open.reading.revision,disposition,
   ...(disposition==="answered"?{answer:text}:{note:text})},disposition==="answered"?"The answer":disposition==="accepted"?"Acceptance":"Declining");
 };
 /** Accepted proposal → Factory's own intake → the Run recorded on the item.
  * Each step is the owner's; an interruption leaves the item accepted and
  * "Commission in Factory" repeats safely (Factory replays the same request). */
 const commissionInFactory=async(reading:ReturnReading,register:InboxRegister)=>{
  const discovery=await discoverSources(kernel.transport,register.project?{kind:"project",project:register.project}:CENTRAL_SCOPE);
  const source=discovery.sources[0];
  if(!source?.projectKey)throw new Error(`Factory has no development source for ${register.label}`);
  const family=await central<AgentSetReading>(kernel.transport,null,{kind:"agent-set",agent_set_ref:CARRYING_FAMILY});
  const receipt=await commission(kernel.transport,source.statePath,commissionRequest(reading,{statePath:source.statePath,projectKey:source.projectKey},register.project,family));
  return call<ReturnReading>(register,{kind:"include",return_ref:reading.return_ref,expected_return_revision:reading.revision,
   realisation_ref:receipt.commission.runRef,realisation_owner_ref:"factory"});
 };
 const acceptAndCommission=async()=>{
  if(!open)return;
  const register=open.register;
  setPending(true);setError(undefined);
  let reading=open.reading;
  try{
   if(!awaitsFactory(reading)){
    reading=await call<ReturnReading>(register,{kind:"review",return_ref:reading.return_ref,expected_return_revision:reading.revision,disposition:"accepted",note:words.trim()||undefined});
    setOpen({reading,register});setWords("");
   }
   reading=await commissionInFactory(reading,register);
   setOpen({reading,register});
  }catch(err){
   setError(`Commissioning was not completed: ${String(err)}`);
   try{setOpen({reading:await call<ReturnReading>(register,{kind:"read",return_ref:reading.return_ref}),register});}catch{/* Keep the refusal visible. */}
  }finally{setPending(false);inbox.reload();}
 };
 const recover=()=>{
  if(!open)return;
  void act({kind:"recover",return_ref:open.reading.return_ref,expected_return_revision:open.reading.revision},"Recovery");
 };
 const current=open?.reading;
 const proposal=current?.record.proposal??undefined;
 const legacyCommission=proposal?.schema==="oi.factory-commission-proposal/v1"?proposal as {schema:string;proposal_ref:string;discrepancy:string;diagnosis_refs?:string[];suggested_factory_request?:Record<string,unknown>;factory_intake?:string}:undefined;
 const document=basis?.document as (DocumentReading["document"]&{fields?:{id:string;label?:string}[];entries?:{id:string;title?:string;label?:string}[]})|undefined;
 const field=document?.fields?.find(item=>item.id===proposal?.field_id);
 const entry=document?.entries?.find(item=>item.id===proposal?.entry_id);
 const target=[named(document?.title,document?.document_id),named(field?.label,field?.id)??named(entry?.title??entry?.label,entry?.id)].filter(Boolean).join(" · ");
 const changedSinceReview=!!current&&!!basis&&!current.included&&basis.revision.revision!==(current.record.review?.source_revision??current.record.proposed_source_revision);
 // The waiting queue, plus the item open here whatever its status — so the
 // outcome of an act stays readable where it was taken.
 // The Inbox reads only what waits; an item just settled here is kept from
 // its own reading so its outcome stays where the act was taken.
 const settledHere:InboxRow|undefined=current&&open&&!inbox.rows.some(row=>row.return_ref===current.return_ref&&(row.register.project??"")===(open.register.project??""))
  ?{...current.record,request:current.record.request??null,return_ref:current.return_ref,revision:current.revision,register:open.register,settled:true}:undefined;
 const shown=[...(settledHere?[settledHere]:[]),...inbox.rows.filter(row=>isWaiting(row)||row.return_ref===current?.return_ref)];
 const multi=new Set(inbox.rows.map(row=>row.register.project??"")).size>1;
 return <section className="project-receiving left-inbox" aria-label="Inbox">
  <header><span>Inbox</span><small aria-label="Inbox summary">{inbox.state==="reading"?"Reading…":inbox.state==="unavailable"?"Receiving isn't available here":inbox.count||inbox.lowerBound?`${inbox.count}${inbox.lowerBound?"+":""} waiting`:"Nothing waiting"}</small><button className="receiving-refresh" aria-label="Refresh receiving" disabled={pending} onClick={inbox.reload}><Glyph name="refresh" size={12}/></button></header>
  {shown.map(row=><button key={`${row.register.project??""}:${row.return_ref}`} className={`receiving-row ${row.now_ref?"receiving-has-now":""}`} data-now-ref={row.now_ref??undefined} data-register={row.register.project??"Central"} aria-expanded={current?.return_ref===row.return_ref} onClick={()=>void expand(row)}>
    <span className={`receiving-status receiving-${row.status}`} data-status={row.status}>{isRequest(row)?requestRowStatus(row):reviewStatus(row.status)}</span>
    {isRequest(row)&&row.request
     ?<span className="receiving-origin receiving-request-subject" data-request-kind={row.request.kind}>{row.request.kind==="question"?"Question":"Proposal"} · {row.request.subject}{multi?<span className="receiving-register"> · {row.register.label}</span>:null}</span>
     :<span className="receiving-origin">{row.author.actor_kind==="human"?"Human":"Agent"} · {current?.return_ref===row.return_ref?named(basis?.document.title,row.document_id??undefined)??"Contribution":"Contribution"}{multi?<span className="receiving-register"> · {row.register.label}</span>:null}</span>}
    <time className="receiving-when">{formatRelativeTime(row.received_at_unix_seconds*1000).replace(/ ago$/,"")}</time>
   </button>)}
  {pending&&!current&&<p className="left-reading" role="status">Opening…</p>}
  {current&&current.record.kind==="request"&&current.record.request&&<RequestDetail reading={current} words={words} setWords={setWords} pending={pending}
    decide={decide} acceptAndCommission={()=>void acceptAndCommission()}/>}
  {current&&current.record.kind!=="request"&&<div className="receiving-detail">
    <p className="receiving-origin">{current.record.author.actor_kind==="human"?"Human":"Agent"} contribution</p>
    {legacyCommission&&<p className="receiving-target">Factory commission proposal · <code>{legacyCommission.proposal_ref}</code>{Array.isArray(legacyCommission.diagnosis_refs)&&legacyCommission.diagnosis_refs.length?` · ${legacyCommission.diagnosis_refs.length} evidence ref${legacyCommission.diagnosis_refs.length===1?"":"s"}`:""}</p>}
    {target&&<p className="receiving-target">For {target}</p>}
    {proposal&&"html" in proposal&&<div className="receiving-proposal">{htmlToText(String(proposal.html))}</div>}
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
    {legacyCommission&&current.record.status==="accepted"&&<p className="oi-note receiving-commission">An earlier commission proposal made as a document edit. New proposals arrive as requests, and accepting one commissions the Run in Factory directly.</p>}
    {current.included&&<p role="status" className="receiving-included">Included into the document.</p>}
    <details className="receiving-raw"><summary>Show raw</summary><pre className="oi-scroll-quiet">{JSON.stringify(current.record,null,2)}</pre></details>
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}

/** A request is read as a decision to make, not an edit to include: who is
 * asking, what, why, on what evidence — and the person's words go back. */
function RequestDetail({reading,words,setWords,pending,decide,acceptAndCommission}:{reading:ReturnReading;words:string;setWords:(value:string)=>void;pending:boolean;
 decide:(disposition:"accepted"|"rejected"|"answered")=>void;acceptAndCommission:()=>void}){
 const record=reading.record,request=record.request!;
 const question=request.kind==="question",forFactory=request.proposed_owner_ref==="factory";
 const open=record.status==="pending"||record.status==="needs-review";
 const review=record.review;
 return <div className="receiving-detail receiving-request" data-request-kind={request.kind}>
  <p className="receiving-origin">{question?"A question":"A proposal"} from {askedBy(record)}</p>
  <h4 className="receiving-request-subject">{request.subject}</h4>
  {request.body&&<p className="receiving-request-body">{request.body}</p>}
  {record.summary&&record.summary!==request.body&&<p className="receiving-request-summary">{record.summary}</p>}
  {forFactory&&<p className="receiving-target">Accepting it commissions the work in Factory.</p>}
  {!!record.evidence_refs?.length&&<details className="receiving-evidence"><summary>Evidence ({record.evidence_refs.length})</summary><ul>{record.evidence_refs.map(ref=><li key={ref}><code>{ref}</code></li>)}</ul></details>}
  <p className="receiving-review" role="status">{requestStatus(record)}</p>
  {review?.answer&&<p className="receiving-decision">Your answer: {review.answer}</p>}
  {review?.note&&<p className="receiving-decision">Your note: {review.note}</p>}
  {record.realisation&&<p role="status" className="receiving-included">Factory made {record.realisation.ref}; its Return will arrive here.</p>}
  {open&&<>
   {question&&!!request.options?.length&&<div className="receiving-options" role="group" aria-label="Offered answers">{request.options.map(option=>
    <button key={option} className="receiving-option" aria-pressed={words===option} disabled={pending} onClick={()=>setWords(option)}>{option}</button>)}</div>}
   <textarea className="receiving-words" aria-label={question?"Your answer":"A note back (optional)"} placeholder={question?"Your answer":"A note back (optional)"}
    value={words} disabled={pending} onChange={event=>setWords(event.target.value)} rows={3}/>
   <div className="receiving-actions">
    {question
     ?<button className="receiving-accept" disabled={pending||!words.trim()} onClick={()=>decide("answered")}>Answer</button>
     :forFactory
      ?<button className="receiving-accept" disabled={pending} onClick={acceptAndCommission}>Accept and commission</button>
      :<button className="receiving-accept" disabled={pending} onClick={()=>decide("accepted")}>Accept</button>}
    <button className="receiving-reject" disabled={pending} onClick={()=>decide("rejected")}>Decline</button>
   </div>
  </>}
  {awaitsFactory(reading)&&<div className="receiving-actions"><button className="receiving-recover" disabled={pending} onClick={acceptAndCommission}>Commission in Factory</button></div>}
  {record.now_ref&&<p className="receiving-now">Your decision goes back to the work that asked.</p>}
  <details className="receiving-raw"><summary>Show raw</summary><pre className="oi-scroll-quiet">{JSON.stringify(record,null,2)}</pre></details>
 </div>;
}
