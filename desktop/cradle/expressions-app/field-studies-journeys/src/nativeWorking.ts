
import {validateInitialNativeDefinition,validateNativeDefinitionRequest,type NativeDefinitionPort,type NativeDefinitionTarget,type PendingNativeDefinition} from './proceduralNativeDefinition.js';
import {nativeStageLibraryRequest,requireInitialNativeStageLibraryDispatch,validateNativeStageLibraryReply,validatePendingNativeStageLibrary,type NativeStageLibraryReply,type PendingNativeStageLibrary} from './proceduralNativeStageLibrary.js';
import type {StageLibraryIntent} from './proceduralStageSource.js';
import {validatePendingSelectedSource,selectedSourceReplyView,type PendingNativeSelectedSceneSource,type SelectedSceneSourcePort,type SelectedSceneSourceReply} from './proceduralSelectedSceneSource.js';
import {selectedSceneRequest,selectedSceneSourceReason,validateSelectedSceneRequest,validatePendingSelectedScene,validateSelectedSceneOpen,validateSelectedSceneRecovery,validateSelectedSceneAbandonment,type NativeSelectedSceneRequest,type PendingNativeSelectedScene,type SelectedSceneOpening} from './proceduralSelectedScene.js';
import {validatePendingAuthoredDriver,validateNativeAuthoredDriverReply,type PendingNativeAuthoredDriver,type StageAuthoredDriverObservation} from './proceduralStageAuthoredDrivers.js';
import type {ProceduralReply} from './proceduralWorking.js';
import {validateStageLifecycleIntent,validateStageLifecycleReply,stageLifecycleCancelIntent,validateStageLifecycleCancelIntent,validateStageLifecycleCancelReply,type NativeLifecycleCancelIntent,type NativeLifecycleIntent,type NativeLifecycleReply,type StageLifecycleObservation} from './proceduralStageLifecycle.js';
import {pendingStageBootstrap,validatePendingStageBootstrap,isStageBootstrapRefusal,validateStageBootstrapRefusal,validateStageBootstrapReceipt,validateStageBootstrapCacheMiss,type NativeStageBootstrapCommand,type PendingNativeSourceBootstrap,type StageSourceBootstrapReceipt,type StageSourceBootstrapOutcome,type StageSourceBootstrapIntent,type StageSourceBootstrapResult} from './proceduralStageBootstrap.js';
import {validatePendingNativeControl,validateNativeControlReply,nativeControlSnapshot,type PendingNativeControl,type NativeControlResult} from './proceduralNativeControls.js';
import type {NativeScoreOperation} from './native-performance/scoreProtocol.js';
import {pendingProcedure,validatePendingProcedure,validateProceduralReply,proceduralReplyView,mutatesProcedure,procedureReference,preparationRetryView,type PendingProcedure} from './proceduralWorking.js';
import {validateOperation,type ProceduralRequest} from './proceduralProtocol.js';
const NATIVE_PARAMETERS=new Set(['glyph','shape','kind','yantra','force_mode','ascii','image','x','y','z','scale','share','width','height','rotation','frequency','force_strength','force_spin','force_radius']);
function applyMaterialParameter(scene:import('./model.js').Scene,ref:string,key:string,value:string|number):void{
 for(const entity of scene.entities.filter(e=>e.id===ref)){
  if(['x','y','z'].includes(key)&&typeof value==='number')entity.position[key as 'x'|'y'|'z']=value/400;
  else if((key==='width'||key==='height')&&typeof value==='number')entity.size[key==='width'?'x':'y']=value/400;
  else if(key==='rotation'&&typeof value==='number')entity.rotation=value*180/Math.PI;
  else if(key==='scale'||key==='share'||key==='kind')(entity as unknown as Record<string,unknown>)[key]=value;
  else if(key==='glyph')entity.text=String(value);
  else if(key==='shape')entity.shape=(value==='glyph'?'text':value) as typeof entity.shape;
  else if(key==='yantra')entity.yantraId=String(value);
  else if(key==='frequency')entity.templateFrequency=Number(value);
  else if(key==='force_mode')entity.force.kind=value as typeof entity.force.kind;
  else if(key==='force_strength')entity.force.strength=Number(value);
  else if(key==='force_spin')entity.force.spin=Number(value);
  else if(key==='force_radius')entity.force.radius=Number(value)/400;
  else if(key==='ascii'||key==='image'){
   if(value==='')delete entity.source;
   else entity.source=key==='ascii'?{kind:'ascii',ascii:{text:String(value)}}:{kind:'image',image:{dataUrl:String(value),mode:'luminance',threshold:.5,invert:false,scale:1}};
  }
 }
}
export interface PendingNativeLifecycle {kind:'native-lifecycle';intent:NativeLifecycleIntent;source_reply?:NativeLifecycleReply;last_reply?:NativeLifecycleReply;material?:PendingProcedure;material_reply?:ProceduralReply;cancellation?:{intent:NativeLifecycleCancelIntent;receipt?:unknown}}
export function nativeOwnerSnapshot(value:unknown,reference:string):{document:KernelExpressionDocument;file?:NativeFile}{
 const document=readDocument(value,reference),result=value as {file?:NativeFile|null;saved_revision?:number|null};
 if(!result.file)return {document};
 const revision=result.saved_revision;
 if(!Number.isSafeInteger(revision)||revision!<1||revision!>document.revision)throw Error('The native file has no valid acknowledged document revision');
 return {document,file:{...artifact(value,reference),document_revision:revision!}};
}
import {prepareBlueprintEdit,blueprintReply,type BlueprintIntent,type BlueprintEdit} from './nativeBlueprint.js';
import {prepareOccurrenceEdit,occurrenceReply,type OccurrenceIntent,type DuplicateOccurrenceIntent,type InsertSourceIntent,type OccurrenceEdit} from './nativeOccurrence.js';
/** Retained native basis for the existing authoring draft. Every semantic
 * mutation and durable file save crosses existing owner operations. Recovery
 * shares the existing draft DB, separately from the exportable Journey. */
import {sameSceneData} from './sceneCorrespondence.js';
import {clone,validateJourney,type Journey} from './model.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {prepareCompositionEdit,acceptCompositionReply,rebaseCompositionView,type CompositionEdit} from './kernelComposition.js';
export interface WorkingSnapshot {journey:Journey;sceneId:string;entityId:string|null}
export interface NativeFile {location:{schema:'central.path-ref/v1';ref:string;root:string;path:string};revision:string;expression_ref:string;document_revision?:number}
export type SaveDestination={parent_path:string;name:string}|{location:NativeFile['location'];revision:string};
export type PendingNative =
 | PendingProcedure
 | PendingNativeStageLibrary
 | PendingNativeSourceBootstrap
 | PendingNativeSelectedScene
 | PendingNativeSelectedSceneSource
 | PendingNativeControl
 | PendingNativeAuthoredDriver
 | PendingNativeLifecycle
 | {kind:'create';expression_ref:string;submitted:WorkingSnapshot}
 | {kind:'edit';request:CompositionEdit;submitted:WorkingSnapshot}
 | {kind:'file';intent:unknown}
 | {kind:'selection';request:SelectionEdit}
 | {kind:'connections';request:ConnectionEdit}
 | {kind:'occurrence';intent:OccurrenceIntent;request:OccurrenceEdit}
 | {kind:'blueprint';intent:BlueprintIntent;request:BlueprintEdit};
export interface NativeSelection {scene_ref:string;entity_ref?:string|null;binding_ref?:string}
export interface SelectionEdit {operation:'edit';expression_ref:string;expected_revision:number;actor:string;changes:[Record<string,unknown>]}
function selectionEdit(view:KernelConversion,selection:NativeSelection):SelectionEdit {
 const document=view.document,scene=document.scenes.find(s=>s.scene_ref===selection.scene_ref);
 if(!scene)throw new Error('Selection belongs to an absent native Scene');
 const relation=selection.binding_ref?document.relations?.[selection.binding_ref]:undefined;
 if(selection.binding_ref&&(!relation||!scene.entity_refs.includes(relation.from_entity_ref)||!scene.entity_refs.includes(relation.to_entity_ref)))throw new Error('Relation occurrence is not in this native Scene');
 if(selection.entity_ref&&(!scene.entity_refs.includes(selection.entity_ref)||selection.binding_ref))throw new Error('Select one exact entity or relation occurrence');
 const change=relation?{change:'relation_focus',scene_ref:scene.scene_ref,binding_ref:relation.binding_ref}
  :{change:'focus',scene_ref:scene.scene_ref,entity_ref:selection.entity_ref??null};
 return {operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:'human:expressions-app',changes:[change]};
}
function selectionMatches(view:KernelConversion,request:SelectionEdit,document:KernelExpressionDocument):boolean {
 const expected=clone(view.document),change=request.changes[0];
 expected.selection={scene_ref:String(change.scene_ref),entity_ref:change.change==='focus'?(change.entity_ref as string|null):null,
  ...(change.change==='relation_focus'?{relation_ref:String(change.binding_ref)}:{})};
 if(document.revision!==expected.revision&&document.revision!==expected.revision+1)return false;
 expected.revision=document.revision;
 return same(expected,document);
}
export interface ConnectionEdit {operation:'edit';expression_ref:string;expected_revision:number;actor:string;changes:Record<string,unknown>[]}
/** Expression connections are local composition bindings. This never edits a
 * source-owned semantic relation or infers Wiki write authority.
 *
 * ES1A/ES1B (O:I #352): the same bounded edit/readback path also carries
 * scene-body and scene-trigger changes (`scene_body_set`/`scene_body_clear`/
 * `scene_trigger_attach`/`scene_trigger_detach`) — the Rust-exact change
 * grammar from kernel/src/expression.rs's `Change` enum. This function name
 * predates that widening; it is kept so every existing call site
 * (`nativeWorkspace.edit`) needs no change. */
