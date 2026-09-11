import {useEffect,useRef,useState} from "react";
import type {SurfaceBinding,LayoutState} from "../surface/types";
import {useKernel} from "../kernel/KernelProvider";
import {readFile} from "../files/client";
import {flow} from "../flow/client";
import {encounter,type EncounterReading} from "../encounter/client";
import {composeAddressed} from "../encounter/AddressedComposer";
import {composeSharedField,openA2aExchange} from "../receiving/SharedFieldMaterial";
import {readDraft} from "../workspace/drafts";
import "./context.css";
import {observationIsCurrent} from "./ComponentSelection";
type Candidate={observationKey?:string;selector?:string;role?:string;bounds?:{x:number;y:number;width:number;height:number};bindingId:string;kind:string;text:string;sourceRef?:string;start?:number;end?:number;revision?:string;workingCopy?:boolean};
function matches(candidate:Candidate,content:string){return candidate.start!==undefined&&candidate.end!==undefined?content.slice(candidate.start,candidate.end)===candidate.text:content.includes(candidate.text);}
export function ContextTray({bindings,accompanying}:{bindings:Record<string,SurfaceBinding>;accompanying:LayoutState["accompanying"]}){
 const kernel=useKernel();const [candidate,setCandidate]=useState<Candidate>();const [target,setTarget]=useState("");const [error,setError]=useState<string>();const [busy,setBusy]=useState(false);
 const tray=useRef<HTMLElement>(null);const returnFocus=useRef<HTMLElement|null>(null);const latest=useRef({bindings,kernel});latest.current={bindings,kernel};
 useEffect(()=>{let generation=0;const take=(event:Event)=>{const next=(event as CustomEvent<Candidate>).detail;if(!next?.text?.trim()||!next.bindingId)return;const current=++generation;const binding=latest.current.bindings[next.bindingId];if(!binding)return;
   const open=(value:Candidate,message?:string)=>{if(current!==generation)return;returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setTarget("");setCandidate(value);setError(message);};
   const accept=(value:Candidate)=>open(value,undefined);
   if(next.kind==="element"){accept({...next,sourceRef:binding.ref??next.sourceRef??binding.browser?.url});return;}
   if(binding.kind==="source"&&binding.ref){const buffer=latest.current.kernel.snapshot.buffers[binding.ref];if(!buffer||!matches(next,buffer.content)){open({...next,sourceRef:binding.ref},"The selected source is no longer available. Select it again.");return;}accept({...next,sourceRef:binding.ref,revision:buffer.base_revision,workingCopy:buffer.dirty});return;}
   if(binding.location){const draft=binding.ref?readDraft(binding.ref):undefined;if(draft&&matches(next,draft.content)){accept({...next,sourceRef:binding.ref,revision:draft.base_revision,workingCopy:draft.content!==draft.saved_content});return;}
    void readFile(latest.current.kernel.transport,binding.location).then(read=>{if(!matches(next,read.content))throw new Error("The selected file changed before its revision could be recorded. Select it again.");accept({...next,sourceRef:binding.ref,revision:read.revision,workingCopy:false});}).catch(reason=>open({...next,sourceRef:binding.ref},String(reason)));return;}
   accept({...next,sourceRef:next.sourceRef??binding.ref});
  };window.addEventListener("oi:context-candidate",take);return()=>{generation++;window.removeEventListener("oi:context-candidate",take);};},[]);
 useEffect(()=>{if(!candidate)return;const previous=returnFocus.current;requestAnimationFrame(()=>tray.current?.querySelector<HTMLElement>('button:not(:disabled),select:not(:disabled)')?.focus());return()=>{if(previous?.isConnected)requestAnimationFrame(()=>previous.focus({preventScroll:true}));};},[candidate?.bindingId,candidate?.text]);
 if(!candidate)return null;
 const binding=bindings[candidate.bindingId];
 const choices=Object.values(bindings).filter(b=>b.kind==="encounter"&&b.ref&&b.project);
 if(accompanying&&!choices.some(b=>b.ref===accompanying.ref))choices.push({id:accompanying.ref,kind:"encounter",ref:accompanying.ref,project:accompanying.project,title:"Accompanying conversation",encounter:{space:accompanying.space}});
 const selected=choices.find(b=>b.id===(target||choices[0]?.id));
 const close=()=>{if(!busy)setCandidate(undefined);};
 /** Currency validation + provenance composition, shared by all three
  * destinations (the AIKit draft, the addressed request and the shared-field
  * projection). Throws when the selection went stale; on success returns the
  * exact source ref and the quoted composition. */
 const validateSelection=async():Promise<{sourceRef:string;text:string;revision?:string;title:string}>=>{
  if(!binding)throw new Error("Open a source to include this selection.");
  let revision=candidate.revision;let working=!!candidate.workingCopy;let canonical:string|undefined;
  if(candidate.kind==="element"){if(!candidate.observationKey||!await observationIsCurrent(candidate.observationKey))throw new Error("The selected component changed. Pick it again.");}
  else if(binding.kind==="flow"&&binding.flow){const read=await flow(kernel.transport,{action:"flow_read",project:binding.project!,flow_ref:binding.flow.flowRef});if(!revision||revision!==read.flow.current_revision)throw new Error("The Flow changed since selection. Select the passage again.");if(working){let draft:{text?:string;revision?:string}|undefined;try{draft=JSON.parse(localStorage.getItem(`oi-flow-draft:${binding.flow.flowRef}`)??"null")??undefined;}catch{}if(draft?.revision!==revision||!draft.text||!matches(candidate,draft.text))throw new Error("The Flow draft changed since selection. Select the passage again.");canonical=draft.text;}else canonical=read.content;}
  else if(binding.kind==="source"&&binding.ref){const buffer=kernel.snapshot.buffers[binding.ref];if(!buffer||!revision||buffer.base_revision!==revision)throw new Error("The source changed since selection. Select it again.");canonical=buffer.content;working=buffer.dirty;}
  else if(binding.location){const read=await readFile(kernel.transport,binding.location);if(!revision||read.revision!==revision)throw new Error("The file changed since selection. Select the passage again.");if(working){const draft=binding.ref?readDraft(binding.ref):undefined;if(!draft||draft.base_revision!==revision)throw new Error("The file draft changed since selection. Select the passage again.");canonical=draft.content;}else canonical=read.content;}
  if(canonical!==undefined&&!matches(candidate,canonical))throw new Error("The selected material changed. Select it again before including it.");
  const origin=candidate.sourceRef??binding.terminal?.cwd??binding.browser?.url??binding.title;
  const metadata=[binding.title,origin,revision?`revision ${revision}`:candidate.kind==="element"?`observed ${candidate.role==="text"?"text":"component"} · ${candidate.selector} · role ${candidate.role??"element"}${candidate.bounds?` · viewport bounds x=${candidate.bounds.x}, y=${candidate.bounds.y}, width=${candidate.bounds.width}, height=${candidate.bounds.height} CSS px`:""}`:"observed excerpt",working?"working copy — unsaved":""].filter(Boolean).join(" · ");
  const quoted=candidate.text.split("\n").map(line=>`> ${line}`).join("\n");
  return {sourceRef:origin,text:`@context — ${metadata}\n${quoted}`,revision,title:binding.title};
 };
 const compose=async():Promise<{destination:{ref:string;project:string};sourceRef:string;text:string}>=>{
  const chosen=selected;
  if(!chosen?.ref||!chosen.project)throw new Error("Open an agent conversation to include this selection.");
  const composed=await validateSelection();
  return {sourceRef:composed.sourceRef,text:composed.text,destination:{ref:chosen.ref,project:chosen.project}};
 };
 const add=async()=>{setBusy(true);setError(undefined);
  try{
   const composed=await compose();
   const read=await encounter<EncounterReading>(kernel.transport,composed.destination.project,{action:"view",agent_session:composed.destination.ref});
   await encounter(kernel.transport,composed.destination.project,{action:"draft",agent_session:composed.destination.ref,basis:read.draft.revision,text:[read.draft.text,composed.text].filter(Boolean).join("\n\n")});
   setCandidate(undefined);
  }catch(reason){setError(String(reason));}finally{setBusy(false);}
 };
 /** The addressed destination (first complete vertical): the same validated
  * composition routes to the conversation's addressed-request composer instead
  * of the shared human draft. The event carries identity only — the composer's
  * sender, audience and participation basis stay explicit owner-validated
  * inputs, and no new store is created anywhere on this path. */
 const address=async()=>{setBusy(true);setError(undefined);
  try{
   const composed=await compose();
   composeAddressed({agentSession:composed.destination.ref,sourceRef:composed.sourceRef,text:composed.text});
   setCandidate(undefined);
  }catch(reason){setError(String(reason));}finally{setBusy(false);}
 };
 /** The shared-field destination (Wave 7): the same validated composition
  * becomes a real `oi.projection/v1` envelope beside the document. The
  * projection carries the EXACT passage and its selection-time revision;
  * publisher/audience are explicit inputs owned by the publication strip.
  * Needs no conversation — only a revision-carrying source selection. */
 const publish=async()=>{setBusy(true);setError(undefined);
  try{
   const composed=await validateSelection();
   if(!composed.revision)throw new Error("Publishing shares a revision-carrying source selection — select the passage again.");
   composeSharedField({sourceRef:candidate.sourceRef??composed.sourceRef,revision:composed.revision,text:candidate.text,title:composed.title});
   setCandidate(undefined);
  }catch(reason){setError(String(reason));}finally{setBusy(false);}
 };
 /** The A2A destination (Wave 7): the selection seeds a bounded message to a
  * peer agent over the A2A v1 wire. The exchange form beside the document
  * owns endpoint, authority and send; the selection only pre-fills it. */
 const exchangeA2a=async()=>{setBusy(true);setError(undefined);
  try{
   const composed=await validateSelection();
   if(!composed.revision)throw new Error("An A2A exchange shares a revision-carrying source selection — select the passage again.");
   openA2aExchange({sourceRef:candidate.sourceRef??composed.sourceRef,revision:composed.revision,text:candidate.text,title:composed.title});
   setCandidate(undefined);
  }catch(reason){setError(String(reason));}finally{setBusy(false);}
 };
 const keyboard=(e:React.KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();close();return;}if(e.key!=="Tab"||!tray.current)return;const focusable=[...tray.current.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),[href],input:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length);if(!focusable.length){e.preventDefault();tray.current.focus();return;}const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
 return <div className="context-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={tray} className="context-tray" role="dialog" aria-modal="true" aria-label="Include selected context" tabIndex={-1} onKeyDown={keyboard}><header><h2>Include selected context</h2><button aria-label="Close context selection" onClick={close} disabled={busy}>×</button></header><p>{binding?.title??"Selection"} · {candidate.text.length} characters</p><pre>{candidate.text}</pre>{candidate.kind==="element"&&<p className="context-origin">{candidate.selector}{candidate.bounds&&` · ${Math.round(candidate.bounds.width)} × ${Math.round(candidate.bounds.height)} at ${Math.round(candidate.bounds.x)}, ${Math.round(candidate.bounds.y)}`}</p>}<p className="context-origin">{candidate.sourceRef??binding?.terminal?.cwd??"Observed material"}</p><label>Conversation <select aria-label="Context destination" value={target||choices[0]?.id||""} onChange={e=>setTarget(e.target.value)}>{choices.map(b=><option key={b.id} value={b.id}>{b.title} · {b.project}</option>)}</select></label>{!choices.length&&<p>Open an agent conversation to include this selection.</p>}<p>The excerpt and its provenance will be added to the shared draft. Use Send in that conversation when ready.</p>{error&&<p role="alert">{error}</p>}<div className="context-actions"><button disabled={busy||!!error||!selected||!binding} onClick={()=>void add()}>{busy?"Adding…":"Add to draft"}</button><button className="context-address" disabled={busy||!!error||!selected||!binding} title="Compose this selection into that conversation's addressed request instead of the shared draft" onClick={()=>void address()}>Address to the participant</button>{candidate.revision&&<button className="context-publish" disabled={busy||!!error} title="Compose this selection into a shared-field projection beside the document — publication carries an explicit publisher and audience" onClick={()=>void publish()}>Publish to the shared field</button>}{candidate.revision&&<button className="context-a2a" disabled={busy||!!error} title="Seed a bounded A2A v1 message to a peer agent with this selection — the exchange form beside the document owns endpoint and send" onClick={()=>void exchangeA2a()}>Exchange over A2A</button>}</div></section></div>;
}
