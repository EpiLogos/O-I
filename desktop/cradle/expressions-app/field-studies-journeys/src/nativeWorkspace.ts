import type {SourceOccurrenceChoice} from './nativeOccurrence.js';
import type {BlueprintIntent} from './nativeBlueprint.js';
/** The native working document behind the hosted application: open, commit,
 * recover and file-save through the owner. It has no panel of its own; its
 * standing reaches the app's Save control and Studio footer via host.status. */
import {clone,type Journey} from './model.js';
import {NativeWorking,type NativeCheckpoint,type NativeFile,type NativeWorkingRecord,type WorkingSnapshot} from './nativeWorking.js';
import {kernelExpressionsAvailable,listKernelExpressions,readKernelExpression,nativeExpressionRequest,nativeFileRequest,documentToChanges,type KernelChange} from './kernelExpressions.js';
import type {KernelSaveAnchor} from './store.js';
import {readWorkingCheckpoint,readWorkingDraft,readBoundWorkingDraft,acceptWorkingRecoveryBasis,writeWorkingCheckpoint,writeDraft,applyRecoveryPlan,removeDraft} from './recovery.js';
// lane-3 E19b: the hosted recovery choice uses the same offer and plan as the browser boot.
import {settleHostedDraft,bootWasUnclean,type RecoveryChoice} from './draftStorage.js';
import type {RecoveryRecord} from '../../../src/expressions/recoveryTypes';
import {hostedRecovery,hostedScope,recoveryBinding,selectedRecovery,draftRecoveryAddress,selectNativeRecovery} from './nativeRecovery.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {nestedDocumentReads} from './nestedReads.js';
import {type NestedDocumentLike,type NestedGraph} from './nestedOccurrence.js';
import {nativeConnections} from './nativeCorrespondence.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
import {prepareCompositionEdit} from './kernelComposition.js';
import {NativeOpenIntent} from './nativeOpenIntent.js';
import {NativeSelectionQueue} from './nativeSelectionQueue.js';
import {refreshStep,hasLocalEdits,performedByLiveAct} from './nativeFollow.js';
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
/** How an adoption from the owner enters the one undo history (see the host's `load`). */
export type NativeAdoption='record'|'acknowledge'|'act'|'outside';
/** The kernel edit an owner acknowledged, with the kernel documents either side of it. */
export interface KernelCheckpointRecord {changes:KernelChange[];before:unknown;after:unknown}
/** One native act, named for what the user did: its label, and what the owner acknowledged (or the
 * refusal by name when that kernel edit has no inverse). */