function connectionEdit(view:KernelConversion,changes:Record<string,unknown>[]):ConnectionEdit {
 if(!changes.length||changes.length>256)throw new Error('Choose 1–256 native connection changes');
 const request:ConnectionEdit={operation:'edit',expression_ref:view.document.expression_ref,expected_revision:view.document.revision,actor:'human:expressions-app',changes:clone(changes)};
 connectionResult(view,request); // refuse unsupported ownership before dispatch
 return request;
}
const SCENE_CHANGE_KINDS=new Set(['scene_body_set','scene_body_clear','scene_trigger_attach','scene_trigger_detach']);
function connectionResult(view:KernelConversion,request:ConnectionEdit):KernelExpressionDocument {
 const doc=clone(view.document);doc.relations??={};
 const touchedScenes=new Set<string>();
 for(const change of request.changes){
  if(change.change==='subject_bind'){
   const entity=typeof change.entity_ref==='string'?doc.entities[change.entity_ref]:undefined;
   const binding=change.binding as import('./kernelDocumentBridge.js').KernelSubject|undefined;
   if(!entity||!binding||typeof binding.subject_ref!=='string'||typeof binding.native_owner!=='string')throw new Error('A subject binding needs its exact existing native occurrence and owner');
   entity.subject=clone(binding);continue;
  }
  if(change.change==='scene_material_set'){
   const scene=doc.scenes.find(s=>s.scene_ref===change.scene_ref);
   const material=change.presentation as NonNullable<typeof scene>['presentation'];
   if(!scene||material?.schema!=='oi.journey-scene/v1')throw new Error('Scene material needs its existing native Scene');
   scene.presentation=clone(material);continue;
  }
  if(change.change==='parameter_set'){
   const entity=typeof change.entity_ref==='string'?doc.entities[change.entity_ref]:undefined;
   const key=change.parameter,value=change.value;
   if(!entity||typeof key!=='string'||!NATIVE_PARAMETERS.has(key)||(typeof value!=='string'&&typeof value!=='number')||typeof value==='number'&&!Number.isFinite(value))throw new Error('Choose an admitted native entity parameter');
   if(entity.parameters[key]?.automation)throw new Error('Take manual control before changing an automated parameter');
   entity.parameters[key]={value,automation:null};
   for(const scene of doc.scenes)if(scene.presentation)applyMaterialParameter(scene.presentation.scene,String(change.entity_ref),key,value);
   continue;
  }
  if(SCENE_CHANGE_KINDS.has(change.change as string)){
   applySceneChange(doc,change,touchedScenes);
   continue;
  }
  // Reusable-material index (EXPRESSION-ACT-MATERIAL-V1 §1): document-level
  // metadata; the kernel validates its refs against the whole document.
  if(change.change==='reuse_set'){
   if(!change.reuse||typeof change.reuse!=='object')throw new Error('reuse_set needs a reuse block');
   (doc as {reuse?:unknown}).reuse=clone(change.reuse);continue;
  }
  if(change.change==='reuse_clear'){delete (doc as {reuse?:unknown}).reuse;continue;}
  // A world-position pin: the exact occurrence keeps its place; this is not
  // blueprint membership and not a lock on its other properties.
  if(change.change==='entity_pin'){
   const ref=change.entity_ref,entity=typeof ref==='string'?doc.entities[ref]:undefined;
   if(!entity||typeof change.pinned!=='boolean')throw new Error('A pin names an existing occurrence and a pinned state');
   if(change.pinned)(entity as {pinned?:boolean}).pinned=true;else delete (entity as {pinned?:boolean}).pinned;
   continue;
  }
  const binding=change.binding as NonNullable<KernelExpressionDocument['relations']>[string]|undefined;
  const ref=change.change==='relation_bind'?binding?.binding_ref:change.binding_ref;
  if(typeof ref!=='string'||!ref.startsWith(doc.expression_ref+':relation:connection-'))throw new Error('Only O:I Expression connections can be edited here');
  const previous=doc.relations[ref];
  if(previous&&previous.native_owner!=='oi')throw new Error('Source relations must be changed through their source owner');
  if(change.change==='relation_bind'){
   if(!binding||binding.native_owner!=='oi'||!binding.relation?.ref.startsWith(ref+':'))throw new Error('Connection binding must identify its O:I owner');
   if(!doc.scenes.some(scene=>scene.entity_refs.includes(binding.from_entity_ref)&&scene.entity_refs.includes(binding.to_entity_ref)))throw new Error('Both connection endpoints must belong to the same native Scene');
   doc.relations[ref]=clone(binding);
  }else if(change.change==='relation_remove'){
   if(!previous)throw new Error('Connection is absent');
   delete doc.relations[ref];
   if(doc.selection?.relation_ref===ref)delete doc.selection.relation_ref;
  }else throw new Error('Only native connection bind/remove/scene-body/scene-trigger/reuse changes are admitted by this operation');
 }
 if(!same(doc,view.document)){
  doc.revision++;
  for(const entity of Object.values(doc.entities))if(!same(entity,view.document.entities[entity.entity_ref]))entity.revision=doc.revision;
  for(const scene of doc.scenes)if(!same(scene,view.document.scenes.find(s=>s.scene_ref===scene.scene_ref)))scene.revision=doc.revision;
 }
 kernelDocumentToJourney(doc); // complete binding and membership validation
 return doc;
}
/** ES1A/ES1B change application, mirrored from kernel/src/expression.rs's
 * `Change::SceneBodySet/SceneBodyClear/SceneTriggerAttach/SceneTriggerDetach`
 * handling — a local prediction of the owner's own semantics, so the
 * readback comparison in `editConnections` below stays an honest check
 * rather than a rubber stamp. */
function applySceneChange(doc:KernelExpressionDocument,change:Record<string,unknown>,touchedScenes:Set<string>):void {
 if(change.change==='scene_body_set'||change.change==='scene_body_clear'){
  const sceneRef=change.scene_ref;
  if(typeof sceneRef!=='string'||!sceneRef)throw new Error('Scene body change needs a scene_ref');
  const scene=doc.scenes.find(s=>s.scene_ref===sceneRef);
  if(!scene)throw new Error(`Scene body change names an absent native Scene: ${sceneRef}`);
  scene.body=change.change==='scene_body_set'?clone(change.body as Record<string,unknown>):null;
  touchedScenes.add(sceneRef);
  return;
 }
 if(change.change==='scene_trigger_attach'){
  const sceneRef=change.scene_ref,trigger=change.trigger as {trigger_ref?:unknown}|undefined;
  if(typeof sceneRef!=='string'||!sceneRef)throw new Error('Scene trigger attach needs a scene_ref');
  const scene=doc.scenes.find(s=>s.scene_ref===sceneRef);
  if(!scene)throw new Error(`Scene trigger attach names an absent native Scene: ${sceneRef}`);
  if(!trigger||typeof trigger.trigger_ref!=='string'||!trigger.trigger_ref)throw new Error('Scene trigger attach needs a trigger_ref');
  if(doc.scenes.some(s=>((s.triggers??[]) as {trigger_ref:string}[]).some(t=>t.trigger_ref===trigger.trigger_ref)))throw new Error('Scene trigger already exists');
  scene.triggers=[...((scene.triggers??[]) as unknown[]),clone(trigger)];
  touchedScenes.add(sceneRef);
  return;
 }
 if(change.change==='scene_trigger_detach'){
  const triggerRef=change.trigger_ref;
  if(typeof triggerRef!=='string'||!triggerRef)throw new Error('Scene trigger detach needs a trigger_ref');
  let removed=false;
  for(const scene of doc.scenes){
   const before=((scene.triggers??[]) as {trigger_ref:string}[]);
   const after=before.filter(t=>t.trigger_ref!==triggerRef);
   if(after.length!==before.length){scene.triggers=after;touchedScenes.add(scene.scene_ref);removed=true;}
  }
  if(!removed)throw new Error('Scene trigger is absent');
  return;
 }
}
function connectionView(view:KernelConversion,doc:KernelExpressionDocument):KernelConversion {
 return kernelDocumentToJourney(doc,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});
}
export interface NativeWorkingRecord {
 schema:'oi.native-working/v1';draft_id:string;view?:KernelConversion;file?:NativeFile;pending?:PendingNative;native_source_failure?:unknown;native_performance_failure?:unknown;native_performance_edit?:{state:'submitted'|'unknown';request:Record<string,unknown>;native_reply?:unknown;reason?:string};
}
export interface NativeWorkingPorts {
 expression:(request:Record<string,unknown>)=>Promise<unknown>;
 stageLibrary?:(intent:StageLibraryIntent,retry:boolean,receive:(raw:unknown)=>Promise<void>)=>Promise<unknown>;
 /** Hidden first compiled definition admission, before ordinary S Prepare. */
 stageDefinition?:NativeDefinitionPort;
 selectedSceneSource?:SelectedSceneSourcePort;
 selectedSceneOpen?:(request:NativeSelectedSceneRequest,receive:(reply:unknown)=>Promise<void>)=>Promise<unknown>;
 selectedSceneRecover?:(request:NativeSelectedSceneRequest,receive:(reply:unknown)=>Promise<void>)=>Promise<unknown>;
 selectedSceneAbandon?:(request:NativeSelectedSceneRequest)=>Promise<unknown>;
 /** Actual SAME InstrumentSession performs and accounts this private host request. */
 lifecycle?:(intent:NativeLifecycleIntent)=>Promise<unknown>;
 lifecycleRetry?:(intent:NativeLifecycleIntent)=>Promise<unknown>;
 lifecycleSettlement?:(intent:NativeLifecycleIntent)=>Promise<unknown>;
 lifecycleCancel?:(intent:NativeLifecycleCancelIntent)=>Promise<unknown>;
 sourceBootstrap?:(request:NativeStageBootstrapCommand)=>Promise<unknown>;
 sourceBootstrapRetry?:(intent:StageSourceBootstrapIntent)=>Promise<unknown>;
 file:(request:Record<string,unknown>)=>Promise<unknown>;
 checkpoint:(draftId:string,record:NativeWorkingRecord)=>Promise<void>;
 mint:()=>string;
}
const same=sameSceneData;
function readDocument(value:unknown,reference:string):KernelExpressionDocument {
 const result=value as {state?:string;expression_ref?:string;document?:KernelExpressionDocument}|null;
 if(result?.state==='revision_conflict'&&result.expression_ref===reference)throw new Error('revision_conflict: the native Expression changed; inspect its current basis before trying again');
 if(result?.state!=='ready'||result.document?.expression_ref!==reference)throw new Error('The native owner did not return the addressed Expression');
 return kernelDocumentToJourney(result.document).document;
}
function artifact(value:unknown,reference:string):NativeFile {
 const result=value as {document?:KernelExpressionDocument;file?:NativeFile}|null,file=result?.file;
 if(result?.document?.expression_ref!==reference||file?.location?.schema!=='central.path-ref/v1'
  ||!file.location.ref||!file.location.root||!file.location.path||!file.revision)throw new Error('The owner did not confirm the exact native file and revision');
 return {location:clone(file.location),revision:file.revision,expression_ref:reference,document_revision:result.document.revision};
}
function firstView(document:KernelExpressionDocument,snapshot:WorkingSnapshot):KernelConversion {
 if(document.revision!==1||Object.keys(document.entities).length||Object.keys(document.relations??{}).length||document.scenes.length!==1||document.title!==snapshot.journey.name)throw new Error('The created native Expression has already changed; reconcile it before composing');
 return kernelDocumentToJourney(document,{identity:{expression:snapshot.journey.id,scenes:{[document.scenes[0].scene_ref]:snapshot.journey.scenes[0].id}}});
}
/** Lost CAS replies are recovered only from the exact intended result, not
 * merely from a higher revision, routing receipt or matching title. */
function editMatches(record:NativeWorkingRecord,request:CompositionEdit,submitted:WorkingSnapshot,doc:KernelExpressionDocument):boolean {
 if(!record.view||doc.revision!==request.expected_revision+1)return false;
 const basis=record.view.document;
 if(!same(doc.relations??{},basis.relations??{})||!same(doc.provenance,basis.provenance))return false;
 for(const [ref,entity]of Object.entries(basis.entities))if(!same(doc.entities[ref],entity))return false;
 try{
  const view=rebaseCompositionView(record.view,submitted.journey,doc);
  return prepareCompositionEdit(view,submitted.journey,{sceneId:submitted.sceneId,entityId:submitted.entityId}).changes.length===0;
 }catch{return false;}
}
 /** Checkpoint data is validated through actual import and action laws. */
