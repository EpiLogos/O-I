import {useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {knowledge} from "../knowledge/client";
import {encounter,type EncounterReading} from "../encounter/client";
import {composeAddressed} from "../encounter/AddressedComposer";
import {composeSharedField} from "../receiving/SharedFieldMaterial";
import type {ActionDispatch} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import type {AgentAccompanying} from "../agent/AgentLayer";
import {composeValidated,preparedClear,preparedRemove,preparedUpdate,type PreparedItem} from "./prepared";
import {usePreparedItems,useTransientSelection} from "./PreparedContext";

/**
 * The Context plane's prepared-context host (owner direction 2026-09-19):
 * compact prepared items, a transient selection preview, and the delivery
 * acts that used to live in the modal — include into the accompanying
 * conversation's shared draft (the primary act), addressed composition,
 * shared-field publication and durable remembering as explicit secondary
 * actions per item. A2A has no place here (owner amendment: removed). All
 * delivery revalidates against the source at act time and travels through
 * the native owners; nothing here claims provider disclosure.
 */
export function PreparedPanel({bindings,accompanying}:{bindings:Record<string,SurfaceBinding>;accompanying?:AgentAccompanying}){
 const items=usePreparedItems();
 const preview=useTransientSelection();
 const [openId,setOpenId]=useState<string>();
 const [busyId,setBusyId]=useState<string>();
 const [errorId,setErrorId]=useState<{id:string;text:string}>();
 if(items.length===0&&!preview)return <p className="prepared-empty oi-note">Select material anywhere and add it to context — it is prepared here, with its exact source and revision.</p>;
 return <div className="prepared-panel" aria-label="Prepared context">
  {preview&&<p className="prepared-preview" data-transient-selection="true"><span>Current selection</span> {preview.text}</p>}
  {items.length>0&&<ul className="prepared-items">
   {items.map(item=><PreparedRow key={item.id} bindings={bindings} item={item} accompanying={accompanying} open={openId===item.id} onToggle={()=>setOpenId(current=>current===item.id?undefined:item.id)} busy={busyId===item.id} onBusy={busy=>setBusyId(busy?item.id:undefined)} error={errorId?.id===item.id?errorId.text:undefined} onError={text=>setErrorId(text?{id:item.id,text}:undefined)}/>)}
  </ul>}
  {items.length>1&&<button className="prepared-clear" onClick={preparedClear}>Clear all prepared</button>}
 </div>;
}

function PreparedRow({bindings,item,accompanying,open,onToggle,busy,onBusy,error,onError}:{
 bindings:Record<string,SurfaceBinding>;item:PreparedItem;accompanying?:AgentAccompanying;open:boolean;onToggle:()=>void;busy:boolean;
 onBusy:(busy:boolean)=>void;error?:string;onError:(text?:string)=>void;
}){
 const kernel=useKernel();
 const [instruction,setInstruction]=useState(item.instruction??"");
 const [remembered,setRemembered]=useState<ActionDispatch>();
 const [resolve,setResolve]=useState<{reading?:unknown;error?:string;pending:boolean}>();
 const excerpt=item.text.length>180?`${item.text.slice(0,180)}…`:item.text;
 // Honest disclosure law: an act that cannot run on this item (no owner
 // revision to share) is disabled, never merely refused after the click.
 const revisable=!!item.revision;
 const destination=accompanying?`${accompanying.project} conversation`:"a conversation";
 /** Act-time revalidation, then the named delivery. Every path throws the
  * same staleness refusals the tray had; nothing auto-delivers. */
 const compose=()=>composeValidated({transport:kernel.transport,buffers:kernel.snapshot.buffers,bindings},item);
 const include=async()=>{
  onBusy(true);onError(undefined);
  try{
   if(!accompanying?.ref||!accompanying.project)throw new Error("Open an agent conversation to include this selection.");
   const composed=await compose();
   const read=await encounter<EncounterReading>(kernel.transport,accompanying.project,{action:"view",agent_session:accompanying.ref});
   await encounter(kernel.transport,accompanying.project,{action:"draft",agent_session:accompanying.ref,basis:read.draft.revision,text:[read.draft.text,composed.text].filter(Boolean).join("\n\n")});
   preparedUpdate(item.id,{delivered:{ref:accompanying.ref,project:accompanying.project,at:Date.now()}});
  }catch(reason){onError(String(reason));}finally{onBusy(false);}
 };
 const address=async()=>{
  onBusy(true);onError(undefined);
  try{
   if(!accompanying?.ref||!accompanying.project)throw new Error("Open an agent conversation to address this selection.");
   const composed=await compose();
   composeAddressed({agentSession:accompanying.ref,sourceRef:composed.sourceRef,text:composed.text});
   onError(undefined);
  }catch(reason){onError(String(reason));}finally{onBusy(false);}
 };
 const publish=async()=>{
  onBusy(true);onError(undefined);
  try{
   const composed=await compose();
   if(!composed.revision)throw new Error("Publishing shares a revision-carrying source selection — select the passage again.");
   composeSharedField({sourceRef:item.sourceRef??composed.sourceRef,revision:composed.revision,text:item.text,title:composed.title});
  }catch(reason){onError(String(reason));}finally{onBusy(false);}
 };
 const remember=async(scope:"root"|"project")=>{
  onBusy(true);onError(undefined);setRemembered(undefined);
  try{
   const composed=await compose();
   if(!composed.revision)throw new Error("Remembering shares a revision-carrying source selection — select the passage again.");
   const bindingProject=bindings[item.bindingId]?.project;
   if(scope==="project"&&!bindingProject)throw new Error("This selection has no project register to remember into.");
   const action=scope==="project"?"projectcentral.remember":"central.remember";
   const input=scope==="project"
    ?{selection:item.text,source_ref:item.sourceRef,destination:"remembered",project:bindingProject}
    :{selection:item.text,source_ref:item.sourceRef,destination:"remembered",project:null};
   const response=await kernelOp(kernel.transport,{op:"invoke_action",invocation:{action,target_ref:item.sourceRef??"",input}});
   if(response.outcome?.result!=="action_dispatched")throw new Error(response.error??"the kernel returned no dispatch outcome");
   setRemembered(response.outcome.dispatch);
  }catch(reason){onError(String(reason));}finally{onBusy(false);}
 };
 const reveal=()=>{
  window.dispatchEvent(new CustomEvent("oi:reveal-prepared",{detail:{bindingId:item.bindingId,start:item.start,end:item.end,observationKey:item.observationKey}}));
 };
 const resolveInAikit=async()=>{
  if(!item.sourceRef)return;
  setResolve({pending:true});
  try{
   const reading=await knowledge<unknown>(kernel.transport,bindings[item.bindingId]?.project,{action:"resolve",query:item.sourceRef});
   setResolve({reading,pending:false});
  }catch(reason){setResolve({error:String(reason),pending:false});}
 };
 const stateLine=[item.revision?`rev ${item.revision.slice(0,10)}`:item.kind==="element"?"observed":"no revision",item.workingCopy?"unsaved":undefined,item.delivered?`included in ${item.delivered.project} draft`:undefined].filter(Boolean).join(" · ");
 return <li className="prepared-item" data-prepared-id={item.id} data-prepared-kind={item.kind}>
  <div className="prepared-row">
   <button className="prepared-reveal" onClick={reveal} title="Reveal at the source">{item.title}</button>
   <span className="prepared-state">{stateLine}</span>
   <button className="prepared-remove" aria-label={`Remove ${item.title} from context`} title="Remove from context" onClick={()=>preparedRemove(item.id)}>×</button>
  </div>
  <p className="prepared-excerpt">{excerpt}</p>
  <input className="prepared-instruction" aria-label={`Instruction for ${item.title}`} placeholder="Instruction for this material (optional)" value={instruction}
    onChange={event=>setInstruction(event.target.value)}
    onBlur={()=>{const value=instruction.trim();if(value!==((item.instruction??"")))preparedUpdate(item.id,{instruction:value||undefined});}}/>
  <div className="prepared-actions">
   <button className="prepared-include" disabled={busy} title={`Append the exact excerpt and its provenance to ${destination}'s shared draft — send stays in the composer`} onClick={()=>void include()}>{busy?"Including…":item.delivered?"Include again":"Include in conversation"}</button>
   <details className="prepared-more">
    <summary aria-label={`More actions for ${item.title}`} title="Secondary destinations">⋯</summary>
    <div className="oi-menu">
     <button className="oi-menu-item" disabled={busy||!revisable} onClick={()=>void address()}>Address to the participant</button>
     <button className="oi-menu-item" disabled={busy||!revisable} onClick={()=>void publish()}>Publish to the shared field</button>
     <button className="oi-menu-item" disabled={busy||!revisable} onClick={()=>void remember("project")}>Remember — project register</button>
     <button className="oi-menu-item" disabled={busy||!revisable} onClick={()=>void remember("root")}>Remember — root register</button>
    </div>
   </details>
   <button className="prepared-details-toggle" aria-expanded={open} onClick={onToggle}>{open?"Hide details":"Details"}</button>
  </div>
  {error&&<p className="prepared-error" role="alert">{error}</p>}
  {remembered&&<RememberReceipt outcome={remembered}/>}
  {open&&<div className="prepared-details">
   <dl className="oi-kv">
    <dt>Source ref</dt><dd><code>{item.sourceRef??"—"}</code></dd>
    {item.revision&&<><dt>Revision</dt><dd><code>{item.revision}</code></dd></>}
    {item.start!==undefined&&item.end!==undefined&&<><dt>Range</dt><dd>{item.start}–{item.end} ({item.end-item.start} chars)</dd></>}
    {item.kind==="element"&&<><dt>Observation</dt><dd>{item.selector}{item.bounds?` · ${Math.round(item.bounds.width)} × ${Math.round(item.bounds.height)} at ${Math.round(item.bounds.x)}, ${Math.round(item.bounds.y)}`:""}</dd></>}
    <dt>Origin</dt><dd>{item.origin}</dd>
    <dt>State</dt><dd>{item.delivered?"Included in the conversation draft — delivery is the draft owner's receipt, not provider memory":"Prepared on this device — nothing has been disclosed"}</dd>
   </dl>
   {item.sourceRef&&<div className="prepared-resolve">
    <button onClick={()=>void resolveInAikit()} disabled={resolve?.pending}>{resolve?.pending?"Resolving…":"Resolve in AIKit"}</button>
    {resolve?.error&&<p role="alert">{resolve.error}</p>}
    {resolve?.reading!==undefined&&<pre data-aikit-resolve="true">{JSON.stringify(resolve.reading,null,2)}</pre>}
   </div>}
  </div>}
 </li>;
}

/** The typed remember receipt: the owner payload verbatim — note ref,
 * provenance, the owner's own read-path operation — with the one honest line
 * the recognition law demands. Non-invoked dispatch states render the
 * owner's (or kernel's) own words unchanged, never a desktop paraphrase. */
function RememberReceipt({outcome}:{outcome:ActionDispatch}){
 if(outcome.state!=="invoked"){const detail=!("state" in outcome)?"":outcome.state==="owner_refused"?outcome.message:outcome.state==="owner_unavailable"?outcome.detail:outcome.state==="malformed_ref"?outcome.detail:outcome.state==="unsupported_action"?`${outcome.owner}: ${outcome.detail}`:outcome.state==="unknown_owner"?outcome.action:"";
  return <div className="prepared-remembered" data-remembered-state={outcome.state}><p role="alert">The remember operation did not land ({outcome.state})</p>{detail&&<p className="prepared-origin">{detail}</p>}</div>;}
 const proposal=(outcome.data??{}) as {note?:{ref?:string;provenance?:{source_ref:string;origin_action:string;recorded_at_unix_seconds:number;authorship:string;recognition:string};authorship?:string;read_path?:{action:string;input:Record<string,unknown>}};read_path?:{action:string;input:Record<string,unknown>}};
 const note=proposal.note;
 if(!note?.ref||!note.provenance)return <div className="prepared-remembered" data-remembered-state="invoked"><p role="status">Remembered · {outcome.owner_operation}</p><pre>{JSON.stringify(outcome.data,null,2)}</pre></div>;
 const recorded=new Date(note.provenance.recorded_at_unix_seconds*1000);
 return <div className="prepared-remembered" data-remembered-state="invoked">
  <p role="status">Remembered · {note.ref} · {note.provenance.authorship}</p>
  <p className="prepared-origin">{note.provenance.source_ref} · {note.provenance.origin_action} · recorded {recorded.toLocaleString()}</p>
  <p className="prepared-origin">recognition: {note.provenance.recognition} — recognition is the human owner's separate act; this surface performs none and no control here claims it.</p>
  {proposal.read_path&&<p className="prepared-origin">Owner read: {proposal.read_path.action}</p>}
 </div>;
}
