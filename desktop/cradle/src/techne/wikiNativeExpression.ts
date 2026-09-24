/** M0 prepares the existing native Expression/Scenes for the hosted engine.
 * No Stage lease, canvas renderer, duplicate graph or browser document store.
 * The caller opens only the returned native ref through the current host. */
import {kernelOp} from '../kernel/bridge';
import type {KernelTransportStatus} from '../kernel/types';
import type {Change,ExpressionDocument,ExpressionRequest,ExpressionResult} from '../expression/types';
import {wikiRegistersFrom,type WikiProjection,type WikiRegister} from './wikiExpression';
import {ensureWikiProjection,getWikiProjectionState,setWikiProjectionRegisters,setWikiProjectionRegister,subscribeWikiProjection,wikiProjectionOpening,wikiProjectionDocumentReady,wikiProjectionDocumentFocused,wikiProjectionKernelUnavailable,wikiProjectionDrift} from './wikiProjectionStore';

export interface WikiNativeExpression {document:ExpressionDocument;projection:WikiProjection;drift?:string}
export interface WikiNativeFocus {sceneRef:string;entityRef:string|null;relationRef?:string|null}
const ACTOR='human:techne-instrument-0';
const flights=new Map<string,Promise<WikiNativeExpression>>();
const focusQueue=new Map<string,Promise<WikiNativeExpression>>();

/** Populate only from the kernel navigator's actual project disclosure. */
export function publishWikiNativeRegisters(projects:readonly {name:string;path:string}[]):readonly WikiRegister[]{
 setWikiProjectionRegisters(wikiRegistersFrom([...projects]));return wikiNativeRegisters();
}
export function wikiNativeRegisters():readonly WikiRegister[]{return getWikiProjectionState().registers;}
/** Selection changes the existing navigator preference, never opens/replaces work.
 * A restored hosted deep link therefore remains untouched until explicit open. */
export function selectWikiNativeRegister(key:string):WikiRegister{
 const register=wikiNativeRegisters().find(row=>row.key===key);if(!register)throw Error('This register is not disclosed by the current World');
 setWikiProjectionRegister(key);return register;
}
export function selectedWikiNativeRegister():WikiRegister|undefined{
 const state=getWikiProjectionState();return state.registers.find(row=>row.key===state.registerKey);
}

async function expression(transport:KernelTransportStatus,request:ExpressionRequest):Promise<ExpressionResult>{
 const result=await kernelOp(transport,{op:'expression',request});
 if(result.error||result.outcome?.result!=='expression')throw Error(result.error??'The native Expression owner returned no result');
 return result.outcome.data as ExpressionResult;
}
function projectionReady(transport:KernelTransportStatus,register:WikiRegister):Promise<WikiProjection>{
 return new Promise((resolve,reject)=>{
  let done=false;let unsubscribe=()=>{};
  const finish=(error?:Error,projection?:WikiProjection)=>{if(done)return;done=true;clearTimeout(timer);unsubscribe();if(error)reject(error);else resolve(projection!);};
  const check=()=>{const standing=getWikiProjectionState().standings[register.key];if(!standing)return;if(standing.phase==='unavailable')finish(Error(standing.reason));else if(standing.phase==='absent')finish(Error('This register has no Wiki reading to project'));else if('projection'in standing&&standing.projection)finish(undefined,standing.projection);};
  const timer=setTimeout(()=>finish(Error('The native Wiki reading did not complete; the hosted work was retained')),120000);
  unsubscribe=subscribeWikiProjection(check);ensureWikiProjection(register,transport);check();
 });
}
function accepted(register:WikiRegister,projection:WikiProjection,document:ExpressionDocument):WikiNativeExpression{
 if(document.expression_ref!==projection.document.expression_ref)throw Error('The native owner returned another Expression identity');
 const basis=projection.document.provenance[0];const original=document.provenance.find(row=>row.ref===basis?.ref);
 const drift=basis&&original?.revision!==basis.revision?'The source revision changed. This native composition, its Scenes and selection were retained; reconcile its source bindings before applying a new interpretation.':undefined;
 if(drift)wikiProjectionDrift(register.key,document,drift);else wikiProjectionDocumentReady(register.key,document);
 return {document,projection,...(drift?{drift}:{})};
}
/** Inspect/list before open. A standing native generation always wins over a
 * fresh derived projection, including its authored edits and current Scene. */