export function validateWorkingRecord(raw:unknown,journey:Journey):NativeWorkingRecord {
 const value=clone(raw) as NativeWorkingRecord;
 if(value?.schema!=='oi.native-working/v1'||value.draft_id!==journey.id)throw new Error('Recovery belongs to a different authoring draft');
 validateJourney(journey);
 if(value.view){
  const view=value.view;
  validateJourney(view.journey);
  if(view.journey.id!==journey.id)throw new Error('Native recovery identity disagrees with its draft');
  const scenes=Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id]));
  const pages=Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]));
  value.view=kernelDocumentToJourney(view.document,{identity:{expression:journey.id,scenes,entities:view.entity_ids},pages});
 }
 if(value.native_performance_edit){
  const pending=value.native_performance_edit,request=pending.request,changes=request?.changes as {change?:unknown;scene_ref?:unknown;operations?:unknown}[]|undefined;
  if(!value.view||!['submitted','unknown'].includes(pending.state)||request.operation!=='edit'||request.expression_ref!==value.view.document.expression_ref||request.expected_revision!==value.view.document.revision||!Array.isArray(changes)||changes.length!==1||changes[0].change!=='scene_performance_edit'||!value.view.document.scenes.some(s=>s.scene_ref===changes[0].scene_ref)||!Array.isArray(changes[0].operations)||!changes[0].operations.length)throw Error('Recovered score edit does not match its exact retained native Document basis.');
 }
 if(value.file){
  artifact({document:value.view?.document,file:value.file},value.file.expression_ref);
  if(value.file.expression_ref!==value.view?.document.expression_ref)throw new Error('Recovered file points to another work');
  if(value.file.document_revision!==undefined&&(!Number.isSafeInteger(value.file.document_revision)||value.file.document_revision<1||value.file.document_revision>value.view.document.revision))throw Error('Recovered file has an invalid acknowledged document revision');
 }
 if(value.pending){
  const pending=value.pending;
  if(!['create','edit','file','selection','connections','occurrence','blueprint','procedural','native-control','native-stage-library','native-source-bootstrap','native-lifecycle','native-authored-driver','native-selected-scene-open','native-selected-scene-source'].includes(pending.kind))throw new Error('Unknown pending native operation');
  if(pending.kind==='create'||pending.kind==='edit'){
   validateJourney(pending.submitted.journey);
   if(pending.submitted.journey.id!==journey.id)throw new Error('Pending proposal belongs to another draft');
  }
  if(pending.kind==='create'&&(!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(pending.expression_ref)||value.view))throw new Error('Invalid pending creation identity');
  if(pending.kind==='edit'&&(!value.view||pending.request.operation!=='edit'||pending.request.expression_ref!==value.view.document.expression_ref||pending.request.expected_revision!==value.view.document.revision
   ||!same(pending.request,prepareCompositionEdit(value.view,pending.submitted.journey,{sceneId:pending.submitted.sceneId,entityId:pending.submitted.entityId,actor:pending.request.actor}))))throw new Error('The recovered edit does not match its captured basis');
  if(pending.kind==='selection'){
   const change=pending.request?.changes?.[0];
   if(!value.view||!change||!same(pending.request,selectionEdit(value.view,{scene_ref:String(change.scene_ref),entity_ref:change.entity_ref as string|null,binding_ref:change.binding_ref as string|undefined})))throw new Error('Recovered selection does not match its native basis');
  }
  if(pending.kind==='connections'&&(!value.view||!same(pending.request,connectionEdit(value.view,pending.request.changes))))throw new Error('Recovered connection edit does not match its native basis');
  if(pending.kind==='blueprint'&&(!value.view||!same(pending.request,prepareBlueprintEdit(value.view,pending.intent).request)))throw new Error('Recovered blueprint does not match its captured native basis');
  if(pending.kind==='occurrence'&&(!value.view||!same(pending.request,prepareOccurrenceEdit(value.view,pending.intent).request)))throw new Error('Recovered occurrence does not match its captured native basis');
  if(pending.kind==='native-stage-library'){if(!value.view)throw Error('Retained native Stage library lacks its original Document');validatePendingNativeStageLibrary(pending,value.view);if(pending.material)validatePendingProcedure(pending.material,value.view);}
  if(pending.kind==='procedural'){if(!value.view)throw Error('Recovered procedure lacks a native document');validatePendingProcedure(pending,value.view);}
  if(pending.kind==='native-authored-driver'){if(!value.view)throw Error('Retained authored driver lacks its original native Document');validatePendingAuthoredDriver(pending,value.view);}
  if(pending.kind==='native-selected-scene-source'){if(!value.view)throw Error('Retained native source lacks its original Document');validatePendingSelectedSource(pending,value.view);}
  if(pending.kind==='native-selected-scene-open'){if(!value.view)throw Error('Retained native opening lacks its original Document');validatePendingSelectedScene(pending,value.view);}
  if(pending.kind==='native-source-bootstrap'){if(!value.view)throw Error('Retained Source bootstrap lacks its original Document');validatePendingStageBootstrap(pending,value.view);}
  if(pending.kind==='native-lifecycle'){if(!value.view)throw Error('Retained lifecycle lacks its actual Document');const basis=pending.source_reply?.document??value.view.document;const v=kernelDocumentToJourney(basis);const sceneId=Object.entries(v.bindings).find(([,b])=>b.scene_ref===pending.intent.scene_ref)?.[0];if(!sceneId)throw Error('Retained lifecycle lost its original Scene');validateStageLifecycleIntent({view:v,journey:v.journey,sceneId,selected:[]},pending.intent);if(pending.material)validatePendingProcedure(pending.material,pending.material.request.operation==='prepare'?v:value.view);if(pending.cancellation){if(!pending.source_reply||!pending.material_reply?.operation)throw Error('Retained lifecycle cancellation lost its original Source/S journal');validateStageLifecycleCancelIntent(value.view,pending.intent,pending.source_reply,pending.cancellation.intent,pending.material_reply.operation);}}
  if(pending.kind==='native-control'){if(!value.view)throw Error('Retained native control lacks its original Document');validatePendingNativeControl(pending,value.view);}
  if(pending.kind==='file'&&!value.view)throw new Error('A file-save checkpoint requires a native basis');
 }
 return value;
}
export class NativeWorking {
 private record?:NativeWorkingRecord;
 private epoch=0;
 private inFlight=false;
 constructor(private readonly ports:NativeWorkingPorts){}
 get state():NativeWorkingRecord|undefined{return this.record?clone(this.record):undefined;}
 get busy():boolean{return this.inFlight;}
 /** Late results are checkpointed for the old work, never adopted into a
  * newly selected inquiry. Navigation does not cancel an authorised act. */
 detach():void{this.epoch++;this.replaceRecord(undefined);}
 restore(raw:unknown,journey:Journey):void{this.epoch++;this.replaceRecord(validateWorkingRecord(raw,journey));}
 /** Reopen an acknowledged native basis after process restart. Local draft
  * edits and interrupted operations remain recovery data; none is replayed. */
 async reopenCheckpoint(raw:unknown,journey:Journey,accept:()=>boolean=()=>true):Promise<KernelConversion>{
  if(this.inFlight)throw new Error('A native operation is still returning');
  const record=validateWorkingRecord(raw,journey);
  if(!record.view)throw new Error('This draft has no acknowledged native basis to reopen');
  const epoch=++this.epoch;this.inFlight=true;
  try{
   const result=await this.ports.expression({operation:'open',document:record.view.document,actor:'oi:working-draft-recovery'});
   const conflict=result as {state?:string;expression_ref?:string}|null;
   if(conflict?.state==='revision_conflict'&&conflict.expression_ref===record.view.document.expression_ref
    &&!record.pending&&!record.native_performance_edit&&!prepareCompositionEdit(record.view,journey).changes.length){
    // Another aperture may have advanced clean work (including its focus).
    // Read that owner revision; never submit the old document as an edit or
    // rebase unsaved/interrupted material onto an unrelated native basis.
    const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
    const view=connectionView(record.view,document),refreshed={...record,view};
    if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while recovery was returning; its native basis was not replaced');
    await this.ports.checkpoint(record.draft_id,clone(refreshed));
    if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while recovery was returning; its native basis was not replaced');
    this.replaceRecord(refreshed);
    return clone(view);
   }
   const reopened=readDocument(result,record.view.document.expression_ref);
   if(!same(reopened,record.view.document))throw new Error('Native work changed; the recovery draft was retained separately');
   if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while recovery was returning; its native basis was not replaced');
   this.replaceRecord(record);
   return {...clone(record.view),journey:clone(journey)};
  }finally{this.inFlight=false;}
 }
 async adopt(document:KernelExpressionDocument,file?:NativeFile,accept:()=>boolean=()=>true):Promise<KernelConversion>{
  if(this.record?.native_performance_edit&&this.record.view?.document.expression_ref===document.expression_ref)throw Error('Reconcile the original native score edit before replacing this same Expression basis.');
  if(this.inFlight)throw new Error('A native operation is still returning; the current draft is retained');
  const epoch=++this.epoch,view=kernelDocumentToJourney(document);
  const record:NativeWorkingRecord={schema:'oi.native-working/v1',draft_id:view.journey.id,view,...(file?{file}: {})};
  validateWorkingRecord(record,view.journey);
  this.inFlight=true;
  try{
   await this.ports.checkpoint(record.draft_id,clone(record));
   // Returning durable data is not permission to replace the selected work.
   // Check before changing the basis, so a later navigation needs no rollback.
   if(epoch!==this.epoch||!accept())throw new Error('The selected draft changed while opening; its native basis was not replaced');
   this.replaceRecord(clone(record));return view;
  }finally{this.inFlight=false;}
 }
 /** Adopt a newer owner revision of the SAME Expression (advanced by another
  * native owner operation, e.g. a constellation re-projection) only while
  * this draft is clean: nothing pending and no local changes. Unsaved work is
  * never rebased; the caller is told the draft was kept. */
 async advanceClean(journey:Journey,accept:()=>boolean=()=>true):Promise<KernelConversion|null>{
  const record=this.record;
  if(!record?.view)throw new Error('No native work is open');
  if(record.pending||record.native_performance_edit||prepareCompositionEdit(record.view,journey).changes.length)return null;
  const epoch=this.begin();
  try{
   const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
   if(document.revision<=record.view.document.revision)return clone(record.view);
   const view=connectionView(record.view,document);
   if(epoch!==this.epoch||!accept())throw new Error('The work changed while the newer native revision was returning; its basis was kept');
   await this.persist({...record,view},epoch);
   return clone(view);
  }finally{this.inFlight=false;}
 }
 private async persist(record:NativeWorkingRecord,epoch:number):Promise<void>{
  await this.ports.checkpoint(record.draft_id,clone(record));
  if(epoch===this.epoch)this.replaceRecord(clone(record));
 }
 private begin(readOnlyScore=false):number{
   if(this.inFlight)throw new Error('A native operation is already in flight');
   if(this.record?.native_performance_edit&&!readOnlyScore)throw Error('Reconcile the original native score edit before another native change. Its request and basis are retained.');
   this.inFlight=true;return this.epoch;
  }
 /** Adopt an owner document whose reply semantics cannot be validated against
  * the captured intent: the typed check runs first; a diverged owner still
  * becomes the acknowledged basis rather than a permanent refusal. */
 private adoptOwnerDocument(view:KernelConversion,validate:(basis:KernelConversion,document:KernelExpressionDocument)=>KernelConversion,document:KernelExpressionDocument):KernelConversion{
  try{return validate(view,document);}catch{return connectionView(view,document);}
 }
 /** An interrupted operation is settled before new work, never replayed
  * blindly and never left blocking the draft: unchanged on the owner, the
  * intent is dropped; applied, it is adopted; diverged, the owner's current
  * document becomes the acknowledged basis and the local draft simply
  * remains the user's unsaved work. */
 private async settlePending(record:NativeWorkingRecord,epoch:number):Promise<NativeWorkingRecord>{
  const pending=record.pending!;
  if(pending.kind==='native-stage-library')throw Error('The original native Stage library/Envelope/Prepare intent remains retained; inspect that exact native compilation and journal before another action');
  if(pending.kind==='native-selected-scene-source')throw Error('The original World source request/context/result is retained; recover its SAME native owner, never repeat its getter/Edit or substitute another ordinal.');
  if(pending.kind==='native-selected-scene-open')throw Error('The full original selected Scene opening is retained. Recover or explicitly abandon it through its actual native owner; no fresh World was composed.');
  if(pending.kind==='native-authored-driver')throw Error('The original Source-owned driver intent is retained; guarded native retry/current Source reconciliation is required before another action');
  if(pending.kind==='native-lifecycle')throw Error('The full original lifecycle intent still awaits Source/material settlement; inspect its SAME native owner before another action.');
  if(pending.kind==='native-source-bootstrap')throw Error('The complete original Source intent has uncertain standing; retry or explicitly requalify it through its native owner. No saved history grants current Source.');
  if(pending.kind==='native-control')throw Error('This native control has uncertain standing; explicitly retry its exact original intent through the native owner. No history was inferred or replayed.');
  if(pending.kind==='procedural'){
   if(!record.view)throw Error('Pending procedure has no retained native basis');
   const inspected=await this.ports.expression({operation:'procedural',request:{operation:'inspect_operation',operation_ref:procedureReference(pending.request)}}) as {schema?:string;state?:string;operation_ref?:string};
   const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
   if(inspected?.schema==='oi.expression-procedural/v1'&&inspected.state==='absent'&&inspected.operation_ref===procedureReference(pending.request)){
    if(pending.request.operation!=='prepare'||!same(document,record.view.document))throw Error('Uncertain procedure action remains retained; inspect its actual owner before continuing');
    await this.persist({...record,pending:undefined},epoch);
   }else{
    const receipt=validateProceduralReply(inspected,pending);
    const view=proceduralReplyView(record.view,receipt,document);
    await this.persist({...record,view,pending:undefined},epoch);
   }
   return clone(this.record!);
  }
  if(pending.kind==='file'){
   const response=await this.ports.file({operation:'inspect',intent:pending.intent}) as {state?:string;artifact?:unknown};
   if(response?.state==='saved'&&record.view){
    const file=artifact(response.artifact,record.view.document.expression_ref);
    await this.persist({...record,file,pending:undefined},epoch);
   }else await this.persist({...record,pending:undefined},epoch);
   return clone(this.record!);
  }
  if(pending.kind==='create'){
   let created:KernelExpressionDocument|null=null;
   try{created=readDocument(await this.ports.expression({operation:'inspect',expression_ref:pending.expression_ref}),pending.expression_ref);}
   catch{created=null;}
   let adopted=false;
   if(created){
    try{const view=firstView(created,pending.submitted);await this.persist({...record,view,pending:undefined},epoch);adopted=true;}
    catch{/* the created identity changed elsewhere; leave it to its owner and mint a fresh one on the next save */}
   }
   if(!adopted)await this.persist({...record,pending:undefined},epoch);
   return clone(this.record!);
  }
  const view=record.view!;
  const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:pending.request.expression_ref}),pending.request.expression_ref);
  if(!same(document,view.document)){
   const adopted=pending.kind==='edit'?rebaseCompositionView(view,pending.submitted.journey,document)
    :pending.kind==='blueprint'?this.adoptOwnerDocument(view,(basis,doc)=>blueprintReply(basis,pending.intent,doc),document)
    :pending.kind==='occurrence'?this.adoptOwnerDocument(view,(basis,doc)=>occurrenceReply(basis,pending.intent,doc),document)
    :pending.kind==='selection'?rebaseCompositionView(view,view.journey,document)
    :connectionView(view,document);
   await this.persist({...record,view:adopted,pending:undefined},epoch);
  }else await this.persist({...record,pending:undefined},epoch);
  return clone(this.record!);
 }
 async commit(snapshot:WorkingSnapshot):Promise<KernelExpressionDocument>{
  const epoch=this.begin(),submitted=clone(snapshot);
  try{
   validateJourney(submitted.journey);
   if(!submitted.journey.name.trim())throw new Error("Give the native composition a nonempty title before saving");
   let record:NativeWorkingRecord=this.record?clone(this.record):{schema:'oi.native-working/v1',draft_id:submitted.journey.id};
   if(record.draft_id!==submitted.journey.id)throw new Error('Select the native basis of this draft before saving');
   if(record.pending)record=await this.settlePending(record,epoch);
   if(!record.view){
    const expression_ref=this.ports.mint();
    if(!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(expression_ref))throw new Error('Native creation needs a stable safe Expression identity');
    record={...record,pending:{kind:'create',expression_ref,submitted}};
    await this.persist(record,epoch); // storage failure means no native effect
    const document=readDocument(await this.ports.expression({operation:'create',expression_ref,title:submitted.journey.name,actor:'human:expressions-app'}),expression_ref);
    record={...record,view:firstView(document,submitted),pending:undefined};
    await this.persist(record,epoch);
   }
   const view=record.view!;
   const request=prepareCompositionEdit(view,submitted.journey,{sceneId:submitted.sceneId,entityId:submitted.entityId});
   if(!request.changes.length)return clone(view.document);
   record={...record,pending:{kind:'edit',request,submitted}};
   await this.persist(record,epoch);
   const document=acceptCompositionReply(request,await this.ports.expression({...request}));
   if(!editMatches(record,request,submitted,document))throw new Error('Native acknowledgement does not contain the submitted composition; inspect before retrying');
   record={...record,view:rebaseCompositionView(view,submitted.journey,document),pending:undefined};
   await this.persist(record,epoch);
   return document;
  }finally{this.inFlight=false;}
 }
 /** Selection edits only the native focus and acknowledged revision. It never
  * commits the human's unsaved material, discloses it to an Agent, or remounts
  * the current physical field. */
 async select(selection:NativeSelection):Promise<void>{
  const epoch=this.begin();
  try{
   let record=this.record?clone(this.record):undefined;
   if(!record?.view)throw new Error('This representation has no native working basis');
   if(record.pending)record=await this.settlePending(record,epoch);
   if(!record.view)throw new Error('This representation has no native working basis');
   const request=selectionEdit(record.view,selection),change=request.changes[0],selected=record.view.document.selection;
   if(selected&&selected.scene_ref===change.scene_ref&&((change.change==='relation_focus'&&selected.relation_ref===change.binding_ref)||(change.change==='focus'&&!selected.relation_ref&&selected.entity_ref===change.entity_ref)))return;
   record={...record,pending:{kind:'selection',request}};
   await this.persist(record,epoch);
   const document=readDocument(await this.ports.expression({...request}),request.expression_ref);
   if(!selectionMatches(record.view!,request,document))throw new Error('Native selection reply changed more than its captured focus; preserve and reconcile');
   await this.persist({...record,view:rebaseCompositionView(record.view!,record.view!.journey,document),pending:undefined},epoch);
  }finally{this.inFlight=false;}
 }
 async editBlueprint(intent:BlueprintIntent):Promise<KernelConversion>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view)throw Error('Open a native Expression before applying a blueprint');
   let basis=record;
   if(basis.pending)basis=await this.settlePending(basis,epoch);
   if(!basis.view)throw Error('Open a native Expression before applying a blueprint');
   const {request,expected}=prepareBlueprintEdit(basis.view,intent);
   if(same(expected,basis.view!.document))return clone(basis.view!);
   await this.persist({...basis,pending:{kind:'blueprint',intent:clone(intent),request}},epoch);
   const reply=readDocument(await this.ports.expression({...request}),request.expression_ref);
   blueprintReply(record.view,intent,reply);
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   const view=blueprintReply(record.view,intent,observed);
   await this.persist({...record,view,pending:undefined},epoch);return view;
  }finally{this.inFlight=false;}
 }
 /** Exact native connection edit with durable intent and independent readback. */
 async editConnections(changes:Record<string,unknown>[]):Promise<KernelConversion>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view)throw new Error('Open a native Expression before editing its connections');
   let basis=record;
   if(basis.pending)basis=await this.settlePending(basis,epoch);
   if(!basis.view)throw new Error('Open a native Expression before editing its connections');
   const request=connectionEdit(basis.view,changes),expected=connectionResult(basis.view,request);
   if(same(expected,basis.view.document))return clone(basis.view);
   await this.persist({...basis,pending:{kind:'connections',request}},epoch);
   const reply=readDocument(await this.ports.expression({...request}),request.expression_ref);
   if(!same(reply,expected))throw new Error('Native connection acknowledgement differs from the captured edit; inspect before retrying');
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   if(!same(observed,expected))throw new Error('Native connection readback changed; preserve the pending edit and reconcile');
   const view=connectionView(record.view,observed);
   await this.persist({...record,view,pending:undefined},epoch);
   return view;
  }finally{this.inFlight=false;}
 }
 /** Duplicate one native source occurrence with durable intent and exact readback. */
 async duplicateOccurrence(intent:DuplicateOccurrenceIntent):Promise<KernelConversion>{return this.editOccurrence(intent);}
 async insertSource(intent:InsertSourceIntent):Promise<KernelConversion>{return this.editOccurrence(intent);}
 private async editOccurrence(intent:OccurrenceIntent):Promise<KernelConversion>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view)throw new Error('Open a native Expression before duplicating an occurrence');
   let basis=record;
   if(basis.pending)basis=await this.settlePending(basis,epoch);
   if(!basis.view)throw new Error('Open a native Expression before duplicating an occurrence');
   const captured=clone(intent),{request}=prepareOccurrenceEdit(basis.view,captured);
   await this.persist({...basis,pending:{kind:'occurrence',intent:captured,request}},epoch);
   const reply=readDocument(await this.ports.expression({...request}),request.expression_ref);
   occurrenceReply(basis.view,captured,reply);
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   const view=occurrenceReply(basis.view,captured,observed);
   await this.persist({...basis,view,pending:undefined},epoch);
   return view;
  }finally{this.inFlight=false;}
 }
 /** Re-admit an already saved, unchanged basis by reading its actual file and
  * then its current native head. This never writes a file or checkpoint. */
 async confirmSaved(snapshot:WorkingSnapshot,accept:()=>boolean=()=>true):Promise<NativeFile|undefined>{
  const epoch=this.begin(),basis=this.record;
  const current=()=>epoch===this.epoch&&this.record===basis&&accept();
  try{
   if(!current())throw Error('The selected work changed before its saved file was read');
   if(!basis?.view||!basis.file||basis.pending)return;
   const {view,file}=basis;
   if(file.document_revision!==view.document.revision)return;
   if(basis.draft_id!==snapshot.journey.id||prepareCompositionEdit(view,snapshot.journey,{sceneId:snapshot.sceneId,entityId:snapshot.entityId}).changes.length)return;
   const durable=await this.ports.expression({operation:'inspect_file',location:file.location,expected_file_revision:file.revision});
   if(!current())throw Error('The selected work changed while its saved file was read');
   const decoded=readDocument(durable,view.document.expression_ref),received=artifact(durable,view.document.expression_ref);
   if(!same(decoded,view.document)||!same(received,file))throw Error('The saved file differs from this complete native basis; reconcile it before saving');
   const inspected=await this.ports.expression({operation:'inspect',expression_ref:view.document.expression_ref});
   if(!current())throw Error('The selected work changed while its saved native head was read');
   const head=nativeOwnerSnapshot(inspected,view.document.expression_ref);
   if(!same(head.document,view.document)||!same(head.file,file))throw Error('The native head or file binding changed while its saved file was read');
   const standing=inspected as {dirty?:boolean;saved_revision?:number};
   if(standing.dirty!==false||standing.saved_revision!==view.document.revision)return;
   return clone(file);
  }finally{this.inFlight=false;}
 }
 async saveFile(snapshot:WorkingSnapshot,destination:SaveDestination):Promise<NativeFile>{
  const document=await this.commit(snapshot),epoch=this.begin();
  try{
   let record=this.record?clone(this.record):undefined;
   if(!record?.view||record.view.document.expression_ref!==document.expression_ref||record.draft_id!==snapshot.journey.id)throw new Error('The working position changed before file save; nothing was written to a different work');
   const intent=await this.ports.file({operation:'prepare',document,destination:record.file?{location:record.file.location,revision:record.file.revision}:destination});
   record={...record,pending:{kind:'file',intent}};
   await this.persist(record,epoch);
   const result=await this.ports.file({operation:'perform',intent}),file=artifact(result,document.expression_ref);
   await this.persist({...record,file,pending:undefined},epoch);
   return file;
  }finally{this.inFlight=false;}
 }
 async retryFile():Promise<NativeFile>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(record?.pending?.kind!=='file'||!record.view)throw new Error('There is no exact file-save operation to retry');
   const result=await this.ports.file({operation:'perform',intent:record.pending.intent});
   const file=artifact(result,record.view.document.expression_ref);
   await this.persist({...record,file,pending:undefined},epoch);return file;
  }finally{this.inFlight=false;}
 }
 async inspectPending():Promise<string>{
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined,pending=record?.pending;
   if(!record||!pending)throw new Error('There is no interrupted native operation');
   const basis=record.view;
   await this.settlePending(record,epoch);
   const settled=this.record!;
   if(!basis||!settled.view||same(settled.view.document,basis.document))return 'The interrupted operation was not applied. Nothing was replayed, and saving works again.';
   return 'The owner’s current document is now the working basis. Nothing was replayed; your draft edits remain as unsaved work.';
  }finally{this.inFlight=false;}
 }

