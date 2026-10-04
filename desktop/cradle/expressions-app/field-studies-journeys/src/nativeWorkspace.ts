import type {NativeDefinitionPort} from './proceduralNativeDefinition';
import {NativePerformanceActs} from './native-performance/retainedAct.js';

import {retainedLibraryForDefinitionRetry,type NativeStageLibraryReply} from './proceduralNativeStageLibrary.js';
import {declaredNativeAuthorshipProfiles,sourceAuthorshipRequest,procedureAuthorshipRequest,validateNativeAuthorshipReading,type NativeStageAuthorshipRequest,type NativeAuthorshipReading} from './proceduralStageAuthoring';
import {selectedSourceAssetPresent,type SelectedSceneSourcePort,PendingNativeSelectedSceneSource,SelectedSceneSourceReply} from './proceduralSelectedSceneSource.js';
import {selectedSceneRequest,selectedSceneSourceReason,type NativeSelectedSceneRequest,type PendingNativeSelectedScene,type SelectedSceneOpening} from './proceduralSelectedScene.js';
import {validateAuthoredDriverRead,validateAuthoredDriverIntent,authoredDriverSnapshot,type NativeAuthoredDriverReadRequest,type NativeAuthoredDriverReadReply,type NativeAuthoredDriverIntent,type AuthoredDriverAction,type StageAuthoredDriverAvailability,type StageAuthoredDriverObservation,type PendingNativeAuthoredDriver} from './proceduralStageAuthoredDrivers.js';
import {validateStageLifecycleIntent,validateStageLifecycleAvailability,type NativeLifecycleAction,type NativeLifecycleCancelIntent,type NativeLifecycleIntent,type StageLifecycleAvailability,type StageLifecycleObservation} from './proceduralStageLifecycle.js';
import {pendingStageBootstrap,stageBootstrapCommand,validateStageSourceAuthorship,type NativeStageBootstrapCommand,type StageSourceAuthorship,type StageSourceBootstrapIntent,type StageSourceBootstrapOutcome,type PendingNativeSourceBootstrap} from './proceduralStageBootstrap.js';
import {nativeDriverRequest,validateNativeDriver,nativeControlRequest,type StudioNativeDriverIntent,type StudioNativeControlIntent,type NativeControlResult,type NativeParameterDriverReading,type PendingNativeControl} from './proceduralNativeControls.js';
import {controlCapabilities} from './proceduralControls.js';
import type {NativeConductContext} from './native-field/controller.js';
import {validateNativeSceneSource,validateProcedureAuthorship,type NativeSceneSource,type ProcedureAuthorship,type StageLibraryIntent} from './proceduralStageSource.js';
import {validateStageNoChangeOutcome,validateStagePreparedReceipt,type StagePreparation,type StageCapability,type StageCapabilityName,type StageRuntimeIntent,type StageRuntimeResult,type StageLibraryReplay,type StagePreparedPreview} from './proceduralStageProvider.js';
import type {ProceduralReply} from './proceduralWorking.js';
import {buildStudioEnvelope,studioBasis,type StudioChangeIntent,type StudioSnapshot,type NativeProcedureTemplate,type ProcedureAuthoringIntent,type ProcedurePreview,type ProcedureActionIntent,type RestorationReceipt,type StudioBasis} from './proceduralStudio.js';
import {sameNative,type ProceduralRequest,type Participant,type Operation} from './proceduralProtocol.js';
import {ProcedureSources,type ProcedureSourceCommand,type ProcedureSourceRequest} from './proceduralSources.js';
import type {SourceBasis,RestorationMode} from './proceduralRetention.js';
export type NativeFileOpenBasis=Pick<NativeFile,'location'|'revision'|'expression_ref'>;
export function qualifyWorkspaceConductContext(before:KernelConversion,after:KernelConversion|undefined,context:NativeConductContext,current:boolean):NativeConductContext{
 if(!current||!after||!sameNative(after.document,before.document)||context.expression_ref!==before.document.expression_ref||
  context.document_revision!==before.document.revision)throw new Error('The original native Document/CAS changed before conduct');
 return clone(context);
}
import type {SourceOccurrenceChoice} from './nativeOccurrence.js';
import type {BlueprintIntent} from './nativeBlueprint.js';
/** The native working document behind the hosted application: open, commit,
 * recover and file-save through the owner. It has no panel of its own; its
 * standing reaches the app's Save control and Studio footer via host.status. */
