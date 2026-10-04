/** Internal compiled-batch admission. The native owner hydrates the actual
 * definition, graph, timing and first pending material from its producer ref.
 * This caller retains request/receipt custody; it cannot construct a grant. */
import {clone} from './model';
import {sameNative,type Envelope} from './proceduralProtocol';
import {retainedProcedureAuthorship,type StageLibraryIntent} from './proceduralStageSource';
import type {StudioBasis} from './proceduralStudio';
import type {NativeDocumentTransactionContext} from './native-field/ql/instrument-session.mjs';

export type NativeDefinitionAction={action:'install_prepared'}|{action:'source_continue';procedure_ref:string};
export interface NativeDefinitionTarget {basis:StudioBasis;source_producer_ref:string|null;request:NativeDefinitionAction}
export interface NativeDefinitionIntent {lease:string;expression_ref:string;document_revision:number;source_producer_ref:string|null;request:NativeDefinitionAction}
export interface NativeDefinitionRequest {
 lease:string;expression_ref:string;document_revision:number;source_producer_ref?:string;
 request:{schema:'ql.field-host-request/v1';instance_ref:string;event_ref:string;subject_ref:string;request_id:string;expected_generation:string;expected_samples_elapsed:string;command:{operation:'procedure';request:NativeDefinitionAction}};
}
export interface PendingNativeDefinition {
 dispatch_state:'dispatched';context:NativeDocumentTransactionContext;original_request:NativeDefinitionRequest;
 raw_reply?:unknown;recovery_reply?:unknown;
}
export type NativeDefinitionPort=(target:NativeDefinitionTarget,
 capture:(context:NativeDocumentTransactionContext,request:NativeDefinitionRequest)=>Promise<void>,
 receive:(raw:unknown,recovery:boolean)=>Promise<void>,original?:PendingNativeDefinition)=>Promise<unknown>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const u64=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v)&&BigInt(v)<=18446744073709551615n;
function need(v:unknown,message:string):asserts v {if(!v)throw Error(message);}

export function validateNativeDefinitionTarget(target:NativeDefinitionTarget):void {
 need(object(target)&&Object.keys(target).sort().join(',')==='basis,request,source_producer_ref','Native definition requires its exact identity-only admission target');
 need(object(target.basis)&&text(target.basis.expression_ref)&&text(target.basis.scene_ref)&&Number.isSafeInteger(target.basis.document_revision)&&target.basis.document_revision>=1,'The original native definition Document/Scene/CAS is absent');
 const action=target.request;
 need(object(action)&&((action.action==='install_prepared'&&Object.keys(action).join(',')==='action'&&typeof target.source_producer_ref==='string'&&/^procedure-source:[a-f0-9]{64}$/.test(target.source_producer_ref))||
  (action.action==='source_continue'&&Object.keys(action).sort().join(',')==='action,procedure_ref'&&text(action.procedure_ref)&&target.source_producer_ref===null)),
 'Definition admission accepts only the actual first producer or original installed Procedure identity');
}
/** The Session supplies this sealed header. Saved caller JSON cannot establish
 * its current owner/ordinal; the dedicated private recovery API checks that. */
export function validateNativeDefinitionRequest(target:NativeDefinitionTarget,context:NativeDocumentTransactionContext,raw:unknown):NativeDefinitionRequest {
 validateNativeDefinitionTarget(target);
 need(object(context)&&context.schema==='ql.native-document-transaction/v1'&&['instance_ref','event_ref','subject_ref'].every(k=>text(context[k as keyof NativeDocumentTransactionContext]))&&
  [context.last_request_id,context.next_request_id,context.expected_generation,context.expected_samples_elapsed].every(u64)&&BigInt(context.next_request_id)===BigInt(context.last_request_id)+1n,
 'Original definition needs the SAME sealed Session context');
 need(object(raw)&&Object.keys(raw).sort().join(',')===(target.source_producer_ref===null?'document_revision,expression_ref,lease,request':'document_revision,expression_ref,lease,request,source_producer_ref')&&
  text(raw.lease)&&raw.expression_ref===target.basis.expression_ref&&raw.document_revision===target.basis.document_revision&&
  (target.source_producer_ref===null?!Object.hasOwn(raw,'source_producer_ref'):raw.source_producer_ref===target.source_producer_ref),
 'The sealed definition request differs from its actual producer/Document basis');
 const request=raw.request;
 need(object(request)&&Object.keys(request).sort().join(',')==='command,event_ref,expected_generation,expected_samples_elapsed,instance_ref,request_id,schema,subject_ref'&&
  request.schema==='ql.field-host-request/v1'&&request.instance_ref===context.instance_ref&&request.event_ref===context.event_ref&&request.subject_ref===context.subject_ref&&
  request.request_id===context.next_request_id&&request.expected_generation===context.expected_generation&&request.expected_samples_elapsed===context.expected_samples_elapsed&&
  object(request.command)&&Object.keys(request.command).sort().join(',')==='operation,request'&&request.command.operation==='procedure'&&sameNative(request.command.request,target.request),
 'Definition request differs from the exact original Session header/action');
 return clone(raw) as unknown as NativeDefinitionRequest;
}
export function validatePendingNativeDefinition(target:NativeDefinitionTarget,pending:PendingNativeDefinition):void {
 need(pending?.dispatch_state==='dispatched','Original definition dispatch standing is uncertain');
 validateNativeDefinitionRequest(target,pending.context,pending.original_request);
}
/** Extract only an actual native retained outcome. Recovery currentness and
 * Source currentness are separate; the Session accounts its old ACK once. */
