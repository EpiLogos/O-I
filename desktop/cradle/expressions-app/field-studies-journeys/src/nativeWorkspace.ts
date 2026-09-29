import type {SourceOccurrenceChoice} from './nativeOccurrence.js';
import type {BlueprintIntent} from './nativeBlueprint.js';
/** The native working document behind the hosted application: open, commit,
 * recover and file-save through the owner. It has no panel of its own; its
 * standing reaches the app's Save control and Studio footer via host.status. */
import {clone,type Journey} from './model.js';
import {NativeWorking,type NativeFile,type WorkingSnapshot} from './nativeWorking.js';
import {kernelExpressionsAvailable,listKernelExpressions,readKernelExpression,nativeExpressionRequest,nativeFileRequest} from './kernelExpressions.js';
import {readWorkingCheckpoint,readWorkingDraft,writeWorkingCheckpoint,writeDraft} from './recovery.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {nativeConnections} from './nativeCorrespondence.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import {prepareCompositionEdit} from './kernelComposition.js';
import {NativeOpenIntent} from './nativeOpenIntent.js';
import {NativeSelectionQueue} from './nativeSelectionQueue.js';
import {refreshStep,hasLocalEdits,performedByLiveAct,retainedDraftId} from './nativeFollow.js';
import {worldAvailable,worldRequest} from './worldChannel.js';

/** The exact native work a summon carries to the cradle's verso account —
 * refs only, the pointer to the Expression / Scene / entity-or-relation
 * occurrence currently open. The cradle validates it through the owner. */
export interface NativeSubject {
 ref:string;kind:'expression';nativeOwner:'oi';revision:number;title:string;
 project?:string;sceneRef:string|null;entityRef:string|null;relationRef:string|null;
}
/** The current native construction's real facets, derived from the open kernel
 * Expression — what each M′ instrument stands on, so a lens's availability and
 * content are DISCLOSED by the actual construction, never hardcoded. Null when
 * no native construction is open. */
export interface ConstructionFacets {
 ref:string;revision:number;title:string;
 members:number;relations:number;
 scenes:{scene_ref:string;title:string;members:number;relations:number}[];
 currentScene:string|null;
}
export interface NativeWorkspaceHost {
 shouldRetainDraft?:()=>boolean;
 snapshot:()=>WorkingSnapshot;
 version:()=>number;
 load:(view:KernelConversion,preservePosition?:boolean)=>void;
 toast:(message:string,duration?:number)=>void;
 summon:(kind:'library'|'verso'|'search',subject?:NativeSubject)=>void;
 correspondence:(rows:Record<string,ConnectionBinding[]>,selection:string|null)=>void;
 /** The working document's truthful standing, shown by the app's own Save
  * control and Studio footer — there is no separate native panel. */
 status?:(state:NativeStatus)=>void;
 /** A followed Expression was adopted; `readThrough` when an act performs it. */
 followed?:(reference:string,readThrough:boolean)=>void;
}
export interface NativeStatus {
 text:string;failed:boolean;busy:boolean;
 identity:{ref:string;title:string;revision:number}|null;
 pending:string|null;retryOpen:boolean;
 file:{path:string;revision:string|number}|null;
 page:{page:number;count:number;shown:number;total:number;hidden:number}|null;
}
/** Capture the visible draft and navigation generation before any owner read.
 * A native reply may be retained, but only this still-current draft may adopt it. */
export function captureNativeAdoption(host:Pick<NativeWorkspaceHost,'snapshot'|'version'>,generation:()=>number):()=>boolean {
 const version=host.version(),draftId=host.snapshot().journey.id,selected=generation();
 return ()=>host.version()===version&&host.snapshot().journey.id===draftId&&generation()===selected;
}
/** `changed()` runs once at boot (to associate whatever document is already
 * showing with its own native working checkpoint) and again on every genuine
 * local journey switch thereafter. Only the switches after boot may
 * invalidate an in-flight native open: at boot nothing has opened yet, so
 * there is nothing for that call to legitimately invalidate, and a native
 * open captured concurrently (e.g. a click landing mid-boot) must not be
 * refused by boot's own bookkeeping — an untouched boot canvas is not
 * authored work (see `awaitingNativeBoot`/`shouldRetainDraft` in app.ts).
 * Exported standalone so this sequencing is covered by a plain unit test. */