import {clone,type Journey} from './model.js';
import {NativeWorking,nativeOwnerSnapshot,type NativeFile,type WorkingSnapshot} from './nativeWorking.js';
import {kernelExpressionsAvailable,listKernelExpressions,readKernelExpression,nativeExpressionRequest,nativeFileRequest,nativeProcedureSourceRequest} from './kernelExpressions.js';
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
 selectedSceneSource?:SelectedSceneSourcePort;
 selectedSceneOpen?:(request:NativeSelectedSceneRequest,receive:(reply:unknown)=>Promise<void>,binding?:import('./native-field/controller').NativeSelectedSourceBinding)=>Promise<unknown>;
 selectedSceneRecover?:(request:NativeSelectedSceneRequest,receive:(reply:unknown)=>Promise<void>,binding?:import('./native-field/controller').NativeSelectedSourceBinding)=>Promise<unknown>;
 selectedSceneAbandon?:(request:NativeSelectedSceneRequest)=>Promise<unknown>;
 /** Request readiness of an actual admitted selected-Scene owner, never Source authority. */
 sourceBootstrapReason?:(view:KernelConversion)=>string|null;
 /** Actual installed Source constructor/receiver capability. Callback presence is not admission. */
 authoredDriverCapability?:(kind:AuthoredDriverAction['kind'],request:NativeAuthoredDriverReadRequest,reading:NativeAuthoredDriverReadReply,view:KernelConversion)=>StageAuthoredDriverAvailability;
 /** Actual native factory/session consumes HostACK before returning Source or
  * material refusal. These callbacks accept identity-only intent; Kernel reads
  * actual Source/outputs/interventions/Atlas/timing and issues prepare_request. */
 stageLifecycle?:{
  capability(action:NativeLifecycleAction['kind'],basis:StudioBasis,view:KernelConversion):StageLifecycleAvailability;
  request(intent:NativeLifecycleIntent,view:KernelConversion):Promise<unknown>;
  retry(intent:NativeLifecycleIntent,view:KernelConversion):Promise<unknown>;
  settle(intent:NativeLifecycleIntent,view:KernelConversion):Promise<unknown>;
  /** Genuine SAME-session lifecycle_cancel after actual S Cancel; no copied record. */
  cancel?(intent:NativeLifecycleCancelIntent,view:KernelConversion):Promise<unknown>;
 };
 /** Existing NativeFieldController/InstrumentSession barrier, not a second
  * transaction owner. It returns the complete real Kernel result. */
 nativeDocumentTransaction?:(action:()=>Promise<unknown>)=>Promise<unknown>;
 /** Actual controller Source route; SAME private session accounts ACK first. */
 sourceBootstrap?:(command:NativeStageBootstrapCommand)=>Promise<unknown>;
 sourceBootstrapRetry?:(intent:StageSourceBootstrapIntent)=>Promise<unknown>;
 sourceAuthorship?:(view:KernelConversion,actor:string)=>Promise<StageSourceAuthorship>;
 /** Pure native authoring intent read; SAME admitted owner barrier, no Field ordinal. */
 nativeAuthorshipRead?:(request:NativeStageAuthorshipRequest)=>Promise<unknown>;
 procedureAuthorship?:(source:NativeSceneSource,view:KernelConversion,compiler:ProcedureSources)=>Promise<ProcedureAuthorship>;
 /** Protected current native source/held-host producer. No callback presence
  * or saved definition is promoted to live capability. Root owns the exact
  * Cprime graph/currentness/ThreadPlan, issued producer_ref and host ordinal. */
 stageLibrary?:{
  definition?:NativeDefinitionPort;
  request(intent:StageLibraryIntent,retry:boolean,receive:(raw:unknown)=>Promise<void>):Promise<unknown>;
  refresh(basis:StudioBasis):Promise<StageCapability>;
  capability(name:StageCapabilityName,basis:StudioBasis):StageCapability;
 };
 stageProvider?:{
  capability(name:StageCapabilityName,basis:StudioBasis,view:KernelConversion):StageCapability;
  authorship(source:NativeSceneSource,view:KernelConversion,compiler:ProcedureSources):Promise<ProcedureAuthorship>;
  prepareLibrary(intent:StageLibraryIntent,view:KernelConversion,snapshot:WorkingSnapshot,compiler:ProcedureSources):Promise<{envelope:import('./proceduralProtocol.js').Envelope;preview:Omit<ProcedurePreview,'operation'>}>;
  retryLibrary(intent:StageLibraryIntent,view:KernelConversion,compiler:ProcedureSources,working:NativeWorking):Promise<StageLibraryReplay|null>;
  conduct(intent:StageRuntimeIntent,view:KernelConversion):Promise<StageRuntimeResult>;
  conductContext?(request:Readonly<Record<string,unknown>>,view:KernelConversion):NativeConductContext|Promise<NativeConductContext>;
 };

 /** Supplied by actual native receiving owners; UI does not invent instances. */
 proceduralParticipants?:()=>readonly Participant[];
 proceduralSources?:()=>readonly SourceBasis[];
 subscribeProcedural?:(listener:()=>void)=>()=>void;
 procedureProvider?:{
  templates():readonly NativeProcedureTemplate[];
  prepare(intent:ProcedureAuthoringIntent,view:KernelConversion,snapshot:WorkingSnapshot,source:ProcedureSources):Promise<{envelope:import('./proceduralProtocol.js').Envelope;preview:Omit<ProcedurePreview,'operation'>}>;
  action(intent:ProcedureActionIntent,view:KernelConversion,source:ProcedureSources):Promise<ProceduralRequest>;
  restore(mode:RestorationMode,basis:StudioBasis,view:KernelConversion):Promise<RestorationReceipt>;
 };
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
 nativeAuthorshipCurrent?:(basis:{expression_ref:string;scene_ref:string})=>boolean;
 /** Same controller holds stopped native capture through ordinary file I/O. */
 performanceSave?:<T>(save:()=>Promise<T>)=>Promise<T>;
 performanceFileRecovery?:<T>(save:()=>Promise<T>)=>Promise<T>;
 /** A followed Expression was adopted; `readThrough` when an act performs it. */
 followed?:(reference:string,readThrough:boolean)=>void;
}
export interface NativeStatus {
 text:string;failed:boolean;busy:boolean;
 identity:{ref:string;title:string;revision:number}|null;
 pending:string|null;retryOpen:boolean;
 file:{path:string;revision:string|number;document_revision?:number}|null;
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
export function isGenuineWorkspaceSwitch(state:{booted:boolean},initialising?:boolean):boolean{
 const first=!state.booted;state.booted=true;return initialising===undefined?!first:!initialising;
}
export function installNativeWorkspace(host:NativeWorkspaceHost){
 const scope=new URLSearchParams(location.search).get('mode')==='techne'?'techne':'expressions';
 const expressionRequest=(request:Record<string,unknown>):Promise<unknown>=>{
  const captured=clone(request);
  const procedural=captured.request as {operation?:unknown}|undefined;
  return (captured.operation==='edit'||captured.operation==='procedural'&&['control','authored_driver','read_authored_drivers'].includes(String(procedural?.operation)))&&host.nativeDocumentTransaction
   ?host.nativeDocumentTransaction(()=>nativeExpressionRequest(captured)):nativeExpressionRequest(captured);
 };

 const work:NativeWorking=new NativeWorking({expression:expressionRequest,file:nativeFileRequest,stageLibrary:host.stageLibrary?.request,stageDefinition:host.stageLibrary?.definition,selectedSceneSource:host.selectedSceneSource,sourceBootstrap:host.sourceBootstrap,sourceBootstrapRetry:host.sourceBootstrapRetry,selectedSceneOpen:host.selectedSceneOpen,selectedSceneRecover:host.selectedSceneRecover,selectedSceneAbandon:host.selectedSceneAbandon,
 lifecycle:async intent=>{const view=work.state?.view;if(!view||!host.stageLifecycle)throw Error('The actual native lifecycle factory/session is not paired');return host.stageLifecycle.request(intent,view);},
 lifecycleRetry:async intent=>{const view=work.state?.view;if(!view||!host.stageLifecycle)throw Error('The guarded original native lifecycle recovery owner is not paired');return host.stageLifecycle.retry(intent,view);},
 lifecycleSettlement:async intent=>{const view=work.state?.view;if(!view||!host.stageLifecycle)throw Error('The same-Source material-readback lifecycle settlement owner is not paired');return host.stageLifecycle.settle(intent,view);},
 lifecycleCancel:async intent=>{const view=work.state?.view;if(!view||!host.stageLifecycle?.cancel)throw Error('The actual Source cancellation acknowledgement route is not paired; native S Cancel remains retained');return host.stageLifecycle.cancel(intent,view);},
  checkpoint:(id,value)=>writeWorkingCheckpoint(id,value,scope),mint:()=>`expression:authored-${crypto.randomUUID()}`});
 const performanceActs=new NativePerformanceActs();

 const procedureSource=new ProcedureSources({compile:request=>{const document=work.state?.view?.document;if(request.command!=='discover'&&!document)throw Error('Open the original native Expression before producing its material');return nativeProcedureSourceRequest({operation:'procedural_compile',request:{...request,...(document?{basis:{expression_ref:document.expression_ref,document_revision:document.revision}}:{})} as unknown as Record<string,unknown>});}});
 const proceduralListeners=new Set<()=>void>();
 let nativeSourceAuthorshipReading:NativeAuthorshipReading|null=null;

 let busy=false,notice='',lastFailure=false,restoreGeneration=0,intentGeneration=0;const bootState={booted:false};
 let ownerIdle:Promise<void>=Promise.resolve();
 let queuedMutations=0;
 let lastAuthoredDriver:StageAuthoredDriverObservation|null=null;
 let lastAuthorshipReading:NativeAuthorshipReading|null=null;
 const currentProfiles=()=>{const current=work.state?.view,sceneId=host.snapshot().sceneId,binding=current?.bindings[sceneId];return current&&binding&&current.document.selection?.scene_ref===binding.scene_ref?declaredNativeAuthorshipProfiles(current,sceneId,host.proceduralSources?.()??[]):[];};

 const status=(text:string)=>{notice=text;update();};
 const update=()=>{
  for(const listener of proceduralListeners)listener();
  const state=work.state,doc=state?.view?.document;
  host.correspondence(nativeConnections(state?.view),doc?.selection?.relation_ref??null);
  const binding=state?.view?.bindings[host.snapshot().sceneId];
  host.status?.({text:notice,failed:lastFailure,busy,
   identity:doc?{ref:doc.expression_ref,title:doc.title,revision:doc.revision}:null,
   pending:state?.pending?.kind??null,retryOpen:!!opens?.reference,
   file:state?.file?{path:state.file.location.path,revision:state.file.revision,document_revision:state.file.document_revision}:null,
   page:binding?{page:binding.page,count:binding.page_count,shown:binding.occurrences.length,total:binding.member_refs.length,hidden:binding.hidden_refs.length}:null});
 };
 const run=async(task:()=>Promise<void>,reportCurrent:()=>boolean=()=>true):Promise<boolean>=>{
  if(busy)return false;busy=true;
  let releaseOwner!:()=>void;ownerIdle=new Promise<void>(resolve=>{releaseOwner=resolve;});
  lastFailure=false;update();status('Reading or saving through the native owner…');
  try{await task();return true;}catch(error){if(reportCurrent()){lastFailure=true;status(error instanceof Error?error.message:String(error));host.toast(notice,7000);}return false;}
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
  try{
   const listed=await worldRequest<{acts?:{act_ref?:unknown;expression_ref?:unknown;phase?:unknown;resident_currentness?:unknown}[]}>({operation:'act_list',expression_ref:reference});
   if(!performedByLiveAct(listed.acts??[],reference))return false;
   const document=(await inspectReference(reference)).document;
   for(const act of listed.acts??[]){
    if(act.expression_ref!==reference||!['running','held'].includes(String(act.phase)))continue;
    if(act.phase==='running'||act.resident_currentness||typeof act.act_ref!=='string'||!await performanceActs.isSavedCustody(act.act_ref,document).catch(()=>false))return true;
   }
   return false;
  }
  catch{return false;}
 };
 const localEdits=(view:KernelConversion)=>hasLocalEdits(loadedVersion,host.version(),prepareCompositionEdit(view,host.snapshot().journey).changes.length);
 const inspectReference=async(reference:string)=>nativeOwnerSnapshot(await nativeExpressionRequest({operation:'inspect',expression_ref:reference}),reference);

 const followOpen=async(reference:string)=>{
  if(!reference.startsWith('expression:'))throw new Error('Choose a native Expression reference');
  const captured=captureNativeAdoption(host,()=>restoreGeneration),generation=++followGeneration;opens.cancel();
  const current=()=>generation===followGeneration&&captured();
  const listed=await listKernelExpressions();requireAdoption(current);
  // A fresh process has no in-memory graph. Reopen the exact acknowledged
  // checkpoint through the owner before following it; retain its local draft
  // and attached native file, rather than deriving an unrelated browser view.
  if(!listed.some(row=>row.expression_ref===reference)){
   const recovered=await readWorkingDraft(reference,scope);requireAdoption(current);
   if(recovered?.record.view){
    const performing=await actPerforms(reference);requireAdoption(current);
    if(host.shouldRetainDraft?.()!==false)await writeDraft(clone(host.snapshot().journey));requireAdoption(current);
    const view=await work.reopenCheckpoint(recovered.record,recovered.journey,current);requireAdoption(current);
    readThrough=performing?reference:null;restoreGeneration++;selections.cancel();host.load(view);markLoaded();host.followed?.(reference,!!readThrough);
    status(`Reopened ${view.document.title} through its native owner. Its Scene, selection, attached file and separate unsaved draft were retained.`);update();return;
   }
  }
  const native=await inspectReference(reference),raw=native.document;
  requireAdoption(current);
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
  requireAdoption(current);
  const view=await work.adopt(raw,native.file,current);
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
  const native=await inspectReference(reference);await adopt(native.document,current,native.file);
 };
 const opens=new NativeOpenIntent({
  idle:async()=>{while(busy)await ownerIdle;},
  open:(reference,current)=>run(()=>openReference(reference,current)),
  changed:()=>{update();},
 });
 const requestOpen=(reference:string)=>{
  if(!reference.startsWith('expression:')){status('Choose a native Expression reference');return Promise.resolve(false);}
  intentGeneration++; // Explicit opening wins over boot before any owner reply.
  return opens.submit(reference,captureNativeAdoption(host,()=>restoreGeneration));
 };
 const loadFile=async(path:string,observed?:NativeFileOpenBasis)=>{
  const current=captureNativeAdoption(host,()=>restoreGeneration),result=await nativeFileRequest({operation:'open',path,...(observed?{observed:clone(observed)}:{})}) as {document:KernelExpressionDocument;file:NativeFile};
  if(!result?.document||!result.file)throw new Error('The native file was not returned');
  await adopt(result.document,current,{location:result.file.location,revision:result.file.revision,expression_ref:result.document.expression_ref,document_revision:result.document.revision});
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
 const savePerformance=<T>(save:()=>Promise<T>):Promise<T>=>(work.state?.pending?.kind==='file'||performanceActs.needsReconciliation)&&host.performanceFileRecovery?host.performanceFileRecovery(save):host.performanceSave?host.performanceSave(save):save();

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
 const beginSwitch=()=>{
  intentGeneration++;opens.cancel();restoreGeneration++;selections.cancel();
  return {generation:restoreGeneration,intent:intentGeneration};
 };
 const retainPerformanceAct=async()=>{
  const view=work.acknowledgedView,local=host.snapshot(),binding=view?.bindings[local.sceneId];
  const scene=view?.document.scenes.find(row=>row.scene_ref===binding?.scene_ref);
  if(!scene?.performance)return;
  if(!view||!binding||work.state?.pending||localEdits(view)||view.document.selection?.scene_ref!==binding.scene_ref)throw Error('Reconcile the actual selected performance Document before its native Act and file save.');
  const original=clone(view.document),version=host.version(),generation=restoreGeneration,intent=intentGeneration;
  const current=()=>{const now=work.acknowledgedView;return !!now&&host.version()===version&&restoreGeneration===generation&&intentGeneration===intent&&host.snapshot().sceneId===local.sceneId&&!work.state?.pending&&!localEdits(now)&&JSON.stringify(now.document)===JSON.stringify(original);};
  const retained=await performanceActs.retain(original,binding.scene_ref,'human:expressions-app',current);
  if(!current())throw Error('The native Act retained its original edition; the selected work changed before file save.');
  return retained;
 };


 return {
  /** Retry the last native open that failed (e.g. a revision conflict). */
  retryOpen:()=>{intentGeneration++;return opens.retry();},
  /** Inspect and settle an interrupted native operation. */
  resolvePending,
  /** Re-perform an interrupted file save with its retained identity. */
  retryFile:()=>savePerformance(()=>guarded(async()=>{const file=await work.retryFile();status(`Verified the retained file save: ${file.location.path}.`);})),
  /** Page the loaded members of a Scene larger than the render budget. */
  page:(delta:number)=>guarded(()=>changePage(delta)),
  /** Read and qualify a complete unchanged saved basis without rewriting it. */
  confirmSaved:async():Promise<NativeFile|undefined>=>{
   const snapshot=clone(host.snapshot()),captured=captureNativeAdoption(host,()=>restoreGeneration);
   const current=()=>captured()&&host.snapshot().sceneId===snapshot.sceneId&&host.snapshot().entityId===snapshot.entityId;
   let file:NativeFile|undefined;
   const succeeded=await mutate(async()=>{file=await work.confirmSaved(snapshot,current);});
   if(!succeeded)throw Error(notice||'The existing saved file was not qualified');
   return file;
  },
  /** Write the working composition to a Central file and read it back. */
  saveFile:(folder:string,name:string)=>savePerformance(()=>{const snapshot=clone(host.snapshot()),version=host.version();return guarded(async()=>{
   await retainSubmitted(snapshot);
   await retainPerformanceAct();
   const file=await work.saveFile(snapshot,{parent_path:folder,name});
   status(`Saved and read back ${file.location.path}.${host.version()!==version?' Newer local edits are still unsaved.':''}`);
  });}),
  status:()=>update(),
  open:requestOpen,
  cancelOpen:()=>{opens.cancel();update();},
  openFile:(path:string,observed?:NativeFileOpenBasis)=>{intentGeneration++;return run(()=>loadFile(path,observed));},
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
  async changed(journey:Journey,bootCurrent?:()=>boolean,switchBasis?:{generation:number;intent:number}):Promise<number|undefined>{
   const switching=isGenuineWorkspaceSwitch(bootState,!!bootCurrent);
   if(!switching&&(bootCurrent?.()!==true||intentGeneration!==0||busy||work.state?.view||opens.reference))return;
   if(switching){const basis=switchBasis??beginSwitch();if(basis.generation!==restoreGeneration||basis.intent!==intentGeneration)return;}
   const generation=restoreGeneration,intent=intentGeneration,captured=captureNativeAdoption(host,()=>restoreGeneration),current=()=>captured()&&intentGeneration===intent&&(!bootCurrent||bootCurrent());
   if(!current())return;work.detach();host.correspondence({},null);
   try{
    const record=await readWorkingCheckpoint(journey.id,scope) as import('./nativeWorking.js').NativeWorkingRecord|undefined;
    if(!current())return;
    if(record?.view){
     while(busy)await ownerIdle;if(!current())return;
     const reopened=await run(async()=>{
      const view=await work.reopenCheckpoint(record,journey,current);requireAdoption(current);
      restoreGeneration++;selections.cancel();host.load(view,true);markLoaded();readThrough=null;
      status('Reopened the acknowledged native world; local edits and interrupted operations were retained.');update();
     },current);
     if(!reopened)return;
    }else{if(record)work.restore(record,journey);update();}
    return host.version();
   }
   catch(error){if(generation===restoreGeneration&&current()){lastFailure=true;status(`Native recovery was not adopted: ${error instanceof Error?error.message:String(error)}`);update();}}
  },
  inspect(){const state=work.inspect();return {native_ref:state.native_ref,revision:state.revision,file:state.file,pending:state.pending,notice,failed:lastFailure,busy,notes:state.notes,bindings:state.bindings};},
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
  nativeView:()=>work.acknowledgedView,
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
  follow:async(reference:string):Promise<boolean>=>{intentGeneration++;while(busy)await ownerIdle;return run(()=>followOpen(reference));},
  /** Re-read a followed Expression. Clean: adopt the kernel's newer revision
   * (never commits). Edited: keep the edits unsaved and disclose the newer
   * revision. Not open: follow it. */
  refreshReference:async(reference:string):Promise<boolean>=>{while(busy)await ownerIdle;return run(async()=>{
   const current=work.state?.view;
   if(!current||current.document.expression_ref!==reference){await followOpen(reference);return;}
   const native=await inspectReference(reference),raw=native.document;
   const step=refreshStep({openRef:current.document.expression_ref,reference,localRevision:current.document.revision,kernelRevision:raw.revision,edited:localEdits(current),pending:!!work.state?.pending});
   if(step.kind==='current')return;
   if(step.kind==='follow'){await followOpen(reference);return;}
   if(step.kind==='disclose'){
    lastFailure=true;
    status(`${raw.title} moved to revision ${step.kernelRevision}; this view is on ${step.localRevision} with unsaved edits, which were kept. Save or reopen to reconcile.`);
    host.toast(notice,7000);return;
   }
   const generation=++followGeneration;
   const view=await work.adopt(raw,native.file??work.state?.file,()=>generation===followGeneration);
   restoreGeneration++;selections.cancel();host.load(view);markLoaded();host.followed?.(reference,readThrough===reference);update();
  });},
  nativeSubject,
  construction,
  // Persist the current composition — its scenes, members and relations —
  // to the native Expression through the owner (kernel scene_create/edit with
  // the expected-revision basis check; a stale reply is refused, never
  // retried). This is the native scene act M3′ commits to, not a browser save.
  commit:async()=>savePerformance(async()=>{
   // A focus write may still be acknowledging the click that began editing.
   // Keep this submitted draft and wait for that owner operation; busy is not
   // a failed save. Navigation still invalidates work addressed to the old doc.
   const snapshot=clone(host.snapshot()),version=host.version();
   return mutate(async()=>{
    await retainSubmitted(snapshot);
   await retainPerformanceAct();
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
     const file=await work.saveFile(snapshot,{location:destination.location,revision:destination.revision});
     status(`Saved and read back ${file.location.path}.${host.version()!==version?' Newer local edits remain a separate draft.':''}`);
    }else{
     const doc=await work.commit(snapshot);
     status(`Saved · native revision ${doc.revision} — ${doc.scenes.length} scene${doc.scenes.length===1?'':'s'}, ${Object.keys(doc.entities).length} member${Object.keys(doc.entities).length===1?'':'s'} in the native Expression.${host.version()!==version?' Newer local edits remain a separate draft.':''}`);
    }
   });
  }),

beginSwitch,
intentGeneration:()=>intentGeneration,
idle:async()=>{while(busy)await ownerIdle;},
nativeSourceAuthorshipCustody:()=>nativeSourceAuthorshipReading===null?null:clone(nativeSourceAuthorshipReading),
nativeSourceAuthorshipReading:()=>{
   const reading=nativeSourceAuthorshipReading,view=work.acknowledgedView;
   if(!reading||!view||!host.nativeAuthorshipCurrent?.(reading.basis))return null;
   const local=host.snapshot(),binding=view.bindings[local.sceneId];
   if(view.document.expression_ref!==reading.basis.expression_ref||view.document.selection?.scene_ref!==reading.basis.scene_ref||binding?.scene_ref!==reading.basis.scene_ref)return null;
   // Bootstrap/record CAS may advance revisions. This exact original intent
   // remains historical; only same current owner/Scene may disclose it here.
   return clone(reading);
  },
nativeSourceAuthorship:async(sceneId:string):Promise<Record<string,unknown>>=>{
   const view=work.acknowledgedView;
   if(!view||!host.nativeAuthorshipRead||localEdits(view)||host.snapshot().sceneId!==sceneId)throw Error('The actual native selected-Scene authored profile/thread/ground issuer is unavailable or the local source changed.');
   const request=sourceAuthorshipRequest(view,sceneId,'human:expressions-app');
   const original=clone(view.document),version=host.version();
   const raw=await host.nativeAuthorshipRead(request),now=work.acknowledgedView;
   if(!now||host.version()!==version||host.snapshot().sceneId!==sceneId||JSON.stringify(now.document)!==JSON.stringify(original)||localEdits(now))throw Error('The native authored intent returned after its complete current Document or local selection changed.');
   const reading=validateNativeAuthorshipReading(request,raw);
   nativeSourceAuthorshipReading=clone(reading);
   return clone(reading.authorship) as unknown as Record<string,unknown>;
  },
acceptNativeSource:async(result:unknown,expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number},current:()=>boolean):Promise<KernelConversion>=>{
   let view:KernelConversion|undefined;
   const succeeded=await mutate(async()=>{const before=work.acknowledgedView;if(!before||localEdits(before)||!current())throw Error('The original source reply remains native; the local Document changed before adoption.');view=await work.acceptNativeSource(result,expected,current);update();});
   if(!succeeded||!view)throw Error(notice||'The original source transaction requires reconciliation.');return view;
  },
preparePerformanceView:async():Promise<KernelConversion>=>{
   let view:KernelConversion|undefined;
   const succeeded=await mutate(async()=>{const before=work.state?.view;if(!before)throw Error('Open a native Expression before playing.');view=await flushDraft(before);update();});
   if(!succeeded||!view)throw Error(notice||'The current native draft was not prepared.');return view;
  },
editNativePerformance:async(expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number},operations:import('./native-performance/scoreProtocol.js').NativeScoreOperation[],current:()=>boolean):Promise<KernelConversion>=>{
   let view:KernelConversion|undefined;
   const succeeded=await mutate(async()=>{const before=work.state?.view;if(!before||localEdits(before)||!current())throw Error('The local Document changed before its native score edit.');view=await work.editNativePerformance(expected,operations,current);update();});
   if(!succeeded||!view)throw Error(notice||'The original native score edit is retained for reconciliation.');return view;
  },
resolveNativePerformanceEdit:async(current:()=>boolean):Promise<KernelConversion>=>{
   let view:KernelConversion|undefined;
   const succeeded=await mutate(async()=>{const before=work.state?.view;if(!before||localEdits(before)||!current())throw Error('The local Document changed before score reconciliation.');view=await work.resolveNativePerformanceEdit(current);update();});
   if(!succeeded||!view)throw Error(notice||'The exact score edit remains pending; no edit was retried.');return view;
  },
acceptNativePerformance:async(result:unknown,expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number},current:()=>boolean):Promise<KernelConversion>=>{
   let view:KernelConversion|undefined;
   const succeeded=await mutate(async()=>{
    const before=work.state?.view;if(!before||localEdits(before)||!current())throw Error('The performance reply is retained natively; the local Document changed before adoption.');
    view=await work.acceptNativePerformance(result,expected,current);update();
   });
   if(!succeeded||!view)throw Error(notice||'The original native performance reply was not adopted.');return view;
  },