export function ensureWikiNativeExpression(transport:KernelTransportStatus,register:WikiRegister):Promise<WikiNativeExpression>{
 const key=JSON.stringify([transport,register]);const existing=flights.get(key);if(existing)return existing;
 const pending=(async()=>{
  try{
   const projection=await projectionReady(transport,register),ref=projection.document.expression_ref;
   wikiProjectionOpening(register.key);
   const listed=await expression(transport,{operation:'list'});
   if(!Array.isArray(listed.expressions))throw Error('Native Expression inventory is unavailable');
   let data:ExpressionResult;
   if(listed.expressions.some(row=>row.expression_ref===ref))data=await expression(transport,{operation:'inspect',expression_ref:ref});
   else{
    data=await expression(transport,{operation:'open',document:projection.document,actor:ACTOR});
    if(data.state==='revision_conflict')data=await expression(transport,{operation:'inspect',expression_ref:ref});
   }
   if(!data.document)throw Error('The native Expression owner returned no document');
   return accepted(register,projection,data.document);
  }catch(error){wikiProjectionKernelUnavailable(register.key,String(error instanceof Error?error.message:error));throw error;}
 })();flights.set(key,pending);void pending.finally(()=>{if(flights.get(key)===pending)flights.delete(key);}).catch(()=>undefined);return pending;
}
/** Native focus only; actual rendering is refreshed by the hosted engine's
 * existing native workspace under its unsaved-work guard. */
export function focusWikiNativeExpression(transport:KernelTransportStatus,register:WikiRegister,focus:WikiNativeFocus):Promise<WikiNativeExpression>{
 const key=JSON.stringify([transport,register]);
 // Serialize across mounted host lifetimes, not just one React effect. An old
 // request may finish, but cannot retry over a newer selection after cleanup.
 const prior=focusQueue.get(key);
 const pending=(prior?prior.catch(()=>undefined):Promise.resolve()).then(()=>applyNativeFocus(transport,register,focus));
 focusQueue.set(key,pending);
 void pending.finally(()=>{if(focusQueue.get(key)===pending)focusQueue.delete(key);}).catch(()=>undefined);
 return pending;
}
async function applyNativeFocus(transport:KernelTransportStatus,register:WikiRegister,focus:WikiNativeFocus):Promise<WikiNativeExpression>{
 let prepared=await ensureWikiNativeExpression(transport,register);
 for(let attempt=0;attempt<2;attempt++){
  const document=prepared.document,scene=document.scenes.find(row=>row.scene_ref===focus.sceneRef);
  if(!scene||focus.entityRef&&!scene.entity_refs.includes(focus.entityRef))throw Error('This selection is not a member of the current native Scene');
  if(focus.relationRef){const relation=document.relations[focus.relationRef];if(!relation||!scene.entity_refs.includes(relation.from_entity_ref)||!scene.entity_refs.includes(relation.to_entity_ref))throw Error('This relation is not in the current native Scene');}
  const change:Change=focus.relationRef?{change:'relation_focus',scene_ref:focus.sceneRef,binding_ref:focus.relationRef}:{change:'focus',scene_ref:focus.sceneRef,entity_ref:focus.entityRef};
  const data=await expression(transport,{operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:ACTOR,changes:[change]});
  if(data.state==='revision_conflict'&&attempt===0){const current=await expression(transport,{operation:'inspect',expression_ref:document.expression_ref});if(!current.document)throw Error('The changed native composition could not be read');prepared=accepted(register,prepared.projection,current.document);continue;}
  if(!data.document)throw Error('The native focus was not acknowledged');
  if(data.document.expression_ref!==document.expression_ref)throw Error('The native focus redirected the Expression');
  wikiProjectionDocumentFocused(register.key,data.document);return {...prepared,document:data.document};
 }
 throw Error('The native composition changed again; choose the current Scene and retry');
}