export function isGenuineWorkspaceSwitch(state:{booted:boolean}):boolean{
 const first=!state.booted;state.booted=true;return !first;
}
export function installNativeWorkspace(host:NativeWorkspaceHost){
 const scope=new URLSearchParams(location.search).get('mode')==='techne'?'techne':'expressions';
 const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,
  checkpoint:(id,value)=>writeWorkingCheckpoint(id,value,scope),mint:()=>`expression:authored-${crypto.randomUUID()}`});
 let busy=false,notice='',lastFailure=false,restoreGeneration=0;const bootState={booted:false};
 let ownerIdle:Promise<void>=Promise.resolve();
 let queuedMutations=0;
 const status=(text:string)=>{notice=text;update();};
 const update=()=>{
  const state=work.state,doc=state?.view?.document;
  host.correspondence(nativeConnections(state?.view),doc?.selection?.relation_ref??null);
  const binding=state?.view?.bindings[host.snapshot().sceneId];
  host.status?.({text:notice,failed:lastFailure,busy,
   identity:doc?{ref:doc.expression_ref,title:doc.title,revision:doc.revision}:null,
   pending:state?.pending?.kind??null,retryOpen:!!opens?.reference,
   file:state?.file?{path:state.file.location.path,revision:state.file.revision}:null,
   page:binding?{page:binding.page,count:binding.page_count,shown:binding.occurrences.length,total:binding.member_refs.length,hidden:binding.hidden_refs.length}:null});
 };
 const run=async(task:()=>Promise<void>):Promise<boolean>=>{
  if(busy)return false;busy=true;
  let releaseOwner!:()=>void;ownerIdle=new Promise<void>(resolve=>{releaseOwner=resolve;});
  lastFailure=false;update();status('Reading or saving through the native owner…');
  try{await task();return true;}catch(error){lastFailure=true;status(error instanceof Error?error.message:String(error));host.toast(notice,7000);return false;}
  finally{busy=false;releaseOwner();update();selections.resume();}
 };
 const mutate=async(task:()=>Promise<void>):Promise<boolean>=>{
  const generation=restoreGeneration,draftId=host.snapshot().journey.id;
  const nativeRef=work.state?.view?.document.expression_ref;
  queuedMutations++;
  try{
   while(busy)await ownerIdle;
   return await run(async()=>{
    if(generation!==restoreGeneration||draftId!==host.snapshot().journey.id||nativeRef!==work.state?.view?.document.expression_ref)throw new Error('The native work changed before its queued edit. Return to that draft and try again.');
    await task();
   });
  }finally{queuedMutations--;selections.resume();}
 };
 type FocusIntent={generation:number;nativeRef:string;sceneId:string;entityId:string|null;bindingRef?:string};
 const selections=new NativeSelectionQueue<FocusIntent>({
  available:()=>!busy&&!work.busy&&queuedMutations===0,
  current:intent=>intent.generation===restoreGeneration&&work.state?.view?.document.expression_ref===intent.nativeRef,
  apply:intent=>run(async()=>{
   const view=work.state?.view,binding=view?.bindings[intent.sceneId];
   if(!view||!binding)throw new Error('This field does not have a native occurrence basis');
   const occurrence=binding.occurrences.find(o=>o.view_entity_id===intent.entityId);
   if(intent.entityId&&!occurrence)throw new Error('The selected representation is not a bound native occurrence');
   await work.select({scene_ref:binding.scene_ref,entity_ref:occurrence?.entity_ref??null,binding_ref:intent.bindingRef});
   if(intent.generation!==restoreGeneration)return;
   const relation=binding.relations.find(r=>r.binding_ref===intent.bindingRef);
   status(relation?`Relation ${relation.relation.ref} · ${relation.relation.revision} · ${relation.from_entity_ref} → ${relation.to_entity_ref}`
    :occurrence?`Selected ${occurrence.subject?.subject_ref??occurrence.entity_ref} · occurrence ${occurrence.entity_ref}`:'Native selection cleared.');
  }),
 });
 const retainSubmitted=async(snapshot:WorkingSnapshot)=>{
  const generation=restoreGeneration;
  await writeDraft(snapshot.journey);
  if(generation!==restoreGeneration||host.snapshot().journey.id!==snapshot.journey.id)throw new Error('The selected work changed while its draft was being retained. No composition was committed.');
 };
 const requireAdoption=(current:()=>boolean)=>{if(!current())throw new Error('The working draft changed while opening. It and its native basis were retained; choose Open again when ready.');};
 const adopt=async(raw:KernelExpressionDocument,current:()=>boolean,file?:NativeFile)=>{
  requireAdoption(current);
  const old=clone(host.snapshot());
  if(host.shouldRetainDraft?.()!==false)await writeDraft(old.journey); // retain authored work, not an untouched boot canvas
  requireAdoption(current);
  const view=await work.adopt(raw,file,current);
  requireAdoption(current);
  restoreGeneration++;selections.cancel();
  host.load(view);markLoaded();readThrough=null;status(`Opened ${raw.title} on its exact native revision. ${view.notes.join(' ')}`);update();
 };
 // Following (host open-expression, the boot deep link, a Run's act): the
 // frame stands on the kernel's document; a running act makes it read-through.
 let followGeneration=0,loadedVersion=-1,readThrough:string|null=null;
 const markLoaded=()=>{loadedVersion=host.version();};
 const actPerforms=async(reference:string):Promise<boolean>=>{
  if(!worldAvailable())return false;
  try{const listed=await worldRequest<{acts?:{expression_ref?:unknown;phase?:unknown}[]}>({operation:'act_list',expression_ref:reference});return performedByLiveAct(listed.acts??[],reference);}
  catch{return false;}
 };
 const localEdits=(view:KernelConversion)=>hasLocalEdits(loadedVersion,host.version(),prepareCompositionEdit(view,host.snapshot().journey).changes.length);
 const followOpen=async(reference:string)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const generation=++followGeneration;opens.cancel();
  const raw=await readKernelExpression(reference) as KernelExpressionDocument;
  if(generation!==followGeneration)return;
  // Nothing is discarded: the showing draft, and any unsaved checkpoint of
  // this same Expression, stay in recovery under their own identities.
  if(host.shouldRetainDraft?.()!==false)await writeDraft(clone(host.snapshot().journey));
  const recovered=await readWorkingDraft(reference,scope).catch(()=>undefined);
  if(recovered?.record?.view&&(recovered.record.pending||prepareCompositionEdit(recovered.record.view,recovered.journey).changes.length)){
   await writeDraft({...clone(recovered.journey),id:retainedDraftId(recovered.journey.id,Date.now()),name:`${recovered.journey.name} (unsaved)`.slice(0,160)});
  }
  // Whether an act performs this Expression is read BEFORE the basis moves:
  // adopting the native basis and loading it into the field are one step, as
  // in `adopt`. Awaiting between them left the frame reporting (and saving
  // against) the new Expression while it still showed the previous document.
  const performing=await actPerforms(reference);
  if(generation!==followGeneration)return;
  const view=await work.adopt(raw,undefined,()=>generation===followGeneration);
  readThrough=performing?reference:null;
  restoreGeneration++;selections.cancel();host.load(view);markLoaded();host.followed?.(reference,!!readThrough);
  status(`${readThrough?'Following':'Opened'} ${raw.title} at revision ${raw.revision}.${readThrough?' An act is performing it: this view reads through and never commits into it.':''}`);update();
 };
 const openReference=async(reference:string,intentCurrent:()=>boolean=()=>true)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const captured=captureNativeAdoption(host,()=>restoreGeneration),current=()=>captured()&&intentCurrent(),basis=work.state;
  const listed=await listKernelExpressions();requireAdoption(current);
  if(basis?.view?.document.expression_ref===reference&&listed.some(entry=>entry.expression_ref===reference)){status('This native work is already open. Its current Scene, selection and unsaved draft were retained.');return;}
  // A live native document may already belong to an authored Journey with
  // its own identity, unsaved material or interrupted operation. Consult that
  // exact checkpoint before deriving a new rendering identity from the ref.
  const recovered=await readWorkingDraft(reference,scope);requireAdoption(current);
  if(recovered){
   if(host.shouldRetainDraft?.()!==false)await writeDraft(clone(host.snapshot().journey));requireAdoption(current);
   const view=await work.reopenCheckpoint(recovered.record,recovered.journey,current);
   requireAdoption(current);
   restoreGeneration++;selections.cancel();host.load(view);update();
   status('Working composition recovered through its native owner. Unsaved edits and interrupted operations were retained.');return;
  }
  await adopt(await readKernelExpression(reference) as KernelExpressionDocument,current);
 };
 const opens=new NativeOpenIntent({
  idle:async()=>{while(busy)await ownerIdle;},
  open:(reference,current)=>run(()=>openReference(reference,current)),
  changed:()=>{update();},
 });
 const requestOpen=(reference:string)=>{
  if(!reference.startsWith('expression:')){status('Choose a native Expression reference');return Promise.resolve(false);}
  return opens.submit(reference,captureNativeAdoption(host,()=>restoreGeneration));
 };
 const loadFile=async(path:string)=>{
  const current=captureNativeAdoption(host,()=>restoreGeneration),result=await nativeFileRequest({operation:'open',path}) as {document:KernelExpressionDocument;file:NativeFile};
  if(!result?.document||!result.file)throw new Error('The native file was not returned');
  await adopt(result.document,current,{location:result.file.location,revision:result.file.revision,expression_ref:result.document.expression_ref});
 };
 const changePage=async(delta:number)=>{
  let record=work.state;const snapshot=host.snapshot();
  let view=record?.view,binding=view?.bindings[snapshot.sceneId];
  if(!record||!view||!binding)throw new Error('No native Scene is currently addressed');
  if(record.pending){await work.inspectPending();record=work.state;view=record?.view;binding=view?.bindings[snapshot.sceneId];if(!record||!view||!binding)throw new Error('No native Scene is currently addressed');}
  if(prepareCompositionEdit(view,snapshot.journey).changes.length){await work.commit(snapshot);record=work.state!;view=record.view!;binding=view.bindings[snapshot.sceneId];}
  const pages=Object.fromEntries(Object.values(view.bindings).map(item=>[item.scene_ref,item.page]));
  pages[binding.scene_ref]=binding.page+delta;
  const identity={expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,item])=>[item.scene_ref,id])),entities:view.entity_ids};
  const next=kernelDocumentToJourney(view.document,{identity,pages});
  const updated={...record,view:next};await writeWorkingCheckpoint(record.draft_id,updated,scope);work.restore(updated,snapshot.journey);
  host.load(next,true);status('Only the loaded member page changed. Native identity, membership, sources and file are unchanged.');
 };
 // The exact native work the verso must account for: the open Expression on
 // its current revision, and the exact Scene / entity-or-relation occurrence
 // the native selection stands on. Null when no native work is open (the
 // verso then falls back to the host's own subject). Refs only — the cradle
 // reads the content and revalidates the revision through the owner.
 const nativeSubject=():NativeSubject|null=>{
  const doc=work.state?.view?.document;if(!doc)return null;
  return {ref:doc.expression_ref,kind:'expression',nativeOwner:'oi',revision:doc.revision,title:doc.title,
   sceneRef:doc.selection?.scene_ref??null,entityRef:doc.selection?.entity_ref??null,relationRef:doc.selection?.relation_ref??null};
 };
 // The real facets the M′ instruments stand on, derived from the OPEN kernel
 // Expression — never a hardcoded guess. A lens uses this to disclose its own
 // availability and material.
 const construction=():ConstructionFacets|null=>{
  const view=work.state?.view,doc=view?.document;if(!view||!doc)return null;
  const scenes=doc.scenes.map(s=>{
   const binding=Object.values(view.bindings).find(b=>b.scene_ref===s.scene_ref);
   return {scene_ref:s.scene_ref,title:s.title,members:s.entity_refs.length,relations:binding?.relations.length??0};
  });
  return {ref:doc.expression_ref,revision:doc.revision,title:doc.title,
   members:Object.keys(doc.entities).length,relations:Object.keys(doc.relations??{}).length,
   scenes,currentScene:doc.selection?.scene_ref??null};
 };
 const guarded=(task:()=>Promise<void>)=>run(async()=>{
  if(!kernelExpressionsAvailable())throw new Error('The native host channel is not ready. No native operation has been staged.');
  await task();
 });
 /** The working draft is saved through the owner before any second native
  * edit touches the same Expression: editing never demands a manual save
  * first, and the structured edit lands on the draft's own new revision.
  * Returns true when a flush happened and the basis moved. */
 const flushDraft=async(current:KernelConversion):Promise<KernelConversion>=>{
  if(!prepareCompositionEdit(current,host.snapshot().journey).changes.length)return current;
  if(readThrough===current.document.expression_ref)throw new Error('An act is performing this Expression; this view reads through and keeps your edits unsaved rather than committing into it.');
  await work.commit(host.snapshot());
  return work.state?.view??current;
 };
 const resolvePending=()=>guarded(async()=>{
  const before=work.state,version=host.version();
  const clean=before?.view&&!prepareCompositionEdit(before.view,host.snapshot().journey).changes.length;
  const result=await work.inspectPending();
  if(before?.pending?.kind==='connections'&&work.state?.view){
   if(clean&&host.version()===version){restoreGeneration++;selections.cancel();host.load(work.state.view,true);}
   else{status(`${result} Newer local edits remain in your working draft.`);return;}
  }
  status(result);
 });
 return {
  /** Retry the last native open that failed (e.g. a revision conflict). */
  retryOpen:()=>opens.retry(),
  /** Inspect and settle an interrupted native operation. */
  resolvePending,
  /** Re-perform an interrupted file save with its retained identity. */
  retryFile:()=>guarded(async()=>{const file=await work.retryFile();status(`Verified the retained file save: ${file.location.path}.`);}),
  /** Page the loaded members of a Scene larger than the render budget. */
  page:(delta:number)=>guarded(()=>changePage(delta)),
  /** Write the working composition to a Central file and read it back. */
  saveFile:(folder:string,name:string)=>{const snapshot=clone(host.snapshot()),version=host.version();return guarded(async()=>{
   await retainSubmitted(snapshot);
   const file=await work.saveFile(snapshot,{parent_path:folder,name});
   status(`Saved and read back ${file.location.path}.${host.version()!==version?' Newer local edits are still unsaved.':''}`);
  });},
  status:()=>update(),
  open:requestOpen,
  cancelOpen:()=>{opens.cancel();update();},
  openFile:(path:string)=>run(()=>loadFile(path)),
  /** Follow the same Expression to a newer owner revision when the draft is
   * clean. Resolves false (draft kept) when there is local work to reconcile. */
  advance:async():Promise<boolean>=>{
   let adopted=false;
   await run(async()=>{
    const current=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.advanceClean(host.snapshot().journey,current);
    if(!view)return;
    restoreGeneration++;selections.cancel();host.load(view,true);update();adopted=true;
   });
   return adopted;
  },
  select:(sceneId:string,entityId:string|null,bindingRef?:string)=>{
   const nativeRef=work.state?.view?.document.expression_ref;
   if(!nativeRef)return Promise.resolve('invalidated' as const);
   return selections.submit({generation:restoreGeneration,nativeRef,sceneId,entityId,bindingRef});
  },
  async changed(journey:Journey){
   if(isGenuineWorkspaceSwitch(bootState)){opens.cancel();restoreGeneration++;selections.cancel();}
   const generation=restoreGeneration;work.detach();host.correspondence({},null);
   try{const record=await readWorkingCheckpoint(journey.id,scope);if(generation!==restoreGeneration||host.snapshot().journey.id!==journey.id)return;if(record)work.restore(record,journey);update();}
   catch(error){if(generation===restoreGeneration){lastFailure=true;status(`Native recovery was not adopted: ${error instanceof Error?error.message:String(error)}`);update();}}
  },
  inspect(){const state=work.state;return {native_ref:state?.view?.document.expression_ref,revision:state?.view?.document.revision,file:state?.file,pending:state?.pending?.kind,notes:state?.view?.notes??[],bindings:state?.view?.bindings};},
  /** `changes` may be computed from the flushed native view (after the
   * working draft commits) — e.g. a reuse block naming committed refs. */
  edit:async(input:Record<string,unknown>[]|((view:KernelConversion)=>Record<string,unknown>[]))=>{
   if(Array.isArray(input)&&!input.length)return;
   const succeeded=await mutate(async()=>{
    let current=work.state?.view;
    if(!current)throw new Error('Open a native Expression before editing its connections.');
    const version=host.version();
    current=await flushDraft(current);
    const changes=typeof input==='function'?input(current):input;
    if(!changes.length)return;
    const view=await work.editConnections(changes);
    if(host.version()!==version)throw new Error('The edit was saved natively; newer local edits remain in your working draft.');
    restoreGeneration++;selections.cancel();
    host.load(view,true);update();
   });
   if(!succeeded)throw new Error(notice||'The native edit was not acknowledged.');
  },
  duplicateOccurrence:async(sceneId:string,entityId:string):Promise<void>=>{
   const succeeded=await mutate(async()=>{
    let current=work.state?.view,binding=current?.bindings[sceneId];
    const occurrence=binding?.occurrences.find(row=>row.view_entity_id===entityId);
    if(!current||!binding||!occurrence)throw new Error('Choose a source occurrence in the current native Scene');
    if(host.snapshot().sceneId!==sceneId)throw new Error('The selected Scene changed before duplication');
    current=await flushDraft(current);
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.duplicateOccurrence({operation:'duplicate',scene_ref:binding.scene_ref,entity_ref:occurrence.entity_ref,new_entity_ref:current.document.expression_ref+':entity:occurrence-'+crypto.randomUUID()});
    if(!adoption())throw new Error('The occurrence was duplicated natively; newer local work remains in your draft. Reopen its native composition when ready.');
    restoreGeneration++;selections.cancel();host.load(view,true);update();
   });
   if(!succeeded)throw new Error(notice||'The native duplicate was not acknowledged.');
  },
  insertSource:async(choice:SourceOccurrenceChoice):Promise<void>=>{
   const captured=clone(choice);
   const succeeded=await mutate(async()=>{
    let current=work.state?.view;const active=host.snapshot();let binding=current?.bindings[active.sceneId];
    if(!current||current.document.expression_ref!==captured.expression_ref||current.document.revision!==captured.revision||binding?.scene_ref!==captured.scene_ref)throw new Error('The native Scene changed while choosing a source; choose again from its current composition');
    current=await flushDraft(current);
    binding=current.bindings[active.sceneId];
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.insertSource({operation:'insert-source',scene_ref:captured.scene_ref,new_entity_ref:captured.expression_ref+':entity:occurrence-'+crypto.randomUUID(),title:captured.title,binding:captured.binding});
    if(!adoption())throw new Error('The source was inserted natively; newer local work remains in your draft. Reopen its native composition when ready.');
    restoreGeneration++;selections.cancel();host.load(view,true);update();
   });
   if(!succeeded)throw new Error(notice||'The native source insertion was not acknowledged.');
  },
  nativeView:()=>work.state?.view,
  blueprint:async(intent:BlueprintIntent):Promise<void>=>{
   const captured=clone(intent);
   const succeeded=await mutate(async()=>{
    let current=work.state?.view;const active=host.snapshot();
    if(!current||current.document.expression_ref!==captured.expression_ref||current.document.revision!==captured.revision||current.bindings[active.sceneId]?.scene_ref!==captured.scene_ref)throw Error('The native Scene changed; inspect its blueprint before trying again');
    current=await flushDraft(current);
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.editBlueprint(captured);
    if(!adoption())throw Error('The blueprint was saved natively; newer local work remains in your draft. Reopen when ready.');
    restoreGeneration++;selections.cancel();host.load(view,true);update();
   });
   if(!succeeded)throw Error(notice||'The native blueprint was not acknowledged');
  },
  /** Stand on a kernel Expression (host open-expression, boot deep link). */
  follow:async(reference:string):Promise<boolean>=>{while(busy)await ownerIdle;return run(()=>followOpen(reference));},
  /** Re-read a followed Expression. Clean: adopt the kernel's newer revision
   * (never commits). Edited: keep the edits unsaved and disclose the newer
   * revision. Not open: follow it. */
  refreshReference:async(reference:string):Promise<boolean>=>{while(busy)await ownerIdle;return run(async()=>{
   const current=work.state?.view;
   if(!current||current.document.expression_ref!==reference){await followOpen(reference);return;}
   const raw=await readKernelExpression(reference) as KernelExpressionDocument;
   const step=refreshStep({openRef:current.document.expression_ref,reference,localRevision:current.document.revision,kernelRevision:raw.revision,edited:localEdits(current),pending:!!work.state?.pending});
   if(step.kind==='current')return;
   if(step.kind==='follow'){await followOpen(reference);return;}
   if(step.kind==='disclose'){
    lastFailure=true;
    status(`${raw.title} moved to revision ${step.kernelRevision}; this view is on ${step.localRevision} with unsaved edits, which were kept. Save or reopen to reconcile.`);
    host.toast(notice,7000);return;
   }
   const generation=++followGeneration;
   const view=await work.adopt(raw,work.state?.file,()=>generation===followGeneration);
   restoreGeneration++;selections.cancel();host.load(view);markLoaded();host.followed?.(reference,readThrough===reference);update();
  });},
  nativeSubject,
  construction,
  // Persist the current composition — its scenes, members and relations —
  // to the native Expression through the owner (kernel scene_create/edit with
  // the expected-revision basis check; a stale reply is refused, never
  // retried). This is the native scene act M3′ commits to, not a browser save.
  commit:async()=>{
   // A focus write may still be acknowledging the click that began editing.
   // Keep this submitted draft and wait for that owner operation; busy is not
   // a failed save. Navigation still invalidates work addressed to the old doc.
   const snapshot=clone(host.snapshot()),version=host.version();
   return mutate(async()=>{
    await retainSubmitted(snapshot);
    const doc=await work.commit(snapshot);
    status(`Saved · native revision ${doc.revision} — ${doc.scenes.length} scene${doc.scenes.length===1?'':'s'}, ${Object.keys(doc.entities).length} member${Object.keys(doc.entities).length===1?'':'s'} in the native Expression.${host.version()!==version?' Newer local edits remain a separate draft.':''}`);
   });
  },
 };
}