nativeExpressionRequest:expressionRequest,
nativeConductContext:async(request:Readonly<Record<string,unknown>>):Promise<NativeConductContext>=>{
   const current=work.state?.view;if(!current)throw new Error('Open the original accepted native Expression before procedural conduct');
   const version=host.version(),generation=restoreGeneration,selected=clone(host.snapshot());
   if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw new Error('Save the retained draft before admitting native procedural conduct');
   if(request.action==='source_bootstrap'){const input=request.input as {schema?:string;scene_ref?:string;authorship?:unknown};if(input?.schema!=='oi.expression-procedural-source-bootstrap-intent/v1'||!current.document.scenes.some(scene=>scene.scene_ref===input.scene_ref))throw Error('Source bootstrap names another actual native Scene');validateStageSourceAuthorship(input.authorship);return qualifyWorkspaceConductContext(current,work.state?.view,{expression_ref:current.document.expression_ref,document_revision:current.document.revision,source_producer_ref:null},host.version()===version&&generation===restoreGeneration&&sameNative(host.snapshot(),selected));}
   const reader=host.stageProvider?.conductContext;if(!reader)throw new Error('The protected native SourceCompile conduct context is not paired');
   const context=await reader(clone(request),current);
   return qualifyWorkspaceConductContext(current,work.state?.view,context,
    host.version()===version&&generation===restoreGeneration&&sameNative(host.snapshot(),selected));
  },