export interface NativeActRecord {label:string;record:KernelCheckpointRecord|{refused:string;reason:string}}
export interface NativeWorkspaceHost {
 shouldRetainDraft?:()=>boolean;
 snapshot:()=>WorkingSnapshot;
 version:()=>number;
 /** `act`: an adoption the app's own native act produced, recorded as ONE labelled undo step ('act').
  * 'outside': an adoption from outside this editor, labelled for what it is ('outside'). */
 load:(view:KernelConversion,preservePosition?:boolean,history?:NativeAdoption,act?:NativeActRecord)=>void;
 /** E15: the undo anchor, read in the same step as the act's snapshot, so a Save that stands alone records on the step it began from. */
 anchor?:()=>KernelSaveAnchor;
 /** E15: a draft flush the owner acknowledged on its own is a Save: it records its checkpoint on the anchor it began at. */
 recordSave?:(anchor:KernelSaveAnchor,checkpoint:KernelCheckpointRecord)=>void;
 toast:(message:string,duration?:number)=>void;
 /** The host's hold on owner writes: a reason (named, not sent) while an edit the host has open must finish first (a .canvas import).
  * Checked where each owner write is entered, so a refused write sends nothing to the owner. Null when writes may proceed. */
 gate?:()=>string|null;
 /** Re-render the open Expression's surfaces when nested documents arrive (E14). */
 refresh?:()=>void;
 summon:(kind:'library'|'verso'|'search',subject?:NativeSubject)=>void;
 correspondence:(rows:Record<string,ConnectionBinding[]>,selection:string|null)=>void;
 /** The working document's truthful standing, shown by the app's own Save
  * control and Studio footer — there is no separate native panel. */
 status?:(state:NativeStatus)=>void;
 /** A followed Expression was adopted; `readThrough` when an act performs it. */
 followed?:(reference:string,readThrough:boolean)=>void;
 /** lane-3 E19b: the owner's choice when a hosted draft is newer than its checkpoint's acknowledged basis after an unclean exit. */
 chooseRecovery?:(request:{draft:Journey;saved:Journey;offer:{draftAt:string;savedAt:string};revision:number})=>Promise<RecoveryChoice>;
}
/** E15c: a Save that the owner acknowledged, with its checkpoint for the one undo history. */
export interface NativeSave {checkpoint:NativeCheckpoint}
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
 const checkpoint=async(id:string,value:unknown)=>{
  const address=draftRecoveryAddress(id);
  await writeWorkingCheckpoint(address.checkpoint_id,value,address.scope);
 };
 const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,
  checkpoint,mint:()=>`expression:authored-${crypto.randomUUID()}`});
 let busy=false,notice='',lastFailure=false,restoreGeneration=0;const bootState={booted:false};
 let ownerIdle:Promise<void>=Promise.resolve();
 let queuedMutations=0;
 // E14: the nested documents the open Expression names (nestedDocumentReads).
 const nested=nestedDocumentReads(readKernelExpression,()=>host.refresh?.(),listKernelExpressions);
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
 // The one refusal every owner write passes at its entry: the reason is the status line and the toast, and nothing is sent.
 const refusedByHost=():boolean=>{const reason=host.gate?.();if(!reason)return false;status(reason);host.toast(reason,4200);return true;};
 const run=async(task:()=>Promise<void>):Promise<boolean>=>{
  if(busy)return false;busy=true;
  let releaseOwner!:()=>void;ownerIdle=new Promise<void>(resolve=>{releaseOwner=resolve;});
  lastFailure=false;update();status('Reading or saving through the native owner…');
  try{await task();return true;}catch(error){lastFailure=true;status(error instanceof Error?error.message:String(error));host.toast(notice,7000);return false;}
  finally{busy=false;releaseOwner();update();selections.resume();}
 };
 const mutate=async(task:()=>Promise<void>):Promise<boolean>=>{
  if(refusedByHost())return false;
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
  apply:intent=>refusedByHost()?Promise.resolve(false):run(async()=>{
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
// lane-3 E19b: a hosted draft newer than its checkpoint's acknowledged basis is not adopted silently after an unclean exit. The owner
// chooses once per expression. Each choice keeps both sides: the draft is quarantined or copied to the Library, read back, and only
// then does its native copy leave the owner. The checkpoint's view is the saved basis; the kernel revision is named in the choice.
const recoveryOffered=new Set<string>();
// E19: the decision lives in draftStorage.settleHostedDraft. A draft not newer than the checkpoint is quarantined and the checkpoint opens,
// so it is never adopted; a newer draft is offered after an unclean exit exactly as before.
const settleRecovery=async(found:{record:NativeWorkingRecord;journey:Journey;recoveryRecords?:RecoveryRecord[]},current:()=>boolean)=>{
 const saved=found.record.view?.journey,draftId=found.record.draft_id,scope=found.recoveryRecords?.find(row=>row.kind==='draft')?.scope;
 const settled=await settleHostedDraft(draftId,found.journey,saved,{hosted:hostedRecovery(),uncleanBoot:bootWasUnclean(),settled:recoveryOffered,revision:found.record.view?.document.revision??0,chooseRecovery:host.chooseRecovery,requireAdoption:()=>requireAdoption(current),keepDraft:(plan,draft)=>applyRecoveryPlan(plan,draft),removeNativeDraft:()=>removeDraft(draftId,scope)});
 if(settled.kind==='draft')return found;
 return {...found,journey:settled.journey,recoveryRecords:found.recoveryRecords?.filter(row=>row.kind==='checkpoint')};
};
 const adopt=async(raw:KernelExpressionDocument,current:()=>boolean,file?:NativeFile)=>{
  requireAdoption(current);
  const old=clone(host.snapshot());
  if(host.shouldRetainDraft?.()!==false)await writeDraft(old.journey); // retain authored work, not an untouched boot canvas
  requireAdoption(current);
  const view=await work.adopt(raw,file,current);
  requireAdoption(current);
  restoreGeneration++;selections.cancel();
  host.load(view,false,'acknowledge');markLoaded();readThrough=null;status(`Opened ${raw.title} on its exact native revision. ${view.notes.join(' ')}`);update();
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
 const followOpen=async(reference:string,recovery?:unknown)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const generation=++followGeneration;opens.cancel();
  const address=hostedRecovery()?(recovery!==undefined?recoveryBinding(reference,recovery):selectedRecovery(reference)):null;
  // Revealing the same retained native work never reloads its recovery draft,
  // replaces human input, or resets its Scene transport.
  if(work.state?.view?.document.expression_ref===reference){
   status('This native work is already open. Its Scene, transport and working draft were retained.');return;
  }
  const captured=captureNativeAdoption(host,()=>followGeneration),current=()=>generation===followGeneration&&captured();
  // Retain the departing draft before reading the destination's exact records.
  // A refusal leaves both copies in place and cannot accept a newer CAS basis.
  if(host.shouldRetainDraft?.()!==false)await writeDraft(clone(host.snapshot().journey));
  requireAdoption(current);
  const found=address?await readBoundWorkingDraft(address):await readWorkingDraft(reference,hostedRecovery()?hostedScope():'expressions');
  requireAdoption(current);
  const recovered=found?await settleRecovery(found,current):found;
  requireAdoption(current);
  // Whether an act performs this Expression is read BEFORE the basis moves:
  // adopting the native basis and loading it into the field are one step, as
  // in `adopt`. Awaiting between them left the frame reporting (and saving
  // against) the new Expression while it still showed the previous document.
  const performing=await actPerforms(reference);
  requireAdoption(current);
  if(recovered)acceptWorkingRecoveryBasis(recovered,current);
  const view=recovered?await work.reopenCheckpoint(recovered.record,recovered.journey,current)
   :await work.adopt(await readKernelExpression(reference) as KernelExpressionDocument,undefined,current);
  requireAdoption(current);
  if(address)selectNativeRecovery(address);
  readThrough=performing?reference:null;
  restoreGeneration++;selections.cancel();host.load(view,false,'acknowledge');markLoaded();host.followed?.(reference,!!readThrough);
  status(`${readThrough?'Following':'Opened'} ${view.document.title} at revision ${view.document.revision}.${readThrough?' An act is performing it: this view reads through and never commits into it.':''}`);update();
 };
 const openReference=async(reference:string,intentCurrent:()=>boolean=()=>true)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const captured=captureNativeAdoption(host,()=>restoreGeneration),current=()=>captured()&&intentCurrent(),basis=work.state;
  const listed=await listKernelExpressions();requireAdoption(current);
  if(basis?.view?.document.expression_ref===reference&&listed.some(entry=>entry.expression_ref===reference)){status('This native work is already open. Its current Scene, selection and unsaved draft were retained.');return;}
  // A live native document may already belong to an authored Journey with
  // its own identity, unsaved material or interrupted operation. Consult that
  // exact checkpoint before deriving a new rendering identity from the ref.
  const address=hostedRecovery()?selectedRecovery(reference):null,found=address?await readBoundWorkingDraft(address):await readWorkingDraft(reference,hostedRecovery()?hostedScope():'expressions');requireAdoption(current);
  const recovered=found?await settleRecovery(found,current):found;requireAdoption(current);
  if(recovered){
   if(host.shouldRetainDraft?.()!==false)await writeDraft(clone(host.snapshot().journey));requireAdoption(current);
   acceptWorkingRecoveryBasis(recovered,current);
   const view=await work.reopenCheckpoint(recovered.record,recovered.journey,current);
   requireAdoption(current);
   if(address)selectNativeRecovery(address);
   restoreGeneration++;selections.cancel();host.load(view,false,'acknowledge');update();
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
  if(refusedByHost())return Promise.resolve(false);
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
  const updated={...record,view:next};await checkpoint(record.draft_id,updated);work.restore(updated,snapshot.journey);
  host.load(next,true,'acknowledge');status('Only the loaded member page changed. Native identity, membership, sources and file are unchanged.');
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
 const guarded=(task:()=>Promise<void>)=>refusedByHost()?Promise.resolve(false):run(async()=>{
  if(!kernelExpressionsAvailable())throw new Error('The native host channel is not ready. No native operation has been staged.');
  await task();
 });
 /** The working draft is saved through the owner before any second native
  * edit touches the same Expression: editing never demands a manual save
  * first, and the structured edit lands on the draft's own new revision.
  * Returns true when a flush happened and the basis moved. */
 /** E15/E16: one native act. Its draft flush, its owner edit and, given `sides`, the composition that
  * carries its connector sides are acknowledged in turn, then adopted as ONE labelled undo step whose
  * checkpoint runs from the kernel document before the flush to the one after the last acknowledgement.
  * A draft flush that stands alone is a Save: it records on the step it began from. An act that fails
  * before the owner acknowledges an edit records nothing; after an acknowledgement it records exactly
  * what the owner acknowledged. `label` may be read after the edit when the edit names itself. */
 type ActLabel=string|(()=>string);
 const actLabel=(label:ActLabel):string=>typeof label==='string'?label:label();
 const nativeAct=(label:ActLabel,perform:(current:KernelConversion)=>Promise<{view:KernelConversion;changes?:KernelChange[]}|null>,options:{sides?:(journey:Journey)=>void;guard?:(current:KernelConversion)=>void}={}):Promise<boolean>=>{
  const anchor=host.anchor?.();
  return mutate(async()=>{
   let current=work.state?.view;
   if(!current)throw new Error('Open a native Expression first.');
   options.guard?.(current);
   const version=host.version(),before=clone(current.document);
   let flush:KernelCheckpointRecord|null=null,finalView:KernelConversion|null=null;
   let performed:KernelChange[]=[],sides:KernelChange[]=[],refusal:{refused:string;reason:string}|null=null;
   // The one adoption: the act's own labelled step, or a flush recorded as a Save on its anchor.
   const settle=()=>{
    if(finalView){
     restoreGeneration++;selections.cancel();
     host.load(finalView,true,'act',{label:actLabel(label),record:refusal??{changes:[...(flush?.changes??[]),...performed,...sides],before:clone(before),after:clone(finalView.document)}});
     update();
    }else if(flush&&anchor)host.recordSave?.(anchor,flush);
   };
   try{
    if(prepareCompositionEdit(current,host.snapshot().journey).changes.length){
     if(readThrough===current.document.expression_ref)throw new Error('An act is performing this Expression; this view reads through and keeps your edits unsaved rather than committing into it.');
     const saved=await work.commitRecorded(host.snapshot());
     flush=saved.checkpoint;current=work.state?.view??current;
    }
    const basis=clone(current.document);
    const result=await perform(current);
    if(result&&result.view.document.revision!==basis.revision){
     finalView=result.view;
     if(result.changes)performed=result.changes;
     else{const diff=documentToChanges(basis,finalView.document);if('changes' in diff)performed=diff.changes;else refusal={refused:String(diff.refused??'not_diffable'),reason:diff.error};}
    }
    if(options.sides&&finalView){
     const journey=clone(finalView.journey);options.sides(journey);
     const saved=await work.commitRecorded({...host.snapshot(),journey});
     sides=saved.checkpoint.changes;finalView=work.state?.view??finalView;
    }
    if(host.version()!==version)throw new Error('The edit was saved natively; newer local edits remain in your working draft.');
    settle();
   }catch(error){
    // Once the owner acknowledged the act, what landed is the step, unless local work moved underneath it.
    if(finalView&&host.version()===version)settle();
    else if(!finalView&&flush)settle();
    throw error;
   }
  });
 };
 const resolvePending=()=>guarded(async()=>{
  const before=work.state,version=host.version();
  const clean=before?.view&&!prepareCompositionEdit(before.view,host.snapshot().journey).changes.length;
  const result=await work.inspectPending();
  if(before?.pending?.kind==='connections'&&work.state?.view){
   if(clean&&host.version()===version){restoreGeneration++;selections.cancel();host.load(work.state.view,true,'outside');}
   else{status(`${result} Newer local edits remain in your working draft.`);return;}
  }
  status(result);
 });
 /** The Save, with what the owner acknowledged. It reads the snapshot at the call:
  * a caller that also reads its undo anchor must do so in the same step. Returns
  * false when the Save was refused or failed (named in the status and toast). */
 const commitRecorded=async():Promise<false|NativeSave>=>{
  const snapshot=clone(host.snapshot()),version=host.version();
  const outcome:{saved?:NativeSave}={};
  const ok=await mutate(async()=>{
   await retainSubmitted(snapshot);
   let destination=work.state?.file;
   // Following a native tree entry can have no local file checkpoint. The
   // owner still knows its file; keep Save on that exact existing binding.
   const reference=work.state?.view?.document.expression_ref;
   if(!destination&&reference){
    const inspected=await nativeExpressionRequest({operation:'inspect',expression_ref:reference}) as {document?:KernelExpressionDocument;file?:Omit<NativeFile,'expression_ref'>|null};
    if(inspected.document?.expression_ref!==reference)throw Error('The owner returned a different Expression before saving.');
    if(inspected.file)destination={...inspected.file,expression_ref:reference};
   }
   if(destination){
    const {file,checkpoint}=await work.saveFileRecorded(snapshot,{location:destination.location,revision:destination.revision});
    outcome.saved={checkpoint};
    status(`Saved and read back ${file.location.path}.${host.version()!==version?' Newer local edits remain a separate draft.':''}`);
   }else{
    const {document:doc,checkpoint}=await work.commitRecorded(snapshot);
    outcome.saved={checkpoint};
    status(`Saved · native revision ${doc.revision} — ${doc.scenes.length} scene${doc.scenes.length===1?'':'s'}, ${Object.keys(doc.entities).length} member${Object.keys(doc.entities).length===1?'':'s'} in the native Expression.${host.version()!==version?' Newer local edits remain a separate draft.':''}`);
   }
  });
  return ok&&outcome.saved?outcome.saved:false;
 };
 return {
  /** Retry the last native open that failed (e.g. a revision conflict). */
  retryOpen:()=>refusedByHost()?Promise.resolve(false):opens.retry(),
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
  openFile:(path:string)=>refusedByHost()?Promise.resolve(false):run(()=>loadFile(path)),
  /** Follow the same Expression to a newer owner revision when the draft is
   * clean. Resolves false (draft kept) when there is local work to reconcile. */
  advance:async(isCurrent?:()=>boolean):Promise<boolean>=>{
   if(refusedByHost())return false;
   let adopted=false;
   await run(async()=>{
    if(isCurrent&&!isCurrent())return;
    const current=captureNativeAdoption(host,()=>restoreGeneration);
    const view=await work.advanceClean(host.snapshot().journey,current);
    if(!view||!current()||(isCurrent&&!isCurrent()))return;
    restoreGeneration++;selections.cancel();host.load(view,true,'acknowledge');update();adopted=true;
   });
   return adopted;
  },
  select:(sceneId:string,entityId:string|null,bindingRef?:string)=>{
   if(refusedByHost())return Promise.resolve('invalidated' as const);
   const nativeRef=work.state?.view?.document.expression_ref;
   if(!nativeRef)return Promise.resolve('invalidated' as const);
   return selections.submit({generation:restoreGeneration,nativeRef,sceneId,entityId,bindingRef});
  },
  async changed(journey:Journey){
   if(isGenuineWorkspaceSwitch(bootState)){opens.cancel();restoreGeneration++;selections.cancel();}
   const generation=restoreGeneration;work.detach();host.correspondence({},null);
   if(hostedRecovery()&&host.shouldRetainDraft?.()===false){update();return;}
   try{const address=draftRecoveryAddress(journey.id);
    const record=await readWorkingCheckpoint(address.checkpoint_id,address.scope);
    if(generation!==restoreGeneration||host.snapshot().journey.id!==journey.id)return;if(record)work.restore(record,journey);update();}
   catch(error){if(generation===restoreGeneration){lastFailure=true;status(`Native recovery was not adopted: ${error instanceof Error?error.message:String(error)}`);update();}}
  },
  inspect(){const state=work.state;return {native_ref:state?.view?.document.expression_ref,revision:state?.view?.document.revision,file:state?.file,pending:state?.pending?.kind,notes:state?.view?.notes??[],bindings:state?.view?.bindings};},
  /** `changes` may be computed from the flushed native view (after the
   * working draft commits) — e.g. a reuse block naming committed refs. */
  /** One native edit, acknowledged as one labelled undo step (E15/E16). `sides` rides the same act:
   * it edits the acknowledged composition (e.g. connector lines) and is saved with the edit. */
  edit:async(input:Record<string,unknown>[]|((view:KernelConversion)=>Record<string,unknown>[]),label:ActLabel,sides?:(journey:Journey)=>void)=>{
   if(Array.isArray(input)&&!input.length)return;
   const succeeded=await nativeAct(label,async current=>{
    const changes=typeof input==='function'?input(current):input;
    if(!changes.length)return null;
    const view=await work.editConnections(changes);
    return {view,changes:changes as unknown as KernelChange[]};
   },{sides});
   if(!succeeded)throw new Error(notice||'The native edit was not acknowledged.');
  },
  duplicateOccurrence:async(sceneId:string,entityId:string,label:ActLabel='Duplicate object'):Promise<void>=>{
   const succeeded=await nativeAct(label,async current=>{
    const binding=current.bindings[sceneId],occurrence=binding?.occurrences.find(row=>row.view_entity_id===entityId);
    if(!binding||!occurrence)throw new Error('Choose a source occurrence in the current native Scene');
    if(host.snapshot().sceneId!==sceneId)throw new Error('The selected Scene changed before duplication');
    const view=await work.duplicateOccurrence({operation:'duplicate',scene_ref:binding.scene_ref,entity_ref:occurrence.entity_ref,new_entity_ref:current.document.expression_ref+':entity:occurrence-'+crypto.randomUUID()});
    return {view};
   });
   if(!succeeded)throw new Error(notice||'The native duplicate was not acknowledged.');
  },
  insertSource:async(choice:SourceOccurrenceChoice,label:ActLabel='Insert source'):Promise<void>=>{
   const captured=clone(choice);
   const succeeded=await nativeAct(label,async()=>{
    const view=await work.insertSource({operation:'insert-source',scene_ref:captured.scene_ref,new_entity_ref:captured.expression_ref+':entity:occurrence-'+crypto.randomUUID(),title:captured.title,binding:captured.binding});
    return {view};
   },{guard:current=>{
    if(current.document.expression_ref!==captured.expression_ref||current.document.revision!==captured.revision||current.bindings[host.snapshot().sceneId]?.scene_ref!==captured.scene_ref)throw new Error('The native Scene changed while choosing a source; choose again from its current composition');
   }});
   if(!succeeded)throw new Error(notice||'The native source insertion was not acknowledged.');
  },
  nativeView:()=>{const view=work.state?.view;return view?nested.view(view):undefined;},
  /** The nested documents read so far (E14). The verdict of a placement is taken from it. */
  nestedGraph:():NestedGraph=>nested.graph(),
  readNested:(ref:string,revision:unknown,maxDepth:number):Promise<void>=>nested.readNested(ref,revision,maxDepth),
  nestedDocument:(ref:string):NestedDocumentLike|undefined=>nested.document(ref),
  blueprint:async(intent:BlueprintIntent,label:ActLabel='Apply blueprint'):Promise<void>=>{
   const captured=clone(intent);
   const succeeded=await nativeAct(label,async()=>({view:await work.editBlueprint(captured)}),{guard:current=>{
    if(current.document.expression_ref!==captured.expression_ref||current.document.revision!==captured.revision||current.bindings[host.snapshot().sceneId]?.scene_ref!==captured.scene_ref)throw Error('The native Scene changed; inspect its blueprint before trying again');
   }});
   if(!succeeded)throw Error(notice||'The native blueprint was not acknowledged');
  },
  /** Stand on a kernel Expression (host open-expression, boot deep link). */
  follow:async(reference:string,recovery?:unknown):Promise<boolean>=>{if(refusedByHost())return false;while(busy)await ownerIdle;return run(()=>followOpen(reference,recovery));},
  /** Re-read a followed Expression. Clean: adopt the kernel's newer revision
   * (never commits). Edited: keep the edits unsaved and disclose the newer
   * revision. Not open: follow it. */
  refreshReference:async(reference:string,recovery?:unknown):Promise<boolean>=>{if(refusedByHost())return false;while(busy)await ownerIdle;return run(async()=>{
   if(hostedRecovery()&&recovery!==undefined)recoveryBinding(reference,recovery);
   const current=work.state?.view;
   if(!current||current.document.expression_ref!==reference){await followOpen(reference,recovery);return;}
   const raw=await readKernelExpression(reference) as KernelExpressionDocument;
   const step=refreshStep({openRef:current.document.expression_ref,reference,localRevision:current.document.revision,kernelRevision:raw.revision,edited:localEdits(current),pending:!!work.state?.pending});
   if(step.kind==='current')return;
   if(step.kind==='follow'){await followOpen(reference,recovery);return;}
   if(step.kind==='disclose'){
    lastFailure=true;
    status(`${raw.title} moved to revision ${step.kernelRevision}; this view is on ${step.localRevision} with unsaved edits, which were kept. Save or reopen to reconcile.`);
    host.toast(notice,7000);return;
   }
   const generation=++followGeneration;
   const view=await work.adopt(raw,work.state?.file,()=>generation===followGeneration);
   restoreGeneration++;selections.cancel();host.load(view,false,'acknowledge');markLoaded();host.followed?.(reference,readThrough===reference);update();
  });},
  nativeSubject,
  construction,
  /** Internal Scene join: the actual working owner stays inside the existing
   * serialized mutation path. No owner or second document crosses the host. */
  editScenes:async<T>(task:(owner:Pick<NativeWorking,'state'|'busy'|'commit'>,isCurrent:()=>boolean)=>Promise<T>):Promise<T>=>{
   let result:T|undefined,failure:unknown;
   const generation=restoreGeneration,reference=work.state?.view?.document.expression_ref;
   const succeeded=await mutate(async()=>{
    const isCurrent=()=>restoreGeneration===generation&&work.state?.view?.document.expression_ref===reference;
    if(!isCurrent())throw Error('The native Scene owner changed before its edit');
    try{result=await task(work,isCurrent);status('Scene edit acknowledged by its native owner.');}
    catch(cause){failure=cause;throw cause;}
   });
   if(!succeeded)throw failure??Error(notice||'The native Scene edit was not acknowledged');
   return result as T;
  },
  // Persist the current composition — its scenes, members and relations —
  // to the native Expression through the owner (kernel scene_create/edit with
  // the expected-revision basis check; a stale reply is refused, never
  // retried). This is the native scene act M3′ commits to, not a browser save.
  // A focus write may still be acknowledging the click that began editing.
  // Keep this submitted draft and wait for that owner operation; busy is not
  // a failed save. Navigation still invalidates work addressed to the old doc.
  commit:async()=>(await commitRecorded())!==false,
  commitRecorded,
  /** E15c: replay one recorded Save's kernel edit — an Undo's compensation
   * (`expected` = the document before the Save) or a Redo's forward edit
   * (`expected` = the document after it) — at the acknowledged basis. A refusal,
   * such as a revision conflict, is named in the status and toast; it returns false. */
  replayCheckpoint:(changes:KernelChange[],expected:unknown)=>mutate(async()=>{
   await work.replayKernelEdit(changes,expected as KernelExpressionDocument);
   status('Recorded Save acknowledged by its native owner.');
  }),
 };
}