private liveLifecycleReceipt?:StageLifecycleObservation;
private liveSourceRefusal:{epoch:number;operation_ref:string}|null=null;
private viewSource?:KernelConversion;
private viewSnapshot?:KernelConversion;
private replaceRecord(record:NativeWorkingRecord|undefined):void{
  this.record=record;this.viewSource=undefined;this.viewSnapshot=undefined;
 }
get acknowledgedView():KernelConversion|undefined{
  const view=this.record?.view;
  if(!view)return undefined;
  if(this.viewSource!==view){
   const snapshot=clone(view);
   const freeze=(value:unknown):void=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}};
   freeze(snapshot);this.viewSource=view;this.viewSnapshot=snapshot;
  }
  return this.viewSnapshot;
 }
inspect(){
  const record=this.record,view=record?.view;
  return {native_ref:view?.document.expression_ref,revision:view?.document.revision,
   file:record?.file?clone(record.file):undefined,pending:record?.pending?.kind,
   notes:clone(view?.notes??[]),bindings:view?clone(view.bindings):undefined};
 }
get settledLifecycle():StageLifecycleObservation|null{const receipt=this.liveLifecycleReceipt;return receipt&&this.record?.view&&!this.record.pending&&same(receipt.view.document,this.record.view.document)?clone(receipt):null;}
async editNativePerformance(expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number},operations:NativeScoreOperation[],accept:()=>boolean):Promise<KernelConversion>{
  const epoch=this.begin(),record=this.record?clone(this.record):undefined;
  let nativeReply:unknown,request:Record<string,unknown>={};
  try{
   if(!record?.view||record.pending||record.native_performance_failure||record.native_performance_edit||!accept())throw Error('Reconcile the current native draft before editing this score.');
   const basis=record.view.document,scene=basis.scenes.find(s=>s.scene_ref===expected.scene_ref);
   if(basis.expression_ref!==expected.expression_ref||basis.revision!==expected.document_revision||scene?.revision!==expected.scene_revision||!scene.performance||operations.length<1||operations.length>256)throw Error('The score edit has no current exact native Scene basis.');
   const allowed=new Set(['edit_event','remove_event','overdub','layer_set','route_set','route_clear','automate','loop','seek','tempo']);
   if(operations.some(op=>!allowed.has(op.operation)))throw Error('Native source, checkpoint and receipt custody cannot be authored by this score control.');
   request={operation:'edit',expression_ref:expected.expression_ref,expected_revision:expected.document_revision,actor:'human:expressions-app',changes:[{change:'scene_performance_edit',scene_ref:expected.scene_ref,operations:clone(operations)}]};
   await this.persist({...record,native_performance_edit:{state:'submitted',request:clone(request)}},epoch);
   nativeReply=await this.ports.expression(request);
   const doc=readDocument(nativeReply,expected.expression_ref),updated=doc.scenes.find(s=>s.scene_ref===expected.scene_ref);
   if(!updated||!updated.performance||!Number.isSafeInteger(updated.revision)||![basis.revision,basis.revision+1].includes(doc.revision))throw Error('The native score edit returned a different revision or lost its performance.');
   const unchanged=clone(doc);unchanged.revision=basis.revision;
   const original=unchanged.scenes.find(s=>s.scene_ref===expected.scene_ref)!;original.revision=scene.revision;original.performance=clone(scene.performance);
   if(!same(unchanged,basis))throw Error('The score edit changed source membership, another Scene, selection or authored presentation.');
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:expected.expression_ref}),expected.expression_ref);
   if(!same(observed,doc))throw Error('The independent native score readback differs from the actual edit receipt.');
   if(epoch!==this.epoch||!accept())throw Error('The selected work changed while its native score edit returned.');
   const view=connectionView(record.view,doc);await this.persist({...record,view,native_performance_edit:undefined},epoch);return clone(view);
  }catch(error){
   if(record?.view&&Object.keys(request).length){
    const retained={...record,native_performance_edit:{state:'unknown' as const,request:clone(request),native_reply:nativeReply===undefined?null:clone(nativeReply),reason:String(error)}};
    // Keep the original request/reply in this exact work even when its draft
    // checkpoint fails. A storage failure may not mask the native edit failure.
    if(epoch===this.epoch)this.replaceRecord(clone(retained));
    try{await this.persist(retained,epoch);}catch(storageError){throw new AggregateError([error,storageError],'Native score edit and its draft checkpoint both failed.');}
   }
   throw error;
  }finally{this.inFlight=false;}
 }
