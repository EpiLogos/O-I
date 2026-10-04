/** Wire counterpart of expression::procedural. Host requests join the
 * existing native Workspace serial queue, never a parallel document writer. */
import {clone} from './model';
import type {NativeControlRequest,NativeDriverRequest} from './proceduralNativeControls.js';
import type {NativeAuthoredDriverIntent,NativeAuthoredDriverReadRequest} from './proceduralStageAuthoredDrivers';
import {PROCEDURAL_SCHEMA,validateAddress,addressCovers,type StageAddress,type SourceBasis} from './proceduralRetention';
export type Scope={kind:'expression'}|{kind:'scenes';scene_refs:string[]}|{kind:'addresses';addresses:StageAddress[]}|{kind:'subject';subject_ref:string}|{kind:'locus';source_ref:string;source_revision:string}|{kind:'tag';scene_refs:string[];tag:string;origin:'native'|'authored'|'generated'};
export type Timing={kind:'immediate'}|{kind:'owner_boundary';owner:string;instance_ref:string;cursor:number};
export interface Participant {owner:string;instance_ref:string;required_generation:number;targets:StageAddress[]}
export interface Envelope {operation_ref:string;expression_ref:string;expected_revision:number;actor:string;scope:Scope;sources:SourceBasis[];changes:Array<Record<string,unknown>>;participants:Participant[];timing:Timing;cause_ref:string|null;output_readings?:unknown[];producer_ref?:string}
export type Status='prepared'|'scheduled'|'applying'|'applied'|'cancelled'|'interrupted'|'failed';
export interface Observation {owner:string;instance_ref:string;generation:number;document_revision:number;operation_ref:string;cursor:number;targets:StageAddress[];effective:unknown}
export interface Operation {fingerprint:string;envelope:Envelope;targets:StageAddress[];status:Status;accepted_revision:number|null;applied_revision:number|null;observations:Observation[];failure:string|null}
export interface ObservationBasis {operation_ref:string;material_revision:number;document_revision:number;qualification:'warm_native_material_journal';restored:false}
export interface StateReading {schema:typeof PROCEDURAL_SCHEMA;expression_ref:string;document_revision:number;cursor:number;resynchronised:boolean;snapshot:Array<{address:StageAddress;authored:unknown;document_revision:number}>;deltas:Array<{cursor:number;delta:unknown}>;effective_observations:Observation[];effective_observation_bases?:ObservationBasis[];operation_history?:Array<{operation:Operation;restored:boolean}>}
export type ProceduralRequest={operation:'read_source';expression_ref:string;expected_revision:number;scope:Scope;property_keys:string[];scene_profile:SourceBasis|null}|{operation:'read_outputs';expression_ref:string;expected_revision:number;procedure_ref:string}|{operation:'read';expression_ref:string;scope:Scope;after_cursor:number|null}|{operation:'prepare';envelope:Envelope}|{operation:'commit'|'inspect_operation'|'cancel';operation_ref:string}|NativeDriverRequest|NativeControlRequest|NativeAuthoredDriverIntent|NativeAuthoredDriverReadRequest;
/** Supplied only by the existing Workspace owner after its flush/adoption
 * gates. Mutating commands are retained in that owner's recovery record. */