proceduralParticipants:()=>clone(host.proceduralParticipants?.()??[]),
proceduralSources:()=>clone(currentProfiles()),
subscribeProcedural:(listener:()=>void)=>{
   proceduralListeners.add(listener);const unsubscribe=host.subscribeProcedural?.(listener);
   return ()=>{proceduralListeners.delete(listener);unsubscribe?.();};
  },
procedural:async(request:ProceduralRequest):Promise<unknown>=>{
   let result:unknown;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view;if(!current)throw Error('Open a native Expression before inspecting its procedures');
    if(['prepare','commit','cancel'].includes(request.operation)&&prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw Error('Retain this prepared operation; reconcile the unsaved draft before applying another native mutation');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    result=await work.procedural(clone(request));
    const view=work.state?.view;
    if(['prepare','commit','cancel'].includes(request.operation)&&view){
     if(!adoption())throw Error('The procedural operation returned natively; newer local text remains in its retained draft');
     restoreGeneration++;selections.cancel();host.load(view,true);update();
    }
   });
   if(!succeeded)throw Error(notice||'The native procedure did not return');return result;
  },
pendingSelectedScene:():PendingNativeSelectedScene|null=>{const pending=work.state?.pending;return pending?.kind==='native-selected-scene-open'?clone(pending):null;},
selectedSceneOpeningReason:():string|null=>{
   const view=work.state?.view;if(!view)return 'Open the current native Expression before its retained Scene World.';
   if(work.state?.pending)return 'The full original native operation remains retained; recover or abandon its exact opening before another request.';
   if(!host.selectedSceneOpen)return 'The actual selected-Scene native opening controller is not paired.';
   return selectedSceneSourceReason(view,host.snapshot().sceneId);
  },
sourceBootstrapReason:():string|null=>{
   const view=work.state?.view;if(!view)return 'Open the current native Expression before Source bootstrap.';
   if(work.state?.pending&&work.state.pending.kind!=='native-source-bootstrap')return 'The full original native operation remains retained; no Source request was substituted.';
   if(!host.sourceBootstrap||!host.sourceBootstrapRetry||!host.sourceBootstrapReason)return 'The selected-Scene SAME-session Source request/guarded recovery owner is not paired.';
   return host.sourceBootstrapReason(view);
  },
openSelectedScene:async(recover=false,binding?:import('./native-field/controller').NativeSelectedSourceBinding):Promise<SelectedSceneOpening>=>{
   let result:SelectedSceneOpening|undefined;const succeeded=await mutate(async()=>{
    let view=work.state?.view;if(!view)throw Error('Open the original native Expression before its selected Scene World');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration),snapshot=clone(host.snapshot());
    const pending=work.state?.pending;
    if(recover){
     if(pending?.kind!=='native-selected-scene-open')throw Error('Recovery requires the full original retained selected Scene opening');
     if(prepareCompositionEdit(view,snapshot.journey).changes.length)throw Error('New local text remains retained; reconcile it before recovering the original opening');
    }else{
     if(pending)throw Error('The original native operation remains retained; another World was not composed');
     view=await flushDraft(view);if(!adoption()||!sameNative(snapshot,host.snapshot()))throw Error('Saving the native draft completed while newer local input arrived; selected opening was not submitted');
    }
    const original=clone(view.document),request=recover?(pending as PendingNativeSelectedScene).request:selectedSceneRequest(view,snapshot.sceneId);
    const current=()=>adoption()&&sameNative(host.snapshot(),snapshot)&&sameNative(work.state?.view?.document,original);
    if(binding&&(!binding.current()||!sameNative(binding.capture(),request)))throw Error('The actual instrument binding differs from the current original native selection');
    const port=recover?host.selectedSceneRecover:host.selectedSceneOpen;
    result=await work.openSelectedScene(clone(request),current,recover,binding?(input,receive)=>{if(!port)throw Error('The actual selected instrument opening controller is unavailable');return port(input,receive,binding);}:undefined);
    if(!current())throw Error('Actual native opening returned after newer local input arrived; its original intent was retained');
    status('Selected native World admitted. Author the original Source, then explicitly requalify its actual current CAS after binding adoption. Body, GPU and sound reception remain separate.');update();
   });if(!succeeded||!result)throw Error(notice||'The original selected native Scene opening is retained');return clone(result);
  },
selectedSceneSourceRetentionReason:():string|null=>{
   const view=work.state?.view;if(!view)return 'Open the actual native Expression before saving its World source.';
   if(!host.selectedSceneSource)return 'The actual SAME-session World source getter is not paired.';
   return host.sourceBootstrapReason?.(view)??(host.sourceBootstrapReason?null:'The actual selected Scene owner is unobserved.');
  },