async resolveNativePerformanceEdit(accept:()=>boolean):Promise<KernelConversion>{
  const epoch=this.begin(true),record=this.record?clone(this.record):undefined;
  try{
   if(!record?.view||record.pending||record.native_performance_failure||!accept())throw Error('The native score reconciliation has no current selected Document.');
   const pending=record.native_performance_edit;if(!pending)return clone(record.view);
   const basis=record.view.document,observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:basis.expression_ref}),basis.expression_ref);
   if(epoch!==this.epoch||!accept())throw Error('The work changed while the native score read returned.');
   let view:KernelConversion;
   if(same(observed,basis))view=record.view;
   else{
    if(!pending.native_reply)throw Error('The native Document changed without the original score edit ACK; the exact pending intent remains retained.');
    const original=readDocument(pending.native_reply,basis.expression_ref);
    if(!same(original,observed))throw Error('The current native Document differs from the original score edit receipt; its pending intent remains retained.');
    const sceneRef=(pending.request.changes as {scene_ref:string}[])[0].scene_ref,oldScene=basis.scenes.find(s=>s.scene_ref===sceneRef),nextScene=original.scenes.find(s=>s.scene_ref===sceneRef);
    if(!oldScene||!nextScene?.performance||![basis.revision,basis.revision+1].includes(original.revision))throw Error('The original score receipt lost the selected native Scene or CAS revision.');
    const unchanged=clone(original);unchanged.revision=basis.revision;const selected=unchanged.scenes.find(s=>s.scene_ref===sceneRef)!;selected.performance=clone(oldScene.performance);selected.revision=oldScene.revision;
    if(!same(unchanged,basis))throw Error('The original score receipt changed another source, Scene, selection or presentation.');
    view=connectionView(record.view,observed);
   }
   await this.persist({...record,view,native_performance_edit:undefined},epoch);return clone(view);
  }finally{this.inFlight=false;}
 }
async acceptNativeSource(result:any,expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number},accept:()=>boolean):Promise<KernelConversion>{
  const epoch=this.begin(),record=this.record?clone(this.record):undefined;
  try{
   if(!record?.view||record.pending||record.native_source_failure||!accept())throw Error('The native source reply has no current acknowledged Document basis.');
   const basis=record.view.document,selected=basis.scenes.find(scene=>scene.scene_ref===expected.scene_ref);
   if(basis.expression_ref!==expected.expression_ref||basis.revision!==expected.document_revision||selected?.revision!==expected.scene_revision)throw Error('The source reply belongs to another original selected Document/Scene CAS.');
   const retained=result?.schema==='oi.native-expression-selected-scene-source/v1';
   const bootstrap=result?.schema==='oi.expression-procedural-source-bootstrap/v1';
   if(!retained&&!bootstrap)throw Error('The actual native source owner result is missing.');
   const raw=retained?result.document_result?.document:result.binding_adoption?.document_receipt?.document;
   if(!raw)throw Error('The original source reply omitted its native Document readback.');
   const doc=kernelDocumentToJourney(raw).document;
   if(doc.expression_ref!==basis.expression_ref||![basis.revision,basis.revision+1].includes(doc.revision))throw Error('The source owner returned a different Document or CAS revision.');
   const target=retained?result.world_source_scene?.scene_ref:expected.scene_ref;
   const before=basis.scenes.find(scene=>scene.scene_ref===target),after=doc.scenes.find(scene=>scene.scene_ref===target);
   if(!before||!after)throw Error('The native source target Scene is absent.');
   const unchanged=clone(doc);unchanged.revision=basis.revision;
   const row=unchanged.scenes.find(scene=>scene.scene_ref===target)!;row.revision=before.revision;row.presentation=clone(before.presentation);
   if(!same(unchanged,basis))throw Error('The source transaction changed membership, score, selection or another native Scene.');
   const view=connectionView(record.view,doc);
   await this.ports.checkpoint(record.draft_id,clone({...record,view}));
   if(epoch!==this.epoch||!accept())throw Error('The selected work changed while retaining its original native source reply.');
   this.replaceRecord(clone({...record,view}));return clone(view);
  }catch(error){if(record&&epoch===this.epoch)await this.persist({...record,native_source_failure:{result:clone(result),expected:clone(expected),reason:String(error)}},epoch);throw error;}
  finally{this.inFlight=false;}
 }
async acceptNativePerformance(result:any,expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number},accept:()=>boolean):Promise<KernelConversion>{
  const epoch=this.begin(),record=this.record?clone(this.record):undefined;
  try{
   if(!record?.view||record.pending||record.native_performance_failure||record.native_performance_edit)throw Error('Reconcile the retained native draft/failure before capturing another performance pulse.');
   const basis=record.view.document,scene=basis.scenes.find(s=>s.scene_ref===expected.scene_ref);
   if(basis.expression_ref!==expected.expression_ref||basis.revision!==expected.document_revision||scene?.revision!==expected.scene_revision||!accept())throw Error('The actual native performance reply belongs to a changed Document or Scene.');
   if(result?.schema!=='oi.native-scene-recording-result/v1'||result.accepted!==true||!result.currentness||!Object.hasOwn(result.currentness,'Ok')){
    await this.persist({...record,native_performance_failure:clone(result)},epoch);throw Error('The original native recording refusal is retained; no later pulse replaces it.');
   }
   const application=result.application?.Ok;
   if(application===null)return clone(record.view);
   if(application?.result!=='expression'||!application.data?.document)throw Error('The actual native performance transaction omitted its Document result.');
   const doc=kernelDocumentToJourney(application.data.document).document,updated=doc.scenes.find(s=>s.scene_ref===expected.scene_ref);
   if(doc.expression_ref!==basis.expression_ref||!updated||!Number.isSafeInteger(updated.revision)||doc.revision!==basis.revision+1)throw Error('Native performance CAS revision/result differs from the original addressed work.');
   const unchanged=clone(doc);unchanged.revision=basis.revision;
   const original=unchanged.scenes.find(s=>s.scene_ref===expected.scene_ref)!;original.revision=scene!.revision;
   if(Object.hasOwn(scene!,'performance'))original.performance=clone(scene!.performance);else delete original.performance;
   if(!same(unchanged,basis))throw Error('A recording transaction changed source membership, selection, another Scene or presentation.');
   const view=connectionView(record.view,doc);
   if(epoch!==this.epoch||!accept())throw Error('The selected work changed while its native performance reply returned.');
   await this.ports.checkpoint(record.draft_id,clone({...record,view}));
   if(epoch!==this.epoch||!accept())throw Error('The selected work changed while retaining the native performance reply.');
   this.replaceRecord(clone({...record,view}));return clone(view);
  }finally{this.inFlight=false;}
 }
async stageLibrary(intent:StageLibraryIntent,retry=false):Promise<NativeStageLibraryReply>{
  const captured=clone(intent);nativeStageLibraryRequest(captured,retry);
  const epoch=this.begin();
  try{
   const record=this.record?clone(this.record):undefined;
   if(!record?.view||!this.ports.stageLibrary)throw Error('The actual native Stage library factory is unavailable');
   const previous=record.pending;
   if(previous&&(previous.kind!=='native-stage-library'||!same(previous.intent,captured)))throw Error('Another full original native intent remains retained');
   if(record.view.document.expression_ref!==captured.basis.expression_ref)throw Error('Native library belongs to another Expression');
   const pending:PendingNativeStageLibrary=previous?clone(previous as PendingNativeStageLibrary):{kind:'native-stage-library',intent:captured,dispatch_state:'not_dispatched'};
   validatePendingNativeStageLibrary(pending,record.view);
   if(!retry&&previous)requireInitialNativeStageLibraryDispatch(pending);
   // Persist the attempt BEFORE calling even a transport which can lose its
   // result. A later absent native memo cannot authorize another compilation.
   if(!retry)pending.dispatch_state='dispatched';
   await this.persist({...record,pending},epoch);
   const receive=async(raw:unknown)=>{
    if(retry)pending.recovery_reply=clone(raw);else pending.native_reply=clone(raw);
    await this.persist({...record,pending},epoch);
    if(epoch!==this.epoch)throw Error('Native library returned to a replaced draft; its original reply is checkpointed');
   };
   const raw=await this.ports.stageLibrary(captured,retry,receive);
   if(epoch!==this.epoch)throw Error('Native library returned after the selected work changed');
   const retained=retry?pending.recovery_reply:pending.native_reply;
   if(!same(raw,retained))throw Error('Native library transport differs from its checkpointed full original reply');
   const result=validateNativeStageLibraryReply(captured,raw,retry);
   if('found' in result&&result.found===false&&pending.dispatch_state!=='not_dispatched')throw Error('Original attempted compilation has no retained terminal native proof; its standing remains unknown and no fresh dispatch is permitted');
   if('state' in result&&result.state==='no_change'&&result.source_current===true)await this.persist({...record,pending:undefined},epoch);
   return result;
  }finally{this.inFlight=false;}
 }
