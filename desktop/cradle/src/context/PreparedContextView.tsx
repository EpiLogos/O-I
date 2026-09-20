import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {AgentSubject} from "../agent/AgentLayer";
import {nativeContext,announceContext,approveCapturedSnapshot,validatePreparedItem,PREPARED_CONTEXT_CHANGED,type PreparedContext,type PreparedItem,type ContextOperation} from "./nativeContext";
import {useContextPreview,addPreviewToContext} from "./contextPreview";
import {revealContextCue} from "./selectionPresentation";
import {EditorIcon} from "../editor/EditorIcon";
import "./prepared-context.css";
export function PreparedContextView({project,session,onOpenSubject}:{project?:string;session?:string;onOpenSubject?:(subject:AgentSubject)=>void}){
 const {transport}=useKernel();const preview=useContextPreview();
 const [context,setContext]=useState<PreparedContext>();const [unbound,setUnbound]=useState<PreparedContext>();
 const [error,setError]=useState<string>();const [busy,setBusy]=useState(false);
 const scopeKey=JSON.stringify([project,session,transport]);const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;
 const load=useCallback(async()=>{const requested=scopeKey;if(!project)return;const next=await nativeContext(transport,project,session);if(scopeRef.current!==requested)return;setContext(next);announceContext(project,next);if(session){const unbound=await nativeContext(transport,project,undefined);if(scopeRef.current===requested)setUnbound(unbound);}},[project,session,transport,scopeKey]);
 useEffect(()=>{let active=true;setContext(undefined);setUnbound(undefined);setError(undefined);
  if(project)void nativeContext(transport,project,session).then(next=>{if(active){setContext(next);announceContext(project,next);}}).catch(e=>{if(active)setError(String(e));});
  if(project&&session)void nativeContext(transport,project,undefined).then(next=>{if(active)setUnbound(next);}).catch(()=>{});
  const changed=(event:Event)=>{const {project:ownerProject,value}=(event as CustomEvent<{project:string;value:PreparedContext}>).detail??{};if(ownerProject!==project||!value)return;if(value.scope.agent_session===(session??null)){setContext(value);setError(undefined);}else if(value.scope.agent_session===null)setUnbound(value);};
  window.addEventListener(PREPARED_CONTEXT_CHANGED,changed);const focus=()=>void load().catch(e=>{if(active)setError(String(e));});window.addEventListener("focus",focus);
  return()=>{active=false;window.removeEventListener(PREPARED_CONTEXT_CHANGED,changed);window.removeEventListener("focus",focus);};
 },[project,session,load,transport]);
 const perform=async(request?:ContextOperation)=>{if(!project||busy)return;setBusy(true);setError(undefined);try{if(request){const next=await nativeContext(transport,project,session,request);setContext(next);announceContext(project,next);}else await load();}catch(e){setError(String(e));}finally{setBusy(false);}};
 const reveal=(item:PreparedItem)=>{const s=item.selection;onOpenSubject?.({ref:s.source_ref,title:s.title,project:s.source_project??project,kind:s.anchor.kind==="text"?"source":"file",revision:s.source_revision??undefined,dirty:s.working_copy});if(s.anchor.kind==="text"){const cue={id:item.id,bindingId:s.binding_id,sourceRef:s.source_ref,start:s.anchor.start,end:s.anchor.end,text:s.text};requestAnimationFrame(()=>revealContextCue(cue));}};
 return <section className="prepared-context" aria-label="Selected context">
  <header><strong>Context</strong><small>{context?.items.length??0} prepared · not sent</small><button type="button" className="oi-tool" title="Refresh context" aria-label="Refresh prepared context" disabled={busy||!project} onClick={()=>void perform()}><EditorIcon name="refresh"/></button></header>
  {preview.candidate&&<div className="context-preview"><small>Current selection · {preview.title}</small><p>{preview.candidate.text.slice(0,180)}{preview.candidate.text.length>180?"…":""}</p><button type="button" disabled={preview.busy||!!preview.candidate.error} onClick={addPreviewToContext}>{preview.busy?"Adding…":"Add to context"}</button></div>}
  {error&&<p className="oi-note" role="alert">{error} No selection was silently converted to a plain-text attachment.</p>}
  {!project&&<p className="oi-note">Select a native Project context to prepare material. Central source identity is retained.</p>}
  {context&&<>
   {context.items.length===0&&!preview.candidate&&<p className="oi-note">Highlight text, then choose Add to context. Use the picker for a component.</p>}
   <ul className="prepared-context-items">{context.items.map(item=><PreparedRow key={item.id} item={item} context={context} busy={busy} onReveal={()=>reveal(item)} onRemove={()=>void perform({operation:"edit",basis:context.revision,mutation:{operation:"remove",id:item.id}})} onExpression={expression=>void perform({operation:"edit",basis:context.revision,mutation:{operation:"add",selection:item.selection,expression}})}/>)}</ul>
   {context.items.length>0&&<button type="button" className="context-clear" disabled={busy} onClick={()=>void perform({operation:"edit",basis:context.revision,mutation:{operation:"clear"}})}>Clear prepared context</button>}
  </>}
  {session&&context&&unbound&&unbound.items.length>0&&<div className="context-preview"><p>{unbound.items.length} selections prepared for this Project without a conversation.</p><button type="button" disabled={busy} onClick={()=>void perform({operation:"adopt",basis:context.revision,project_basis:unbound.revision}).then(()=>load()).catch(e=>setError(String(e)))}>Use in this conversation</button></div>}
  {!session&&context&&<p className="oi-note">Prepared for {project}; no Agent is running or receiving this material. Choose a conversation, then explicitly use these selections.</p>}
 </section>;
}
function PreparedRow({item,context,busy,onReveal,onRemove,onExpression}:{item:PreparedItem;context:PreparedContext;busy:boolean;onReveal:()=>void;onRemove:()=>void;onExpression:(value:string)=>void}){
 const [problem,setProblem]=useState<string>();const [approved,setApproved]=useState(false);const [expression,setExpression]=useState(item.canonical_expression);
 useEffect(()=>{let active=true;setApproved(false);setExpression(item.canonical_expression);void validatePreparedItem(item,context).then(()=>{if(active)setProblem(undefined);}).catch(e=>{if(active)setProblem(String(e));});return()=>{active=false;};},[item,context.revision,context.digest]);
 const s=item.selection;
 return <li className="prepared-context-item" data-selection-id={item.id}>
  <div className="prepared-context-heading"><span title={s.source_ref}>{s.title}</span><small>{approved?"captured snapshot":problem?"review needed":s.working_copy?"unsaved snapshot":"selected"}</small><button type="button" className="oi-tool" title="Reveal source selection" aria-label={`Reveal ${s.title}`} onClick={onReveal}><EditorIcon name="arrow"/></button><button type="button" className="oi-tool" title="Remove selection" aria-label={`Remove ${s.title} from context`} disabled={busy} onClick={onRemove}><EditorIcon name="close"/></button></div>
  <p className="prepared-context-excerpt">{s.text.slice(0,180)}{s.text.length>180?"…":""}</p>
  <details><summary>Selection details</summary><p className="oi-ref">{s.source_ref}</p><small>{s.source_revision??"observed page"} · {s.anchor.kind==="text"?`UTF-16 ${s.anchor.start}–${s.anchor.end}`:`${s.anchor.role} · ${s.anchor.selector}`}</small><pre>{s.text}</pre>
   {problem&&!approved&&<><p className="oi-note">{problem}</p><button type="button" onClick={()=>{approveCapturedSnapshot(context,item);setApproved(true);}}>Use this exact captured snapshot</button></>}
   <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("oi:context-options",{detail:{bindingId:s.binding_id,kind:s.anchor.kind==="text"?"text":"element",text:s.text,sourceRef:s.source_ref,revision:s.source_revision,workingCopy:s.working_copy,...(s.anchor.kind==="text"?{start:s.anchor.start,end:s.anchor.end}:{observationKey:s.anchor.key,selector:s.anchor.selector,role:s.anchor.role})}}))}>Other actions…</button>
   <label>Vāk expression<input aria-label={`Vāk expression for ${s.title}`} value={expression} onChange={e=>setExpression(e.target.value)} spellCheck={false}/></label><button type="button" disabled={busy||expression===item.canonical_expression} onClick={()=>onExpression(expression)}>Validate expression with AIKit</button>
  </details>
 </li>;
}
