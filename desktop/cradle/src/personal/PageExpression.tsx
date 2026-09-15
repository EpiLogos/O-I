import {useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {expressionConfig} from "../expression/engineProjection";
import type {ExpressionDocument,ReadingRef,SubjectBinding} from "../expression/types";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
// @ts-ignore -- Personal Web adapter is the language-neutral document contract.
import {pageExpressionBinding} from "./page-expression.mjs";
// @ts-ignore -- shared renderer admission contract.
import {resolveExpressionPresentation} from "../../../../shared-field/expression-presentation.mjs";

type PageDocument=Record<string,any>; type Loaded={basis:string;document:ExpressionDocument};
export type PageExpressionHostedState={pageRef:string;fileRevision:string;documentId:string|null;documentRevision:number;expressionRef:string;expressionRevision:number;live:boolean};
const signature=(reading:ReadingRef)=>`${reading.ref}\u0000${reading.revision}\u0000${reading.availability}`;
function verifySubjects(document:ExpressionDocument,declared:any[]){
 const native:SubjectBinding[]=[],scene=document.scenes.find(item=>item.scene_ref===document.selection.scene_ref);
 for(const ref of scene?.entity_refs??[]){const subject=document.entities[ref]?.subject;if(subject)native.push(subject);}
 const expected=new Map(declared.map(subject=>[subject.ref,subject]));
 if([...new Set(native.map(item=>item.subject_ref))].sort().join("\n")!==[...expected.keys()].sort().join("\n"))throw new Error("Page and native Expression subjects do not match exactly");
 for(const subject of native){const ref=subject.subject_ref,page=expected.get(ref);if(page.availability!=="available")throw new Error(`Subject ${ref} is ${page.availability}`);const actual=subject.sources.map(signature).sort(),wanted=(page.sources??[]).map(signature).sort();if(actual.join("\n")!==wanted.join("\n"))throw new Error(`Subject ${ref} source revisions do not match the page`);}
}

export function PageExpression({page,fileRevision,pageRef,onHostedState}:{page:PageDocument;fileRevision:string;pageRef:string;onHostedState?:(state:PageExpressionHostedState)=>void}){
 const kernel=useKernel(),stage=useExpressionStage(),binding=useMemo(()=>pageExpressionBinding(page,fileRevision),[page,fileRevision]);
 const expression=binding?.props.expression as any,basis=`${pageRef}\u0000${fileRevision}\u0000${expression?.expression_ref??""}\u0000${expression?.expression_revision??""}`;
 const resolved=useMemo(()=>binding?resolveExpressionPresentation(binding,{renderer_ref:"renderer:oi:expression-stage",available:true,focus:true,capture:true}):null,[binding]);
 const [loaded,setLoaded]=useState<Loaded>(),currentDocument=loaded?.basis===basis?loaded.document:undefined;
 const [error,setError]=useState(""),[stageReady,setStageReady]=useState(false),[focused,setFocused]=useState(false),[captureUrl,setCaptureUrl]=useState<string>();
 const inline=useRef<HTMLDivElement>(null),full=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDivElement>(null),presentation=useRef<StagePresentation|null>(null),returnFocus=useRef<HTMLElement|null>(null),captureGeneration=useRef(0),mounted=useRef(true);
 const presentationId=`page-expression:${basis}`,expressionReceipts=kernel.receipts.filter(receipt=>receipt.event==="expression_changed"),changedSeq=expressionReceipts[expressionReceipts.length-1]?.seq;
 useLayoutEffect(()=>{captureGeneration.current++;presentation.current?.release();presentation.current=null;setLoaded(undefined);setStageReady(false);setFocused(false);setCaptureUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return undefined;});},[basis]);
 useLayoutEffect(()=>{if(expression)onHostedState?.({pageRef,fileRevision,documentId:page.meta?.documentId??null,documentRevision:page.meta?.revision,expressionRef:expression.expression_ref,expressionRevision:expression.expression_revision,live:stageReady&&!error&&resolved?.state==="live"});},[onHostedState,pageRef,fileRevision,page.meta?.documentId,page.meta?.revision,expression?.expression_ref,expression?.expression_revision,stageReady,error,resolved?.state]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;captureGeneration.current++;presentation.current?.release();};},[]);
 useEffect(()=>{if(!expression||resolved?.state!=="live")return;let live=true;setError("");void kernelOp(kernel.transport,{op:"expression",request:{operation:"inspect",expression_ref:expression.expression_ref}}).then(reply=>{
   if(!live)return;if(reply.error||reply.outcome?.result!=="expression")throw new Error(reply.error??"Expression application unavailable");const doc=reply.outcome.data?.document as ExpressionDocument|undefined;if(!doc)throw new Error("Expression is not open in the native application");
   if(doc.revision!==expression.expression_revision)throw new Error(`Expression revision changed: page has ${expression.expression_revision}, native application has ${doc.revision}`);if(expression.scene_ref&&!doc.scenes.some(scene=>scene.scene_ref===expression.scene_ref))throw new Error("Page Expression scene is unavailable");const projected=expression.scene_ref&&doc.selection.scene_ref!==expression.scene_ref?{...doc,selection:{scene_ref:expression.scene_ref,entity_ref:null}}:doc;verifySubjects(projected,expression.subjects);setLoaded(previous=>previous?.basis===basis&&previous.document.revision===projected.revision?previous:{basis,document:projected});
 }).catch(cause=>{if(live){presentation.current?.release();presentation.current=null;setLoaded(undefined);setStageReady(false);setError(String(cause));}});return()=>{live=false;};
 },[kernel.transport,expression?.expression_ref,expression?.expression_revision,basis,resolved?.state,changedSeq]);
 useEffect(()=>{
  if(!currentDocument||presentation.current)return;
  let current=true;
  try{
   const handle=stage.present({id:presentationId,plane:"overlay",recipe:"",config:expressionConfig(currentDocument),appearance:"host",sceneRef:currentDocument.selection.scene_ref});
   // Importing or the opening's foreground claim is temporary. The stage
   // notifies this consumer when admission becomes available again.
   if(!handle){setStageReady(false);if(stage.error)setError(stage.error);return;}
   presentation.current=handle;handle.setContainer(focused?full.current:inline.current);setError("");
   void handle.ready().then(()=>{if(current)setStageReady(true);}).catch(cause=>{if(current){setStageReady(false);setError(String(cause));}});
  }catch(cause){setStageReady(false);setError(String(cause));}
  return()=>{current=false;presentation.current?.release();presentation.current=null;setStageReady(false);};
 },[currentDocument,presentationId,stage]);
 useLayoutEffect(()=>{try{presentation.current?.setContainer(focused?full.current:inline.current);if(focused)requestAnimationFrame(()=>dialog.current?.querySelector<HTMLButtonElement>("button")?.focus());}catch(cause){presentation.current?.release();presentation.current=null;setStageReady(false);setFocused(false);setError(String(cause));}},[focused]);
 const restore=()=>{setFocused(false);requestAnimationFrame(()=>returnFocus.current?.focus());};
 useEffect(()=>{if(!focused)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();restore();}};window.addEventListener("keydown",escape,true);return()=>window.removeEventListener("keydown",escape,true);},[focused]);
 useEffect(()=>()=>{if(captureUrl)URL.revokeObjectURL(captureUrl);},[captureUrl]);
 if(!binding)return null;
 const focus=()=>{returnFocus.current=globalThis.document.activeElement as HTMLElement;setFocused(true);};
 const capture=()=>{const generation=++captureGeneration.current,captureBasis=basis;try{const canvas=stage.capture(presentationId);canvas.toBlob(blob=>{if(!blob){setError("Expression capture returned no PNG");return;}if(!mounted.current||generation!==captureGeneration.current||captureBasis!==basis)return;const next=URL.createObjectURL(blob);setCaptureUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return next;});},"image/png");}catch(cause){setError(String(cause));}};
 return <section className="page-expression-host" data-page-ref={pageRef} data-file-revision={fileRevision} data-expression-ref={expression.expression_ref} data-expression-revision={expression.expression_revision} data-subject-ref={binding.subject_ref}>
   <header><div><small>Expression body</small><strong>{expression.expression_ref}</strong></div><span>r{expression.expression_revision}</span></header>
   {resolved?.state!=="live"?<p role="status">{resolved?.state==="fallback"?`Live renderer not admitted; the page shows its ${resolved.fallback.kind} fallback.`:`Expression unavailable: ${resolved?.reason}`}</p>:<><div ref={inline} className="page-expression-canvas" aria-label="Live Expression"/>{error&&<p role="alert">{error}</p>}</>}
   <div className="page-expression-actions"><button type="button" disabled={!stageReady||!!error} onClick={focus}>Focus Expression</button><button type="button" disabled={!stageReady||!!error} onClick={capture}>Capture current frame</button></div>
   {captureUrl?<figure><img src={captureUrl} alt="Captured Expression frame"/><figcaption>Page-local PNG fallback from {expression.expression_ref} r{expression.expression_revision}. It is not saved or published.</figcaption></figure>:null}
   {focused?<div ref={dialog} className="page-expression-focus" role="dialog" aria-modal="true" aria-label="Focused Expression"><div ref={full} className="page-expression-focus-canvas"/><footer><span>{expression.expression_ref} · page {pageRef} · file {fileRevision}</span><button type="button" onClick={restore}>Return to page</button><button type="button" onClick={capture}>Capture current frame</button></footer></div>:null}
 </section>;
}
