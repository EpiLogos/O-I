/** M0 prepares the existing native Expression/Scenes for the hosted engine.
 * No Stage lease, canvas renderer, duplicate graph or browser document store.
 * The caller opens only the returned native ref through the current host. */
import {kernelOp} from '../kernel/bridge';
import type {KernelTransportStatus} from '../kernel/types';
import type {Change,ExpressionDocument,ExpressionRequest,ExpressionResult,Relation} from '../expression/types';
import {projectWikiExpression,readWikiRegister,wikiRegistersFrom,type WikiProjection,type WikiRegister} from './wikiExpression';
import {ensureWikiProjection,getWikiProjectionState,setWikiProjectionRegisters,setWikiProjectionRegister,subscribeWikiProjection,wikiProjectionOpening,wikiProjectionDocumentReady,wikiProjectionDocumentFocused,wikiProjectionKernelUnavailable,wikiProjectionDrift,refreshWikiProjectionReading} from './wikiProjectionStore';

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
 const incomplete=!document.provenance.some(row=>row.ref.startsWith('wiki:relations:'))&&(!projection.document.provenance.some(row=>row.ref.startsWith('wiki:relations:'))||Object.values(projection.document.relations).some(row=>canonical(document.relations[row.binding_ref])!==canonical(row)));
 const drift=basis&&original?.revision!==basis.revision?'The source revision changed. This native composition, its Scenes and selection were retained; reconcile its source bindings before applying a new interpretation.':incomplete?'Source connections were unavailable when this composition was opened. Retry their reading and review missing connections before restoring them.':undefined;
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

/** Explicit repair of a failed source read. Missing bindings are never an
 * automatic migration: removal is a legitimate native presentation edit. */
export interface WikiRelationRecovery {
 register:WikiRegister;
 document:ExpressionDocument;
 projection:WikiProjection;
 missing:Relation[];
}
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export function planWikiRelationRecovery(register:WikiRegister,document:ExpressionDocument,projection:WikiProjection):WikiRelationRecovery {
 const proposed=projection.document;
 if(document.expression_ref!==proposed.expression_ref)throw Error('The source reading belongs to another composition');
 if(document.provenance.some(row=>row.ref.startsWith('wiki:relations:')))throw Error('This composition already read its source connections. Missing connections may have been intentionally removed.');
 const basis=proposed.provenance.find(row=>row.ref.startsWith('wiki:')&&!row.ref.startsWith('wiki:relations:'));
 if(!basis||!document.provenance.some(row=>row.ref===basis.ref&&row.revision===basis.revision&&row.availability==='available'))throw Error('The Wiki source changed. Review its changed membership before restoring connections.');
 if(!proposed.provenance.some(row=>row.ref.startsWith('wiki:relations:')&&row.availability==='available'))throw Error(projection.notices.find(note=>note.startsWith('Typed relations unavailable:'))??'Source connections are still unavailable');
 const missing:Relation[]=[];
 for(const relation of Object.values(proposed.relations)){
  const existing=document.relations[relation.binding_ref];
  if(existing){if(canonical(existing)!==canonical(relation))throw Error('A connection with this identity has changed. Review its endpoints before restoring.');continue;}
  for(const ref of [relation.from_entity_ref,relation.to_entity_ref]){
   const expected=proposed.entities[ref]?.subject,current=document.entities[ref]?.subject;
   if(!expected||!current||expected.subject_ref!==current.subject_ref||expected.native_owner!==current.native_owner)throw Error('A connection endpoint was removed or rebound. Restore its membership explicitly before connecting it.');
  }
  const scopes=proposed.scenes.filter(scene=>scene.entity_refs.includes(relation.from_entity_ref)&&scene.entity_refs.includes(relation.to_entity_ref));
  if(!scopes.length||scopes.some(scope=>{const scene=document.scenes.find(row=>row.scene_ref===scope.scene_ref);return !scene||!scene.entity_refs.includes(relation.from_entity_ref)||!scene.entity_refs.includes(relation.to_entity_ref);}))throw Error('Scene membership changed. Restore its membership explicitly before connecting it.');
  missing.push(relation);
 }
 return {register,document,projection,missing};
}
export async function previewWikiRelationRecovery(transport:KernelTransportStatus,register:WikiRegister):Promise<WikiRelationRecovery>{
 const reading=await refreshWikiProjectionReading(register,transport);
 const projection=projectWikiExpression(reading);
 const result=await expression(transport,{operation:'inspect',expression_ref:projection.document.expression_ref});
 if(!result.document)throw Error('Open this native composition before restoring its source connections');
 accepted(register,projection,result.document);
 return planWikiRelationRecovery(register,result.document,projection);
}
export async function applyWikiRelationRecovery(transport:KernelTransportStatus,preview:WikiRelationRecovery):Promise<ExpressionDocument>{
 // Re-read at acceptance: previewed source and owner revision are both guards.
 const reading=await readWikiRegister(transport,preview.register);
 if(reading.state!=='ready')throw Error(reading.state==='unavailable'?reading.reason:'The Wiki source is absent');
 const fresh=projectWikiExpression(reading);
 if(canonical(fresh.document.provenance)!==canonical(preview.projection.document.provenance)||canonical(fresh.document.relations)!==canonical(preview.projection.document.relations))throw Error('The source connections changed after review. Retry their reading before restoring.');
 return commitWikiRelationRecovery(transport,preview,fresh);
}
/** Native transaction stage, after source revalidation. Kept separate so the
 * real owner CAS/readback can be checked without replacing a source provider. */
export async function commitWikiRelationRecovery(transport:KernelTransportStatus,preview:WikiRelationRecovery,fresh:WikiProjection):Promise<ExpressionDocument>{
 if(canonical(fresh.document.provenance)!==canonical(preview.projection.document.provenance)||canonical(fresh.document.relations)!==canonical(preview.projection.document.relations))throw Error('The source connections changed after review. Retry their reading before restoring.');
 const inspected=await expression(transport,{operation:'inspect',expression_ref:preview.document.expression_ref});
 if(!inspected.document||canonical(inspected.document)!==canonical(preview.document))throw Error('The native composition changed after review. Retry before restoring connections.');
 const checked=planWikiRelationRecovery(preview.register,inspected.document,fresh);
 if(canonical(checked.missing)!==canonical(preview.missing))throw Error('The connection review changed. Retry before restoring.');
 if(!checked.missing.length)return inspected.document;
 const changed=await expression(transport,{operation:'edit',expression_ref:preview.document.expression_ref,expected_revision:preview.document.revision,actor:ACTOR,changes:checked.missing.map(binding=>({change:'relation_bind',binding}))});
 if(changed.state==='revision_conflict'||!changed.document)throw Error('The native composition changed. Retry before restoring connections.');
 const confirmed=await expression(transport,{operation:'inspect',expression_ref:preview.document.expression_ref});
 if(!confirmed.document)throw Error('Restored connections could not be independently read back. Inspect the native composition before retrying.');
 const expected={...preview.document,revision:changed.document.revision,relations:{...preview.document.relations,...Object.fromEntries(checked.missing.map(row=>[row.binding_ref,row]))}};
 if(canonical(confirmed.document)!==canonical(expected))throw Error('The native composition changed during confirmation. Inspect it before retrying.');
 accepted(preview.register,fresh,confirmed.document);
 return confirmed.document;
}
