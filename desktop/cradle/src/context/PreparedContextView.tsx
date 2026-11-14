import {Refusal} from "../shared/Refusal";
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {AgentSubject} from "../agent/AgentLayer";
import {nativeContext,announceContext,approveCapturedSnapshot,validatePreparedItem,type PreparedContext,type PreparedItem,type ContextOperation} from "./nativeContext";
import {refreshPacket,usePacket} from "./packetSlice";
import {useContextPreview,addPreviewToContext} from "./contextPreview";
import {revealContextCue} from "./selectionPresentation";
import {SelectionResolution} from "./SelectionResolution";
import {EditorIcon} from "../editor/EditorIcon";
import "./prepared-context.css";
type PreparedContextProps={project?:string;session?:string;sourceWorldRef?:string;onOpenSubject?:(subject:AgentSubject)=>void};
/** The owner's writes on a prepared context: an edit, or its register's adopted into the conversation. Its read is the World Model's. */
type ContextWrite=Extract<ContextOperation,{operation:"edit"|"adopt"}>;
export function PreparedContextView(props:PreparedContextProps){
 const {transport}=useKernel();
 return <ScopedPreparedContext key={JSON.stringify([props.sourceWorldRef,props.project,props.session,transport])} {...props}/>;
}
function ScopedPreparedContext({project,session,sourceWorldRef,onOpenSubject}:PreparedContextProps){
 const {transport}=useKernel();const preview=useContextPreview();
 // The packet as the World Model holds it (packetSlice.ts usePacket; O-I ticket 1005): this conversation's, and its register's beside it
 // while one stands, each with the edits announced over it until the slice holds them; a hosted world's from its host.
 const packet=usePacket(transport,project,session,sourceWorldRef);const register=usePacket(transport,session&&!sourceWorldRef?project:undefined,undefined);
 const context=packet?.context,unbound=register?.context;
 const [error,setError]=useState<string>();const [busy,setBusy]=useState(false);
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 // A newer packet stands over a write that failed on the one before it.
 useEffect(()=>{setError(undefined);},[context?.revision,context?.digest]);
 const failure=error??(context?undefined:packet?.error);
 // An edit's answer is announced (the views that show this packet hold it until the slice does); an adoption moves the register's packet
 // too, and Refresh asks for the packet again: each reads the World Model's slice fresh.
 const perform=async(request?:ContextWrite)=>{if(project===undefined||busy)return;setBusy(true);setError(undefined);try{if(request){const next=await nativeContext(transport,project,session,request,sourceWorldRef);if(!mounted.current)return;announceContext(project,next,sourceWorldRef);if(request.operation!=="adopt")return;}await refreshPacket(transport,project,session,sourceWorldRef);}catch(e){if(mounted.current)setError(String(e));}finally{if(mounted.current)setBusy(false);}};
 const reveal=(item:PreparedItem)=>{const s=item.selection;onOpenSubject?.({ref:s.source_ref,title:s.title,project:s.source_project??project,kind:s.anchor.kind==="text"?"source":"file",revision:s.source_revision??undefined,dirty:s.working_copy});if(s.anchor.kind==="text"){const cue={id:item.id,bindingId:s.binding_id,sourceRef:s.source_ref,start:s.anchor.start,end:s.anchor.end,text:s.text};requestAnimationFrame(()=>revealContextCue(cue));}};
 return <section className="prepared-context" aria-label="Selected context">
  <header><strong>Prepared</strong><small>{context?`${context.items.length} prepared · not sent`:project!==undefined?(failure?"Unavailable":"Loading…"):"No destination"}</small><button type="button" className="oi-tool" title="Refresh context" aria-label="Refresh prepared context" disabled={busy||project===undefined} onClick={()=>void perform()}><EditorIcon name="refresh"/></button></header>
  {!sourceWorldRef&&preview.candidate&&<div className="context-preview"><small>Current selection · {preview.title}</small><p>{preview.candidate.text.slice(0,180)}{preview.candidate.text.length>180?"…":""}</p><button type="button" className="oi-action" disabled={preview.busy||!!preview.candidate.error} onClick={addPreviewToContext}>{preview.busy?"Adding…":"Add to context"}</button></div>}
  {failure&&<Refusal className="oi-note" said="Couldn't prepare this context. No selection was turned into a plain-text attachment instead." error={failure}/>}
  {project===undefined&&<p className="oi-note">Select a native Project context to prepare material. Central source identity is retained.</p>}
  {context&&<>
   {context.items.length===0&&!preview.candidate&&<p className="oi-note">{sourceWorldRef?"Selections prepared in this World will appear here.":"Highlight text, then choose Add to context. Use the picker for a component."}</p>}
   <ul className="prepared-context-items">{context.items.map(item=><PreparedRow sourceWorldRef={sourceWorldRef} canReveal={!!onOpenSubject} project={project} key={item.id} item={item} context={context} busy={busy} onReveal={()=>reveal(item)} onRemove={()=>void perform({operation:"edit",basis:context.revision,mutation:{operation:"remove",id:item.id}})} onExpression={expression=>void perform({operation:"edit",basis:context.revision,mutation:{operation:"add",selection:item.selection,expression}})}/>)}</ul>
   {context.items.length>0&&<button type="button" className="oi-action context-clear" disabled={busy} onClick={()=>void perform({operation:"edit",basis:context.revision,mutation:{operation:"clear"}})}>Clear prepared context</button>}
  </>}
  {session&&context&&unbound&&unbound.items.length>0&&<div className="context-preview"><p>{unbound.items.length} selections prepared for this Project without a conversation.</p><button type="button" className="oi-action" disabled={busy} onClick={()=>void perform({operation:"adopt",basis:context.revision,project_basis:unbound.revision})}>Use in this conversation</button></div>}
  {!session&&context&&<p className="oi-note">Prepared for {project}; no Agent is running or receiving this material. Choose a conversation, then explicitly use these selections.</p>}
 </section>;
}
function PreparedRow({project,sourceWorldRef,canReveal,item,context,busy,onReveal,onRemove,onExpression}:{project?:string;sourceWorldRef?:string;canReveal:boolean;item:PreparedItem;context:PreparedContext;busy:boolean;onReveal:()=>void;onRemove:()=>void;onExpression:(value:string)=>void}){
 const [problem,setProblem]=useState<string>();const [approved,setApproved]=useState(false);const [expression,setExpression]=useState(item.canonical_expression);
 useEffect(()=>{
  let active=true,epoch=0,timer:ReturnType<typeof setTimeout>|undefined;setApproved(false);setExpression(item.canonical_expression);
  const check=()=>{const request=++epoch;void validatePreparedItem(item,context,sourceWorldRef).then(()=>{if(active&&request===epoch)setProblem(undefined);}).catch(e=>{if(active&&request===epoch)setProblem(String(e));});};
  const changed=(event:Event)=>{if((event as CustomEvent<{ref?:string}>).detail?.ref!==item.selection.source_ref)return;clearTimeout(timer);timer=setTimeout(check,200);};
  check();window.addEventListener("oi:file-draft-changed",changed);window.addEventListener("oi:file-reading-changed",changed);
  return()=>{active=false;clearTimeout(timer);window.removeEventListener("oi:file-draft-changed",changed);window.removeEventListener("oi:file-reading-changed",changed);};
 },[sourceWorldRef,item,context.revision,context.digest]);
 const s=item.selection;
 return <li className="prepared-context-item" data-selection-id={item.id}>
  <div className="prepared-context-heading"><span title={s.source_ref}>{s.title}</span><small>{approved?"captured snapshot":problem?"review needed":s.working_copy?"unsaved snapshot":"selected"}</small><button type="button" className="oi-tool" title="Reveal source selection" aria-label={`Reveal ${s.title}`} disabled={!canReveal} onClick={onReveal}><EditorIcon name="arrow"/></button><button type="button" className="oi-tool" title="Remove selection" aria-label={`Remove ${s.title} from context`} disabled={busy} onClick={onRemove}><EditorIcon name="close"/></button></div>
  <p className="prepared-context-excerpt">{s.text.slice(0,180)}{s.text.length>180?"…":""}</p>
  <details><summary>Selection details</summary><p className="oi-ref">{s.source_ref}</p><small>{s.source_revision??"observed page"} · {s.anchor.kind==="text"?`UTF-16 ${s.anchor.start}–${s.anchor.end}`:`${s.anchor.role} · ${s.anchor.selector}`}</small><pre>{s.text}</pre>
   {problem&&!approved&&<><p className="oi-note">{problem}</p><button type="button" className="oi-action" onClick={()=>{approveCapturedSnapshot(context,item,sourceWorldRef);setApproved(true);}}>Use this exact captured snapshot</button></>}
   {!sourceWorldRef&&<button type="button" className="oi-action" onClick={()=>window.dispatchEvent(new CustomEvent("oi:context-options",{detail:{bindingId:s.binding_id,kind:s.anchor.kind==="text"?"text":"element",text:s.text,sourceRef:s.source_ref,revision:s.source_revision,workingCopy:s.working_copy,...(s.anchor.kind==="text"?{start:s.anchor.start,end:s.anchor.end}:{observationKey:s.anchor.key,selector:s.anchor.selector,role:s.anchor.role})}}))}>Other actions…</button>}
   <label>Vāk expression<input className="oi-input" aria-label={`Vāk expression for ${s.title}`} value={expression} onChange={e=>setExpression(e.target.value)} spellCheck={false}/></label><button type="button" className="oi-action" disabled={busy||expression===item.canonical_expression} onClick={()=>onExpression(expression)}>Save expression with AIKit</button>{!sourceWorldRef&&<SelectionResolution project={project} expression={expression}/>}
  </details>
 </li>;
}