selectedSceneSourceAssetPresent:():boolean=>!!work.state?.view&&selectedSourceAssetPresent(work.state.view),
pendingSelectedSceneSource:():PendingNativeSelectedSceneSource|null=>{const pending=work.state?.pending;return pending?.kind==='native-selected-scene-source'?clone(pending):null;},
retainSelectedSceneSource:async(actor='human:expressions-app',recover=false,adopted?:(view:KernelConversion)=>void):Promise<SelectedSceneSourceReply>=>{
   let result:SelectedSceneSourceReply|undefined;const succeeded=await mutate(async()=>{
    let view=work.state?.view;if(!view)throw Error('Open the actual native Expression before saving its World source');
    const pending=work.state?.pending;
    if(recover){if(pending?.kind!=='native-selected-scene-source')throw Error('No original source observation is retained');}
    else{if(pending)throw Error('The original native operation remains retained');const before=clone(view.document);view=await flushDraft(view);if(!sameNative(before,view.document))throw Error('Saving the draft changed DocumentCAS; explicitly use its current accepted Scene before source retention');}
    const snapshot=clone(host.snapshot()),version=host.version(),adoption=captureNativeAdoption(host,()=>restoreGeneration),original=clone(view.document);
    const selection=recover?(pending as PendingNativeSelectedSceneSource).selection:selectedSceneRequest(view,snapshot.sceneId),originalActor=recover?(pending as PendingNativeSelectedSceneSource).actor:actor;
    const current=()=>adoption()&&host.version()===version&&sameNative(host.snapshot(),snapshot)&&sameNative(work.state?.view?.document,original);
    result=await work.retainSelectedSceneSource(selection,originalActor,current,recover);
    // Working changed only its accepted native basis; the normal host keeps
    // uncommitted scalar/source text through its existing adoption locks.
    const accepted=work.state?.view;if(!accepted||!adoption()||host.version()!==version||!sameNative(host.snapshot(),snapshot))throw Error('The actual World source was saved natively; newer local text remains retained');
    if(!sameNative(accepted.document,original)){restoreGeneration++;selections.cancel();host.load(accepted,true);}
    // Notify only after the original receipt passed every Working/adoption
    // fence and the same synchronous host load. This is a local version
    // acknowledgement, not Source qualification or a second native getter.
    adopted?.(accepted);
    status('The actual native World source is retained in its original Scene. Capture current Source authorship and requalify through this same owner; body, GPU and sound reception remain separate.');update();
   });if(!succeeded||!result)throw Error(notice||'The original World source observation remains retained');return clone(result);
  },
abandonSelectedScene:async():Promise<unknown>=>{
   let result:unknown;const succeeded=await mutate(async()=>{result=await work.abandonSelectedScene();status('The actual native owner acknowledged closure of the original selected Scene opening. Typed Source fields remain retained.');update();});
   if(!succeeded)throw Error(notice||'The original selected native Scene closure remains unobserved');return result;
  },
pendingSourceBootstrap:():PendingNativeSourceBootstrap|null=>{const pending=work.state?.pending;return pending?.kind==='native-source-bootstrap'?clone(pending):null;},
captureSourceBasis:async():Promise<StudioBasis>=>{
   let result:StudioBasis|undefined;const succeeded=await mutate(async()=>{let current=work.state?.view;if(!current)throw Error('Open a native Expression before capturing Source intent');if(work.state?.pending?.kind==='native-source-bootstrap'){await work.requalifySourceBootstrap();current=work.state!.view!;}else if(work.state?.pending)throw Error('The original native operation is retained; settle its standing before capturing another Source basis');const adoption=captureNativeAdoption(host,()=>restoreGeneration);current=await flushDraft(current);if(!adoption())throw Error('The native draft saved while newer local text arrived; its current Source basis was not substituted');const snapshot=host.snapshot(),binding=current.bindings[snapshot.sceneId];if(!binding)throw Error('The current Scene has no exact native occurrence');host.load(current,true);update();result={expression_ref:current.document.expression_ref,document_revision:current.document.revision,scene_ref:binding.scene_ref};});if(!succeeded||!result)throw Error(notice||'The current accepted Source basis could not be captured');return result;
  },
sourceAuthorship:async(actor:string):Promise<StageSourceAuthorship>=>{
   const draft=clone(host.snapshot()),version=host.version();let result:StageSourceAuthorship|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,reader=host.sourceAuthorship;if(!current||!reader&&!host.nativeAuthorshipRead)throw Error('The original native Source authorship reader is not paired; explicit fields remain editable');
    const binding=current.bindings[draft.sceneId];if(!binding||current.document.selection?.scene_ref!==binding.scene_ref)throw Error('The selected native Scene differs from your authoring view; retain its typed intent and select the exact native Scene before reading');
    if(work.state?.pending)throw Error('The original native operation is retained; settle its standing before reading another Source authoring intent');
    if(host.version()!==version||!sameNative(draft,host.snapshot())||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('Save/read the actual accepted selected Scene before loading Source authorship; unsaved editor text remains retained');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration),before=clone(current.document);
    if(!actor.trim())throw Error('Enter the original reader actor before requesting native Source authorship');
    let reading:NativeAuthorshipReading|null=null;
    if(host.nativeAuthorshipRead){const request=sourceAuthorshipRequest(current,draft.sceneId,actor);reading=validateNativeAuthorshipReading(request,await host.nativeAuthorshipRead(request));result=validateStageSourceAuthorship(reading.authorship);}else result=validateStageSourceAuthorship(await reader!(current,actor));
    if(!adoption()||host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(work.state?.view?.document,before))throw Error('The original Source or authoring view changed while its native fields were returning');
    lastAuthorshipReading=reading;
   });if(!succeeded||!result)throw Error(notice||'The native Source authoring intent was unavailable');return result;
  },
authoringReading:(kind:'source_authorship'|'procedure_authorship'):NativeAuthorshipReading|null=>{
   const current=work.state?.view,snapshot=host.snapshot(),reading=lastAuthorshipReading;if(!current||!reading)return null;
   try{const request=selectedSceneRequest(current,snapshot.sceneId),schema=kind==='source_authorship'?'oi.expression-procedural-source-authorship/v1':'oi.expression-procedural-procedure-authorship/v1';return reading.schema===schema&&sameNative(reading.basis,request)?clone(reading):null;}catch{return null;}
  },
bootstrapSource:async(intent:StageSourceBootstrapIntent):Promise<StageSourceBootstrapOutcome>=>{
   const captured=clone(intent),command=stageBootstrapCommand(captured);let result:StageSourceBootstrapOutcome|undefined;
   if(!work.state?.view||!selectedSourceAssetPresent(work.state.view))throw Error('Save this actual admitted World source asset before procedural Source qualification. Original typed authorship remains retained.');
   const succeeded=await mutate(async()=>{let current=work.state?.view;if(!current)throw Error('Open the original native Source Expression');const pending=work.state?.pending;
    if(pending?.kind==='native-source-bootstrap'&&!sameNative(pending.intent,captured))throw Error('The original full Source intent is retained; another operation ID/input cannot replace it');
    if(!pending){const before=clone(current.document);current=await flushDraft(current);if(!sameNative(current.document,before))throw Error('Saving the actual draft advanced DocumentCAS. Typed Source intent remains original; capture the new accepted Scene explicitly');}
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);result=await work.bootstrapSource(captured);const view=work.state?.view;
    if(!view||!adoption())throw Error('Source returned natively while newer local text arrived; exact receipt remains with native owner and draft was retained');restoreGeneration++;selections.cancel();host.load(view,true);update();
   });if(!succeeded||!result)throw Error(notice||'The original native Source request did not return');return result;
  },
pendingNativeControl:():PendingNativeControl|null=>{const pending=work.state?.pending;return pending?.kind==='native-control'?clone(pending):null;},
readNativeDriver:async(input:StudioNativeDriverIntent):Promise<NativeParameterDriverReading>=>{
   const captured=clone(input),draft=clone(host.snapshot()),version=host.version();let result:NativeParameterDriverReading|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view;if(!current)throw Error('Open the original native Expression before reading its control');
    const snapshot:StudioSnapshot={view:current,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]};
    if(host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(studioBasis(snapshot),captured.basis)||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('The captured control basis or authored draft changed; save/read its original native Source before control');
    const sceneId=Object.entries(current.bindings).find(([,b])=>b.scene_ref===captured.address.scene_ref)?.[0],scene=draft.journey.scenes.find(s=>s.id===sceneId);if(!scene||!sceneId)throw Error('The captured control Scene is absent');
    const context={expression_ref:current.document.expression_ref,scene_ref:captured.address.scene_ref!,occurrences:Object.fromEntries(current.bindings[sceneId].occurrences.map(o=>[o.view_entity_id,o.entity_ref]))};
    const capability=controlCapabilities(scene,context).find(c=>c.target===captured.target&&sameNative(c.address,captured.address));if(!capability)throw Error('The actual control Registry target is unavailable');
    const request=nativeDriverRequest(snapshot,capability),raw=await expressionRequest({operation:'procedural',request:clone(request)}) as {schema?:unknown;native_parameter_driver?:unknown};
    if(raw?.schema!=='oi.expression-procedural/v1')throw Error('The installed native driver reader is unavailable');
    result=validateNativeDriver(snapshot,request,raw.native_parameter_driver);
    if(host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(work.state?.view?.document,current.document))throw Error('The native driver returned after its original Document/draft changed; retain the control text');
   });
   if(!succeeded||!result)throw Error(notice||'The native driver read was not acknowledged');return result;
  },
