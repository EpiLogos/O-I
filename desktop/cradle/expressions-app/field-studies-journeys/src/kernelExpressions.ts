/** The kernel host channel, app side. The hosted application reaches the
 * kernel's expression ops through the cradle's relay (the host owns the
 * kernel transport; the frame owns none — no ambient authority). The kernel
 * document IS the store: nothing here writes a second copy into browser
 * storage, and every answer is either data or a named error.
 *
 * Channel laws (shared with the cradle relay, hostedApp.relayKernelChannel):
 *  - envelope `{v:1, kind, req, ...}`; replies carry the same `req` and a
 *    kind of `<request kind>-result` with exactly one of `data` / `error`;
 *  - feature detection is `window.parent !== window` plus the host's
 *    `oi-kernel-channel` announce (posted on frame load and in answer to an
 *    `oi-kernel-hello`);
 *  - unknown kinds are refused by name, never with silence.
 *
 * The pinned surface the Library consumes feature-detected:
 *   kernelExpressionsAvailable() · listKernelExpressions() ·
 *   readKernelExpression(ref) · saveKernelExpression(doc).
 * installKernelExpressions() is the boot hook (app.ts) — it stands the
 * listener up; it is not part of the consumed API. */
import {validateJourney} from './model.js';
import {kernelDocumentToJourney,KernelExpressionDocument,KernelEntity,KernelParameter} from './kernelDocumentBridge.js';

const VERSION=1;
type Pending={kind:string;resolve:(value:any)=>void;reject:(cause:Error)=>void;timer:number};
const pending=new Map<number,Pending>();
let seq=0,ready=false,installed=false;

interface Reply {v?:unknown;kind?:unknown;req?:unknown;ok?:unknown;data?:unknown;error?:unknown}

function onMessage(ev:MessageEvent){
 if(ev.source!==window.parent)return;
 const d=ev.data as Reply;
 if(!d||typeof d!=='object'||d.v!==VERSION)return;
 if(d.kind==='oi-kernel-channel'){ready=true;return;}
 if(typeof d.kind==='string'&&d.kind.endsWith('-result')&&typeof d.req==='number'){
  const entry=pending.get(d.req);
  if(!entry||d.kind!==`${entry.kind}-result`)return;
  pending.delete(d.req);clearTimeout(entry.timer);
  if(d.ok===true)entry.resolve(d.data);
  else entry.reject(new Error(typeof d.error==='string'&&d.error?d.error:'the kernel host channel refused the request'));
 }
}
function post(message:Record<string,unknown>):void{window.parent.postMessage({v:VERSION,...message},'*');}

/** Boot hook: stand the channel listener up inside the hosted frame. Safe to
 * call anywhere (standalone, Node tests): outside a host frame it simply
 * never arms, and kernelExpressionsAvailable() stays false. The pinned API
 * is also disclosed as window.__OI_KERNEL_EXPRESSIONS__ — the same
 * disclosure precedent as the app's window.__FIELD_STUDIES__ — so hosted
 * tooling and walks consume the exact same surface the Library imports. */
export function installKernelExpressions():void{
 if(installed||typeof window==='undefined'||window.parent===window)return;
 installed=true;
 window.addEventListener('message',onMessage);
 const api={kernelExpressionsAvailable,listKernelExpressions,readKernelExpression,saveKernelExpression};
 (window as unknown as Record<string,unknown>).__OI_KERNEL_EXPRESSIONS__=api;
 post({kind:'oi-kernel-hello'});
}

/** True once the cradle host announced the kernel channel for this frame. */
export function kernelExpressionsAvailable():boolean{return ready;}

function call<T>(kind:string,body:Record<string,unknown>,timeoutMs=20000):Promise<T>{
 if(typeof window==='undefined'||window.parent===window)return Promise.reject(new Error('The kernel host channel is unavailable outside the desktop shell'));
 if(!ready)return Promise.reject(new Error('The kernel host channel has not been announced by the host yet'));
 const req=++seq;
 return new Promise<T>((resolve,reject)=>{
  const timer=window.setTimeout(()=>{
   pending.delete(req);
   reject(new Error(`the kernel host channel did not answer the ${kind} request`));
  },timeoutMs);
  pending.set(req,{kind,resolve,reject,timer});
  post({kind,req,...body});
 });
}

export interface KernelExpressionListing {expression_ref:string;title:string;revision:number;dirty?:boolean;last_touched_unix?:number}

/** The kernel's own expression listing (oi.expression-list/v1) — most
 * recently touched first, exactly as the kernel discloses it. */
export async function listKernelExpressions():Promise<KernelExpressionListing[]>{
 const data=await call<{expressions?:KernelExpressionListing[]}>("kernel-expression",{request:{operation:"list"}});
 return data&&Array.isArray(data.expressions)?data.expressions:[];
}