export function nativeDefinitionOriginalResult(pending:PendingNativeDefinition,raw:unknown,recovery:boolean):Record<string,unknown> {
 need(object(raw),'The actual complete definition receipt is absent');
 if(!recovery)return raw;
 need(raw.schema==='oi.native-procedural-definition-recovery/v1'&&sameNative(raw.original_intent,pending.original_request)&&raw.found===true&&raw.recovered===true&&raw.replayed===false&&
  raw.recovery_current===true&&raw.recovery_currentness===null&&Array.isArray(raw.native_procedural_receipts)&&raw.native_procedural_receipts.length===0&&raw.consumer_release==='unconfirmed'&&object(raw.original_result),
 'The original definition lookup did not requalify the SAME actual retained outcome; do not resend');
 return raw.original_result;
}
export function validateInitialNativeDefinition(intent:StageLibraryIntent,envelope:Envelope,pending:PendingNativeDefinition,raw:unknown,recovery=false):Record<string,unknown> {
 need(intent.action==='prepare','Regeneration requires its Rule-owned event; initial definition cannot be installed again');
 const target:NativeDefinitionTarget={basis:intent.basis,source_producer_ref:envelope.producer_ref??null,request:{action:'install_prepared'}};
 validatePendingNativeDefinition(target,pending);
 const result=nativeDefinitionOriginalResult(pending,raw,recovery);
 need(result.schema==='oi.native-procedural-definition/v1'&&sameNative(result.original_intent,pending.original_request)&&sameNative(result.original_request,pending.original_request.request)&&
  result.captured_producer_ref===envelope.producer_ref,'Native definition receipt changed its full original request or producer');
 need(result.state==='definition_received'&&result.reason===null&&result.source_current===true&&result.material_status==='pending_reception'&&result.consumer_release==='unconfirmed',
 'The first native definition remains refused or uncertain; retain its full original ACK before normal Prepare');
 const ack=result.native_receipt,channel=result.native_source_channel;
 need(object(ack)&&ack.schema==='ql.field-host-receipt/v1'&&object(channel)&&channel.schema==='ql.native-act-owner-result/v1'&&object(channel.result)&&sameNative(channel.result.native_receipt,ack),
 'The first definition lost its actual full Host/C owner reply correspondence');
 const context=pending.context,field=ack.field;
 need(ack.available===true&&['ok','refused'].includes(String(ack.status))&&ack.instance_ref===context.instance_ref&&ack.request_id===context.next_request_id&&ack.last_request_id===context.next_request_id&&
  object(field)&&field.event_ref===context.event_ref&&field.subject_ref===context.subject_ref&&field.generation===context.expected_generation&&field.samples_elapsed===context.expected_samples_elapsed&&Array.isArray(field.audio)&&field.audio.length===0,
 'The original definition Host ACK differs from its SAME sealed FIELD boundary');
 need(object(ack.procedural)&&ack.procedural.status==='installed_pending_material'&&sameNative(ack.procedural.definition_receipt,result.definition_receipt),
 'The native first batch is not retained as pending material');
 const receipt=result.definition_receipt;
 need(object(receipt)&&receipt.schema==='ql.native-procedural-definition-receipt/v1'&&receipt.kind==='install_prepared'&&receipt.material_status==='pending_reception'&&
  object(receipt.definition)&&object(receipt.original_preparation)&&object(receipt.source_bootstrap)&&object(receipt.current_source)&&object(receipt.consumer_contract)&&object(receipt.native_timing_evidence),
 'The first definition needs its complete Source preparation/current context/timing receipt');
 const prepared=receipt.original_preparation,procedure=prepared.original_procedure,edit=prepared.native_edit;
 need(prepared.operation_ref===envelope.operation_ref&&prepared.procedure_ref===intent.authored.procedure_ref&&prepared.expected_document_revision===envelope.expected_revision&&
  prepared.recipe_revision===intent.authored.revision&&object(edit)&&edit.actor===envelope.actor&&sameNative(edit.changes,envelope.changes)&&object(procedure)&&
  receipt.definition.procedure&&sameNative(receipt.definition.procedure,procedure),
 'Native first preparation differs from the actual issued Envelope or original Procedure');
 const bootstrap=receipt.source_bootstrap,scene=bootstrap.scene,currentSource=receipt.current_source;
 need(sameNative(retainedProcedureAuthorship(procedure),intent.authored)&&
  sameNative(prepared.timing,intent.authored.timing)&&sameNative(currentSource.native_scene_source,intent.source)&&
  object(scene)&&scene.native_owner===intent.source.native_owner&&scene.expression_ref===intent.source.expression_ref&&scene.scene_ref===intent.source.scene_ref&&
  scene.document_revision===intent.source.document_revision&&sameNative(scene.source_basis,intent.source.source_basis)&&scene.material_fingerprint===intent.source.material_fingerprint&&
  sameNative(scene.presentation,intent.source.presentation)&&object(bootstrap.authorship)&&sameNative(bootstrap.authorship.contributors,intent.source.contributors),
 'The first native installation changed the original authored recipe or Source; no normal Prepare was issued');
 return clone(result);
}