applyNativeControl:async(input:StudioNativeControlIntent):Promise<NativeControlResult>=>{
   const captured=clone(input),draft=clone(host.snapshot()),version=host.version();let result:NativeControlResult|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view;if(!current)throw Error('Open the original native Expression before control');
    const snapshot:StudioSnapshot={view:current,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]};
    if(host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(studioBasis(snapshot),captured.basis)||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('The original control CAS or authored draft changed; its full typed intent is retained without rebasing');
    const sceneId=Object.entries(current.bindings).find(([,b])=>b.scene_ref===captured.address.scene_ref)?.[0],scene=draft.journey.scenes.find(s=>s.id===sceneId);if(!scene||!sceneId)throw Error('The exact native control Scene is absent');
    const context={expression_ref:current.document.expression_ref,scene_ref:captured.address.scene_ref!,occurrences:Object.fromEntries(current.bindings[sceneId].occurrences.map(o=>[o.view_entity_id,o.entity_ref]))},capability=controlCapabilities(scene,context).find(c=>c.target===captured.target&&sameNative(c.address,captured.address));if(!capability)throw Error('The actual control Registry target is unavailable');
    const readRequest=nativeDriverRequest(snapshot,capability),read=await expressionRequest({operation:'procedural',request:readRequest}) as {schema?:unknown;native_parameter_driver?:unknown};
    if(read?.schema!=='oi.expression-procedural/v1')throw Error('The installed native driver reader is unavailable');
    const driver=validateNativeDriver(snapshot,readRequest,read.native_parameter_driver),request=nativeControlRequest(snapshot,capability,captured,driver);
    if(host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(work.state?.view?.document,current.document))throw Error('The original control Source returned after this draft changed');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);result=await work.control({kind:'native-control',intent:captured,request,driver});
    if(result.view){if(!adoption())throw Error('The control was applied natively; newer local text remains retained. Reopen its exact native composition when ready.');restoreGeneration++;selections.cancel();host.load(work.state!.view!,true);update();}
   });
   if(!succeeded||!result)throw Error(notice||'Native control standing is unknown; retain the original operation and inspect/retry through its owner');return result;
  },
retryNativeControl:async():Promise<NativeControlResult>=>{
   let result:NativeControlResult|undefined;const succeeded=await mutate(async()=>{
    const current=work.state?.view;if(!current)throw Error('Open the original native Expression before retrying its control');
    if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw Error('New local work is retained; reconcile it before adopting the original native control');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);result=await work.retryControl();
    if(result.view){if(!adoption())throw Error('The original control returned natively; newer local text remains retained');restoreGeneration++;selections.cancel();host.load(work.state!.view!,true);update();}
   });if(!succeeded||!result)throw Error(notice||'The original control remains unknown and retained');return result;
  },
pendingAuthoredDriver:():PendingNativeAuthoredDriver|null=>{const pending=work.state?.pending;return pending?.kind==='native-authored-driver'?clone(pending):null;},
authoredDriverCapability:(kind:AuthoredDriverAction['kind'],request:NativeAuthoredDriverReadRequest,reading:NativeAuthoredDriverReadReply):StageAuthoredDriverAvailability=>{
   const view=work.state?.view;if(!view||!host.authoredDriverCapability)return {state:'unavailable',reason:'The actual native authored-driver Source constructor/receiver capability is not paired.'};
   if(view.document.expression_ref!==request.expression_ref||view.document.revision!==request.expected_revision)return {state:'unavailable',reason:'The original native driver Document/Source basis changed; retain typed input.'};
   const snapshot=authoredDriverSnapshot(view,request.scene_ref);validateAuthoredDriverRead(snapshot,request,reading);return host.authoredDriverCapability(kind,clone(request),clone(reading),view);
  },
readAuthoredDrivers:async(input:NativeAuthoredDriverReadRequest):Promise<NativeAuthoredDriverReadReply>=>{
   if(!host.authoredDriverCapability)throw Error('The Source11 native authored-driver reader and constructor are not adopted in the current Source6 host. Typed intent is retained.');
   const request=clone(input),draft=clone(host.snapshot()),version=host.version();let result:NativeAuthoredDriverReadReply|undefined;
   const succeeded=await mutate(async()=>{let current=work.state?.view;if(!current)throw Error('Open the original native Expression before its Source driver read');if(work.state?.pending)throw Error('The original native operation remains retained; resolve its exact standing before a fresh driver read');const before=clone(current.document);current=await flushDraft(current);if(!sameNative(before,current.document)||host.version()!==version||!sameNative(draft,host.snapshot()))throw Error('Saving the draft changed the original driver CAS; typed input stays retained for explicit fresh read');
    if(request.expression_ref!==current.document.expression_ref||request.expected_revision!==current.document.revision)throw Error('The original Source driver read CAS changed; no implicit rebase');
    const snapshot=authoredDriverSnapshot(current,request.scene_ref),raw=await expressionRequest({operation:'procedural',request:clone(request)});if(host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(work.state?.view?.document,current.document))throw Error('Current native Source/draft changed while drivers returned');result=validateAuthoredDriverRead(snapshot,request,raw);
   });if(!succeeded||!result)throw Error(notice||'The actual Source driver reader is unavailable');return result;
  },
applyAuthoredDriver:async(input:NativeAuthoredDriverIntent,read:NativeAuthoredDriverReadReply):Promise<StageAuthoredDriverObservation>=>{
   const intent=clone(input),reading=clone(read),draft=clone(host.snapshot()),version=host.version();let result:StageAuthoredDriverObservation|undefined;
   const succeeded=await mutate(async()=>{const current=work.state?.view;if(!current)throw Error('Open the original native Expression before its driver intent');if(prepareCompositionEdit(current,draft.journey).changes.length||host.version()!==version||!sameNative(draft,host.snapshot()))throw Error('Unsaved/new local input remains retained; do not overwrite it with a native driver edit');
    const snapshot=authoredDriverSnapshot(current,intent.scene_ref);validateAuthoredDriverIntent(snapshot,reading,intent);const capability=host.authoredDriverCapability?.(intent.action.kind,{operation:'read_authored_drivers',expression_ref:intent.expression_ref,expected_revision:intent.expected_revision,scene_ref:intent.scene_ref,scope:clone(intent.scope)},reading,current);if(!capability||capability.state!=='available'||capability.expression_ref!==intent.expression_ref||capability.document_revision!==intent.expected_revision||capability.catalog_revision!==intent.catalog_revision)throw Error(capability?.state==='unavailable'?capability.reason:'The genuine native Source driver constructor/current capability is unavailable');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);result=await work.authoredDriver({kind:'native-authored-driver',intent,reading});lastAuthoredDriver=clone(result);if(result.view){if(!adoption())throw Error('Native driver Edit returned while newer local text arrived; full original receipt and draft are retained');restoreGeneration++;selections.cancel();host.load(result.view,true);update();}
   });if(!succeeded||!result)throw Error(notice||'The native driver receiving is unknown; retain and inspect the original operation');return result;
  },
retryAuthoredDriver:async(input:NativeAuthoredDriverIntent):Promise<StageAuthoredDriverObservation>=>{
   let result:StageAuthoredDriverObservation|undefined;const succeeded=await mutate(async()=>{const current=work.state?.view,pending=work.state?.pending;if(!current||pending?.kind!=='native-authored-driver'||!sameNative(pending.intent,input))throw Error('Guarded driver retry requires the full original retained operation');if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw Error('New local text remains retained; reconcile it before original driver adoption');const adoption=captureNativeAdoption(host,()=>restoreGeneration);result=await work.retryAuthoredDriver();lastAuthoredDriver=clone(result);if(result.view){if(!adoption())throw Error('Original driver receipt returned natively; newer local text stays retained');restoreGeneration++;selections.cancel();host.load(result.view,true);update();}});if(!succeeded||!result)throw Error(notice||'The same original native driver remains unresolved');return result;
  },
settledAuthoredDriver:(intent:NativeAuthoredDriverIntent):StageAuthoredDriverObservation|null=>{const view=work.state?.view;return lastAuthoredDriver?.state==='document_applied'&&sameNative(lastAuthoredDriver.original_intent,intent)&&view&&sameNative(lastAuthoredDriver.view?.document,view.document)?clone(lastAuthoredDriver):null;},
prepareStudio:async(intent:StudioChangeIntent):Promise<Operation>=>{
   if(intent.kind==='control'&&intent.mode!=='record')throw Error('Native scalar controls must use the actual Source-owned atomic control intent port');
   const captured=clone(intent),draft=clone(host.snapshot()),version=host.version();let result:Operation|undefined;
   const succeeded=await mutate(async()=>{
    let current=work.state?.view;if(!current)throw Error('Open a native Expression before changing its stage');
    const snapshot:StudioSnapshot={view:current,journey:host.snapshot().journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]};
    if(host.version()!==version||!sameNative(studioBasis(snapshot),captured.basis)||!sameNative(draft,host.snapshot()))throw Error('The original stage or local draft changed; the typed intent was retained');
    current=await flushDraft(current);
    if(host.version()!==version||!sameNative(draft,host.snapshot()))throw Error('New local work arrived during the native flush; its draft remains intact');
    const nextSnapshot:StudioSnapshot={...snapshot,view:current,journey:host.snapshot().journey};
    const admitted={...captured,basis:studioBasis(nextSnapshot)};
    const envelope=buildStudioEnvelope(nextSnapshot,admitted,clone(host.proceduralParticipants?.()??[]) as Participant[]);
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const reply=await work.procedural({operation:'prepare',envelope}) as {operation:Operation};result=reply.operation;
    if(!adoption())throw Error('Preparation is retained natively; newer local edits remain in the working draft');
    restoreGeneration++;selections.cancel();host.load(work.state!.view!,true);update();
   });
   if(!succeeded||!result)throw Error(notice||'Native preparation was not acknowledged');return result;
  },