/** Read one kernel-held oi.expression/v1 document. */
export async function readKernelExpression(ref:string):Promise<unknown>{
 if(typeof ref!=='string'||!ref)throw new Error('readKernelExpression needs an expression ref');
 const data=await call<{state?:string;document?:unknown}>("kernel-expression",{request:{operation:"inspect",expression_ref:ref}});
 if(!data||typeof data!=='object'||!data.document)throw new Error(`the kernel returned no document for ${ref}`);
 return data.document;
}

/** The kernel's Change grammar (oi.expression/v1), wire form. */
type KernelChange =
 |{change:"scene_create";scene_ref:string;title:string}
 |{change:"scene_compose";scene_ref:string;entity_refs:string[]}
 |{change:"entity_add";scene_ref:string;entity_ref:string;title:string}
 |{change:"entity_remove";entity_ref:string}
 |{change:"parameter_set";entity_ref:string;parameter:string;value:string|number}
 |{change:"focus";scene_ref:string;entity_ref:string|null};

/** The kernel's own parameter vocabulary; anything else cannot be expressed
 * as an edit and is refused here rather than mangled. */
const EDITABLE=new Set(['x','y','z','scale','share','glyph']);
const NUMERIC=new Set(['x','y','z','scale','share']);

const isDocument=(doc:unknown):doc is KernelExpressionDocument=>
 !!doc&&typeof doc==='object'&&(doc as KernelExpressionDocument).schema==='oi.expression/v1'
  &&typeof (doc as KernelExpressionDocument).expression_ref==='string'
  &&typeof (doc as KernelExpressionDocument).revision==='number'
  &&Array.isArray((doc as KernelExpressionDocument).scenes);

const sameJson=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Diff the app's edited document against the kernel's current document and
 * express the difference in the kernel's own Change grammar. Differences
 * this cut cannot express (title/scene retitling, scene removal, subject,
 * relation, automation edits) are returned as a named refusal — never
 * force-written, never dropped. */
export function documentToChanges(current:unknown,edited:unknown):{changes:KernelChange[]}|{error:string}{
 if(!isDocument(edited))return{error:'the document is not an oi.expression/v1 expression'};
 if(!isDocument(current))return{error:'the kernel holds no readable document to diff against'};
 const changes:KernelChange[]=[];
 if(edited.title!==current.title)return{error:'expression retitling is not expressible as a kernel edit in this cut (the kernel has no title change)'};
 const currentScenes=new Map((current.scenes as any[]).map(s=>[s.scene_ref,s]));
 const editedScenes=new Map((edited.scenes as any[]).map(s=>[s.scene_ref,s]));
 for(const ref of currentScenes.keys())if(!editedScenes.has(ref))return{error:`scene ${ref} was removed, and scene removal is not expressible as a kernel edit in this cut`};
 for(const [ref,scene] of editedScenes)if(!currentScenes.has(ref))changes.push({change:'scene_create',scene_ref:ref,title:String(scene.title||ref)});
 for(const [ref,scene] of editedScenes){
  const before=currentScenes.get(ref);
  if(before&&before.title!==scene.title)return{error:`scene ${ref} retitling is not expressible as a kernel edit in this cut`};
 }
 const currentEntities=new Map(Object.entries(current.entities??{}));
 const editedEntities=new Map(Object.entries(edited.entities??{}));
 const homeOf=new Map<string,string>();
 for(const [sceneRef,scene] of editedScenes)for(const entityRef of (scene as any).entity_refs??[])if(!homeOf.has(entityRef))homeOf.set(entityRef,sceneRef);
 for(const ref of currentEntities.keys())if(!editedEntities.has(ref))changes.push({change:'entity_remove',entity_ref:ref});
 for(const [ref,entity] of editedEntities){
  const before=currentEntities.get(ref) as KernelEntity|undefined;
  if(!before){
   const sceneRef=homeOf.get(ref);
   if(!sceneRef)return{error:`entity ${ref} is new but no scene carries it`};
   // entity_add seeds a bare glyph-"O" formation; every parameter the edited
   // document carries rides as its own parameter_set immediately after.
   changes.push({change:'entity_add',scene_ref:sceneRef,entity_ref:ref,title:String((entity as KernelEntity).title||ref)});
   for(const [key,p] of Object.entries((entity as KernelEntity).parameters??{}) as [string,KernelParameter][]){
    if(!EDITABLE.has(key))return{error:`entity ${ref} parameter ${key} is not expressible as a kernel edit in this cut`};
    if(NUMERIC.has(key)){
     if(typeof p.value!=='number'||!Number.isFinite(p.value))return{error:`entity ${ref} parameter ${key} must be a finite number`};
    }else if(typeof p.value!=='string')return{error:`entity ${ref} parameter glyph must be text`};
    changes.push({change:'parameter_set',entity_ref:ref,parameter:key,value:p.value});
   }
   continue;
  }
  const parameters=(entity as KernelEntity).parameters??{};
  const beforeParameters=before.parameters??{};
  for(const [key,p] of Object.entries(parameters) as [string,KernelParameter][]){
   if(!EDITABLE.has(key))return{error:`entity ${ref} parameter ${key} is not expressible as a kernel edit in this cut`};
   const was=beforeParameters[key];
   if(was?.automation)return{error:`entity ${ref} parameter ${key} is automated in the kernel; automation edits are not expressible in this cut`};
   if(!was||!sameJson(was.value,p.value)){
    if(NUMERIC.has(key)){
     if(typeof p.value!=='number'||!Number.isFinite(p.value))return{error:`entity ${ref} parameter ${key} must be a finite number`};
     changes.push({change:'parameter_set',entity_ref:ref,parameter:key,value:p.value});
    }else{
     if(typeof p.value!=='string')return{error:`entity ${ref} parameter glyph must be text`};
     changes.push({change:'parameter_set',entity_ref:ref,parameter:key,value:p.value});
    }
   }
  }
  for(const key of Object.keys(beforeParameters))if(!(key in parameters))return{error:`entity ${ref} parameter ${key} was removed, and parameter removal is not expressible as a kernel edit in this cut`};
  if(!sameJson(before.subject??null,(entity as KernelEntity).subject??null))return{error:`entity ${ref} subject edits are not expressible as a kernel edit in this cut`};
 }
 for(const [sceneRef,scene] of editedScenes){
  const before=currentScenes.get(sceneRef);
  const refs=[...((scene as any).entity_refs??[])];
  for(const entityRef of refs)if(!editedEntities.has(entityRef))return{error:`scene ${sceneRef} carries entity ${entityRef}, which the edited document does not define`};
  if(!before||!sameJson((before as any).entity_refs??[],refs))changes.push({change:'scene_compose',scene_ref:sceneRef,entity_refs:refs});
 }
 const selection=(edited as any).selection;
 if(selection&&typeof selection.scene_ref==='string'&&(!current || !sameJson((current as any).selection,selection)))changes.push({change:'focus',scene_ref:selection.scene_ref,entity_ref:selection.entity_ref??null});
 return{changes};
}

