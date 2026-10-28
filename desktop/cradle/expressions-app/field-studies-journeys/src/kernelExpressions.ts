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
import {kernelDocumentToJourney,KernelExpressionDocument,KernelEntity,KernelParameter,KernelSubject} from './kernelDocumentBridge.js';
import {validatePlaceDraft,type PlaceDraft} from '../../../src/techne/m0m5/place/authoring';

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

/** Lane-1 A10: an https link leaves the frame only as a host request; the host's opener is the only thing that opens it.
 * Returns false when the frame is not hosted or the link is not a bounded https URL (nothing is sent). */
export function openExternalLink(url:string):boolean{
  if(typeof url!=='string'||url.length>2048||window.parent===window)return false;
  let parsed:URL;
  try{parsed=new URL(url);}catch{return false;}
  if(parsed.protocol!=='https:'||parsed.username!==''||parsed.password!=='')return false;
  post({kind:'host-request',request:'open-external',url:parsed.href});
  return true;
}

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

/** Read an exact owner proposal; binding remains a separate human action. */
export function readSceneBlueprint(input:{expression_ref:string;revision:number;scene_ref:string}):Promise<typeof input&{binding:import('./blueprintGeometry.js').SceneBlueprint}>{
 return call('scene-blueprint',{request:input});
}

/** Hosted drafts use the native private recovery owner. Wait for the same
 * frame-bound handshake as expression operations; never silently fall back
 * to an ephemeral browser copy after a native failure. */
export async function nativeRecoveryRequest(request:import('../../../src/expressions/recoveryTypes').ExpressionRecoveryRequest):Promise<import('../../../src/expressions/recoveryTypes').ExpressionRecoveryResult>{
 if(!ready)await new Promise<void>((resolve,reject)=>{
  const done=(event:MessageEvent)=>{
   if(event.source!==window.parent||event.data?.v!==VERSION||event.data?.kind!=='oi-kernel-channel')return;
   clearTimeout(timer);window.removeEventListener('message',done);resolve();
  };
  const timer=window.setTimeout(()=>{window.removeEventListener('message',done);reject(new Error('The native recovery owner did not become available'));},20000);
  window.addEventListener('message',done);post({kind:'oi-kernel-hello'});
 });
 return call('expression-recovery',{request});
}

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

/** The kernel's mode catalogue (`ql music modes --json`, ql.music-modes/v1), verbatim: the host relays the kernel's `music_modes_read` owner read.
 * The symbols' voices read their modes from it (native-field/modeStore.ts). Waits for the host's announce (up to ten seconds) before asking. */
