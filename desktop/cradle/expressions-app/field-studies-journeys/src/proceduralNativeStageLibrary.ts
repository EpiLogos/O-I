/** Normal Stage native-library wire discrimination. The Kernel owns Source,
 * compiler, receiving constructors and Envelope issuance; this module owns no
 * graph, runtime, document store, clock, participant or consumer acknowledgement. */
import {validatePendingNativeDefinition} from './proceduralNativeDefinition';
import {clone} from './model';
import {sameNative,validateEnvelope,type Envelope} from './proceduralProtocol';
import {validateAddress} from './proceduralRetention';
import type {KernelConversion} from './kernelDocumentBridge';
import type {StudioBasis,ProcedurePreview} from './proceduralStudio';
import type {StageCapability,StageCapabilityName} from './proceduralStageProvider';
import {validateProcedureAuthorship,type StageLibraryIntent} from './proceduralStageSource';

export type NativeStageLibraryRequest=
 | {operation:'procedural_stage_capability';request:{basis:StudioBasis}}
 | {operation:'procedural_stage_library'|'procedural_stage_library_retry';request:StageLibraryIntent};
export type NativeStageLibraryPreview=Omit<ProcedurePreview,'operation'>;
export interface NativeStageLibraryIssued {
 schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;
 state:'issued';envelope:Envelope;preview:NativeStageLibraryPreview;
 source_current:true;qualification:'live_native_owner';native_procedural_receipts:[];
}
export interface NativeStageLibraryPending {
 schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;
 state:'pending_reception';reason:string;admission:Record<string,unknown>;
 envelope:null;preview:NativeStageLibraryPreview;source_current:false;
 qualification:'original_native_compilation_retained';native_procedural_receipts:[];
}
export interface NativeStageLibraryCompiling {
 schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;
 state:'pending_compilation';found:true;repeated:true;envelope:null;source_current:false;
 qualification:'original_native_compilation_in_flight';native_procedural_receipts:[];
}
export interface NativeStageLibraryRepeated {
 schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;
 found:true;envelope:Envelope;preview:NativeStageLibraryPreview;
 operation:unknown|null;repeated:true;source_current:false;
 qualification:'original_native_preparation_retry';native_procedural_receipts:[];
}
export interface NativeStageLibraryAbsent {
 schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;
 found:false;native_procedural_receipts:[];
}
export interface NativeStageLibraryNoChange {
 schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;
 state:'no_change';outcome:'no_change';envelope:null;prepared:null;
 preview:NativeStageLibraryPreview;native_procedural_receipts:[];
 source_current:boolean;qualification:'live_native_source_unchanged'|'original_native_no_change_retry';
 found?:true;repeated?:boolean;outcome_basis?:unknown;
}
export interface NativeStageLibraryRefused {schema:'oi.native-procedural-stage-library/v1';original_intent:StageLibraryIntent;state:'known_refusal';reason:string;envelope:null;source_current:false;native_procedural_receipts:[];found?:true;repeated?:true;qualification?:'original_native_compilation_refusal';}
export type NativeStageLibraryReply=NativeStageLibraryNoChange|NativeStageLibraryIssued|NativeStageLibraryPending|NativeStageLibraryCompiling|NativeStageLibraryRepeated|NativeStageLibraryAbsent|NativeStageLibraryRefused;
export interface PendingNativeStageLibrary {
 kind:'native-stage-library';intent:StageLibraryIntent;
 /** This caller checkpoint records an attempted dispatch, never native admission.
  * Missing legacy state is uncertain; a saved label cannot grant native Source. */
 dispatch_state?:'not_dispatched'|'dispatched';
 definition?:import('./proceduralNativeDefinition').PendingNativeDefinition;
 native_reply?:unknown;recovery_reply?:unknown;material?:import('./proceduralWorking').PendingProcedure;material_reply?:unknown;
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&!!value.trim();
function need(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
function basis(value:unknown):asserts value is StudioBasis {
 need(object(value)&&Object.keys(value).sort().join(',')==='document_revision,expression_ref,scene_ref'&&text(value.expression_ref)&&text(value.scene_ref)&&Number.isSafeInteger(value.document_revision)&&Number(value.document_revision)>0,'Native Stage basis requires the exact actual Expression/Scene/CAS');
}
export function nativeStageLibraryRequest(intent:StageLibraryIntent,retry=false):NativeStageLibraryRequest {
 basis(intent?.basis);need(Object.keys(intent).sort().join(',')==='action,authored,basis,choice,operation_ref,profile,scope,source'&&text(intent.operation_ref)&&['prepare','regenerate'].includes(intent.action),'Stage library request must retain its complete original eight-field intent');
 validateProcedureAuthorship(intent.authored);
 need(intent.source?.expression_ref===intent.basis.expression_ref&&intent.source.scene_ref===intent.basis.scene_ref&&intent.source.document_revision===intent.basis.document_revision,'Stage library Source differs from its original selected native basis');
 need(intent.profile?.availability==='available'&&intent.profile.ref===intent.source.source_basis.source_ref&&intent.profile.revision===intent.source.source_basis.revision,'Stage library must retain the exact issued native profile');
 return {operation:retry?'procedural_stage_library_retry':'procedural_stage_library',request:clone(intent)};
}
export function nativeStageCapabilityRequest(current:StudioBasis):NativeStageLibraryRequest {basis(current);return {operation:'procedural_stage_capability',request:{basis:clone(current)}};}
function unexchanged(value:Record<string,unknown>){need(Array.isArray(value.native_procedural_receipts)&&value.native_procedural_receipts.length===0,'Native Stage stateless response lacks its actual known-unexchanged receipt boundary');}
export function validateNativeStageCapability(current:StudioBasis,raw:unknown):StageCapability {
 basis(current);need(object(raw)&&raw.schema==='oi.native-procedural-stage-capability/v1'&&sameNative(raw.basis,current),'Native capability belongs to another actual selected Source basis');unexchanged(raw);
 const c=raw.capability;need(object(c),'Actual native Stage capability is absent');
 if(c.state==='unavailable'){need(text(c.reason),'Native capability did not disclose its actual unavailable reason');return {state:'unavailable',reason:c.reason};}
 need(c.state==='available'&&c.owner==='oi.native-expression'&&c.expression_ref===current.expression_ref&&c.document_revision===current.document_revision&&text(c.source_ref)&&text(c.source_revision),'Native capability must name the actual Source/current Document owner');return clone(c) as StageCapability;
}
function preview(intent:StageLibraryIntent,raw:unknown):NativeStageLibraryPreview {
 need(object(raw)&&raw.procedure_ref===intent.authored.procedure_ref&&raw.recipe_revision===intent.authored.revision&&Array.isArray(raw.changes)&&raw.changes.length<=1024,'Native library preview differs from the original procedure/recipe');
 for(const row of raw.changes){need(object(row)&&text(row.kind)&&typeof row.label==='string','Native library preview change is not an actual typed change');if(row.address!==undefined)validateAddress(row.address);}
 return clone(raw) as unknown as NativeStageLibraryPreview;
}
function envelope(intent:StageLibraryIntent,raw:unknown):Envelope {
 const result=validateEnvelope(raw);
 need(result.expression_ref===intent.basis.expression_ref&&result.expected_revision===intent.basis.document_revision&&result.operation_ref===intent.operation_ref&&sameNative(result.scope,intent.scope)&&text(result.producer_ref)&&result.sources.some(source=>sameNative(source,intent.profile)),'Native issued Envelope differs from the exact original CAS/ID/scope/profile or has no producer admission');
 return result;
}
export function validateNativeStageLibraryReply(intent:StageLibraryIntent,raw:unknown,retry=false):NativeStageLibraryReply {
 nativeStageLibraryRequest(intent,retry);need(object(raw)&&raw.schema==='oi.native-procedural-stage-library/v1'&&sameNative(raw.original_intent,intent),'Native library response differs from its complete original intent');unexchanged(raw);
 if(raw.state==='no_change'){
  need(raw.outcome==='no_change'&&raw.envelope===null&&raw.prepared===null,'Readonly native no-change cannot issue material, an Envelope or preparation');
  const changes=preview(intent,raw.preview);need(changes.changes.length===0,'Native no-change preview contains actual changes');
  need(!Object.hasOwn(raw,'admission')&&!Object.hasOwn(raw,'operation'),'Readonly native no-change cannot carry producer admission or a journal');
  need(raw.found===true&&(!retry&&raw.source_current===true&&raw.qualification==='live_native_source_unchanged'&&raw.repeated===false||retry&&raw.source_current===false&&raw.qualification==='original_native_no_change_retry'&&raw.repeated===true),'Native no-change current/history qualification differs');
  return clone(raw) as unknown as NativeStageLibraryNoChange;
 }
 if(raw.state==='pending_compilation'){
  need(retry&&raw.found===true&&raw.repeated===true&&raw.envelope===null&&raw.source_current===false&&raw.qualification==='original_native_compilation_in_flight','Original native compilation lookup lacks its exact pending/history boundary');
  need(Object.keys(raw).sort().join(',')==='envelope,found,native_procedural_receipts,original_intent,qualification,repeated,schema,source_current,state','Pending compilation cannot issue preview, admission, operation or prepared material');
  return clone(raw) as unknown as NativeStageLibraryCompiling;
 }
 if(raw.state==='known_refusal'){
  need(text(raw.reason)&&raw.envelope===null&&raw.source_current===false,'Known pure native refusal must disclose its original reason without issuing an Envelope');
  need(['admission','preview','operation','prepared','outcome','outcome_basis','preparation'].every(key=>!Object.hasOwn(raw,key)),'Known compiler refusal cannot issue material or a journal');
  need(retry?raw.found===true&&raw.repeated===true&&raw.qualification==='original_native_compilation_refusal':raw.found===undefined&&raw.repeated===undefined&&raw.qualification===undefined,'Native compiler refusal differs from its original fresh/retry standing');
  return clone(raw) as unknown as NativeStageLibraryRefused;
 }
 if(raw.state==='pending_reception'){need(raw.envelope===null&&raw.source_current===false&&raw.qualification==='original_native_compilation_retained'&&text(raw.reason)&&object(raw.admission)&&text(raw.admission.producer_ref),'Pending native receiving must retain the original compiled admission without issuing an Envelope');preview(intent,raw.preview);return clone(raw) as unknown as NativeStageLibraryPending;}
 if(raw.state==='issued'){need(raw.source_current===true&&raw.qualification==='live_native_owner','Native library issuance is not current');envelope(intent,raw.envelope);preview(intent,raw.preview);return clone(raw) as unknown as NativeStageLibraryIssued;}
 need(retry,'Historical library lookup cannot be used as fresh native issuance');
 if(raw.found===false){need(Object.keys(raw).sort().join(',')==='found,native_procedural_receipts,original_intent,schema','Absent native cache lookup cannot supply material, currentness or terminal history');return clone(raw) as unknown as NativeStageLibraryAbsent;}
 need(raw.found===true&&raw.repeated===true&&raw.source_current===false&&raw.qualification==='original_native_preparation_retry'&&Object.hasOwn(raw,'operation'),'Native retry must retain original native preparation with no current grant');
 envelope(intent,raw.envelope);preview(intent,raw.preview);
 if(raw.operation!==null){need(object(raw.operation)&&sameNative(raw.operation.envelope,raw.envelope),'Native original journal differs from the original issued Envelope');}
 return clone(raw) as unknown as NativeStageLibraryRepeated;
}
/** An absent native memo is permission for an initial dispatch only while
 * the SAME checkpoint proves this caller has never attempted that operation. */
export function requireInitialNativeStageLibraryDispatch(pending:PendingNativeStageLibrary):void {
 need(pending.dispatch_state==='not_dispatched'&&pending.native_reply===undefined&&!pending.material&&!pending.material_reply,'Original library was already attempted or its dispatch standing is unknown; retry its SAME native owner, never compile again');
 const result=validateNativeStageLibraryReply(pending.intent,pending.recovery_reply,true);
 need('found' in result&&result.found===false,'Inspect the original native library before initial preparation');
}
export function validatePendingNativeStageLibrary(pending:PendingNativeStageLibrary,view:KernelConversion):void {
 need(pending?.kind==='native-stage-library','Retained native Stage kind differs');nativeStageLibraryRequest(pending.intent);
 need(pending.dispatch_state===undefined||['not_dispatched','dispatched'].includes(pending.dispatch_state),'Retained native Stage dispatch standing differs');
 need(view.document.expression_ref===pending.intent.basis.expression_ref&&view.document.revision===pending.intent.basis.document_revision&&view.document.scenes.some(scene=>scene.scene_ref===pending.intent.basis.scene_ref),'Retained native library lost its original accepted Document/Scene/CAS');
 if(pending.definition){const target={basis:pending.intent.basis,source_producer_ref:pending.definition.original_request.source_producer_ref??null,request:pending.definition.original_request.request.command.request};validatePendingNativeDefinition(target,pending.definition);}
 // Raw unknown/refused outcomes remain diagnostic. Restoring them does not
 // grant native Source, replay, an Envelope or an applied journal.
}
/** Select only the exact original compiled Envelope while its first definition
 * is retained. This is not current Source or a private Session recovery grant:
 * normal work.procedural still reads the actual S journal and performs the
 * original dedicated native definition lookup before normal Prepare. */
export function retainedLibraryForDefinitionRetry(intent:StageLibraryIntent,pending:PendingNativeStageLibrary|undefined,view:KernelConversion):NativeStageLibraryReply|null {
 if(!pending?.definition)return null;
 need(intent.action==='prepare'&&sameNative(pending.intent,intent),'First definition retry cannot replace its complete original Library intent');
 validatePendingNativeStageLibrary(pending,view);
 const result=validateNativeStageLibraryReply(intent,pending.recovery_reply??pending.native_reply,pending.recovery_reply!==undefined);
 need('envelope' in result&&result.envelope!==null,'The original definition has no retained issued native Envelope');
 const request=pending.definition.original_request;
 need(request.request.command.request.action==='install_prepared'&&request.source_producer_ref===result.envelope.producer_ref,'First definition retry differs from its original native producer/action');
 return result;
}
export function supportedNativeStageCapability(name:StageCapabilityName):boolean {return ['library','prepare','authorship'].includes(name);}

/** Memo only of a real current native capability. Actual owner identity and
 * acknowledged Document identity/CAS and Source basis come from the existing controller/Workspace.
 * No constructor token, FIELD frame or callback availability issues this memo. */
export interface NativeStageClientWitness {owner:object;epoch:number;ordinal:string;expression_ref:string;document_revision:number;scene_ref:string;source_basis:unknown;}
export interface NativeStageClientHost {request(request:NativeStageLibraryRequest,receive?:(raw:unknown)=>Promise<void>):Promise<unknown>;witness():NativeStageClientWitness|null;}
export class NativeStageLibraryClient {
 private memo:{witness:NativeStageClientWitness;basis:StudioBasis;capability:StageCapability}|null=null;
 constructor(private readonly host:NativeStageClientHost){}
 invalidate(){this.memo=null;}
 private same(a:NativeStageClientWitness|null,b:NativeStageClientWitness|null):boolean {return !!a&&!!b&&a.owner===b.owner&&a.epoch===b.epoch&&a.ordinal===b.ordinal&&sameNative(a.source_basis,b.source_basis)&&a.expression_ref===b.expression_ref&&a.document_revision===b.document_revision&&a.scene_ref===b.scene_ref;}
 async refresh(current:StudioBasis):Promise<StageCapability> {
  this.invalidate();const before=this.host.witness();
  need(before&&before.expression_ref===current.expression_ref&&before.document_revision===current.document_revision&&before.scene_ref===current.scene_ref,'Actual native Stage Document/session basis is unavailable for a capability read');
  const raw=await this.host.request(nativeStageCapabilityRequest(current));
  const capability=validateNativeStageCapability(current,raw),after=this.host.witness();
  need(this.same(before,after),'Native capability returned after its acknowledged Document/owner/ordinal changed');
  this.memo={witness:before,basis:clone(current),capability};return clone(capability);
 }
 capability(name:StageCapabilityName,current:StudioBasis):StageCapability {
  if(!supportedNativeStageCapability(name))return {state:'unavailable',reason:'The native '+name+' factory/receiving owner is not paired by the Stage library endpoint.'};
  const memo=this.memo;
  if(!memo||!sameNative(memo.basis,current)||!this.same(memo.witness,this.host.witness())){this.invalidate();return {state:'unavailable',reason:'Read/requalify the actual current native Source capability at this acknowledged Document and SAME owner boundary.'};}
  return clone(memo.capability);
 }
 async prepare(intent:StageLibraryIntent,receive:(raw:unknown)=>Promise<void>):Promise<unknown> {
  need(this.capability('prepare',intent.basis).state==='available','Actual native Source capability is unavailable; original Stage intent remains retained');
  const before=this.host.witness(),raw=await this.host.request(nativeStageLibraryRequest(intent),receive);
  need(this.same(before,this.host.witness()),'Library returned after the actual Source owner/Document boundary changed; retain its full native reply before admission');
  return raw;
 }
 async retry(intent:StageLibraryIntent,receive:(raw:unknown)=>Promise<void>):Promise<unknown> {
  // Original lookup precedes fresh CAS/capability; native private memo and the
  // normal S journal own historical/current discrimination.
  const raw=await this.host.request(nativeStageLibraryRequest(intent,true),receive);return raw;
 }
}
