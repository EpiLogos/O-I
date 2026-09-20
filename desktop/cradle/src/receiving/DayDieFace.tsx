import {useEffect,useMemo,useRef,useState} from "react";
import {DOCUMENT_FORMS,resolveDocumentForm} from "../flow/documentForms";
import {readFile} from "../files/client";
import {useKernel} from "../kernel/KernelProvider";
import {receiving} from "./client";
import type {CentralLocation} from "../kernel/types";
import {DayFormSession,isObject,projectDieDocument,unmappedChanges,validateDocumentBasis,type DayDocumentField,pointerValue,type FormBasis} from "../central/dayForm";
import "./receiving.css";
export {projectDieDocument} from "../central/dayForm";
export type {DayDocumentField} from "../central/dayForm";
const DIE_SHELL=DOCUMENT_FORMS.find(form=>form.kind==="document-42"&&form.file==="ql-daily-die.html");

/** The real original editor, never an app-owned replacement. A message from
 * the sandbox may stage material but never authorizes a native write. */
export function DayDieFace({payload,revision,sourceRef,documentId,fields,project}:{payload:unknown;revision:string;sourceRef:string;documentId:string;fields:DayDocumentField[];project:string|null}) {
 const kernel=useKernel();
 const session=useMemo(()=>new DayFormSession({sourceRef,documentId,revision,payload,fields}),[sourceRef,documentId,project]);
 const [face,setFace]=useState<string>();
 const [failure,setFailure]=useState<string>();
 const [message,setMessage]=useState<string>();
 const [dirty,setDirty]=useState(false);
 const [pending,setPending]=useState(false);
 const [review,setReview]=useState<FormBasis>();
 const [unmapped,setUnmapped]=useState<string[]>([]);
 const [,render]=useState(0);
 const frame=useRef<HTMLIFrameElement>(null);
 const snapshot=useRef<{nonce:string;resolve:(v:unknown)=>void;reject:(reason:Error)=>void;timer:number}>();
 const shell=useRef<string>();
 const editEpoch=useRef(0);
 const refresh=()=>render(n=>n+1);
 useEffect(()=>{
  session.active=true;
  return()=>{session.active=false;const held=snapshot.current;if(held){clearTimeout(held.timer);held.reject(new Error("Day view closed before snapshot"));snapshot.current=undefined;}};
 },[session]);
 useEffect(()=>{
  const previous=session.basis.revision;
  session.observe({sourceRef,documentId,revision,payload,fields});
  // Clean external rereads update the actual original editor, not just its
  // save basis. Dirty/pending frames retain their draft and explicit conflict.
  if(session.basis.revision!==previous&&!session.blocked&&shell.current){
   const next=projectDieDocument(shell.current,session.basis.payload);
   if(next){setFace(next);setDirty(false);setReview(undefined);}
   else setFailure("The retained original form cannot project this native revision");
  }
  refresh();
 },[session,revision]);
 useEffect(()=>{
  const warn=(event:BeforeUnloadEvent)=>{if(session.edited||session.draft!==undefined||session.busy){event.preventDefault();event.returnValue="";}};
  window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);
 },[session]);
 useEffect(()=>{
  let alive=true;setFace(undefined);setFailure(undefined);setReview(undefined);setDirty(false);
  (async()=>{
   try {
    const retained=isObject(payload)?payload._oi_form_source:undefined;
    let location:CentralLocation;
    if(retained!==undefined){
     if(!isObject(retained)||retained.schema!=="oi.original-day-form/v1"||!isObject(retained.location)||retained.location.schema!=="central.path-ref/v1"||typeof retained.revision!=="string")throw new Error("Malformed retained original-form locator");
     location=retained.location as unknown as CentralLocation;
    } else {
     if(!DIE_SHELL)throw new Error("Original form roster entry is unavailable");
     location=await resolveDocumentForm(kernel.transport,DIE_SHELL,kernel.snapshot.navigator?.root?.work.projects);
    }
    const original=await readFile(kernel.transport,location);
    if(isObject(retained)&&original.revision!==retained.revision)throw new Error("The retained original form changed. Review that source revision; a different shell is not substituted silently.");
    const projected=projectDieDocument(original.content,session.basis.payload);
    if(!projected)throw new Error("Original editor snapshot seam is unavailable; its source remains intact");
    if(alive){shell.current=original.content;setFace(projected);}
   } catch(error){if(alive)setFailure(String(error));}
  })();return()=>{alive=false;};
 },[session,kernel.transport]);
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.source!==frame.current?.contentWindow||!isObject(event.data)||event.data.source!=="oi-cradle-die-face")return;
   if(event.data.type==="dirty"){session.markDirty();editEpoch.current++;setDirty(true);return;}
   const held=snapshot.current;
   if(!held||event.data.nonce!==held.nonce)return;
   if(event.data.type!=="snapshot"&&event.data.type!=="snapshot-error")return;
   clearTimeout(held.timer);snapshot.current=undefined;
   if(event.data.type==="snapshot-error")held.reject(new Error(String(event.data.error)));
   else held.resolve(event.data.payload);
  };
  window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
 },[session]);
 const capture=()=>new Promise<unknown>((resolve,reject)=>{
  if(snapshot.current||!frame.current?.contentWindow){reject(new Error("Day snapshot is not available"));return;}
  const nonce=crypto.randomUUID();
  const timer=window.setTimeout(()=>{snapshot.current=undefined;reject(new Error("Original form did not acknowledge the requested snapshot; no writes sent"));},5000);
  snapshot.current={nonce,resolve,reject,timer};
  frame.current.contentWindow.postMessage({source:"oi-day-host",type:"snapshot",nonce},"*");
 });
 const save=async()=>{
  setPending(true);setMessage(undefined);
  try {
   const next=await capture();const epoch=editEpoch.current;session.stage(next);setUnmapped(unmappedChanges(session.basis,next));
   await session.save(input=>receiving(kernel.transport,project,{kind:"mutate-field",...input}));
   if(!session.active)return;
   await kernel.rereadSource(sourceRef);
   if(editEpoch.current!==epoch)session.markDirty();
   setDirty(session.edited||session.draft!==undefined);setMessage("Native Save acknowledged; source, document and exact revision matched. Unmapped changes remain only in the original form.");
  } catch(error){if(session.active)setMessage(`Save not completed: ${String(error)}. No automatic replay; retained draft and source need review.`);}
  finally{if(session.active){setPending(false);refresh();}}
 };
 const readForReview=async()=>{
  setPending(true);setMessage(undefined);
  try {
   if(dirty&&!session.draft)session.stage(await capture());
   const value=await receiving(kernel.transport,project,{kind:"document",source_ref:sourceRef,document_id:documentId});
   if(session.active)setReview(validateDocumentBasis(value,sourceRef,documentId));
  }catch(error){if(session.active)setMessage(String(error));}
  finally{if(session.active){setPending(false);}}
 };
 const discardToReview=()=>{
  if(!review||!shell.current)return;
  session.draft=undefined;session.edited=false;session.basis=review;session.blocked=undefined;
  setFace(projectDieDocument(shell.current,review.payload)??undefined);setDirty(false);setReview(undefined);setMessage("Explicitly reopened the reviewed native source; no source was overwritten.");refresh();
 };
 if(failure)return <p className="die-face-unavailable" role="alert">Daily Die original source unavailable: {failure}</p>;
 return <div className="die-face-host">
  <div className="die-face-sync" role="status" aria-live="polite">
   <button type="button" disabled={!face||pending||!!session.blocked} onClick={()=>void save()}>Save Daily Die to native source</button>
   <button type="button" disabled={pending||!face} onClick={()=>void readForReview()}>Review current native source</button>
   <p>{pending?"Waiting for the native operation…":dirty?"Unsaved form edits. Native Save is explicit; the form’s Save HTML copy remains a separate portable artifact.":"Original form over the native Day. Viewing, typing and copied HTML do not authorize automatic native writes."}</p>
   {session.blocked&&<p role="alert">{session.blocked}</p>}
   {message&&<p>{message}</p>}
   {!!unmapped.length&&<p role="alert">These original payload regions have no native field mapping and are NOT natively saved: {unmapped.join(", ")}. Keep an HTML copy before leaving.</p>}
   {review&&<section aria-label="Review native Day revision"><strong>Current native revision: {review.revision}</strong>
    {session.changes().map(edit=><details key={edit.id}><summary>{edit.id} · retained draft versus current source</summary><pre>{JSON.stringify({draft:edit.value,current:pointerValue(review.payload,edit.pointer)},null,2).slice(0,12000)}</pre></details>)}
    <button type="button" onClick={()=>{try{session.reviewOnto(review);if(shell.current)setFace(projectDieDocument(shell.current,session.draft)??undefined);setReview(undefined);setMessage("Draft edits retained against the explicitly reviewed revision. Save remains a separate action.");refresh();}catch(e){setMessage(String(e));}}}>Keep draft edits on this reviewed basis</button>
    <button type="button" onClick={discardToReview}>Discard frame edits and reopen this native revision</button>
   </section>}
  </div>
  {face===undefined?<p role="status">Reading the original Daily Die source…</p>:<iframe ref={frame} className="die-face" title="Day die — the document's supplied form, projected from its native payload" sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" srcDoc={face}/>}
 </div>;
}
