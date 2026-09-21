/** Consumer of the native QL personal operation contract. It is not a Nara
 * registry, journal, authority grant or parallel implementation of M4. */
import {kernelOp} from '../../kernel/bridge';
import type {KernelTransportStatus} from '../../kernel/types';

export const PERSONAL_CONTRACT = 'ql.nara-personal-operations/v1';
export const PERSONAL_RECORD = 'ql.nara-personal-record/v1';
export interface PersonalTarget {record_ref:string;nara_ref:string;subject_ref:string}
export interface PersonalConsent {actor_ref:string;actor_kind:'human';personal_data:true}
export interface ProtectedSource {ref_id:string;revision:string;owner_ref:string}
export interface SourceBasis {source_ref:string;revision:string;standing_ref:string}
export interface IdentitySlot {
  kind:string;coordinate_ref:string;source:SourceBasis|null;protected_value_ref:ProtectedSource|null;
  evidence_refs:string[];tensions:string[];absence_reason:string|null;standing:string;
}
export interface PersonalRecord {
  schema:typeof PERSONAL_RECORD;target:PersonalTarget;revision:number;private:true;
  domain:{schema:'ql.nara-m4-domain/v1';subject_id:string;event:Record<string,unknown>;
    identity:{identity_revision:string;slots:IdentitySlot[];identity_hash_ref:ProtectedSource|null;identity_quaternion_ref:ProtectedSource|null;m3_form_address_ref:string|null;derivation_refs:string[]};
    embodied:Record<string,unknown>;oracle:Record<string,unknown>;transformation:Record<string,unknown>;
    context:Record<string,unknown>;integration:Record<string,unknown>;q_composed:{w:number;x:number;y:number;z:number};source_revisions:SourceBasis[];standing:string};
  journal_refs:ProtectedSource[];receipts:Record<string,unknown>[];
}
export interface PersonalCapabilities {schema:typeof PERSONAL_CONTRACT;ok:true;operations:string[];identity_slots:string[];oracle_systems:string[];context_branches:string[];integration_offices:string[];branches:string[];centres:number;centres_are_cymatic_stations:false;public_export:false}
export type PersonalRequest =
  |{operation:'capabilities'}
  |{operation:'list';consent:PersonalConsent}
  |{operation:'read';target:PersonalTarget;consent:PersonalConsent}
  |{operation:'identity_material';target:PersonalTarget;consent:PersonalConsent;expected_revision:number}
  |{operation:'create';request_id:string;consent:PersonalConsent;seed:Record<string,unknown>}
  |{operation:'apply';request_id:string;consent:PersonalConsent;target:PersonalTarget;expected_revision:number;mutation:Record<string,unknown>};