async procedural(request:ProceduralRequest):Promise<unknown>{
  const epoch=this.begin(!mutatesProcedure(request));
  try{
   let record=this.record?clone(this.record):undefined;
   if(!record?.view)throw Error('Open a native Expression before a procedural operation');
   if(['lifecycle','lifecycle_cancel'].includes((request as {operation:string}).operation))throw Error('Use work.lifecycle with its retained full original intent before a native lifecycle mutation');
   if((request as {operation:string}).operation==='authored_driver')throw Error('Use work.authoredDriver with full PendingNativeAuthoredDriver before mutation');
   if((request as {operation:string}).operation==='read_authored_drivers'){const read=request as unknown as {expression_ref:string;expected_revision:number};if(read.expression_ref!==record.view.document.expression_ref||read.expected_revision!==record.view.document.revision)throw Error('Authored driver read differs from the actual current Expression/CAS');}
   if(request.operation==='control')throw Error('Use the retained native control intent path: work.control requires the full original PendingNativeControl before mutation');
   if(request.operation==='read_driver'&&(request.expression_ref!==record.view.document.expression_ref||request.expected_revision!==record.view.document.revision))throw Error('Native driver read differs from the actual current Expression/CAS');
   if(!mutatesProcedure(request)){
    if((request.operation==='read'||request.operation==='read_outputs'||request.operation==='read_source')&&request.expression_ref!==record.view.document.expression_ref)throw Error('Procedural read belongs to another Expression');
    return await this.ports.expression({operation:'procedural',request:clone(request)});
   }
   if(record.pending?.kind==='native-lifecycle'){
    const lifecycle=clone(record.pending);
    if(request.operation==='prepare'||request.operation_ref!==lifecycle.intent.operation_ref||!lifecycle.source_reply||!lifecycle.material_reply?.operation)throw Error('The pending lifecycle permits only review/Commit/Cancel of its exact actual S operation; full original intent remains retained');
    const inspected=await this.ports.expression({operation:'procedural',request:{operation:'inspect_operation',operation_ref:lifecycle.intent.operation_ref}}) as {operation?:unknown};
    const accepted=validateOperation(inspected.operation);if(accepted.envelope.producer_ref!==lifecycle.source_reply.preparation?.producer_ref||!same(accepted.envelope.changes,(lifecycle.source_reply.preparation?.prepared.native_edit as {changes?:unknown[]})?.changes))throw Error('Current lifecycle S journal differs from its original Source preparation');
    lifecycle.material=pendingProcedure(request,record.view,accepted);await this.persist({...record,pending:lifecycle},epoch);
    const receipt=validateProceduralReply(await this.ports.expression({operation:'procedural',request:clone(request)}),lifecycle.material),document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref),view=proceduralReplyView(record.view,receipt,document);lifecycle.material_reply=clone(receipt);lifecycle.material=undefined;await this.persist({...record,view,pending:lifecycle},epoch);
    if(receipt.operation.status==='applied'&&this.ports.lifecycleSettlement){
     const raw=await this.ports.lifecycleSettlement(clone(lifecycle.intent));
     const original=kernelDocumentToJourney(lifecycle.source_reply.document),sceneId=Object.entries(original.bindings).find(([,b])=>b.scene_ref===lifecycle.intent.scene_ref)?.[0];if(!sceneId)throw Error('Original lifecycle Source Scene is unavailable');
     const result=validateStageLifecycleReply({view:original,journey:original.journey,sceneId,selected:[]},lifecycle.intent,raw,lifecycle.source_reply);
     if(result.state!=='applied'||!same(result.operation,receipt.operation)||!same(result.view.document,document))throw Error('Material is applied in S; SAME Source lifecycle settlement remains unobserved. Full intent/receipts retained');
     await this.persist({...record,view,pending:undefined},epoch);this.liveLifecycleReceipt=clone(result);
    }
    if(receipt.operation.status==='cancelled'){
     // S cancellation retains Source pending until the protected same owner
     // confirms material_abandoned. No saved label or second clock releases it.
     const updated=this.record?clone(this.record):undefined;
     if(!updated?.view||updated.pending?.kind!=='native-lifecycle')throw Error('Cancelled lifecycle lost its full original retained Source intent');
     if(this.ports.lifecycleCancel)await this.abandonLifecycle(updated,clone(updated.pending),epoch);
    }
    return receipt;
   }
   const library=record.pending?.kind==='native-stage-library'?clone(record.pending):undefined;
   if(library){
    if(request.operation!=='prepare')throw Error('Native library permits only normal Prepare of its original issued Envelope');
    const issued=validateNativeStageLibraryReply(library.intent,library.recovery_reply??library.native_reply,!!library.recovery_reply);
    if(!('envelope' in issued)||!issued.envelope||!same(issued.envelope,request.envelope))throw Error('Normal Prepare differs from the retained native issued Envelope');
   }else if(record.pending)record=await this.settlePending(record,epoch);
   if(!record.view)throw Error('The procedure lost its native document basis');
   let accepted;
   if(request.operation==='prepare'){
    // Prepare can have committed its journal before a reply was lost. Resolve
    // that exact original operation before requiring a fresh captured CAS.
    const original=await this.ports.expression({operation:'procedural',request:{operation:'inspect_operation',operation_ref:request.envelope.operation_ref}}) as {schema?:string;state?:string;operation_ref?:string;operation?:unknown};
    if(original?.operation){
     const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
     const resolved=preparationRetryView(request,record.view,original,document);
     await this.persist({...record,view:resolved.view,pending:undefined},epoch);
     return resolved.reply;
    }
    if(original?.schema!=='oi.expression-procedural/v1'||original.state!=='absent'||original.operation_ref!==request.envelope.operation_ref)throw Error('Native original preparation standing is unknown; preserve its complete intent without replay');
   }
   if(library&&request.operation==='prepare'){
    if(library.intent.action!=='prepare')throw Error('Regeneration needs the actual Rule-owned explicit event/current Source producer; initial install or CLI compilation cannot stand in for that event');
    if(!this.ports.stageDefinition)throw Error('The actual SAME-session first native definition admission is unavailable; full compiled intent remains retained before normal Prepare');
    const target:NativeDefinitionTarget={basis:clone(library.intent.basis),source_producer_ref:request.envelope.producer_ref??null,request:{action:'install_prepared'}};
    const prior=library.definition?clone(library.definition):undefined;
    const capture=async(context:import('./native-field/ql/instrument-session.mjs').NativeDocumentTransactionContext,original:import('./proceduralNativeDefinition').NativeDefinitionRequest)=>{
     const sealed=validateNativeDefinitionRequest(target,context,original);
     if(prior)throw Error('The original first definition is already retained; do not issue a replacement request');
     library.definition={dispatch_state:'dispatched',context:clone(context),original_request:sealed};
     await this.persist({...record!,pending:clone(library)},epoch);
    };
    let retained=false;
    const receive=async(raw:unknown,recovery:boolean)=>{
     if(retained||!library.definition)throw Error('The original definition callback custody is missing or already retained');
     retained=true;
     if(recovery)library.definition.recovery_reply=clone(raw);else library.definition.raw_reply=clone(raw);
     // Diagnostic original bytes precede lifetime validation and actual ACK.
     await this.persist({...record!,pending:clone(library)},epoch);
    };
    const raw=await this.ports.stageDefinition(target,capture,receive,prior);
    if(!retained||!library.definition)throw Error('The native definition returned without retaining its sealed original request/full raw outcome');
    validateInitialNativeDefinition(library.intent,request.envelope,library.definition,raw,!!prior);
    const actual=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
    if(!same(actual,record.view.document))throw Error('The first definition returned after its complete current Document changed; original intent/ACK remains retained before normal Prepare');
   }
   if(request.operation!=='prepare'){
    const inspected=await this.ports.expression({operation:'procedural',request:{operation:'inspect_operation',operation_ref:request.operation_ref}}) as {operation?:unknown};
    accepted=validateOperation(inspected.operation);
    if(accepted.envelope.expression_ref!==record.view.document.expression_ref)throw Error('The admitted procedure belongs to another Expression');
   }
   const pending=pendingProcedure(request,record.view,accepted);
   if(library)library.material=clone(pending);
   await this.persist({...record,pending:library??pending},epoch);
   const raw=await this.ports.expression({operation:'procedural',request:clone(request)});
   if(library){library.material_reply=clone(raw);await this.persist({...record,pending:library},epoch);}
   const receipt=validateProceduralReply(raw,pending);
   const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:record.view.document.expression_ref}),record.view.document.expression_ref);
   const view=proceduralReplyView(record.view,receipt,document);
   await this.persist({...record,view,pending:undefined},epoch);
   return receipt;
  }finally{this.inFlight=false;}
 }
async openSelectedScene(request:NativeSelectedSceneRequest,accept:()=>boolean,recover=false,dispatch?:(request:NativeSelectedSceneRequest,receive:(reply:unknown)=>Promise<void>)=>Promise<unknown>):Promise<SelectedSceneOpening>{
  const epoch=this.begin();try{
   let record=this.record?clone(this.record):undefined;if(!record?.view)throw Error('Open the original native Expression before its selected World');
   validateSelectedSceneRequest(request,record.view);
   if(recover){if(record.pending?.kind!=='native-selected-scene-open'||!same(record.pending.request,request))throw Error('Recovery requires the complete original retained selected Scene request');}
   else {
    if(record.pending)throw Error('The original native operation remains retained; no second selected World was composed');
    const sceneId=Object.entries(record.view.bindings).find(([,b])=>b.scene_ref===request.scene_ref)?.[0];
    const reason=sceneId?selectedSceneSourceReason(record.view,sceneId):'The original native Scene has no current view occurrence';if(reason)throw Error(reason);
   }
   const port=dispatch??(recover?this.ports.selectedSceneRecover:this.ports.selectedSceneOpen);
   if(!port)throw Error('The actual selected Scene opening/recovery controller port is not paired');
   const before=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   if(!same(before,record.view.document)||!accept()||epoch!==this.epoch)throw Error('The original native Document/selection changed before opening');
   const pending:PendingNativeSelectedScene=recover?clone(record.pending as PendingNativeSelectedScene):{kind:'native-selected-scene-open',request:clone(request)};
   await this.persist({...record,pending},epoch);
   if(!accept()||epoch!==this.epoch)throw Error('New local input is retained; the selected World was not dispatched');
   let received:SelectedSceneOpening|undefined;
   const result=await port(clone(request),async raw=>{
    // Retain the actual receipt before Session/GPU admission. A refused or
    // changed-basis native opening is never erased or relabelled as success.
    if(recover)pending.recovery_reply=clone(raw);else pending.native_reply=clone(raw);
    await this.persist({...record!,pending:clone(pending)},epoch);
    const opened=recover?validateSelectedSceneRecovery(raw,request,record!.view!):validateSelectedSceneOpen(raw,request,record!.view!);
    const actual=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
    if(!same(actual,before)||!accept()||epoch!==this.epoch)throw Error('The native opening returned after its original full Document/selection changed; intent remains retained');
    received=opened;
   });
   if(!received||!same(result,received)||!accept()||epoch!==this.epoch)throw Error('The actual selected World admission is unobserved on its original current basis; retain its opening');
   const actual=readDocument(await this.ports.expression({operation:'inspect',expression_ref:request.expression_ref}),request.expression_ref);
   if(!same(actual,before))throw Error('The selected native Document changed during admission; original opening remains retained');
   await this.persist({...record,pending:undefined},epoch);return clone(received);
  }finally{this.inFlight=false;}
 }