export interface ProceduralOwner {procedural(request:ProceduralRequest):Promise<unknown>}
const integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
const scopeOverlap=(a:StageAddress,b:StageAddress)=>addressCovers(a,b)||addressCovers(b,a);
export function validateEnvelope(raw:unknown):Envelope {
 const e=raw as Envelope;
 if(e?.producer_ref!==undefined&&(!e.producer_ref.startsWith('procedure-source:')||!/^[a-f0-9]{64}$/.test(e.producer_ref.slice(17))))throw Error('Invalid actual native producer admission');
 if(!e||!e.operation_ref||!e.actor||!e.expression_ref?.startsWith('expression:')||!integer(e.expected_revision)||e.expected_revision<1||!Array.isArray(e.changes)||!e.changes.length||e.changes.length>256||!Array.isArray(e.sources)||!Array.isArray(e.participants)||e.participants.length>16)throw Error('Invalid native procedural envelope');
 if(!e.scope||!['expression','scenes','addresses','subject','locus','tag'].includes(e.scope.kind))throw Error('Unknown scope selector');
 if(!e.timing||!['immediate','owner_boundary'].includes(e.timing.kind))throw Error('Unknown native timing domain');
 if(e.scope.kind==='addresses'){if(!Array.isArray(e.scope.addresses)||(!e.scope.addresses.length&&e.producer_ref===undefined)||e.scope.addresses.length>2048)throw Error('Empty or unbounded explicit target set without native producer admission');e.scope.addresses.forEach(a=>{validateAddress(a);if(a.expression_ref!==e.expression_ref)throw Error('Scoped target belongs to another Expression');});}
 if(e.scope.kind==='scenes'||e.scope.kind==='tag'){if(!Array.isArray(e.scope.scene_refs)||!e.scope.scene_refs.length||e.scope.scene_refs.length>256||e.scope.scene_refs.some(r=>!r.startsWith(e.expression_ref+':scene:')))throw Error('Scene selector is outside this Expression');}
 if(e.scope.kind==='subject'&&!e.scope.subject_ref||e.scope.kind==='locus'&&(!e.scope.source_ref||!e.scope.source_revision))throw Error('Scope lacks a source-qualified native target');
 for(const source of e.sources)if(!source||typeof source.ref!=='string'||!source.ref||typeof source.revision!=='string'||!source.revision||source.availability!=='available')throw Error('Prepared source basis is unqualified, unavailable or stale');
 if(e.scope.kind==='tag'&&!['native','authored','generated'].includes(e.scope.origin))throw Error('Tag origin is required');
 const timing=e.timing;
 if(timing.kind==='owner_boundary'&&(!integer(timing.cursor)||!e.participants.some(p=>p.owner===timing.owner&&p.instance_ref===timing.instance_ref)))throw Error('Scheduled operation needs its actual native timing participant');
 const participants=new Set<string>();
 for(const p of e.participants){const key=JSON.stringify([p.owner,p.instance_ref]);if(!p.owner||!p.instance_ref||!integer(p.required_generation)||p.required_generation<1||!p.targets?.length||participants.has(key))throw Error('Invalid or duplicate native participant');participants.add(key);p.targets.forEach(a=>{validateAddress(a);if(a.expression_ref!==e.expression_ref)throw Error('Participant belongs to another Expression');});}
 return clone(e);
}
export function validateOperation(raw:unknown):Operation {
 const o=raw as Operation;
 if(!o||typeof o.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(o.fingerprint)||!['prepared','scheduled','applying','applied','cancelled','interrupted','failed'].includes(o.status)||!Array.isArray(o.targets)||!Array.isArray(o.observations))throw Error('Invalid retained native operation');
 validateEnvelope(o.envelope);o.targets.forEach(a=>{validateAddress(a);if(a.expression_ref!==o.envelope.expression_ref)throw Error('Operation target belongs to another Expression');});
 for(const revision of [o.accepted_revision,o.applied_revision])if(revision!==null&&(!integer(revision)||revision<1))throw Error('Invalid operation revision');
 if(o.accepted_revision===null||o.accepted_revision<=o.envelope.expected_revision)throw Error('Operation lacks its durably accepted preparation revision');
 if(['applying','applied'].includes(o.status)&&o.applied_revision===null)throw Error('Application requires the actual committed document revision');
 if(o.applied_revision!==null&&o.applied_revision<=(o.accepted_revision??o.envelope.expected_revision))throw Error('Operation did not advance its exact admitted basis');
 const owners=new Set<string>();
 for(const observed of o.observations){
  const p=o.envelope.participants.find(p=>p.owner===observed.owner&&p.instance_ref===observed.instance_ref),id=JSON.stringify([observed.owner,observed.instance_ref]);
  if(!p||owners.has(id)||observed.operation_ref!==o.envelope.operation_ref||observed.document_revision!==o.applied_revision||!integer(observed.generation)||observed.generation<p.required_generation||!integer(observed.cursor)||!sameNative(p.targets,observed.targets))throw Error('Consumer acknowledgement has a different source, owner, target or application basis');
  owners.add(id);observed.targets.forEach(validateAddress);
 }
 if(o.status==='applied'&&o.envelope.participants.some(p=>!owners.has(JSON.stringify([p.owner,p.instance_ref]))))throw Error('Required native consumers have not acknowledged application');
 return clone(o);
}
function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical((value as Record<string,unknown>)[k])]));return value;}
export const sameNative=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
/** The native owner qualifies an original material revision across journal-only
 * revisions. Cold receipt rows and a caller-supplied revision alias cannot. */
export function observationBasisCurrent(reading:StateReading,observed:Observation):boolean {
 if(observed.document_revision===reading.document_revision)return true;
 const bases=reading.effective_observation_bases?.filter(b=>b.operation_ref===observed.operation_ref)??[];
 const history=reading.operation_history?.filter(h=>h.operation.envelope.operation_ref===observed.operation_ref)??[];
 if(bases.length!==1||history.length!==1)return false;
 const basis=bases[0],row=history[0];
 if(basis.qualification!=='warm_native_material_journal'||basis.restored!==false||row.restored!==false||basis.document_revision!==reading.document_revision||basis.material_revision!==observed.document_revision||row.operation.applied_revision!==basis.material_revision||row.operation.envelope.expression_ref!==reading.expression_ref)return false;
 try{validateOperation(row.operation);}catch{return false;}
 return ['applying','applied'].includes(row.operation.status)&&row.operation.observations.some(o=>sameNative(o,observed));
}
/** Original native receipts are inherited by the request owner at CAS.
 * Keeping them out of each immutable material intent prevents recursive
 * journal growth; all other authored/procedural/checkpoint bytes remain. */
