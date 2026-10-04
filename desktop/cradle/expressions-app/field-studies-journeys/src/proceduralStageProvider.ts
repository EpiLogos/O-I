import {validateNativeStageLibraryReply} from './proceduralNativeStageLibrary';
import type {NativeAuthorshipReading} from './proceduralStageAuthoring';
import type {PendingNativeSelectedSceneSource,SelectedSceneSourceReply} from './proceduralSelectedSceneSource';
import type {PendingNativeSelectedScene,SelectedSceneOpening} from './proceduralSelectedScene';
import {validateStageLifecycleIntent,validateStageLifecycleAvailability,type NativeLifecycleAction,type NativeLifecycleIntent,type StageLifecycleObservation,type StageLifecycleAvailability} from './proceduralStageLifecycle';
import {stageBootstrapCommand,validateStageSourceAuthorship,isStageBootstrapRefusalObservation,validateStageBootstrapRefusal,validateStageBootstrapReceipt,requireCurrentStageBootstrap,type StageSourceAuthorship,type StageSourceBootstrapIntent,type StageSourceBootstrapOutcome} from './proceduralStageBootstrap';
/** Stateless Stage bridge to the existing serialized Workspace/native owners.
 * The UI does not compile graphs, manufacture native timing/instances, install
 * a FieldHost definition or retain a second document/runtime. */
import {clone} from './model';
import {studioBasis,scopeContains,type StudioSnapshot,type StudioBasis,type ProcedurePreview} from './proceduralStudio';
import {sameNative,validateOperation,type Scope,type ProceduralRequest} from './proceduralProtocol';
import {preparationRetryView,type ProceduralReply} from './proceduralWorking';
import type {SourceBasis} from './proceduralRetention';
import {validateSourceReply,type ProcedureSourceCommand,type ProcedureSourceReply} from './proceduralSources';
import {stageSourceRequest,validateStageSourceReading,validateStageOccurrenceIdentities,validateProcedureAuthorship,validateNativeSceneSource,projectStageLibrary,type StageSourceReading,type StageLibrary,type StageLibraryIntent,type NativeSceneSource,type ProcedureAuthorship} from './proceduralStageSource';

export type StageCapabilityName='library'|'prepare'|'conduct'|'authorship'|'replay'|'checkpoint'|'bootstrap'|'retire';
export type StageCapability={state:'available';owner:string;expression_ref:string;document_revision:number;source_ref:string;source_revision:string}|{state:'unavailable';reason:string};
export interface StageRuntimeIntent {basis:StudioBasis;procedure_ref:string;expected_recipe_revision:string;action:'read'|'pause'|'resume'|'cancel'|'checkpoint';observed_rule_cursor:number;}
export interface StageRuntimeResult {basis:StudioBasis;procedure_ref:string;native_reply:unknown;/** Actual producer status, not a UI inferred operation effect. */standing:string;}
export interface StagePreparedPreview extends ProcedurePreview {/** Actual NativeWorking receipt; no browser reconstructed operation reply. */native_reply:ProceduralReply;}
export interface StagePreparedReplay {preview:ProcedurePreview;native_reply:ProceduralReply;/** Protected original issued source input, read from native owner cache/journal;
 * this is not an echo supplied by the browser. */original_intent:StageLibraryIntent;repeated:true;}