async retainSelectedSceneSource(selection:NativeSelectedSceneRequest,actor:string,accept:()=>boolean,recover=false):Promise<SelectedSceneSourceReply>{
  const epoch=this.begin();let sourceReceiving=true;try{
   const record=this.record?clone(this.record):undefined;if(!record?.view)throw Error('Open the actual native Expression before saving its World source');
   validateSelectedSceneRequest(selection,record.view);
   if(!this.ports.selectedSceneSource)throw Error('The actual World source SAME-session getter/receipt port is not paired');
   let pending:PendingNativeSelectedSceneSource;
   if(recover){
    if(record.pending?.kind!=='native-selected-scene-source'||!same(record.pending.selection,selection)||record.pending.actor!==actor||!record.pending.request||!record.pending.context)throw Error('Recovery requires the complete original source request and actual Session context');
    pending=validatePendingSelectedSource(record.pending,record.view);
   }else{if(record.pending)throw Error('The original native operation remains retained; a second source observation was not submitted');pending={kind:'native-selected-scene-source',selection:clone(selection),actor};}
   const original=clone(record.view.document);
   if(!recover){const before=readDocument(await this.ports.expression({operation:'inspect',expression_ref:selection.expression_ref}),selection.expression_ref);if(!same(before,original)||!accept()||epoch!==this.epoch)throw Error('The original current selected Document changed before source retention');}
   await this.persist({...record,pending:clone(pending)},epoch);
   const raw=await this.ports.selectedSceneSource(clone(selection),actor,async(request,context)=>{
    if(!sourceReceiving||epoch!==this.epoch)throw Error('Late source capture cannot replace a later Working operation');
    if(pending.request&&!same(pending.request,request)||pending.context&&!same(pending.context,context))throw Error('The original source request/context was substituted');
    pending.request=clone(request);pending.context=clone(context);validatePendingSelectedSource(pending,record.view!);
    await this.persist({...record,pending:clone(pending)},epoch);
    if(!accept()||epoch!==this.epoch)throw Error('New local work remains retained; original source observation was not dispatched');
   },async reply=>{
    if(!sourceReceiving||epoch!==this.epoch)throw Error('Late source reply cannot replace a later Working operation');
    if(recover)pending.recovery_reply=clone(reply);else pending.native_reply=clone(reply);
    await this.persist({...record,pending:clone(pending)},epoch);
   },recover?{request:clone(pending.request!),context:clone(pending.context!)}:undefined);
   if(!pending.request||!accept()||epoch!==this.epoch)throw Error('Actual native source returned after newer local work; original request/context/ACK are retained');
   const actual=readDocument(await this.ports.expression({operation:'inspect',expression_ref:selection.expression_ref}),selection.expression_ref);
   const view=selectedSourceReplyView(record.view,pending.request,raw,actual,recover);
   if(!accept()||epoch!==this.epoch)throw Error('The original source document returned after newer local input; exact receipts remain retained');
   await this.persist({...record,view,pending:undefined},epoch);return clone(raw) as SelectedSceneSourceReply;
  }finally{sourceReceiving=false;if(epoch===this.epoch)this.epoch++;this.inFlight=false;} // Fence ignored callback/checkpoint completion after this source barrier.
 }
async abandonSelectedScene():Promise<unknown>{
  const epoch=this.begin();try{
   const record=this.record?clone(this.record):undefined,pending=record?.pending;
   if(!record?.view||pending?.kind!=='native-selected-scene-open'||!this.ports.selectedSceneAbandon)throw Error('The original selected Scene abandonment owner is unavailable');
   validatePendingSelectedScene(pending,record.view);
   const reply=await this.ports.selectedSceneAbandon(clone(pending.request));
   // Retain the genuine closure before validation, including a rejected reply.
   // A recovery-only opening still names its original lease and cannot permit
   // a foreign closure to erase the retained request.
   pending.abandonment_reply=clone(reply);await this.persist({...record,pending:clone(pending)},epoch);
   validateSelectedSceneAbandonment(reply,pending.request);
   const originals=[pending.native_reply,(pending.recovery_reply as {original_open?:unknown}|undefined)?.original_open].filter(value=>value!==undefined);
   if(originals.some(value=>(value as {lease?:unknown})?.lease!==(reply as {lease?:unknown}).lease))throw Error('Native abandonment closed another lease; original intent and closure remain retained');
   await this.persist({...record,pending:undefined},epoch);return clone(reply);
  }finally{this.inFlight=false;}
 }
async bootstrapSource(intent:StageSourceBootstrapIntent):Promise<StageSourceBootstrapOutcome>{
  const epoch=this.begin();
  try{
   let record=this.record?clone(this.record):undefined;if(!record?.view)throw Error('Open the original native Source Expression');
   if(record.pending&&record.pending.kind!=='native-source-bootstrap')record=await this.settlePending(record,epoch);
   if(!record.view)throw Error('The retained Source intent lost its original native Document');
   if(record.pending?.kind==='native-source-bootstrap'&&!same(record.pending.intent,intent))throw Error('Another complete Source intent is retained; no operation ID, CAS or authorship was replaced');
   const wasPending=record.pending?.kind==='native-source-bootstrap';
   if(!this.ports.sourceBootstrapRetry)throw Error('The guarded original Source cache lookup is not paired');
   // Look up the exact original identity before fresh Source admission. A
   // repeated unchanged-CAS Source receipt is still historical; it cannot be
   // treated as a new session ACK merely because no Document Edit occurred.
   let raw:unknown=await this.ports.sourceBootstrapRetry(clone(intent));
   if((raw as {state?:string})?.state==='cache_miss'){
    validateStageBootstrapCacheMiss(intent,raw,record.view);
    if(wasPending)throw Error('Native owner confirms no original binding admission at this CAS. Original intent remains retained; explicitly read/requalify before another Source operation');
    const original=pendingStageBootstrap(intent,record.view);validatePendingStageBootstrap(original,record.view);
    if(!this.ports.sourceBootstrap)throw Error('The actual private Source request/session receipt port is not paired');
    await this.persist({...record,pending:original},epoch);raw=await this.ports.sourceBootstrap(clone(original.request));
   }

   if(isStageBootstrapRefusal(raw)){
    const inspected=await this.ports.expression({operation:'inspect',expression_ref:intent.basis.expression_ref});
    const observation=validateStageBootstrapRefusal(intent,raw,record.view,inspected),pending=record.pending?.kind==='native-source-bootstrap'?record.pending:pendingStageBootstrap(intent,record.view);
    await this.persist({...record,pending:{...pending,observation}},epoch);if(epoch===this.epoch)this.liveSourceRefusal={epoch,operation_ref:intent.operation_ref};return clone(observation);
   }
   const result=validateStageBootstrapReceipt(intent,raw,record.view);
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:intent.basis.expression_ref}),intent.basis.expression_ref);
   if(!same(observed,result.view.document))throw Error('Source binding returned but exact current native Document changed; original intent remains retained');
   await this.persist({...record,view:result.view,pending:undefined},epoch);return clone(result.receipt);
  }finally{this.inFlight=false;}
 }
async requalifySourceBootstrap():Promise<void>{
  const epoch=this.begin();try{
   const record=this.record?clone(this.record):undefined,pending=record?.pending;
   if(pending?.kind!=='native-source-bootstrap'||!record?.view||!this.ports.sourceBootstrapRetry)throw Error('The original Source requalification owner is unavailable');
   const raw=await this.ports.sourceBootstrapRetry(clone(pending.intent));let view=record.view;
   if(pending.observation&&(raw as {state?:string})?.state==='revision_conflict'){
    if(this.liveSourceRefusal?.epoch!==epoch||this.liveSourceRefusal.operation_ref!==pending.intent.operation_ref)throw Error('Restored/cold Source refusal remains diagnostic only; no changed-Document recovery is granted from saved history');
    const lookup=raw as {schema?:string;state?:string;original_intent?:unknown;expression_ref?:string;document_revision?:number;document_receipt?:unknown;native_receipt?:unknown;historical_native_receipt?:unknown;native_procedural_receipts?:unknown[];source_current?:boolean;replayed?:boolean;qualification?:string};
    if(lookup.schema!=='oi.expression-procedural-source-bootstrap/v1'||!same(lookup.original_intent,pending.request.input)||lookup.expression_ref!==pending.intent.basis.expression_ref||lookup.native_receipt!==null||lookup.historical_native_receipt!==null||!Array.isArray(lookup.native_procedural_receipts)||lookup.native_procedural_receipts.length||lookup.source_current!==false||lookup.replayed!==false||lookup.qualification!=='unqualified')throw Error('The known Source refusal has no guarded current owner lookup; original intent remains retained');
    const document=readDocument(lookup.document_receipt,pending.intent.basis.expression_ref);
    if(document.revision!==lookup.document_revision||same(document,record.view.document)||!same(document,pending.observation.document_receipt.document))throw Error('The current Document changed beyond its original known Source refusal; retain and inspect its actual owner');
    view=connectionView(record.view,document);
   }else if((raw as {state?:string})?.state==='cache_miss')validateStageBootstrapCacheMiss(pending.intent,raw,view);
   else view=validateStageBootstrapReceipt(pending.intent,raw,view).view;
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:pending.intent.basis.expression_ref}),pending.intent.basis.expression_ref);
   if(!same(observed,view.document))throw Error('The actual Source requalification Document changed; original intent remains retained');
   await this.persist({...record,view,pending:undefined},epoch);
  }finally{this.inFlight=false;}
 }