compileProcedureSource:async(command:ProcedureSourceCommand,request:Record<string,unknown>|null=null)=>{
   let result:Awaited<ReturnType<ProcedureSources['run']>>|undefined;
   const succeeded=await mutate(async()=>{result=await procedureSource.run(command,request);});
   if(!succeeded||!result)throw Error(notice||'The native source was unavailable');return result;
  },
refreshStageCapability:async():Promise<StageCapability>=>{
   let result:StageCapability|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.acknowledgedView,draft=host.snapshot();
    if(!current||!host.stageLibrary)throw Error('The actual native Stage capability getter is unavailable');
    if(work.state?.pending||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('Settle the retained operation and save the original Source before capability requalification');
    const basis=studioBasis({view:current,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]});
    result=await host.stageLibrary.refresh(basis);
   });if(!succeeded||!result)throw Error(notice||'Actual native capability is unavailable');return result;
  },
stageCapability:(name:StageCapabilityName,basis:StudioBasis):StageCapability=>{
   const current=work.state?.view;if(!current||current.document.expression_ref!==basis.expression_ref||current.document.revision!==basis.document_revision)return {state:'unavailable',reason:'The actual native Source/Document basis changed.'};
   return clone(host.stageLibrary?.capability(name,clone(basis))??host.stageProvider?.capability(name,clone(basis),current)??{state:'unavailable',reason:'The protected native Stage source/graph/currentness/held-host provider is not paired.'});
  },
stageAuthorship:async(source:NativeSceneSource):Promise<ProcedureAuthorship>=>{
   const captured=clone(source),draft=clone(host.snapshot()),version=host.version();let result:ProcedureAuthorship|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,provider=host.stageProvider;
    if(!current||!host.nativeAuthorshipRead&&!host.procedureAuthorship&&!provider)throw Error('The actual native readonly Cprime/timing authoring intent producer is unavailable');
    if(work.state?.pending||host.version()!==version||!sameNative(draft,host.snapshot())||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('Settle the original operation and save the working draft before reading actual accepted Source authorship; its text remains retained');
    const snapshot:StudioSnapshot={view:current,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]};
    const profile=currentProfiles().find(row=>row.ref===captured.source_basis.source_ref&&row.revision===captured.source_basis.revision);if(!profile)throw Error('The actual current native profile is unavailable');validateNativeSceneSource(captured,snapshot,profile);
    const adoption=captureNativeAdoption(host,()=>restoreGeneration),before=clone(current.document);let reading:NativeAuthorshipReading|null=null;
    if(host.nativeAuthorshipRead){const request=procedureAuthorshipRequest(current,captured);reading=validateNativeAuthorshipReading(request,await host.nativeAuthorshipRead(request),captured);result=clone(reading.authorship) as ProcedureAuthorship;}
    else result=host.procedureAuthorship?await host.procedureAuthorship(captured,current,procedureSource):await provider!.authorship(captured,current,procedureSource);
    validateProcedureAuthorship(result);
    if(!adoption()||host.version()!==version||!sameNative(draft,host.snapshot())||!sameNative(work.state?.view?.document,before))throw Error('Authorship returned after the original actual Source changed; retain its typed intent');
    lastAuthorshipReading=reading;
   });if(!succeeded||!result)throw Error(notice||'The native authored Source was unavailable');return result;
  },
retryStageLibrary:async(intent:StageLibraryIntent):Promise<StageLibraryReplay|null>=>{
   const captured=clone(intent),draft=clone(host.snapshot()),version=host.version();let result:StageLibraryReplay|null|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,provider=host.stageProvider;if(!current||!host.stageLibrary&&!provider)throw Error('The protected native original preparation/journal recovery provider is not paired');
    if(current.document.expression_ref!==captured.basis.expression_ref)throw Error('The original preparation belongs to another actual Expression');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    if(host.stageLibrary){
     // A lost FIRST definition has its own private Session custody. Do not
     // enter a different Library transaction while that original ACK is unknown.
     const pending=work.state?.pending;
     const issued=retainedLibraryForDefinitionRetry(captured,pending?.kind==='native-stage-library'?pending:undefined,current)??await work.stageLibrary(captured,true);
     if('state' in issued&&issued.state==='pending_compilation')throw Error('The original native compilation is still in flight. Its full intent remains held for the SAME owner retry; no receiving material or new compilation was issued.');
     if('state' in issued&&issued.state==='no_change')result={...issued.preview,outcome:'no_change',source_current:issued.source_current,original_intent:clone(captured),native_reply:clone(issued),repeated:true};
     else if('found' in issued&&issued.found===false)result=null;
     else{
      if(!('envelope' in issued)||!issued.envelope)throw Error('reason' in issued?issued.reason:'Original native receiving preparation remains pending');
      const reply=await work.procedural({operation:'prepare',envelope:issued.envelope}) as ProceduralReply&{operation:Operation};
      result={original_intent:clone(captured),repeated:true,preview:{...issued.preview,operation:reply.operation},native_reply:clone(reply)};
     }
    }else result=await provider!.retryLibrary(captured,current,procedureSource,work);
    if(result&&'outcome' in result){if(!work.state?.view)throw Error('The readonly outcome lost its original Workspace');validateStageNoChangeOutcome(captured,result,{view:work.state.view,journey:work.state.view.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]});return;}
    if(result){if(!sameNative(result.original_intent,captured)||result.repeated!==true||!work.state?.view)throw Error('Native original preparation input/readback differs from this retained intent');
     validateStagePreparedReceipt(captured,result.preview,result.native_reply,{view:work.state.view,journey:work.state.view.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]});
     if(!adoption()||host.version()!==version||!sameNative(draft,host.snapshot()))throw Error('The native original receipt is retained; newer local draft/text remains unchanged');
     restoreGeneration++;selections.cancel();host.load(work.state.view,true);update();
    }
   });if(!succeeded||result===undefined)throw Error(notice||'The original native preparation could not be read');return result;
  },
prepareStageLibrary:async(intent:StageLibraryIntent):Promise<StagePreparation>=>{
   const captured=clone(intent),draft=clone(host.snapshot()),version=host.version();let result:StagePreparation|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,provider=host.stageProvider;if(!current||!host.stageLibrary&&!provider)throw Error('The protected native graph/currentness/ThreadPlan preparation provider is unavailable');
    const snapshot:StudioSnapshot={view:current,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]};
    if(host.version()!==version||!sameNative(studioBasis(snapshot),captured.basis)||!sameNative(draft,host.snapshot())||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('Save and explicitly read/requalify the original Source/CAS before preparation; the complete typed intent remains retained');
    validateNativeSceneSource(captured.source,snapshot,captured.profile);validateProcedureAuthorship(captured.authored);
    let produced:{envelope:import('./proceduralProtocol.js').Envelope;preview:Omit<ProcedurePreview,'operation'>};
    if(host.stageLibrary){
     const issued=await work.stageLibrary(captured);
     if('state' in issued&&issued.state==='no_change'){
      if(host.version()!==version||!sameNative(draft,host.snapshot())||!work.state?.view)throw Error('The readonly native outcome returned after newer local work; original intent stays retained');
      result=validateStageNoChangeOutcome(captured,{...issued.preview,outcome:'no_change',source_current:issued.source_current,original_intent:clone(captured),native_reply:clone(issued)},snapshot);return;
     }
     if(!('envelope' in issued)||!issued.envelope)throw Error('reason' in issued?issued.reason:'Original native library has not issued a receiving Envelope');
     produced={envelope:issued.envelope,preview:issued.preview};
    }else produced=await provider!.prepareLibrary(captured,current,draft,procedureSource);
    if(host.version()!==version||!sameNative(draft,host.snapshot())||work.state?.view?.document.revision!==captured.basis.document_revision||produced.envelope.expected_revision!==captured.basis.document_revision||produced.envelope.operation_ref!==captured.operation_ref||!sameNative(produced.envelope.scope,captured.scope)||!produced.envelope.producer_ref)throw Error('Native preparation changed the exact original Source/CAS/scope or lacks issued producer admission; its typed intent remains retained');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration),reply=await work.procedural({operation:'prepare',envelope:produced.envelope}) as ProceduralReply&{operation:Operation};result={...produced.preview,operation:reply.operation,native_reply:clone(reply)};
    if(!work.state?.view)throw Error('The actual prepared native Workspace adoption is unavailable');
    validateStagePreparedReceipt(captured,result,reply,{view:work.state.view,journey:work.state.view.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]});
    if(!adoption())throw Error('The native procedure is prepared; newer local typed work remains in its original draft');
    restoreGeneration++;selections.cancel();host.load(work.state!.view!,true);update();
   });if(!succeeded||!result)throw Error(notice||'The native Stage preparation was not acknowledged');return result;
  },
stageLifecycleCapability:(action:NativeLifecycleAction['kind'],basis:StudioBasis):StageLifecycleAvailability=>{
   const view=work.state?.view;if(!view||view.document.expression_ref!==basis.expression_ref||view.document.revision!==basis.document_revision)return {state:'unavailable',reason:'The exact actual native lifecycle Document/Source basis changed.'};
   const snapshot:StudioSnapshot={view,journey:view.journey,sceneId:Object.entries(view.bindings).find(([,b])=>b.scene_ref===basis.scene_ref)?.[0]??'',selected:[]};
   return validateStageLifecycleAvailability(host.stageLifecycle?.capability(action,basis,view),snapshot,action);
  },