/** Save the app's edited kernel document: the difference goes back through
 * the kernel's own edit op at the document's expected revision. A revision
 * conflict (or any edit this cut cannot express) comes back as
 * {ok:false,error} — a conflict is never force-written. */
export async function saveKernelExpression(doc:unknown):Promise<{ok:boolean;error?:string;revision?:number}>{
 if(!isDocument(doc))return{ok:false,error:'saveKernelExpression needs an oi.expression/v1 document'};
 let current:unknown;
 try{current=await readKernelExpression(doc.expression_ref);}
 catch(cause){return{ok:false,error:`the kernel document could not be read before saving: ${cause instanceof Error?cause.message:String(cause)}`};}
 const diff=documentToChanges(current,doc);
 if('error' in diff)return{ok:false,error:diff.error};
 const data=await call<{state?:string;document?:{revision?:number};current_revision?:number}>("kernel-expression",{request:{operation:"edit",expression_ref:doc.expression_ref,expected_revision:doc.revision,actor:"expressions-app",changes:diff.changes}});
 if(data&&data.state==='revision_conflict')return{ok:false,error:`revision conflict: the kernel holds revision ${data.current_revision}, the edited document expected ${doc.revision}`};
 if(!data||data.state!=='ready')return{ok:false,error:`the kernel did not accept the edit (state ${String(data?.state)})`};
 return{ok:true,revision:data.document?.revision};
}

/** Open one kernel-held document into the app's own engine path: a working
 * journey view (validated by the app's own law) plus the conversion notes
 * naming everything that did not map. The view is never written back as a
 * second store — saves go through saveKernelExpression. */
export function openKernelExpressionIntoView(doc:unknown):{journey:ReturnType<typeof validateJourney>;notes:string[];startSceneId:string|null}{
 const conversion=kernelDocumentToJourney(doc);
 return {journey:validateJourney(conversion.journey),notes:conversion.notes,startSceneId:conversion.startSceneId};
}

/** The actual composition path submits its captured CAS operation, not the
 * legacy scalar-only diff. These are bounded channel calls, not a kernel API. */
export async function nativeExpressionRequest(request:Record<string,unknown>):Promise<unknown>{
 return call('kernel-expression',{request});
}
export async function nativeFileRequest(request:Record<string,unknown>):Promise<unknown>{
 return call('expression-file',{request});
}

/** Source-bound reading of this hosted field. Scope remains with the host's
 * selected native subject; callers cannot smuggle another repository path. */
export const readTechneReading = (): Promise<unknown> => call("techne-reading", {});

export const techneWorldRequest = (request: {operation:'list'}|{operation:'open';register:string}): Promise<unknown> => call('techne-world', {request}, 120000);