async lifecycle(intent:NativeLifecycleIntent,retry=false):Promise<StageLifecycleObservation>{
  const epoch=this.begin();try{
   let record=this.record?clone(this.record):undefined;if(!record?.view)throw Error('Open the original native lifecycle Expression');
   if(record.pending&&record.pending.kind!=='native-lifecycle')record=await this.settlePending(record,epoch);
   if(!record.view)throw Error('The lifecycle lost its native Document');
   const previous=record.pending?.kind==='native-lifecycle'?record.pending:undefined;
   if(previous&&!same(previous.intent,intent))throw Error('Another complete original lifecycle intent remains retained; no target, actor, action or operation ID was replaced');
   if(previous&&!retry)throw Error('Inspect/retry the retained original lifecycle through its guarded native owner; do not send another Source request');
   const basis=previous?.source_reply?.document??record.view.document,v=kernelDocumentToJourney(basis,{identity:{expression:record.view.journey.id,scenes:Object.fromEntries(Object.entries(record.view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:record.view.entity_ids}}),sceneId=Object.entries(v.bindings).find(([,b])=>b.scene_ref===intent.scene_ref)?.[0];
   if(!sceneId)throw Error('The original lifecycle Scene is unavailable');const snapshot={view:v,journey:v.journey,sceneId,selected:[]};validateStageLifecycleIntent(snapshot,intent);
   const send=retry?this.ports.lifecycleRetry:this.ports.lifecycle;if(!send)throw Error('The actual native lifecycle session/factory/recovery route is not paired');
   const pending:PendingNativeLifecycle=previous??{kind:'native-lifecycle',intent:clone(intent)};await this.persist({...record,pending},epoch);
   const raw=await send(clone(intent)),result=validateStageLifecycleReply(snapshot,intent,raw,pending.source_reply);if(!pending.source_reply&&['prepared','pending_reception'].includes(result.state))pending.source_reply=clone(result.native_reply);else if(['historical_retry','source_refused','revision_conflict','reconciliation_required'].includes(result.state))pending.last_reply=clone(result.native_reply);await this.persist({...record,pending},epoch);
   if(result.state==='historical_retry'||['source_refused','revision_conflict','reconciliation_required'].includes(result.state))return result;
   if(result.state==='applied'){
    const inspected=readDocument(await this.ports.expression({operation:'inspect',expression_ref:intent.expression_ref}),intent.expression_ref);if(!same(inspected,result.view.document))throw Error('Current native lifecycle Document changed after settlement; original intent remains retained');await this.persist({...record,view:result.view,pending:undefined},epoch);this.liveLifecycleReceipt=clone(result);return result;
   }
   if(retry)throw Error('The native lifecycle retry did not return settled or historical original standing; retain the full intent');
   const prepared=result.native_reply.prepare_request;
   if(!prepared||prepared.operation!=='prepare')throw Error('The actual native-issued lifecycle prepare_request is unavailable; Source intent remains retained');
   const admission=result.native_reply.preparation!,edit=admission.prepared.native_edit as {changes:unknown[]};
   if(prepared.envelope.operation_ref!==intent.operation_ref||prepared.envelope.expected_revision!==intent.expected_revision||prepared.envelope.expression_ref!==intent.expression_ref||prepared.envelope.actor!==intent.actor||prepared.envelope.producer_ref!==admission.producer_ref||!same(prepared.envelope.changes,edit.changes))throw Error('Native-issued lifecycle Envelope differs from its exact original admitted Source edit');
   const material=pendingProcedure(prepared,record.view);pending.material=material;await this.persist({...record,pending},epoch);
   const original=await this.ports.expression({operation:'procedural',request:{operation:'inspect_operation',operation_ref:intent.operation_ref}}) as {schema?:string;state?:string;operation_ref?:string;operation?:unknown};
   let receipt:ProceduralReply&{operation:import('./proceduralProtocol.js').Operation},view:KernelConversion;
   if(original.operation){const doc=readDocument(await this.ports.expression({operation:'inspect',expression_ref:intent.expression_ref}),intent.expression_ref),admitted=preparationRetryView(prepared,record.view,original,doc);receipt=admitted.reply;view=admitted.view;}
   else {if(original.schema!=='oi.expression-procedural/v1'||original.state!=='absent'||original.operation_ref!==intent.operation_ref)throw Error('Native lifecycle preparation standing is unknown; retain original Source and material request');receipt=validateProceduralReply(await this.ports.expression({operation:'procedural',request:clone(prepared)}),material);const doc=readDocument(await this.ports.expression({operation:'inspect',expression_ref:intent.expression_ref}),intent.expression_ref);view=proceduralReplyView(record.view,receipt,doc);}
   pending.material_reply=clone(receipt);pending.material=undefined;await this.persist({...record,view,pending},epoch);return {...result,view,operation:clone(receipt.operation)};
  }finally{this.inFlight=false;}
 }
private async abandonLifecycle(record:NativeWorkingRecord,pending:PendingNativeLifecycle,epoch:number):Promise<StageLifecycleObservation>{
  if(!record.view||!pending.source_reply||!pending.material_reply?.operation||pending.material_reply.operation.status!=='cancelled')throw Error('Source abandonment requires the original native preparation and actual S cancellation');
  if(!this.ports.lifecycleCancel)throw Error('The protected same-owner Source cancellation route is unavailable; actual S Cancel is retained separately');
  const intent=pending.cancellation?.intent??stageLifecycleCancelIntent(record.view,pending.intent,pending.source_reply,pending.material_reply.operation);
  validateStageLifecycleCancelIntent(record.view,pending.intent,pending.source_reply,intent,pending.material_reply.operation);
  pending.cancellation={...pending.cancellation,intent:clone(intent)};await this.persist({...record,pending},epoch);
  // The native owner consumes this genuine ACK first, including receiving
  // refusal. Diagnostic original bytes are retained before client admission.
  const raw=await this.ports.lifecycleCancel(clone(intent));pending.cancellation.receipt=clone(raw);await this.persist({...record,pending},epoch);
  const result=validateStageLifecycleCancelReply(record.view,pending.intent,pending.source_reply,intent,pending.material_reply.operation,raw);
  if(result.state!=='material_abandoned')return result;
  const document=readDocument(await this.ports.expression({operation:'inspect',expression_ref:intent.expression_ref}),intent.expression_ref);
  if(!same(document,result.view.document))throw Error('The current native Document changed after Source cancellation; full original intent/ACK remains retained');
  await this.persist({...record,view:result.view,pending:undefined},epoch);this.liveLifecycleReceipt=clone(result);return result;
 }
async retryLifecycleCancellation():Promise<StageLifecycleObservation>{
  const epoch=this.begin();try{const record=this.record?clone(this.record):undefined;if(!record?.view||record.pending?.kind!=='native-lifecycle')throw Error('No full original lifecycle cancellation is retained');return await this.abandonLifecycle(record,clone(record.pending),epoch);}finally{this.inFlight=false;}
 }
async retryLifecycle():Promise<StageLifecycleObservation>{const pending=this.record?.pending;if(pending?.kind!=='native-lifecycle')throw Error('No original native lifecycle is retained');if(pending.material_reply?.operation?.status==='cancelled')return this.retryLifecycleCancellation();return this.lifecycle(clone(pending.intent),true);}
async authoredDriver(captured:PendingNativeAuthoredDriver):Promise<StageAuthoredDriverObservation>{
  const epoch=this.begin();try{
   let record=this.record?clone(this.record):undefined; if(!record?.view)throw Error('Open the original native Expression before driver authoring');
   if(record.pending&&record.pending.kind!=='native-authored-driver')record=await this.settlePending(record,epoch);
   if(!record.view)throw Error('The full original driver lost its native Document');
   if(record.pending?.kind==='native-authored-driver'&&(!same(record.pending.intent,captured.intent)||!same(record.pending.reading,captured.reading)))throw Error('Another full original driver intent/read is retained; no target, action or operation ID was replaced');
   const original=clone(record.pending?.kind==='native-authored-driver'?record.pending:captured);validatePendingAuthoredDriver(original,record.view);await this.persist({...record,pending:original},epoch);
   // Real gateway/InstrumentSession accounts native channel custody first.
   const raw=await this.ports.expression({operation:'procedural',request:clone(original.intent)});
   original.raw_reply=clone(raw);await this.persist({...record,pending:original},epoch);
   const result=validateNativeAuthoredDriverReply(record.view,original,raw);
   if(result.view){const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:original.intent.expression_ref}),original.intent.expression_ref);if(!same(observed,result.view.document))throw Error('Actual native driver owner changed after the receipt; original intent and newer local draft remain retained');await this.persist({...record,view:result.view,pending:undefined},epoch);}
   return result;
  }finally{this.inFlight=false;}
 }
async retryAuthoredDriver():Promise<StageAuthoredDriverObservation>{const pending=this.record?.pending;if(pending?.kind!=='native-authored-driver')throw Error('There is no full original native driver operation to retry');return this.authoredDriver(clone(pending));}
async control(captured:PendingNativeControl):Promise<NativeControlResult>{
  const epoch=this.begin();
  try{
   let record=this.record?clone(this.record):undefined;
   if(!record?.view)throw Error('Open the original native Expression before control');
   if(record.pending&&record.pending.kind!=='native-control')record=await this.settlePending(record,epoch);
   if(!record.view)throw Error('The retained control lost its native Document');
   if(record.pending?.kind==='native-control'&&!same(record.pending,captured))throw Error('Another original native control is still retained; no input, target or operation ID was replaced');
   validatePendingNativeControl(captured,record.view);
   const original=clone(captured);await this.persist({...record,pending:original},epoch);
   const raw=await this.ports.expression({operation:'procedural',request:clone(original.request)});
   const result=validateNativeControlReply(nativeControlSnapshot(record.view,original.intent),original.intent,original.request,raw);
   if(result.view){
    const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:original.request.expression_ref}),original.request.expression_ref);
    if(!same(observed,result.view.document))throw Error('The owner changed after the native control receipt; retain the original intent and newer local draft');
    await this.persist({...record,view:result.view,pending:undefined},epoch);
   }
   // Known source refusal/conflict still retains the original input. An explicit
   // current Source reconciliation is required before creating another intent.
   return result;
  }finally{this.inFlight=false;}
 }
async retryControl():Promise<NativeControlResult>{
  const pending=this.record?.pending;if(pending?.kind!=='native-control')throw Error('There is no original native control to retry');
  return this.control(clone(pending));
 }

async acceptNativePhysical(result:any,expected:{expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number;actor:string},accept:()=>boolean):Promise<KernelConversion>{
  const epoch=this.begin(),record=this.record?clone(this.record):undefined;
  try{
   if(!record?.view||record.pending||record.native_performance_failure||record.native_performance_edit||!accept())throw Error('Reconcile the current native draft before adopting its physical edit.');
   const basis=record.view.document,scene=basis.scenes.find(row=>row.scene_ref===expected.scene_ref);
   if(basis.expression_ref!==expected.expression_ref||basis.revision!==expected.document_revision||scene?.revision!==expected.scene_revision)throw Error('The actual physical edit belongs to another current Document/Scene.');
   if(!['oi.native-physical-scene-edit-result/v1','oi.native-acoustic-scene-edit-result/v1'].includes(result?.schema)||result.accepted!==true||result.application_committed!==true||result.state!=='applied_and_retained'||!Array.isArray(result.document_edits)||result.document_edits.length!==2){
    await this.persist({...record,native_performance_failure:clone(result)},epoch);throw Error('The original physical body/document outcome requires reconciliation; native custody remains.');
   }
   for(const key of ['expression_ref','document_revision','scene_ref','scene_revision','actor'] as const)if(result.request?.[key]!==expected[key])throw Error('The original physical authored CAS differs.');
   const carriers=basis.scenes.filter(row=>(row.presentation as any)?.scene?.epiWorld?.schema==='oi.epi-world-material/v1');
   if(carriers.length!==1)throw Error('The original native World carrier is absent or ambiguous.');
   const validate=(document:KernelExpressionDocument,previous:KernelExpressionDocument,field:boolean)=>{
    if(document.expression_ref!==previous.expression_ref||!Number.isSafeInteger(document.revision)||document.revision<=previous.revision)throw Error('The actual physical Document revision did not advance.');
    const normalized=clone(document);normalized.revision=previous.revision;
    for(const row of normalized.scenes){const old=previous.scenes.find(item=>item.scene_ref===row.scene_ref);if(!old)throw Error('A physical edit added another Scene.');
     const selected=row.scene_ref===expected.scene_ref,carrier=field&&row.scene_ref===carriers[0].scene_ref;
     if(selected||carrier){if(!Number.isSafeInteger(row.revision)||Number(row.revision)<=Number(old.revision))throw Error('The addressed physical Scene revision did not advance.');row.revision=old.revision;}
     if(selected){if(Object.hasOwn(old,'performance'))row.performance=clone(old.performance);else delete row.performance;}
     if(carrier){if(Object.hasOwn(old,'native_field_source'))(row as any).native_field_source=clone((old as any).native_field_source);else delete (row as any).native_field_source;}
    }
    if(!same(normalized,previous))throw Error('The physical transaction changed selection, presentation, unrelated Scene or source membership.');
   };
   const pending=kernelDocumentToJourney(result.document_edits[0].document).document,document=kernelDocumentToJourney(result.document).document;
   validate(pending,basis,false);validate(document,pending,true);
   if(result.schema==='oi.native-acoustic-scene-edit-result/v1'){const original:any=scene!.performance,retained:any=document.scenes.find(row=>row.scene_ref===expected.scene_ref)?.performance;if(!original||!retained||!Array.isArray(original.native_sources)||!Array.isArray(retained.native_sources)||!same(original.bases,retained.bases)||!same(original.pitches,retained.pitches)||original.native_sources.some((source:any)=>!retained.native_sources.some((row:any)=>same(row,source))))throw Error('The acoustic transaction lost its unique original musical bases, pitches or source epochs.');}
   if(!same(document,result.document_edits[1].document))throw Error('The physical final Document differs from its original second edit.');
   const observed=readDocument(await this.ports.expression({operation:'inspect',expression_ref:basis.expression_ref}),basis.expression_ref);
   if(!same(observed,document)||epoch!==this.epoch||!accept())throw Error('The original physical native Document changed before adoption.');
   const view=connectionView(record.view,document);await this.persist({...record,view},epoch);return clone(view);
  }finally{this.inFlight=false;}
 }
}