lifecycleStage:async(intent:NativeLifecycleIntent,retry=false):Promise<StageLifecycleObservation>=>{
   const captured=clone(intent),draft=clone(host.snapshot()),version=host.version();let result:StageLifecycleObservation|undefined;
   const succeeded=await mutate(async()=>{
    const view=work.state?.view;if(!view||!host.stageLifecycle)throw Error('The actual same-owner lifecycle Source/event/material factory is not paired');
    if(view.document.expression_ref!==captured.expression_ref||host.version()!==version||prepareCompositionEdit(view,draft.journey).changes.length)throw Error('Save the current native draft before lifecycle receiving; its complete typed intent remains retained');
    if(!retry){const snapshot:StudioSnapshot={view,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]};validateStageLifecycleIntent(snapshot,captured);const cap=validateStageLifecycleAvailability(host.stageLifecycle.capability(captured.action.kind,studioBasis(snapshot),view),snapshot,captured.action.kind);if(cap.state==='unavailable')throw Error(cap.reason);}
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);result=retry&&work.state?.pending?.kind==='native-lifecycle'&&work.state.pending.material_reply?.operation?.status==='cancelled'?await work.retryLifecycleCancellation():await work.lifecycle(captured,retry);
    const adopted=work.state?.view;if(!adopted||!adoption()||host.version()!==version||!sameNative(draft,host.snapshot()))throw Error('The original lifecycle/native receipts are retained; newer uncommitted material remains in the existing draft');
    if(adopted.document.revision!==view.document.revision){restoreGeneration++;selections.cancel();host.load(adopted,true);update();}
   });if(!succeeded||!result)throw Error(notice||'Native lifecycle receiving remains unresolved; full original intent stays retained');return result;
  },
pendingStageLifecycle:()=>{const pending=work.state?.pending;return pending?.kind==='native-lifecycle'?clone(pending):null;},
settledStageLifecycle:(intent:NativeLifecycleIntent)=>{const receipt=work.settledLifecycle;return receipt&&sameNative(receipt.original_intent,intent)?clone(receipt):null;},
conductStage:async(intent:StageRuntimeIntent):Promise<StageRuntimeResult>=>{
   const captured=clone(intent),draft=clone(host.snapshot()),version=host.version();let result:StageRuntimeResult|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,provider=host.stageProvider;if(!current||!provider)throw Error('The protected same-held-host conduct provider is unavailable');
    if(current.document.expression_ref!==captured.basis.expression_ref||current.document.revision!==captured.basis.document_revision||host.version()!==version||prepareCompositionEdit(current,draft.journey).changes.length)throw Error('The actual native conduct basis changed; retain the unsaved draft and exact intent');
    result=await provider.conduct(captured,current);if(!sameNative(result.basis,captured.basis)||result.procedure_ref!==captured.procedure_ref)throw Error('Native conduct returned another original procedure basis');
   });if(!succeeded||!result)throw Error(notice||'Native conduct was unavailable');return result;
  },
procedureTemplates:()=>clone(host.procedureProvider?.templates()??[]),
prepareProcedure:async(intent:ProcedureAuthoringIntent):Promise<ProcedurePreview>=>{
   const captured=clone(intent),draft=clone(host.snapshot()),version=host.version();let result:ProcedurePreview|undefined;
   const succeeded=await mutate(async()=>{
    let current=work.state?.view;const provider=host.procedureProvider;
    if(!current||!provider)throw Error('The current native procedure producer has no admitted recipe provider');
    const basis=studioBasis({view:current,journey:draft.journey,sceneId:draft.sceneId,selected:draft.entityId?[draft.entityId]:[]});
    if(host.version()!==version||!sameNative(basis,captured.basis)||!sameNative(draft,host.snapshot()))throw Error('The recipe original basis changed; its typed intent remains retained');
    current=await flushDraft(current);
    const admitted={...captured,basis:{...captured.basis,document_revision:current.document.revision}};
    const produced=await provider.prepare(admitted,current,clone(host.snapshot()),procedureSource);
    if(host.version()!==version||!sameNative(draft,host.snapshot()))throw Error('Native source preparation returned after newer local work; retain and requalify its original basis');
    const adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const reply=await work.procedural({operation:'prepare',envelope:produced.envelope}) as {operation:Operation};
    result={...produced.preview,operation:reply.operation};
    if(!adoption())throw Error('The native procedure is prepared; newer local work remains in its draft');
    restoreGeneration++;selections.cancel();host.load(work.state!.view!,true);update();
   });
   if(!succeeded||!result)throw Error(notice||'The native recipe was not prepared');return result;
  },
procedureAction:async(intent:ProcedureActionIntent):Promise<Operation>=>{
   let result:Operation|undefined;const captured=clone(intent);
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,provider=host.procedureProvider;
    if(!current||!provider)throw Error('The current procedural owner is not admitted');
    if(current.document.expression_ref!==captured.basis.expression_ref||current.document.revision!==captured.basis.document_revision)throw Error('The original procedure basis changed before its action');
    if(prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw Error('Keep the unsaved draft and reconcile before changing native procedural conduct');
    const request=await provider.action(captured,current,procedureSource),adoption=captureNativeAdoption(host,()=>restoreGeneration);
    const reply=await work.procedural(request) as {operation:Operation};result=reply.operation;
    if(!adoption())throw Error('Native procedure action returned; newer local work remains retained');
    restoreGeneration++;selections.cancel();host.load(work.state!.view!,true);update();
   });
   if(!succeeded||!result)throw Error(notice||'The native procedural action was not acknowledged');return result;
  },
restoreProcedural:async(mode:RestorationMode,basis:StudioBasis):Promise<RestorationReceipt>=>{
   let result:RestorationReceipt|undefined;
   const succeeded=await mutate(async()=>{
    const current=work.state?.view,provider=host.procedureProvider;
    if(!current||!provider)throw Error('The actual restoration owner is not admitted');
    if(current.document.expression_ref!==basis.expression_ref||current.document.revision!==basis.document_revision||prepareCompositionEdit(current,host.snapshot().journey).changes.length)throw Error('Restoration must keep the original native basis and unsaved draft');
    result=await provider.restore(mode,clone(basis),current);
   });
   if(!succeeded||!result)throw Error(notice||'Native restoration did not return');return result;
  },
receiveKeptAnswer:async(receipt:import('../../../src/nara/instrumentProtocol').NativeExpressionAnswerReceipt):Promise<boolean>=>{
   if(receipt.schema!=='oi.nara-expression-answer-receipt/v1'||receipt.state!=='saved')throw Error('The native answer is kept but its same-file save is unconfirmed. Reconcile its existing native file before reading.');
   while(busy)await ownerIdle;
   const before=work.acknowledgedView;
   if(!before||before.document.expression_ref!==receipt.expression_ref||before.document.revision!==receipt.previous_revision
     ||localEdits(before)||work.state?.pending)throw Error('The saved answer was kept natively; resolve this retained local draft before receiving its revision.');
   const version=host.version(),intent=intentGeneration,generation=followGeneration;
   return run(async()=>{
    const current=()=>host.version()===version&&intentGeneration===intent&&followGeneration===generation&&work.acknowledgedView===before;
    const native=await inspectReference(receipt.expression_ref);if(!current())throw Error('The current view changed; the saved answer remains in its native file.');
    if(native.document.revision!==receipt.revision||!native.file||native.file.revision!==receipt.file.revision
      ||JSON.stringify(native.file.location)!==JSON.stringify(receipt.file.location))throw Error('The native answer receipt does not match this exact saved file and revision.');
    const view=await work.adopt(native.document,native.file,current);if(host.version()!==version||intentGeneration!==intent||followGeneration!==generation)throw Error('The view changed while receiving the saved native answer.');
    restoreGeneration++;selections.cancel();host.load(view,true);markLoaded();host.followed?.(receipt.expression_ref,readThrough===receipt.expression_ref);update();
   });
  },

 acceptNativePhysical:async(result:unknown,expected:import('./native-performance/sceneRecording.js').NativeRecordingCas,current:()=>boolean):Promise<KernelConversion>=>{
   let view:KernelConversion|undefined;
   const succeeded=await mutate(async()=>{const before=work.acknowledgedView;if(!before||localEdits(before)||!current())throw Error('The physical body reply remains native; the current local Document changed.');view=await work.acceptNativePhysical(result,expected,current);update();});
   if(!succeeded||!view)throw Error(notice||'The original physical document requires reconciliation.');return view;
  },

 selectNativePerformanceAct:async(act_ref:string)=>{
   const view=work.acknowledgedView,local=host.snapshot(),binding=view?.bindings[local.sceneId];
   if(!view||!binding||localEdits(view)||work.state?.pending)throw Error('Open the actual acknowledged native Scene before selecting its retained performance.');
   const original=clone(view.document),version=host.version(),selected=await performanceActs.selected(act_ref,original.expression_ref,binding.scene_ref);
   if(host.version()!==version||JSON.stringify(work.acknowledgedView?.document)!==JSON.stringify(original)||JSON.stringify(selected.document)!==JSON.stringify(original))throw Error('The selected native Act Edition differs from the actual current Document; its saved original remains retained.');
   return selected;
  },

 nativePerformanceActs:async()=>{
   const document=work.acknowledgedView?.document;
   if(!document)throw Error('Open the actual native Expression before its retained performance list.');
   const original=clone(document),version=host.version(),result=await performanceActs.discover(document.expression_ref);
   if(host.version()!==version||JSON.stringify(work.acknowledgedView?.document)!==JSON.stringify(original))throw Error('The native performance list returned after the selected Expression changed.');
   return result;
  },

 nativePerformanceActCustody:()=>performanceActs.inspect(),

 retainNativePerformanceAct:async()=>{const selected=await retainPerformanceAct();if(!selected)throw Error('The actual current selected Scene has no retained native performance.');return selected;},
};
}