export type PersonalCall=(request:PersonalRequest)=>Promise<unknown>;
export class PersonalRefusal extends Error {constructor(message:string){super(message);this.name='PersonalRefusal';}}
export function object(value:unknown,label='Native reading'):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} is not an object`);
  return value as Record<string,unknown>;
}
export function text(value:unknown,label='Reference'):string{
  if(typeof value!=='string'||!value.trim()||value.length>4096||/[\u0000-\u001f\u007f]/.test(value))throw new Error(`${label} is missing or malformed`);return value;
}
export function sameTarget(a:PersonalTarget,b:PersonalTarget):boolean{return a.record_ref===b.record_ref&&a.nara_ref===b.nara_ref&&a.subject_ref===b.subject_ref;}
export function targetOf(value:unknown):PersonalTarget{
  const v=object(value,'Personal target');return {record_ref:text(v.record_ref),nara_ref:text(v.nara_ref),subject_ref:text(v.subject_ref)};
}
export function readEnvelope(value:unknown):Record<string,unknown>{
  const v=object(value);
  if(v.schema!==PERSONAL_CONTRACT||typeof v.ok!=='boolean')throw new Error('Incompatible native personal reply; no success was inferred');
  if(!v.ok)throw new PersonalRefusal(typeof object(v.error).reason==='string'?String(object(v.error).reason):'The native personal operation was refused');
  if(v.private!==true||v.automatic_agent_or_model_invocation!==false)throw new Error('The personal reply lost its private, non-inference standing');
  return v;
}
export function readRecord(value:unknown,expected?:PersonalTarget):PersonalRecord{
  const v=object(value,'Personal record'),target=targetOf(v.target),domain=object(v.domain,'M4 domain');
  if(v.schema!==PERSONAL_RECORD||v.private!==true||!Number.isSafeInteger(v.revision)||Number(v.revision)<1||domain.schema!=='ql.nara-m4-domain/v1'||domain.subject_id!==target.subject_ref)
    throw new Error('Invalid private native personal record');
  if(expected&&!sameTarget(target,expected))throw new Error('The owner returned another personal encounter');
  for(const key of ['identity','embodied','oracle','transformation','context','integration','event','q_composed'])object(domain[key],key);
  if(!Array.isArray(object(domain.identity).slots)||!Array.isArray(v.journal_refs)||!Array.isArray(v.receipts)||!Array.isArray(domain.source_revisions))throw new Error('Native personal record is incomplete');
  return structuredClone(v) as unknown as PersonalRecord;
}
/** Bound public route: the kernel forwards to `oi ql nara` on stdin. Personal
 * data is never put into process arguments, generic diagnostics or telemetry. */
export function personalCall(transport:()=>KernelTransportStatus,project?:string):PersonalCall{
  return async request=>{
    const target='target' in request?request.target.record_ref:'ql:nara-personal';
    const reply=await kernelOp(transport(),{op:'invoke_action',...(project?{project}:{}),invocation:{action:'ql.nara.personal',target_ref:target,input:request}});
    if(reply.error||reply.outcome?.result!=='action_dispatched')throw new Error('The native personal transport did not confirm an outcome; retain the original request for recovery');
    const dispatch=reply.outcome.dispatch;
    if(dispatch.state!=='invoked')throw new Error('The native personal operation did not return a confirmed result. Re-read or recover the original request; no automatic retry.');
    return dispatch.data;
  };
}
export interface PersonalState {record:PersonalRecord|null;busy:boolean;pending:PersonalRequest|null;error:string|null}
/** One presentation's review state, not durable personal state. No persistence,
 * model calls or timer. Uncertain writes retain their exact idempotency key. */
export class PersonalController {
  private state:PersonalState={record:null,busy:false,pending:null,error:null};
  private readonly call:PersonalCall;
  readonly consent:PersonalConsent;
  constructor(call:PersonalCall,consent:PersonalConsent){this.call=call;this.consent=structuredClone(consent);text(consent.actor_ref);if(consent.actor_kind!=='human'||consent.personal_data!==true)throw new Error('Explicit personal-data consent is required');}
  get snapshot():PersonalState{return structuredClone(this.state);}
  async read(target:PersonalTarget):Promise<PersonalRecord>{
    if(this.state.busy||this.state.pending)throw new Error('Resolve the current personal operation before changing the selected encounter');
    this.state.busy=true;
    try{const reply=readEnvelope(await this.call({operation:'read',target,consent:this.consent}));const record=readRecord(reply.record,target);this.state.record=record;this.state.error=null;return structuredClone(record);}
    catch(error){this.state.error=error instanceof Error?error.message:'Personal read failed';throw error;}finally{this.state.busy=false;}
  }
  async apply(mutation:Record<string,unknown>):Promise<PersonalRecord>{
    if(this.state.busy||this.state.pending||!this.state.record)throw new Error('Read the current personal record and resolve any outstanding operation first');
    const request:PersonalRequest={operation:'apply',request_id:`nara-operation/${crypto.randomUUID()}`,consent:structuredClone(this.consent),target:structuredClone(this.state.record.target),expected_revision:this.state.record.revision,mutation:structuredClone(mutation)};
    return this.write(request);
  }
  async create(seed:Record<string,unknown>):Promise<PersonalRecord>{
    if(this.state.busy||this.state.pending||this.state.record)throw new Error('Do not recreate a personal occasion; continue its existing record');
    return this.write({operation:'create',request_id:`nara-operation/${crypto.randomUUID()}`,consent:structuredClone(this.consent),seed:structuredClone(seed)});
  }
  async recover():Promise<PersonalRecord>{
    if(this.state.busy||!this.state.pending)throw new Error('There is no outstanding personal operation');
    // Native request replay is idempotent, unlike resending an Agent turn or
    // recasting an oracle. Reuse exactly the prior ID AND complete payload.
    return this.write(structuredClone(this.state.pending));
  }
  private async write(request:PersonalRequest):Promise<PersonalRecord>{
    if(request.operation!=='apply'&&request.operation!=='create')throw new Error('Not a native mutation');
    this.state.busy=true;this.state.pending=structuredClone(request);this.state.error=null;
    try{
      const reply=readEnvelope(await this.call(request));const expected=request.operation==='apply'?request.target:undefined;
      const record=readRecord(reply.record,expected),receipt=object(reply.receipt,'Native receipt');
      const previous=request.operation==='apply'?request.expected_revision:0;
      if(receipt.request_id!==request.request_id||receipt.previous_revision!==previous||receipt.revision!==previous+1||record.revision<Number(receipt.revision)||reply.source_mutated!==false||receipt.source_mutated!==false)
        throw new Error('The owner did not confirm this exact revision-bound operation');
      if(request.operation==='apply'&&receipt.operation!==request.mutation.kind)throw new Error('The returned receipt belongs to another operation');
      if(request.operation==='create'&&(record.target.nara_ref!==request.seed.nara_ref||record.target.subject_ref!==object(request.seed.personal).subject_id||receipt.operation!=='create'))throw new Error('The returned personal occasion differs from the requested one');
      this.state.record=record;this.state.pending=null;return structuredClone(record);
    }catch(error){if(error instanceof PersonalRefusal)this.state.pending=null;this.state.error=error instanceof Error?error.message:'Personal operation has unknown outcome';throw error;}
    finally{this.state.busy=false;}
  }
}