export function proceduralChanges(changes:Array<Record<string,unknown>>):Array<Record<string,unknown>> {
 const out=clone(changes);
 for(const change of out){
  if(change.change!=='scene_material_set')continue;
  const presentation=change.presentation as {scene?:{procedural?:{operations?:unknown[]}}}|undefined;
  const retained=presentation?.scene?.procedural;
  if(retained){if(!Array.isArray(retained.operations))throw Error('The native operation journal is invalid');retained.operations=[];}
 }
 return out;
}
export class ProceduralClient {
 constructor(private readonly owner:ProceduralOwner){}
 async outputs(expression_ref:string,expected_revision:number,procedure_ref:string):Promise<unknown[]> {
  const result=await this.owner.procedural({operation:'read_outputs',expression_ref,expected_revision,procedure_ref}) as {schema?:string;state?:string;expression_ref?:string;document_revision?:number;output_readings?:unknown[]};
  if(result.state==='revision_conflict')throw Error('The retained output basis changed before it was read');
  if(result.schema!==PROCEDURAL_SCHEMA||result.expression_ref!==expression_ref||result.document_revision!==expected_revision||!Array.isArray(result.output_readings)||result.output_readings.length>2048)throw Error('The native output reading has a different document basis');
  return clone(result.output_readings);
 }
 async read(expression_ref:string,scope:Scope,after_cursor:number|null=null):Promise<StateReading>{
  const r=await this.owner.procedural({operation:'read',expression_ref,scope:clone(scope),after_cursor}) as StateReading;
  if(r?.schema!==PROCEDURAL_SCHEMA||r.expression_ref!==expression_ref||!integer(r.document_revision)||r.document_revision<1||!integer(r.cursor)||!Array.isArray(r.snapshot)||!Array.isArray(r.deltas)||!Array.isArray(r.effective_observations))throw Error('The native state reply has a different basis');
  r.snapshot.forEach(row=>{validateAddress(row.address);if(row.address.expression_ref!==expression_ref||row.document_revision!==r.document_revision)throw Error('State snapshot mixed different document bases');});
  let cursor=after_cursor??0;for(const delta of r.deltas){if(!integer(delta.cursor)||delta.cursor<=cursor||delta.cursor>r.cursor)throw Error('Native delta cursor regressed');cursor=delta.cursor;}
  for(const o of r.effective_observations){if(!integer(o.generation)||!integer(o.cursor)||!observationBasisCurrent(r,o)||!o.targets?.length||o.targets.some(a=>a.expression_ref!==expression_ref)||!r.snapshot.some(row=>o.targets.some(a=>scopeOverlap(row.address,a))))throw Error('Effective observation is foreign, stale or outside the actual resolved scope');}
  return clone(r);
 }
 private async operation(request:ProceduralRequest):Promise<{operation:Operation;restored:boolean;repeated:boolean;document_receipt?:unknown}>{
  const r=await this.owner.procedural(request) as {schema?:string;state?:string;current_revision?:number;operation?:Operation;restored?:boolean;repeated?:boolean;document_receipt?:unknown};
  if(r?.state==='revision_conflict')throw Error(`The Expression changed to revision ${r.current_revision}; the original intent is retained for reconciliation`);
  if(r?.schema!==PROCEDURAL_SCHEMA||!r.operation)throw Error('The native owner returned no procedural receipt');
  const op=validateOperation(r.operation),expected=request.operation==='prepare'?request.envelope.operation_ref:request.operation==='read'||request.operation==='read_outputs'||request.operation==='read_source'||request.operation==='read_driver'||request.operation==='read_authored_drivers'?null:request.operation_ref;
  if(op.envelope.operation_ref!==expected||request.operation==='prepare'&&!sameNative(op.envelope,request.envelope))throw Error('The native reply belongs to a different operation or accepted intent');
  return {operation:op,restored:r.restored===true,repeated:r.repeated===true,document_receipt:r.document_receipt};
 }
 prepare(envelope:Envelope){return this.operation({operation:'prepare',envelope:validateEnvelope(envelope)});}
 commit(operation_ref:string){return this.operation({operation:'commit',operation_ref});}
 inspect(operation_ref:string){return this.operation({operation:'inspect_operation',operation_ref});}
 cancel(operation_ref:string){return this.operation({operation:'cancel',operation_ref});}
}
