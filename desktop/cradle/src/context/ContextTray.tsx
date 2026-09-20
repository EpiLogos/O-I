import {useEffect,useRef} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding,LayoutState} from "../surface/types";
import {readFile} from "../files/client";
import {readDraft} from "../workspace/drafts";
import {encounter} from "../encounter/client";
import {ContextActions} from "./ContextActions";
import {observationIsCurrent,markObservations} from "./ComponentSelection";
import {exactText,selectionSnapshot,type SelectionCandidate} from "./selectionModel";
import {nativeContext,announceContext,registerSelectionValidator,PREPARED_CONTEXT_CHANGED,type PreparedContext,type PreparedItem} from "./nativeContext";
import {getContextPreview,setContextPreview,useContextPreview} from "./contextPreview";
import {scopeGuard,selectionScopeKey} from "./scopeGuard";
import {setContextCues} from "./selectionPresentation";
import "./prepared-context.css";

/** The existing root mount now joins explicit selections to native preparation.
 * It renders no selection dialog, owns no source/session store, and never sends.
 * The old publishing/address/remember dialog is a deliberately summoned extra. */
export function ContextTray({bindings,accompanying}:{bindings:Record<string,SurfaceBinding>;accompanying:LayoutState["accompanying"]}){
 const kernel=useKernel();const latest=useRef({kernel,bindings,accompanying});latest.current={kernel,bindings,accompanying};
 const companionKey=selectionScopeKey(accompanying?.project,accompanying?.ref);
 useEffect(()=>{setContextPreview({});setContextCues([]);markObservations([]);},[companionKey]);
 const cueRevisions=useRef(new Map<string,number>());
 const view=useContextPreview();const retained=useRef(new Map<string,SurfaceBinding>());
 useEffect(()=>{
  let disposed=false,generation=0,busy=false;
  const bindingFor=(id:string,ref?:string)=>latest.current.bindings[id]??Object.values(latest.current.bindings).find(b=>b.ref===ref)??retained.current.get(id);
  const validate=async(item:PreparedItem)=>{
   const s=item.selection,anchor=s.anchor;
   if(anchor.kind==="observation"){if(!await observationIsCurrent(anchor.key))throw new Error("The observed page/component changed or is closed. Review the captured snapshot in Context.");
    const binding=bindingFor(s.binding_id,s.source_ref);
    if(s.source_revision&&binding?.location){const saved=await readFile(latest.current.kernel.transport,binding.location);if(saved.revision!==s.source_revision)throw new Error("The observed source revision changed. Review its captured snapshot.");}
    return;}
   const binding=bindingFor(s.binding_id,s.source_ref);if(!binding)throw new Error("Open this source or review the captured snapshot in Context.");
   const buffer=latest.current.kernel.snapshot.buffers[s.source_ref];
   if(buffer){if(buffer.base_revision!==s.source_revision||!exactText({text:s.text,start:anchor.start,end:anchor.end},buffer.content))throw new Error("The selected source range changed. Reselect it or review the captured snapshot.");return;}
   if(!binding.location)throw new Error("The source is not currently readable. Review its captured snapshot.");
   const saved=await readFile(latest.current.kernel.transport,binding.location);
   if(saved.revision!==s.source_revision)throw new Error("The source revision changed. Reselect it or review the captured snapshot.");
   const draft=readDraft(s.source_ref);const content=draft?.base_revision===s.source_revision?draft.content:saved.content;
   if(s.working_copy&&!draft)throw new Error("The unsaved source basis is no longer open. Review its captured snapshot.");
   if(!exactText({text:s.text,start:anchor.start,end:anchor.end},content))throw new Error("The selected range changed. Reselect it or review the captured snapshot.");
  };
  const unregister=registerSelectionValidator(validate);
  const present=(event:Event)=>{if(busy)return;const candidate=(event as CustomEvent<SelectionCandidate|undefined>).detail;if(!candidate){setContextPreview({});return;}const binding=bindingFor(candidate.bindingId);if(!binding)return;setContextPreview({candidate,title:binding.title});};
  const take=async(event:Event)=>{
   if(busy)return;
   const next=(event as CustomEvent<SelectionCandidate>).detail;if(!next||typeof next.text!=="string"||!next.bindingId)return;
   if(next.prepare){next.prepare();return;}
   const binding=bindingFor(next.bindingId,next.sourceRef);if(!binding)return;
   const companion=latest.current.accompanying;
   const project=binding.project??companion?.project;
   const session=companion&&companion.project===project?companion.ref:undefined;
   const transport=latest.current.kernel.transport;
   const checkScope=scopeGuard(()=>selectionScopeKey(latest.current.accompanying?.project,latest.current.accompanying?.ref));
   const operation=++generation;busy=true;setContextPreview({candidate:next,title:binding.title,busy:true});
   try{
    if(next.error)throw new Error(next.error);
    let revision=next.revision,workingCopy=next.workingCopy;
    if(next.kind==="element"){if(!next.observationKey||!await observationIsCurrent(next.observationKey))throw new Error("The page selection changed. Select it again.");if(revision&&binding.location){const saved=await readFile(transport,binding.location);if(saved.revision!==revision)throw new Error("The observed source revision changed. Select it again.");}}
    else {
     const buffer=binding.ref?latest.current.kernel.snapshot.buffers[binding.ref]:undefined;
     const draft=binding.ref?readDraft(binding.ref):undefined;
     let content:string;
     if(buffer){if(revision&&buffer.base_revision!==revision)throw new Error("The source revision changed. Select it again.");revision=buffer.base_revision;workingCopy=buffer.dirty;content=buffer.content;}
     else if(draft){if(revision&&draft.base_revision!==revision)throw new Error("The source revision changed. Select it again.");revision=draft.base_revision;workingCopy=draft.content!==draft.saved_content;content=draft.content;}
     else if(binding.location){const read=await readFile(latest.current.kernel.transport,binding.location);if(revision&&revision!==read.revision)throw new Error("The selected source revision changed.");revision=read.revision;workingCopy=false;content=read.content;}
     else throw new Error("The exact source basis is unavailable; no broader material was attached.");
     if(!exactText(next,content))throw new Error("The exact selected range changed. Select it again.");
    }
    const selection=selectionSnapshot(next,binding,{revision,workingCopy});
    checkScope();
    if(!project)throw new Error("The current native context route requires a Project binding. The selection remains here; Central has not been replaced by a fabricated child Project.");

    // Starts the existing owner service only, never a provider/Agent turn.
    await encounter(transport,project,{action:"start"});
    checkScope();
    const current=await nativeContext(transport,project,session);
    checkScope();
    const result=await nativeContext(transport,project,session,{operation:"edit",basis:current.revision,mutation:{operation:"add",selection}});
    retained.current.set(binding.id,binding);if(retained.current.size>64)retained.current.delete(retained.current.keys().next().value!);
    checkScope();
    if(!disposed&&operation===generation){announceContext(project,result);setContextPreview({notice:session?"Added to Context · not sent":`Prepared for ${project} · choose a conversation in Context`});}
   }catch(error){if(!disposed&&operation===generation)setContextPreview({candidate:next,title:binding.title,error:String(error)});}
   finally{busy=false;}
  };
  const changed=(event:Event)=>{const detail=(event as CustomEvent<{project:string;value:PreparedContext}>).detail;if(!detail?.value)return;const c=detail.value;
   const companion=latest.current.accompanying;
   if(c.scope.agent_session!==(companion?.ref??null)||companion&&detail.project!==companion.project)return;
   const scope=selectionScopeKey(detail.project,c.scope.agent_session??undefined);
   if((cueRevisions.current.get(scope)??-1)>c.revision)return;
   cueRevisions.current.set(scope,c.revision);if(cueRevisions.current.size>64)cueRevisions.current.delete(cueRevisions.current.keys().next().value!);
   setContextCues(c.items.flatMap(item=>item.selection.anchor.kind==="text"?[{id:item.id,bindingId:item.selection.binding_id,sourceRef:item.selection.source_ref,start:item.selection.anchor.start,end:item.selection.anchor.end,text:item.selection.text}]:[]));
   markObservations(c.items.flatMap(item=>item.selection.anchor.kind==="observation"?[item.selection.anchor.key]:[]));
  };
  window.addEventListener("oi:selection-preview",present);window.addEventListener("oi:context-candidate",take);window.addEventListener(PREPARED_CONTEXT_CHANGED,changed);
  return()=>{disposed=true;generation++;unregister();window.removeEventListener("oi:selection-preview",present);window.removeEventListener("oi:context-candidate",take);window.removeEventListener(PREPARED_CONTEXT_CHANGED,changed);setContextCues([]);markObservations([]);};
 },[]);
 return <><ContextActions bindings={bindings} accompanying={accompanying}/>{(view.error||view.notice)&&<div className="context-feedback" role={view.error?"alert":"status"}><span>{view.error??view.notice}</span>{view.error&&<button type="button" onClick={()=>{const candidate=getContextPreview().candidate;if(candidate)window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:candidate}));}}>Retry</button>}<button type="button" aria-label="Dismiss context notice" onClick={()=>setContextPreview({})}>×</button></div>}</>;
}
