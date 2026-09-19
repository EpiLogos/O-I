/**
 * The Expression application's authoring state, as one reusable hook.
 *
 * This is the same state machine the Expression composer has always run —
 * list/inspect/refresh through `KernelOp::Expression`, generation-guarded
 * reads, revision-checked edits, conflict disclosure — lifted out of
 * `ExpressionView` so the composer (Settings → Compose, the agent panel's
 * Composition plane) and the Expressions centre surface share ONE
 * implementation. The hook owns no presentation: hosts decide where the
 * stage artboard sits and which controls are visible.
 */
import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import type {Change,Entity,ExpressionDocument,ExpressionRequest,ExpressionResult,Refinement} from "./types";
import type {CentralLocation} from "../kernel/types";

export const EXPRESSION_EDITOR_ACTOR="human:expression-editor";

export type ExpressionListing=NonNullable<ExpressionResult["expressions"]>;
export interface ExpressionFileIdentity {location:CentralLocation;revision:string}

export interface ExpressionApplication {
 document:ExpressionDocument|undefined;
 list:ExpressionListing;
 error:string;
 setError:(message:string)=>void;
 pending:boolean;
 file:ExpressionFileIdentity|undefined;
 setFile:(file:ExpressionFileIdentity|undefined)=>void;
 /** The last owner result, kept for the operation disclosure. */
 result:ExpressionResult|undefined;
 request:(request:ExpressionRequest)=>Promise<ExpressionResult>;
 inspect:(expressionRef:string)=>Promise<void>;
 refresh:()=>Promise<void>;
 run:(op:ExpressionRequest)=>Promise<ExpressionResult|undefined>;
 edit:(changes:Change[])=>Promise<ExpressionResult|undefined>|undefined;
 commitParameter:(entityRef:string,parameter:string,value:string|number,basis:number)=>Promise<boolean>;
 /** Resolve a Central-relative path to an existing file through the owner's
  * directory reading (never a manufactured location). */
 resolveFile:(path:string)=>Promise<CentralLocation>;
 selected:Entity|undefined;
 sceneEntities:string[];
 pendingRefinements:Refinement[];
}

export function useExpressionApplication(initialExpressionRef?:string):ExpressionApplication {
 const kernel=useKernel();
 const [document,setDocument]=useState<ExpressionDocument>();
 const [list,setList]=useState<ExpressionListing>([]);
 const [error,setError]=useState("");const [pending,setPending]=useState(false);
 const [file,setFile]=useState<ExpressionFileIdentity>();
 const [result,setResult]=useState<ExpressionResult>();
 const mounted=useRef(true);const readGeneration=useRef(0);const selectedRef=useRef<string>();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;readGeneration.current++;};},[]);
 const request=useCallback(async(request:ExpressionRequest)=>{
  const reply=await kernelOp(kernel.transport,{op:"expression",request});
  if(reply.error||!reply.outcome||reply.outcome.result!=="expression")throw new Error(reply.error??"Expression application unavailable");
  return reply.outcome.data;
 },[kernel.transport]);
 const inspect=useCallback(async(expressionRef:string)=>{
  const generation=++readGeneration.current;selectedRef.current=expressionRef;setPending(false);setError("");
  const reading=await request({operation:"inspect",expression_ref:expressionRef});
  if(!mounted.current||generation!==readGeneration.current||selectedRef.current!==expressionRef)return;
  if(reading.document)setDocument(reading.document);if(reading.file)setFile(reading.file);
 },[request]);
 const refresh=useCallback(async()=>{
  const generation=readGeneration.current;const expressionRef=selectedRef.current;
  const listing=await request({operation:"list"});if(!mounted.current||generation!==readGeneration.current)return;setList(listing.expressions??[]);
  if(expressionRef){const reading=await request({operation:"inspect",expression_ref:expressionRef});if(!mounted.current||generation!==readGeneration.current||selectedRef.current!==expressionRef)return;if(reading.document)setDocument(reading.document);if(reading.file)setFile(reading.file);}
 },[request]);
 useEffect(()=>{if(initialExpressionRef)void inspect(initialExpressionRef).catch(e=>setError(String(e)));else void refresh().catch(e=>setError(String(e)));},[refresh,inspect,initialExpressionRef]);
 const seq=kernel.receipts.filter(r=>r.event==="expression_changed").slice(-1)[0]?.seq;
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[seq,refresh]);
 const run=async(op:ExpressionRequest)=>{
  const target="expression_ref" in op?op.expression_ref:undefined;
  let generation=readGeneration.current;
  if(op.operation==="create"){selectedRef.current=op.expression_ref;generation=++readGeneration.current;}
  setPending(true);setError("");try{
   const data=await request(op);
   const currentSelection=mounted.current&&generation===readGeneration.current&&(!target||selectedRef.current===target);
   if(!currentSelection)return undefined;
   setResult(data);
   if(data.document){selectedRef.current=data.document.expression_ref;setDocument(data.document);}
   if(data.file)setFile(data.file);
   if(["revision_conflict","proposal_basis_conflict","file_revision_conflict","save_refused"].includes(data.state??""))setError(JSON.stringify(data));
   await refresh();return data;
  }catch(e){if(mounted.current&&generation===readGeneration.current)setError(String(e));return undefined;}finally{if(mounted.current&&generation===readGeneration.current)setPending(false);}
 };
 const edit=(changes:Change[])=>document&&run({operation:"edit",expression_ref:document.expression_ref,expected_revision:document.revision,actor:EXPRESSION_EDITOR_ACTOR,changes});
 const commitParameter=async(entity_ref:string,parameter:string,value:string|number,basis:number)=>{
  if(!document)return false;
  const data=await run({operation:"edit",expression_ref:document.expression_ref,expected_revision:basis,actor:EXPRESSION_EDITOR_ACTOR,changes:[{change:"parameter_set",entity_ref,parameter,value}]});
  return data?.state==="ready";
 };
 const resolveFile=async(path:string)=>{
  const clean=path.trim();const slash=clean.lastIndexOf("/");
  const parent=slash<0?".":clean.slice(0,slash);const name=clean.slice(slash+1);
  const reply=await kernelOp(kernel.transport,{op:"files_list",path:parent});
  if(!reply.outcome||reply.outcome.result!=="directory_read")throw new Error(reply.error??"Folder unavailable");
  const entry=reply.outcome.directory.entries.find(e=>e.name===name&&e.kind==="file");
  if(!entry)throw new Error("Choose an existing Expression file under Central");return entry.location;
 };
 const selected=document?.selection.entity_ref?document.entities[document.selection.entity_ref]:undefined;
 const pendingRefinements=document?.refinements.filter(proposal=>!proposal.decision)??[];
 const sceneEntities=document?.scenes.find(s=>s.scene_ref===document.selection.scene_ref)?.entity_refs??[];
 return {document,list,error,setError,pending,file,setFile,result,request,inspect,refresh,run,edit,commitParameter,resolveFile,selected,sceneEntities,pendingRefinements};
}

/** Export through the owner, then hand the person a local JSON copy. */
export async function exportExpressionCopy(app:Pick<ExpressionApplication,"document"|"run">){
 const document=app.document;if(!document)return;
 const data=await app.run({operation:"export",expression_ref:document.expression_ref,expected_revision:document.revision});
 if(data?.document){const url=URL.createObjectURL(new Blob([JSON.stringify(data.document,null,2)],{type:"application/json"}));const a=window.document.createElement("a");a.href=url;a.download="expression.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