export async function readMusicModes():Promise<unknown>{
 const deadline=Date.now()+10000;
 while(!ready&&typeof window!=='undefined'&&window.parent!==window&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
 return call<unknown>('music-modes',{});
}

/** Personal readings stay on this session channel, outside Journey data. */
export function naraInstrumentRequest(request:import('../../../src/nara/instrumentProtocol').NaraInstrumentRequest):Promise<import('../../../src/nara/instrumentProtocol').NaraInstrumentReply>{
 return call('nara-instrument',{request},90000);
}

export interface KernelExpressionListing {expression_ref:string;title:string;revision:number;dirty?:boolean;last_touched_unix?:number;open?:boolean}

/** The kernel's own expression listing (oi.expression-list/v1) — most
 * recently touched first, exactly as the kernel discloses it — held to the
 * works the kernel holds OPEN. Since N1 the list also names closed works from
 * the works home (`open: false`, with their file location); every reader here
 * inspects or reads a work by ref, which a closed work cannot answer. The
 * shell's browser lists the closed ones and opens them from their files. */
export async function listKernelExpressions():Promise<KernelExpressionListing[]>{
 const data=await call<{expressions?:KernelExpressionListing[]}>("kernel-expression",{request:{operation:"list"}});
 return data&&Array.isArray(data.expressions)?data.expressions.filter(entry=>entry.open!==false):[];
}

/** Read one kernel-held oi.expression/v1 document. */
export async function readKernelExpression(ref:string):Promise<unknown>{
 if(typeof ref!=='string'||!ref)throw new Error('readKernelExpression needs an expression ref');
 const data=await call<{state?:string;document?:unknown}>("kernel-expression",{request:{operation:"inspect",expression_ref:ref}});
 if(!data||typeof data!=='object'||!data.document)throw new Error(`the kernel returned no document for ${ref}`);
 return data.document;
}

/** The kernel's Change grammar (oi.expression/v1), wire form: every kind the
 * documentToChanges diff below can emit (kernel expression.rs `Change`). */
export type KernelChange =
 |{change:"rename";title:string}
 |{change:"scene_create";scene_ref:string;title:string}
 |{change:"scene_rename";scene_ref:string;title:string}
 |{change:"scene_remove";scene_ref:string}
 |{change:"scene_reorder";scene_refs:string[]}
 |{change:"scene_compose";scene_ref:string;entity_refs:string[]}
 |{change:"scene_material_set";scene_ref:string;presentation:{schema:'oi.journey-scene/v1';scene:unknown;saved?:unknown}}
 |{change:"scene_material_clear";scene_ref:string}
 |{change:"scene_performance_set";scene_ref:string;performance:unknown}
 |{change:"scene_performance_clear";scene_ref:string}
 |{change:"scene_body_set";scene_ref:string;body:unknown}
 |{change:"scene_body_clear";scene_ref:string}
 |{change:"scene_trigger_attach";scene_ref:string;trigger:unknown}
 |{change:"scene_trigger_detach";trigger_ref:string}
 |{change:"entity_add";scene_ref:string;entity_ref:string;title:string}
 |{change:"entity_remove";entity_ref:string}
 |{change:"entity_pin";entity_ref:string;pinned:boolean}
 /** O-I #761: a Scene marked private (a Palace's private room) or open again — the Scene's own flag, as a pin is the entity's. */
 |{change:"scene_private";scene_ref:string;private:boolean}
 |{change:"subject_bind";entity_ref:string;binding:KernelSubject}
 |{change:"subject_unbind";entity_ref:string}
 |{change:"parameter_set";entity_ref:string;parameter:string;value:string|number}
 |{change:"parameter_automate";entity_ref:string;parameter:string;automation:NonNullable<KernelParameter['automation']>}
 |{change:"parameter_manual";entity_ref:string;parameter:string}
 |{change:"relation_bind";binding:unknown}
 |{change:"relation_remove";binding_ref:string}
 |{change:"relation_focus";scene_ref:string;binding_ref:string}
 |{change:"representation_bind";binding:unknown}
 |{change:"profile_adopt";adoption:unknown}
 |{change:"profile_release";profile_ref:string}
 |{change:"collections_set";collections:string[]}
 |{change:"reuse_set";reuse:unknown}
 |{change:"reuse_clear"}
 |{change:"composition_set";presentation:unknown}
 |{change:"focus";scene_ref:string;entity_ref:string|null};

/** The kernel's own entity parameter vocabulary (`expression.rs` `parameter`/
 * `bounds`): every text/material carrier and every bounded numeric key.
 * Rich authored material (layers, sources, sequences, forces, tint, sound…)
 * travels whole through the Scene presentation (`scene_material_set`), not
 * through scalar parameters. Anything else is refused rather than mangled. */
const TEXTUAL=new Set(['glyph','shape','kind','yantra','force_mode','ascii','image']);
const NUMERIC=new Set(['x','y','z','scale','share','width','height','rotation','frequency','force_strength','force_spin','force_radius']);
const EDITABLE=new Set([...TEXTUAL,...NUMERIC]);

const isDocument=(doc:unknown):doc is KernelExpressionDocument=>
 !!doc&&typeof doc==='object'&&(doc as KernelExpressionDocument).schema==='oi.expression/v1'
  &&typeof (doc as KernelExpressionDocument).expression_ref==='string'
  &&typeof (doc as KernelExpressionDocument).revision==='number'
  &&Array.isArray((doc as KernelExpressionDocument).scenes);

const sameJson=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** The one list of refusals, shared by the document diff and the live
 * composition path. Each names a difference the kernel's Change grammar cannot
 * carry (no change removes a parameter, a representation, or sets an entity
 * title), or one the owner rules forbid an Expression edit to carry
 * (source_relation: only O:I connections are edited here; owner_metadata:
 * provenance and refinements have their own owner operations). Every other
 * difference is emitted as kernel changes; none is dropped. */
export const UNEXPRESSIBLE={
 parameter_removal:'no kernel change removes a parameter from an entity',
 parameter_outside_editable:'the parameter is outside the kernel\'s own parameter vocabulary (EDITABLE)',
 non_finite_number:'a bounded numeric parameter must be a finite number',
 text_value:'a textual parameter must be text',
 new_entity_unplaced:'a new entity must be carried by a scene, because entity_add names the scene it joins',
 undefined_scene_entity:'a scene may carry only entities the document defines',
 unsupported_scene_material:'Scene material must be oi.journey-scene/v1 with a scene object',
 unsupported_properties:'the Expression properties must be oi.journey-properties/v1',
 composition_removal:'no kernel change clears the Expression properties; the kernel can only set them',
 entity_rename:'the kernel sets an entity title only when the entity is added; no change renames an entity',
 representation_removal:'no kernel change removes a representation binding; representation_bind only adds or replaces',
 owner_metadata:'document provenance and refinements change only through their own owner operations (propose, review), not an edit',
 source_relation:'a source-owned relation changes only through its source owner; an Expression edit carries only O:I connections',
} as const;
const refuse=(reason:keyof typeof UNEXPRESSIBLE,subject:string):{error:string;refused:keyof typeof UNEXPRESSIBLE}=>({error:`${subject} is not expressible as a kernel edit in this cut: ${UNEXPRESSIBLE[reason]}`,refused:reason});

/** One parameter's kernel changes: the value as parameter_set, the automation
 * as parameter_automate or parameter_manual. The kernel refuses parameter_set
 * on an automated parameter, so a value change under automation takes manual
 * control, sets the value, and automates again with the same course. */
function parameterChanges(ref:string,key:string,was:KernelParameter|undefined,p:KernelParameter):{changes:KernelChange[]}|{error:string}{
 const wasAutomation=was?.automation??null,nowAutomation=p.automation??null;
 const valueChanged=!was||!sameJson(was.value,p.value);
 const automationChanged=!sameJson(wasAutomation,nowAutomation);
 if(!valueChanged&&!automationChanged)return{changes:[]};
 if(!EDITABLE.has(key))return refuse('parameter_outside_editable',`entity ${ref} parameter ${key}`);
 if(valueChanged){
  if(NUMERIC.has(key)){if(typeof p.value!=='number'||!Number.isFinite(p.value))return refuse('non_finite_number',`entity ${ref} parameter ${key}`);}
  else if(typeof p.value!=='string')return refuse('text_value',`entity ${ref} parameter ${key}`);
 }
 const manual=wasAutomation!==null&&(valueChanged||nowAutomation===null);
 const changes:KernelChange[]=[];
 if(manual)changes.push({change:'parameter_manual',entity_ref:ref,parameter:key});
 if(valueChanged)changes.push({change:'parameter_set',entity_ref:ref,parameter:key,value:p.value});
 if(nowAutomation!==null&&(automationChanged||manual))changes.push({change:'parameter_automate',entity_ref:ref,parameter:key,automation:nowAutomation});
 return{changes};
}

/** Kernel document rows, read without trusting their shape. */
const at=(value:unknown,key:string):unknown=>value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined;
const ownerOf=(row:unknown):string=>String(at(row,'native_owner')??'');
const rowsOf=(rows:unknown):unknown[]=>Array.isArray(rows)?rows:[];
function keyed(rows:unknown,keyOf:(row:unknown)=>string):Map<string,unknown>{const out=new Map<string,unknown>();for(const row of rowsOf(rows))out.set(keyOf(row),row);return out;}
/** Every trigger of a Scene list, keyed by trigger_ref, with the Scene that carries it. */
function triggersOf(scenes:unknown):Map<string,{scene_ref:string;trigger:unknown}>{
 const out=new Map<string,{scene_ref:string;trigger:unknown}>();
 for(const scene of rowsOf(scenes))for(const trigger of rowsOf(at(scene,'triggers')))out.set(String(at(trigger,'trigger_ref')),{scene_ref:String(at(scene,'scene_ref')),trigger});
 return out;
}

/** Diff the app's edited document against the kernel's current document and
 * express the difference in the kernel's own Change grammar, applied in the
 * order emitted within one atomic edit. Differences this cut cannot express
 * are returned as a named refusal (see UNEXPRESSIBLE) — never force-written,
 * never dropped. The live composition path (kernelComposition.ts) builds its
 * edit from the same grammar; the shared kinds of both paths are pinned by
 * tests/commit-grammar-parity.test.mjs. */
export function documentToChanges(current:unknown,edited:unknown):{changes:KernelChange[]}|{error:string;refused?:keyof typeof UNEXPRESSIBLE}{
 if(!isDocument(edited))return{error:'the document is not an oi.expression/v1 expression'};
 if(!isDocument(current))return{error:'the kernel holds no readable document to diff against'};
 if(edited.expression_ref!==current.expression_ref)return{error:'the edited document addresses a different Expression than the kernel holds'};
 const was=current as unknown as Record<string,unknown>,now=edited as unknown as Record<string,unknown>;
 // Refusals come before any change: nothing partial is returned.
 if(!sameJson(was.provenance??[],now.provenance??[])||!sameJson(was.refinements??[],now.refinements??[]))return refuse('owner_metadata','the document provenance and refinements');
 const changes:KernelChange[]=[];
 if(edited.title!==current.title)changes.push({change:'rename',title:edited.title});
 // A trigger that is gone, moved or changed detaches first, so a removed Scene
 // never leaves a dangling trigger behind (the kernel validates triggers whole).
 const currentTriggers=triggersOf(current.scenes),editedTriggers=triggersOf(edited.scenes);
 for(const [ref,old] of currentTriggers){const next=editedTriggers.get(ref);if(!next||next.scene_ref!==old.scene_ref||!sameJson(next.trigger,old.trigger))changes.push({change:'scene_trigger_detach',trigger_ref:ref});}
 const currentScenes=new Map((current.scenes as any[]).map(s=>[s.scene_ref,s]));
 const editedScenes=new Map((edited.scenes as any[]).map(s=>[s.scene_ref,s]));
 // create before remove: the kernel keeps at least one Scene (expression.rs "An Expression retains at least one Scene"),
 // so replacing the only Scene must create first (as kernelComposition.ts does).
 for(const [ref,scene] of editedScenes)if(!currentScenes.has(ref))changes.push({change:'scene_create',scene_ref:ref,title:String(scene.title||ref)});
 for(const ref of currentScenes.keys())if(!editedScenes.has(ref))changes.push({change:'scene_remove',scene_ref:ref});
 for(const [ref,scene] of editedScenes){
  const before=currentScenes.get(ref);
  if(before&&before.title!==scene.title)changes.push({change:'scene_rename',scene_ref:ref,title:String(scene.title??'')});
  // O-I #761: a Scene's privacy rides as its own change (a created Scene starts open, so only a private one says so).
  if(Boolean(before?.private)!==Boolean(scene.private))changes.push({change:'scene_private',scene_ref:ref,private:Boolean(scene.private)});
 }
 // The kernel appends created scenes, so after the removals and creations it
 // holds the surviving refs in their current order, then the created refs.
 const afterCreate=[...current.scenes.map(s=>s.scene_ref).filter(ref=>editedScenes.has(ref)),...[...editedScenes.keys()].filter(ref=>!currentScenes.has(ref))];
 const editedOrder=[...editedScenes.keys()];
 if(!sameJson(afterCreate,editedOrder))changes.push({change:'scene_reorder',scene_refs:editedOrder});
 // A relation that is gone leaves before its entities do: the kernel drops a
 // relation touching a removed entity without a report, so it must be removed first.
 const currentRelations=new Map(Object.entries((was.relations??{}) as Record<string,unknown>));
 const editedRelations=new Map(Object.entries((now.relations??{}) as Record<string,unknown>));
 for(const [ref,old] of currentRelations){
  if(editedRelations.has(ref)&&sameJson(editedRelations.get(ref),old))continue;
  if(ownerOf(old)!=='oi')return refuse('source_relation',`relation ${ref}`);
  if(!editedRelations.has(ref))changes.push({change:'relation_remove',binding_ref:ref});
 }
 const currentEntities=new Map(Object.entries(current.entities??{}));
 const editedEntities=new Map(Object.entries(edited.entities??{}));
 const homeOf=new Map<string,string>();
 for(const [sceneRef,scene] of editedScenes)for(const entityRef of (scene as any).entity_refs??[])if(!homeOf.has(entityRef))homeOf.set(entityRef,sceneRef);
 for(const ref of currentEntities.keys())if(!editedEntities.has(ref))changes.push({change:'entity_remove',entity_ref:ref});
 for(const [ref,entity] of editedEntities){
  const before=currentEntities.get(ref) as KernelEntity|undefined;
  const now=entity as KernelEntity;
  if(!before){
   const sceneRef=homeOf.get(ref);
   if(!sceneRef)return refuse('new_entity_unplaced',`entity ${ref}`);
   // entity_add seeds a bare glyph-"O" formation; every parameter the edited
   // document carries rides as its own change immediately after.
   changes.push({change:'entity_add',scene_ref:sceneRef,entity_ref:ref,title:String(now.title||ref)});
   for(const [key,p] of Object.entries(now.parameters??{}) as [string,KernelParameter][]){
    const part=parameterChanges(ref,key,undefined,p);
    if('error' in part)return part;
    changes.push(...part.changes);
   }
  }else{
   // The kernel sets an entity title only at entity_add; a renamed entity is refused, never dropped.
   if(before.title!==now.title)return refuse('entity_rename',`entity ${ref}`);
   const parameters=now.parameters??{};
   const beforeParameters=before.parameters??{};
   for(const [key,p] of Object.entries(parameters) as [string,KernelParameter][]){
    const part=parameterChanges(ref,key,beforeParameters[key],p);
    if('error' in part)return part;
    changes.push(...part.changes);
   }
   for(const key of Object.keys(beforeParameters))if(!(key in parameters))return refuse('parameter_removal',`entity ${ref} parameter ${key}`);
  }
  // Subject: bind the edited binding, or unbind when it was cleared.
  const beforeSubject=before?.subject??null,nowSubject=now.subject??null;
  if(!sameJson(beforeSubject,nowSubject))changes.push(nowSubject===null?{change:'subject_unbind',entity_ref:ref}:{change:'subject_bind',entity_ref:ref,binding:nowSubject});
  // A world-position pin is a flag on the occurrence (kernel EntityPin).
  if(Boolean(before?.pinned)!==Boolean(now.pinned))changes.push({change:'entity_pin',entity_ref:ref,pinned:Boolean(now.pinned)});
 }
 for(const [sceneRef,scene] of editedScenes){
  const before=currentScenes.get(sceneRef);
  const refs=[...((scene as any).entity_refs??[])];
  for(const entityRef of refs)if(!editedEntities.has(entityRef))return refuse('undefined_scene_entity',`scene ${sceneRef} carries entity ${entityRef}`);
  if(!before||!sameJson((before as any).entity_refs??[],refs))changes.push({change:'scene_compose',scene_ref:sceneRef,entity_refs:refs});
 }
 // Scene-level kernel carriers, whole: a body and a performance are set, or cleared when removed.
 for(const [sceneRef,scene] of editedScenes){
  const before=currentScenes.get(sceneRef);
  const body=at(scene,'body')??null,wasBody=at(before,'body')??null;
  if(!sameJson(wasBody,body))changes.push(body===null?{change:'scene_body_clear',scene_ref:sceneRef}:{change:'scene_body_set',scene_ref:sceneRef,body});
  const performance=at(scene,'performance')??null,wasPerformance=at(before,'performance')??null;
  if(!sameJson(wasPerformance,performance))changes.push(performance===null?{change:'scene_performance_clear',scene_ref:sceneRef}:{change:'scene_performance_set',scene_ref:sceneRef,performance});
 }
 // Connections and relation bindings: a changed or new binding is bound whole; the kernel has no relation-owner rule of its own, so the source-owner rule is kept here.
 for(const [ref,next] of editedRelations){
  const old=currentRelations.get(ref);
  if(old!==undefined&&sameJson(old,next))continue;
  if(ownerOf(next)!=='oi')return refuse('source_relation',`relation ${ref}`);
  changes.push({change:'relation_bind',binding:next});
 }
 // Representation bindings add or replace; the kernel has no removal.
 const repRef=(row:unknown)=>String(at(at(row,'representation'),'ref')??'');
 const currentReps=keyed(was.representations,repRef),editedReps=keyed(now.representations,repRef);
 for(const ref of currentReps.keys())if(!editedReps.has(ref))return refuse('representation_removal',`representation ${ref}`);
 for(const [ref,rep] of editedReps)if(!sameJson(currentReps.get(ref),rep))changes.push({change:'representation_bind',binding:rep});
 // Scene triggers: a new or changed trigger attaches after its Scene and entities exist.
 for(const [ref,next] of editedTriggers){const old=currentTriggers.get(ref);if(!old||old.scene_ref!==next.scene_ref||!sameJson(old.trigger,next.trigger))changes.push({change:'scene_trigger_attach',scene_ref:next.scene_ref,trigger:next.trigger});}
 // Profile adoptions: released when gone, adopted when new or changed.
 const profileKey=(row:unknown)=>String(at(row,'profile_ref')??'');
 const currentProfiles=keyed(was.profiles,profileKey),editedProfiles=keyed(now.profiles,profileKey);
 for(const ref of currentProfiles.keys())if(!editedProfiles.has(ref))changes.push({change:'profile_release',profile_ref:ref});
 for(const [ref,profile] of editedProfiles)if(!sameJson(currentProfiles.get(ref),profile))changes.push({change:'profile_adopt',adoption:profile});
 const collectionsWas=rowsOf(was.collections) as string[],collectionsNow=rowsOf(now.collections) as string[];
 if(!sameJson(collectionsWas,collectionsNow))changes.push({change:'collections_set',collections:[...collectionsNow]});
 // Reusable material: set whole, or cleared when removed.
 const reuseWas=was.reuse??null,reuseNow=now.reuse??null;
 if(!sameJson(reuseWas,reuseNow))changes.push(reuseNow===null?{change:'reuse_clear'}:{change:'reuse_set',reuse:reuseNow});
 // Rich Scene material: a changed presentation returns whole through the
 // native composition path, after membership so its occurrences resolve; a
 // removed presentation is the kernel's scene_material_clear.
 for(const [sceneRef,scene] of editedScenes){
  const presentation=(scene as any).presentation;
  const before=currentScenes.get(sceneRef);
  if(presentation===undefined||presentation===null){
   if(before&&before.presentation)changes.push({change:'scene_material_clear',scene_ref:sceneRef});
   continue;
  }
  if(presentation.schema!=='oi.journey-scene/v1'||!presentation.scene||typeof presentation.scene!=='object')return refuse('unsupported_scene_material',`scene ${sceneRef}`);
  if(!before||!sameJson(before.presentation??null,presentation))changes.push({change:'scene_material_set',scene_ref:sceneRef,presentation:{schema:'oi.journey-scene/v1',scene:presentation.scene,saved:presentation.saved??null}});
 }
 const properties=(edited as any).presentation;
 const currentProperties=(current as any).presentation??null;
 if(properties===undefined||properties===null){
  if(currentProperties!==null)return refuse('composition_removal','the Expression properties');
 }else if(!sameJson(currentProperties,properties)){
  if(properties.schema!=='oi.journey-properties/v1')return refuse('unsupported_properties','the Expression properties');
  changes.push({change:'composition_set',presentation:properties});
 }
 // A selected relation occurrence is relation_focus; an entity or scene selection is focus.
 const selection=(edited as any).selection;
 if(selection&&typeof selection.scene_ref==='string'&&!sameJson((current as any).selection??null,selection))changes.push(typeof selection.relation_ref==='string'&&selection.relation_ref
  ?{change:'relation_focus',scene_ref:selection.scene_ref,binding_ref:selection.relation_ref}
  :{change:'focus',scene_ref:selection.scene_ref,entity_ref:selection.entity_ref??null});
 return{changes};
}

/** The compensating kernel edit that restores `before` from `after`: the same
 * diff read backwards. Reading it from the two documents, not from the change
 * list alone, keeps every ordering law and named refusal of the forward grammar
 * (a removed Scene restored with its members, a relation restored after its
 * entities, a parameter that no change can remove) and needs no second
 * implementation of the kernel's apply. */
export type KernelCompensation={changes:KernelChange[]}|{refused:string;reason:string};
export function invertEdit(before:unknown,after:unknown):KernelCompensation{
 const diff=documentToChanges(after,before);
 if('changes' in diff)return{changes:diff.changes};
 return{refused:diff.refused??'not_diffable',reason:diff.error};
}

/** Save the app's edited kernel document: the difference goes back through
 * the kernel's own edit op at the document's expected revision. A revision
 * conflict (or any edit this cut cannot express) comes back as
 * {ok:false,error} — a conflict is never force-written.
 * With `explicit`, the caller supplies the change list (a compensating edit
 * from the undo stack) and the basis it holds: one edit, one expected
 * revision, no diff against the kernel's current document. */
/** The kernel's one-edit operation guard: an edit carries at most this many
 * changes (kernelComposition.ts prepareCompositionEdit, "one edit still carries
 * at most 256 changes"). A larger list is refused whole, never split. */
export const KERNEL_EDIT_BUDGET=256;
/** Gesture ids already submitted as one kernel edit in this page. A gesture's
 * changes reach the kernel once; a refused or conflicted gesture is re-made. */
const submittedGestures=new Set<string>();
export async function saveKernelExpression(doc:unknown,explicit?:{changes:KernelChange[];expectedRevision?:number;gesture?:string}):Promise<{ok:boolean;error?:string;revision?:number}>{
 if(!isDocument(doc))return{ok:false,error:'saveKernelExpression needs an oi.expression/v1 document'};
 let changes:KernelChange[],expectedRevision:number=doc.revision;
 if(explicit){
  if(!Array.isArray(explicit.changes)||explicit.changes.length===0)return{ok:false,error:'the explicit kernel edit carries no changes'};
  changes=explicit.changes;expectedRevision=explicit.expectedRevision??doc.revision;
 }else{
  let current:unknown;
  try{current=await readKernelExpression(doc.expression_ref);}
  catch(cause){return{ok:false,error:`the kernel document could not be read before saving: ${cause instanceof Error?cause.message:String(cause)}`};}
  const diff=documentToChanges(current,doc);
  if('error' in diff)return{ok:false,error:diff.error};
  changes=diff.changes;
 }
 if(changes.length>KERNEL_EDIT_BUDGET)return{ok:false,error:`this edit carries ${changes.length} kernel changes, over the one-edit budget of ${KERNEL_EDIT_BUDGET}; it is refused whole and never split into several edits`};
 const gesture=explicit?.gesture;
 if(gesture!==undefined){
  if(typeof gesture!=='string'||!gesture)return{ok:false,error:'the gesture id must be a nonempty string'};
  if(submittedGestures.has(gesture))return{ok:false,error:`gesture ${gesture} was already submitted as one kernel edit; a gesture's changes never split across edits, and a refused or conflicted gesture is re-made on its current basis`};
  submittedGestures.add(gesture);
 }
 const data=await call<{state?:string;document?:{revision?:number};current_revision?:number}>("kernel-expression",{request:{operation:"edit",expression_ref:doc.expression_ref,expected_revision:expectedRevision,actor:"expressions-app",changes}});
 if(data&&data.state==='revision_conflict')return{ok:false,error:`revision conflict: the kernel holds revision ${data.current_revision}, the edited document expected ${expectedRevision}`};
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

/** ES1A scene-body native carrier reads (O:I #352): a `SceneBody.subject_ref`
 * is an opaque native reference, resolved only through the owner's own
 * `file_resolve` seam — this app never parses it. Two typed reads over the
 * `central-subject-text`/`central-subject-bytes` host-channel kinds (the
 * cradle relay, `relayKernelChannel` in desktop/cradle/src/expressions/
 * hostedApp.ts): UTF-8 text for `text_source` bodies, base64 + mime hint for
 * `image_media` bodies (the same binary-safe seam FND-04 already defines). */
export interface NativeSubjectLocation {schema:'central.path-ref/v1';ref:string;root:string;path:string}
export interface NativeSubjectText {requested_ref:string;location:NativeSubjectLocation;native_owner:'central';ref:string;revision:string;byte_len:number;content:string}
export interface NativeSubjectBytes {requested_ref:string;location:NativeSubjectLocation;native_owner:'central';ref:string;revision:string;byte_len:number;mime_hint:string|null;content_base64:string}
export async function nativeSubjectTextRequest(ref:string):Promise<NativeSubjectText>{
 if(typeof ref!=='string'||!ref)throw new Error('nativeSubjectTextRequest needs a native subject ref');
 const data=await call<NativeSubjectText>('central-subject-text',{ref});
 if(!data||typeof data.content!=='string')throw new Error(`the native owner returned no readable text for ${ref}`);
 return data;
}
/** O-I #768: a `knowledge_whole` body's subject is a constellation of the wiki, named by its whole's wiki ref. The host reads it from the
 * wiki's own projection on the `knowledge-whole` channel (expressions-boundary protocol.ts KNOWLEDGE_WHOLE_CHANNEL, answered by the
 * shell's native/wikiSubjectStanding.ts); this app never reads the wiki itself. */
export type NativeKnowledgeWhole=import('../../../../../packages/expressions-boundary/src/protocol').KnowledgeWholeReading;
export async function nativeKnowledgeWholeRequest(ref:string):Promise<NativeKnowledgeWhole>{
 if(typeof ref!=='string'||!ref)throw new Error('nativeKnowledgeWholeRequest needs a wiki ref');
 const data=await call<NativeKnowledgeWhole>('knowledge-whole',{request:{ref}});
 if(!data||typeof data!=='object'||typeof data.ref!=='string')throw new Error(`the wiki returned no reading of ${ref}`);
 return data;
}
export async function nativeSubjectBytesRequest(ref:string):Promise<NativeSubjectBytes>{
 if(typeof ref!=='string'||!ref)throw new Error('nativeSubjectBytesRequest needs a native subject ref');
 const data=await call<NativeSubjectBytes>('central-subject-bytes',{ref});
 if(!data||typeof data.content_base64!=='string')throw new Error(`the native owner returned no readable image bytes for ${ref}`);
 return data;
}

/** The active native Scene is the address. The host validates its revision
 * and source projection; no shell workspace or renderer file path supplies scope. */
export interface TechneSceneReadingRequest {expression_ref:string;revision:number;scene_ref:string;facet?:'relation-semantics'|'node-metadata'|'scene-relations';
 /** lane-5 T1b: 'expression' asks for the whole Expression's scenes (the journey); absent is the scene-scoped reading. */
 scope?:'expression'}
export const readTechneReading = (request:TechneSceneReadingRequest): Promise<unknown> => call("techne-reading", {request}, 45000);
/** Session presentation action; the host's existing DisclosureSession owns
 * its declared window. Nothing is saved into the Expression by this route. */
export const techneTimeWindowRequest = (request:import('../../../../../packages/expressions-boundary/src/timeWindow').NativeTimeWindowRequest):Promise<unknown> => call('techne-time-window',{request},30000);

export const techneWorldRequest = (request: {operation:'list'}|{operation:'open';register:string}): Promise<unknown> => call('techne-world', {request}, 120000);

/** Lane-4 T17b: a draft position the map offers the owner's editor when it opens. It is a draft, never a write: the editor still requires a source basis. */
export interface TechneConstellationRequest extends TechneSceneReadingRequest {entity_ref:string;operation:'inspect'|'open';placeDraft?:PlaceDraft}
export const techneConstellationRequest = (request:TechneConstellationRequest):Promise<{frame_ref:string;frame_revision:number;title:string;project?:string}> => {
 if(request.placeDraft!==undefined){
  if(request.operation!=='open')return Promise.reject(new Error('A place draft is offered only when the editor opens.'));
  const checked=validatePlaceDraft(request.placeDraft);
  if(!checked.ok)return Promise.reject(new Error(checked.reason));
 }
 return call('techne-constellation',{request},30000);
};
/** Deliberate typed relationship between two occurrences' exact constellation participations. */
export interface TechneConstellationRelation extends TechneSceneReadingRequest {operation:'relate';from_entity_ref:string;to_entity_ref:string;relation:string;direction:'directed'|'undirected'|'bidirectional'}
export interface TechneConstellationRelationReceipt {frame_ref:string;frame_revision:number;relation_ref:string;state:'saved'|'unchanged';expression:{state:'ready';expression_ref:string;revision:number}|{state:'pending';detail:string}}
export const techneConstellationRelate = (request:TechneConstellationRelation):Promise<TechneConstellationRelationReceipt> => call('techne-constellation',{request},60000);

/** The sanitized native Library reading (nativeLibrary.ts's model shape) —
 * Central Projects (via their bound overview Expression), Scenes and native
 * collections, read live through the host's EXISTING Library providers
 * (desktop/cradle/src/library/libraryReading.ts) via the "library-read"
 * host-channel kind. No source bodies; never copied into browser storage. */
export interface LibraryReadingEntry {
 ref:string;title:string;kind:string;owner:string;scope:'local'|'shared';
 revision?:string;project?:string;expressionRef?:string;
 scenes?:{scene_ref:string;title:string}[];collections?:string[];
 collectionMemberships?:{title:string;group:string;manifest_path:string}[];
}
export interface LibraryReadingCoverage {provider:string;state:string;reason?:string}
export const readLibraryEntries = (scope:'local'|'shared'='local'):Promise<{entries:LibraryReadingEntry[];coverage:LibraryReadingCoverage[]}> => call('library-read',{request:{scope}},20000);