export interface StageNoChangeOutcome extends Omit<ProcedurePreview,'operation'> {outcome:'no_change';original_intent:StageLibraryIntent;native_reply:unknown;source_current:boolean;repeated?:true;}
export type StagePreparation=StagePreparedPreview|StageNoChangeOutcome;
export type StageLibraryReplay=StagePreparedReplay|(StageNoChangeOutcome&{repeated:true});
export function validateStageNoChangeOutcome(intent:StageLibraryIntent,result:StageNoChangeOutcome,snapshot:StudioSnapshot):StageNoChangeOutcome{
 const reply=validateNativeStageLibraryReply(intent,result.native_reply,result.repeated===true);
 if(!('state' in reply)||reply.state!=='no_change'||result.outcome!=='no_change'||!sameNative(result.original_intent,intent)||!sameNative({procedure_ref:result.procedure_ref,recipe_revision:result.recipe_revision,changes:result.changes},reply.preview)||result.source_current!==reply.source_current)throw Error('Readonly Stage outcome differs from its complete actual original native result');
 if(reply.source_current&&!sameNative(studioBasis(snapshot),intent.basis))throw Error('Current native no-change returned after the actual selected Source/CAS changed');
 return clone(result);
}
export interface StageLibraryResult {source:ProcedureSourceReply['source'];procedure:Record<string,unknown>;program:Record<string,unknown>;document_revision:number;source_scene_ref:string;source_material_fingerprint:string;standing:string;}
export interface StageWorkspacePort {
 snapshot():StudioSnapshot|null;
 refreshCapability?():Promise<StageCapability>;
 authoringReading?(kind:'source_authorship'|'procedure_authorship'):NativeAuthorshipReading|null;
 retainSelectedSceneSource?(actor:string,recover?:boolean):Promise<SelectedSceneSourceReply>;
 pendingSelectedSceneSource?():PendingNativeSelectedSceneSource|null;
 selectedSceneSourceRetentionReason?():string|null;
 selectedSceneOpeningReason?():string|null;
 sourceBootstrapReason?():string|null;
 pendingSelectedScene?():PendingNativeSelectedScene|null;
 openSelectedScene?(recover?:boolean):Promise<SelectedSceneOpening>;
 abandonSelectedScene?():Promise<unknown>;
 /** Existing Workspace saves the retained draft before capturing this actual accepted CAS. */
 captureSourceBasis?():Promise<StudioBasis>;
 /** Full original structural authorship, from an actual native authoring source. */
 sourceAuthorship?(actor:string):Promise<StageSourceAuthorship>;
 /** SAME private session request/ACK, then SAME NativeWorking checkpoint/adoption. */
 bootstrapSource?(intent:StageSourceBootstrapIntent):Promise<StageSourceBootstrapOutcome>;
 procedural(request:ProceduralRequest):Promise<unknown>;
 compileProcedureSource(command:ProcedureSourceCommand,request?:Record<string,unknown>|null):Promise<ProcedureSourceReply>;
 /** Actual protected native owner status, after current source qualification.
  * Callback presence alone is never treated as an installed live producer. */
 capability?(name:StageCapabilityName,basis:StudioBasis):StageCapability;
 /** Original full authored C′ + genuine timing owner, from its native source. */
 authorship?(source:NativeSceneSource):Promise<ProcedureAuthorship>;
 /** INSIDE existing Workspace flushDraft/adoption route. Root re-reads the
  * exact Source, compiles/attests full original native_context and seals its
  * completed producer. This callback owns Prepare/producer_ref and retention. */
 prepareLibrary?(intent:StageLibraryIntent):Promise<StagePreparation>;
 /** Existing proceduralWorking recovery/journal path. Look up original ID and
  * compare its complete original native issued input BEFORE fresh CAS. Null
  * means the native owner found no original admission, not a swallowed error.
  * It refuses any edited intent or foreign intervention, and adopts only its
  * actual unique native journal readback through existing Workspace custody. */
 retryLibrary?(intent:StageLibraryIntent):Promise<StageLibraryReplay|null>;
 /** Protected NativeConduct fills its actual held-host envelope and source
  * producer_ref; UI sends an intent only, never a full transport/ACK/body. */
 conduct?(intent:StageRuntimeIntent):Promise<StageRuntimeResult>;
 lifecycleCapability?(action:NativeLifecycleAction['kind'],basis:StudioBasis):StageLifecycleAvailability;
 lifecycle?(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;
 retryLifecycle?(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;
 settledLifecycle?(intent:NativeLifecycleIntent):StageLifecycleObservation|null;
}
export interface ProceduralStageProvider {
 retainSelectedSceneSource(actor:string,recover?:boolean):Promise<SelectedSceneSourceReply>;
 pendingSelectedSceneSource():PendingNativeSelectedSceneSource|null;
 selectedSceneSourceRetentionReason():string|null;
 selectedSceneOpeningReason():string|null;
 sourceBootstrapReason():string|null;
 pendingSelectedScene():PendingNativeSelectedScene|null;
 openSelectedScene(recover?:boolean):Promise<SelectedSceneOpening>;
 abandonSelectedScene():Promise<unknown>;
 capability(name:StageCapabilityName,basis:StudioBasis):StageCapability;
 captureSourceBasis():Promise<StudioBasis>;
 sourceAuthorship(actor:string):Promise<StageSourceAuthorship>;
 authoringReading(kind:'source_authorship'|'procedure_authorship'):NativeAuthorshipReading|null;
 bootstrapSource(intent:StageSourceBootstrapIntent):Promise<StageSourceBootstrapOutcome>;
 readSource(snapshot:StudioSnapshot,scope:Scope,profile?:SourceBasis|null,propertyKeys?:string[]):Promise<StageSourceReading>;
 discover(snapshot:StudioSnapshot):Promise<StageLibrary>;
 authorship(snapshot:StudioSnapshot,source:NativeSceneSource):Promise<ProcedureAuthorship>;
 build(snapshot:StudioSnapshot,intent:StageLibraryIntent):Promise<StageLibraryResult>;
 prepare(intent:StageLibraryIntent):Promise<StagePreparation>;
 conduct(intent:StageRuntimeIntent):Promise<StageRuntimeResult>;
 lifecycleAvailability(action:NativeLifecycleAction['kind']):StageLifecycleAvailability;
 lifecycle(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;
 retryLifecycle(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;
 settledLifecycle(intent:NativeLifecycleIntent):StageLifecycleObservation|null;
}
function requireCurrent(port:StageWorkspacePort,basis:StudioBasis):StudioSnapshot {
 const current=port.snapshot();if(!current||!sameNative(studioBasis(current),basis))throw Error('The original native Source/Scene/revision changed; its typed intent remains retained');return current;
}
function validateCapability(raw:StageCapability|undefined,basis:StudioBasis,name:StageCapabilityName):StageCapability {
 if(!raw)return {state:'unavailable',reason:`The native ${name} owner has not published its current source qualification.`};
 if(raw.state==='unavailable'){if(typeof raw.reason!=='string'||!raw.reason.trim())throw Error('The native owner did not disclose its unavailable reason');return clone(raw);}
 if(raw.state!=='available'||raw.expression_ref!==basis.expression_ref||raw.document_revision!==basis.document_revision||![raw.owner,raw.source_ref,raw.source_revision].every(value=>typeof value==='string'&&!!value))throw Error('The native capability belongs to another actual Source/Document basis');return clone(raw);
}
function requireCapability(port:StageWorkspacePort,name:StageCapabilityName,basis:StudioBasis){const status=validateCapability(port.capability?.(name,basis),basis,name);if(status.state==='unavailable')throw Error(status.reason);}
/** The current durable journal and the genuine native receipt must both name
 * this still-prepared original admission. Historical/restored receipts never
 * stand in for current native Source or Workspace adoption. */
export function validateStagePreparedReceipt(intent:StageLibraryIntent,preview:ProcedurePreview,nativeReply:ProceduralReply,snapshot:StudioSnapshot):StagePreparedPreview {
 const operation=validateOperation(preview.operation);
 if(operation.envelope.expression_ref!==intent.basis.expression_ref||operation.envelope.operation_ref!==intent.operation_ref||operation.envelope.expected_revision!==intent.basis.document_revision||!sameNative(operation.envelope.scope,intent.scope)||!operation.envelope.sources.some(source=>sameNative(source,intent.profile))||!operation.envelope.producer_ref||preview.procedure_ref!==intent.authored.procedure_ref||preview.recipe_revision!==intent.authored.revision)throw Error('Native preparation lacks the exact original CAS/scope/profile/procedure and protected source producer admission');
 if(studioBasis(snapshot).scene_ref!==intent.basis.scene_ref)throw Error('The prepared journal belongs to another current Scene');
 if(intent.choice.recipe==='force_parameters')for(const change of operation.envelope.changes){if(change.change!=='parameter_set')continue;const parameter=change.parameter,entity=change.entity_ref;
  if(typeof parameter!=='string'||typeof entity!=='string'||!intent.choice.writes.some(write=>write.parameter===parameter)||!['force_radius','force_strength','force_spin'].includes(parameter))throw Error('The prepared force batch writes a sibling or undeclared native Parameter');
  const locations=snapshot.view.document.scenes.filter(scene=>scene.entity_refs.includes(entity));if(!locations.length||locations.some(scene=>!scopeContains(intent.scope,{expression_ref:intent.basis.expression_ref,scene_ref:scene.scene_ref,entity_ref:entity,component:'force',constituent_ref:null,property:parameter.slice(6)},snapshot)))throw Error('The prepared global force Parameter leaves its exact original scalar scope');
 }
 const admitted=preparationRetryView({operation:'prepare',envelope:operation.envelope},snapshot.view,nativeReply,snapshot.view.document);
 if(!sameNative(admitted.reply.operation,operation))throw Error('The current native receipt differs from its prepared preview');
 validateNativeSceneSource({...intent.source,document_revision:operation.accepted_revision!},snapshot,intent.profile);
 return clone({...preview,operation,native_reply:nativeReply});
}
export function createProceduralStageProvider(port:StageWorkspacePort):ProceduralStageProvider {
 return {
  async retainSelectedSceneSource(actor,recover=false){if(!port.retainSelectedSceneSource)throw Error('The actual World source retention Workspace is not paired');return port.retainSelectedSceneSource(actor,recover);},
  pendingSelectedSceneSource:()=>clone(port.pendingSelectedSceneSource?.()??null),
  selectedSceneSourceRetentionReason:()=>port.selectedSceneSourceRetentionReason?.()??(port.selectedSceneSourceRetentionReason?null:'The actual SAME-session source getter is not paired.'),
  selectedSceneOpeningReason:()=>port.selectedSceneOpeningReason?.()??(port.selectedSceneOpeningReason?null:'The actual selected Scene opening Workspace is not paired.'),
  sourceBootstrapReason:()=>port.sourceBootstrapReason?.()??(port.sourceBootstrapReason?null:'The SAME selected-Scene Source request owner is not paired.'),
  pendingSelectedScene:()=>clone(port.pendingSelectedScene?.()??null),
  async openSelectedScene(recover=false){if(!port.openSelectedScene)throw Error('The actual selected Scene opening Workspace is not paired');return port.openSelectedScene(recover);},
  async abandonSelectedScene(){if(!port.abandonSelectedScene)throw Error('The actual original selected Scene closure owner is not paired');return port.abandonSelectedScene();},
  capability:(name,basis)=>validateCapability(port.capability?.(name,clone(basis)),basis,name),
  async captureSourceBasis(){if(!port.captureSourceBasis)throw Error('The accepted native Source basis capture is not paired');const basis=await port.captureSourceBasis();requireCurrent(port,basis);return clone(basis);},
  async sourceAuthorship(actor){if(!port.sourceAuthorship)throw Error('The original native structural authorship reader is not paired; enter the explicit authored fields');return validateStageSourceAuthorship(await port.sourceAuthorship(actor));},
  async bootstrapSource(intent){
   intent=clone(intent);stageBootstrapCommand(intent);
   // Working owns original-ID retry before fresh CAS. The real native owner
   // distinguishes historical/cache replies; no browser retry grants Source.
   if(!port.bootstrapSource)throw Error('The private same-owner Source bootstrap/Document adoption port is not paired');
   const original=port.snapshot();if(!original)throw Error('The original native Source Workspace is unavailable');
   const reply=await port.bootstrapSource(intent);
   if(isStageBootstrapRefusalObservation(reply)){
    const observation=validateStageBootstrapRefusal(intent,reply.native_reply,original.view,reply.document_receipt),current=port.snapshot();
    if(!current||!sameNative(current.view.document,original.view.document))throw Error('The original Source basis changed while its known refusal was returning; intent stays retained');
    return clone(observation);
   }
   const result=validateStageBootstrapReceipt(intent,reply,original.view),current=port.snapshot();
   if(!current||!sameNative(current.view.document,result.view.document))throw Error('Native Source returned but current Document adoption is unobserved; retain the complete original intent');
   return clone(result.receipt);
  },
  async readSource(snapshot,scope,profile=null,propertyKeys=[]){
   const basis=studioBasis(snapshot);requireCurrent(port,basis);const request=stageSourceRequest(snapshot,scope,profile,propertyKeys);
   const raw=await port.procedural(request);const current=requireCurrent(port,basis),reading=validateStageSourceReading(raw,current,request);await validateStageOccurrenceIdentities(reading);requireCurrent(port,basis);await port.refreshCapability?.();requireCurrent(port,basis);return reading;
  },
  async discover(snapshot){const basis=studioBasis(snapshot);requireCurrent(port,basis);const raw=await port.compileProcedureSource('discover',null);requireCurrent(port,basis);return projectStageLibrary(raw);},
  authoringReading:kind=>clone(port.authoringReading?.(kind)??null),
  async authorship(snapshot,source){
   const basis=studioBasis(snapshot);requireCurrent(port,basis);
   if(!port.authorship)throw Error('The protected native authored C′/timing provider is not paired');
   const result=await port.authorship(clone(source));requireCurrent(port,basis);validateProcedureAuthorship(result);return clone(result);
  },
  async build(snapshot,intent){
   intent=clone(intent);snapshot=clone(snapshot);
   requireCurrent(port,intent.basis);if(!sameNative(studioBasis(snapshot),intent.basis))throw Error('The library intent has another native original basis');requireCapability(port,'library',intent.basis);validateProcedureAuthorship(intent.authored);
   validateNativeSceneSource(intent.source,snapshot,intent.profile);
   const reply=validateSourceReply(await port.compileProcedureSource('library',{schema:'ql.procedural-library/v1',source:clone(intent.source),authored:clone(intent.authored),choice:clone(intent.choice)}),'library');requireCurrent(port,intent.basis);
   const result=reply.native_result.result as {schema?:unknown;procedure?:Record<string,unknown>;program?:Record<string,unknown>;document_revision?:number;original_source_scene?:string;source_material_fingerprint?:string;standing?:string};
   if(result.schema!=='ql.procedural-library/v1'||result.document_revision!==intent.basis.document_revision||result.original_source_scene!==intent.source.scene_ref||result.source_material_fingerprint!==intent.source.material_fingerprint||!result.procedure||!result.program||result.procedure.procedure_ref!==intent.authored.procedure_ref||result.procedure.revision!==intent.authored.revision||!sameNative(result.procedure.composition,intent.authored.composition)||!sameNative(result.procedure.timing,intent.authored.timing)||result.procedure.principal_subject_ref!==intent.source.principal.subject_ref||result.procedure.locus_ref!==intent.source.locus_ref||!sameNative(result.procedure.profile,intent.source.source_basis)||typeof result.standing!=='string')throw Error('The native library built another authored Source/procedure/timing basis');
   return clone({source:reply.source,procedure:result.procedure,program:result.program,document_revision:result.document_revision,source_scene_ref:result.original_source_scene,source_material_fingerprint:result.source_material_fingerprint,standing:result.standing});
  },
  async prepare(intent){
   intent=clone(intent);
   const repeated=await port.retryLibrary?.(clone(intent));
   if(repeated){
    if(repeated.repeated!==true||!sameNative(repeated.original_intent,intent))throw Error('Native original preparation input differs from this complete retained intent');const snapshot=port.snapshot();
    if('outcome' in repeated){if(!snapshot)throw Error('Original readonly outcome has no actual Workspace');return validateStageNoChangeOutcome(intent,repeated,snapshot);}
    const operation=validateOperation(repeated.preview.operation);
    if(!snapshot)throw Error('The original preparation has no current native Workspace adoption');
    return validateStagePreparedReceipt(intent,{...repeated.preview,operation},repeated.native_reply,snapshot);
   }
   const original=requireCurrent(port,intent.basis);validateNativeSceneSource(intent.source,original,intent.profile);validateProcedureAuthorship(intent.authored);requireCapability(port,'prepare',intent.basis);if(!port.prepareLibrary)throw Error('The protected native graph/currentness/ThreadPlan preparation provider is not paired');
   const result=await port.prepareLibrary(clone(intent));
   // Native Prepare itself advances the durable journal. Admit that exact
   // accepted revision only, with actual original Scene material and binding
   // unchanged. This is a readback check, never an intent rebase or ACK.
   const adopted=port.snapshot();if(!adopted)throw Error('The prepared journal is retained natively; its exact current Workspace adoption is unavailable');
   if('outcome' in result)return validateStageNoChangeOutcome(intent,result,adopted);
   return validateStagePreparedReceipt(intent,result,result.native_reply,adopted);
  },
  lifecycleAvailability(action){const snapshot=port.snapshot();if(!snapshot)return {state:'unavailable',reason:'Open the current native Expression before lifecycle inspection.'};return validateStageLifecycleAvailability(port.lifecycleCapability?.(action,studioBasis(snapshot)),snapshot,action);},
  async lifecycle(intent){
   intent=clone(intent);const snapshot=port.snapshot();if(!snapshot)throw Error('The native lifecycle Workspace is unavailable');validateStageLifecycleIntent(snapshot,intent);
   const capability=validateStageLifecycleAvailability(port.lifecycleCapability?.(intent.action.kind,studioBasis(snapshot)),snapshot,intent.action.kind);if(capability.state==='unavailable')throw Error(capability.reason);
   if(!port.lifecycle)throw Error('The retained native lifecycle intent/material receiving route is not paired');
   const result=await port.lifecycle(intent);if(!sameNative(result.original_intent,intent)||!result.native_reply)throw Error('The native lifecycle owner changed the full original intent or omitted its genuine reply');return clone(result);
  },
  async retryLifecycle(intent){if(!port.retryLifecycle)throw Error('The guarded original native lifecycle recovery owner is not paired; full intent remains retained');const original=clone(intent),result=await port.retryLifecycle(original);if(!sameNative(result.original_intent,original)||!result.native_reply)throw Error('The native recovery reply differs from the full original lifecycle intent');return clone(result);},
  settledLifecycle(intent){const observed=port.settledLifecycle?.(clone(intent));const current=port.snapshot();if(!observed||!current||!['applied','material_abandoned'].includes(observed.state)||!sameNative(observed.original_intent,intent)||!sameNative(observed.view.document,current.view.document))return null;return clone(observed);},
  async conduct(intent){
   intent=clone(intent);
   requireCurrent(port,intent.basis);requireCapability(port,'conduct',intent.basis);if(!port.conduct)throw Error('The protected native held-host conduct provider is not paired');
   if(!Number.isSafeInteger(intent.observed_rule_cursor)||intent.observed_rule_cursor<0)throw Error('Use the last actual observed native rule position');
   const reply=await port.conduct(clone(intent));if(!sameNative(reply.basis,intent.basis)||reply.procedure_ref!==intent.procedure_ref||typeof reply.standing!=='string'||!reply.native_reply)throw Error('Native conduct returned another procedure or Source basis');return clone(reply);
  },
 };
}
