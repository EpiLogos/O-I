/** Identity-only intent for the native lifecycle owner. Reading retained rows
 * here discloses saved authorship; it never establishes an installed instance,
 * Source qualification, event boundary or material/physical acknowledgement. */
import {clone} from './model';
import {sameNative} from './proceduralProtocol';
import {retention,type ProcedureRetention,type ContributionRetention} from './proceduralRetention';
import {studioBasis,type StudioSnapshot} from './proceduralStudio';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge';
import {validateOperation,validateEnvelope,type Operation,type ProceduralRequest} from './proceduralProtocol';

export type NativeLifecycleAction={kind:'retire'}|{kind:'contribution_detach';contribution_ref:string}|{kind:'scene_policy';from_scene_ref:string;to_scene_ref:string;policy:'continue'|'hold'|'checkpoint_release'};
export interface NativeLifecycleIntent {operation:'lifecycle';expression_ref:string;expected_revision:number;scene_ref:string;operation_ref:string;actor:string;procedure_ref:string;expected_procedure_revision:string;action:NativeLifecycleAction}
export interface NativeLifecycleCancelIntent {operation:'lifecycle_cancel';expression_ref:string;expected_revision:number;scene_ref:string;operation_ref:string;actor:string;procedure_ref:string;expected_procedure_revision:string}
export interface StageLifecycleProcedure {procedure:ProcedureRetention;scene_refs:string[];contributions:ContributionRetention[]}
export interface StageLifecycleChoice {scene_ref:string;title:string;procedures:StageLifecycleProcedure[]}
export type StageLifecycleAvailability={state:'available';owner:string;expression_ref:string;document_revision:number;source_ref:string;source_revision:string}|{state:'unavailable';reason:string};
/** Raw native reply remains attached to original intent. A status alone is not
 * a material readback, nor an observation of flow, resident state or sound. */
export interface StageLifecycleAdmission {producer_ref:string;expression_ref:string;document_revision:number;prepared:Record<string,unknown>;source:unknown}
export interface NativeLifecycleReply {schema:'oi.expression-procedural-lifecycle/v1';original_intent:NativeLifecycleIntent|NativeLifecycleCancelIntent;state:'material_abandoned'|'prepared'|'pending_reception'|'applied'|'historical_retry'|'source_refused'|'revision_conflict'|'reconciliation_required';native_receipt:Record<string,unknown>|null;preparation:StageLifecycleAdmission|null;document:KernelExpressionDocument;source_current:boolean;replayed:boolean;historical_native_receipt?:Record<string,unknown>;prepare_request?:Extract<ProceduralRequest,{operation:'prepare'}>;operation?:Operation;reason?:string}
export interface StageLifecycleObservation {original_intent:NativeLifecycleIntent;native_reply:NativeLifecycleReply;state:NativeLifecycleReply['state'];standing:string;view:KernelConversion;operation?:Operation}
export interface StageLifecyclePort {
 snapshot():StudioSnapshot|null;
 capability(action:NativeLifecycleAction['kind'],snapshot:StudioSnapshot):StageLifecycleAvailability;
 /** SAME serialized Workspace/NativeWorking writer persists the full original
  * before sending it. The native factory supplies ConductEvent/current flow. */
 submit(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;
 /** Read/retry the original native owner through its guarded recovery route.
  * Never replay a saved host ACK or convert cold history into a live grant. */
 retry(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;
 /** Only a live reply already validated by the same Working writer after
  * protected Source material_readback; saved S labels alone never clear it. */
 settled?(intent:NativeLifecycleIntent):StageLifecycleObservation|null;
}
const scalarText=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=4096&&!/[\u0000-\u001f\u007f]/.test(value);
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function exact(value:Record<string,unknown>,keys:string[]){if(!keys.every(key=>Object.hasOwn(value,key))||Object.keys(value).some(key=>!keys.includes(key)))throw Error('Native lifecycle intent has missing or unknown fields');}

/** Accepted native Document only, never the mutable local Journey. Mirrors
 * across generated Scenes must carry the same complete retained definition and
 * contribution. Scene occurrence IDs remain separate from Procedure identity. */
export function stageLifecycleChoices(snapshot:StudioSnapshot):StageLifecycleChoice[]{
 const basis=studioBasis(snapshot),doc=snapshot.view.document,procedures=new Map<string,StageLifecycleProcedure>(),contributions=new Map<string,ContributionRetention>();
 if(doc.expression_ref!==basis.expression_ref||doc.revision!==basis.document_revision)throw Error('The current native lifecycle Document basis is unavailable');
 for(const scene of doc.scenes){
  if(!scene.scene_ref.startsWith(doc.expression_ref+':scene:'))throw Error('A retained lifecycle Scene belongs to another Expression');
  const material=scene.presentation?.scene;if(!material)continue;const saved=retention(material);
  for(const row of saved.procedures){const prior=procedures.get(row.procedure_ref);if(prior&&!sameNative(prior.procedure,row))throw Error('The full saved Procedure differs across its native Scene occurrences');if(prior)prior.scene_refs.push(scene.scene_ref);else procedures.set(row.procedure_ref,{procedure:clone(row),scene_refs:[scene.scene_ref],contributions:[]});}
  for(const row of saved.contributions){if(row.owned_addresses.some(address=>address.expression_ref!==doc.expression_ref))throw Error('A saved contribution belongs to another Expression');const prior=contributions.get(row.contribution_ref);if(prior&&!sameNative(prior,row))throw Error('The full saved contribution differs across its native Scene mirrors');if(!prior)contributions.set(row.contribution_ref,clone(row));}
 }
 for(const row of contributions.values()){const procedure=procedures.get(row.procedure_ref);if(procedure)procedure.contributions.push(row);}
 return doc.scenes.map(scene=>({scene_ref:scene.scene_ref,title:scene.title,procedures:[...procedures.values()].filter(row=>row.scene_refs.includes(scene.scene_ref)).map(clone)}));
}

export function validateStageLifecycleIntent(snapshot:StudioSnapshot,raw:unknown):NativeLifecycleIntent {
 if(!object(raw))throw Error('Retain the complete original native lifecycle intent');
 exact(raw,['operation','expression_ref','expected_revision','scene_ref','operation_ref','actor','procedure_ref','expected_procedure_revision','action']);
 const intent=raw as unknown as NativeLifecycleIntent,doc=snapshot.view.document;
 if(intent.operation!=='lifecycle'||intent.expression_ref!==doc.expression_ref||!Number.isSafeInteger(intent.expected_revision)||intent.expected_revision!==doc.revision||![intent.scene_ref,intent.operation_ref,intent.actor,intent.procedure_ref,intent.expected_procedure_revision].every(scalarText))throw Error('The lifecycle intent differs from its original native Document/CAS');
 const choices=stageLifecycleChoices(snapshot),scene=choices.find(row=>row.scene_ref===intent.scene_ref),procedure=scene?.procedures.find(row=>row.procedure.procedure_ref===intent.procedure_ref);
 if(!procedure||procedure.procedure.revision!==intent.expected_procedure_revision)throw Error('The exact original saved Procedure revision/Scene is unavailable; retain the intent');
 if(!object(intent.action))throw Error('Choose an explicit native lifecycle action');const action=intent.action;
 if(action.kind==='retire')exact(action,['kind']);
 else if(action.kind==='contribution_detach'){
  exact(action,['kind','contribution_ref']);const contribution=procedure.contributions.find(row=>row.contribution_ref===action.contribution_ref);
  if(!scalarText(action.contribution_ref)||!contribution||contribution.status!=='active')throw Error('The selected active contribution is not owned by this exact original Procedure');
 }else if(action.kind==='scene_policy'){
  exact(action,['kind','from_scene_ref','to_scene_ref','policy']);
  if(!['continue','hold','checkpoint_release'].includes(action.policy)||action.from_scene_ref!==intent.scene_ref||!choices.some(row=>row.scene_ref===action.from_scene_ref)||!choices.some(row=>row.scene_ref===action.to_scene_ref))throw Error('Choose the actual Procedure Scene as source, an actual destination Scene and an explicit continuation policy');
 }else throw Error('Unknown native lifecycle action');
 return clone(intent);
}
export function stageLifecycleIntent(snapshot:StudioSnapshot,input:{scene_ref:string;operation_ref:string;actor:string;procedure_ref:string;action:NativeLifecycleAction}):NativeLifecycleIntent {
 const scene=stageLifecycleChoices(snapshot).find(row=>row.scene_ref===input.scene_ref),procedure=scene?.procedures.find(row=>row.procedure.procedure_ref===input.procedure_ref);
 if(!procedure)throw Error('Choose an actual saved Procedure in its native Scene');
 return validateStageLifecycleIntent(snapshot,{operation:'lifecycle',expression_ref:snapshot.view.document.expression_ref,expected_revision:snapshot.view.document.revision,scene_ref:input.scene_ref,operation_ref:input.operation_ref,actor:input.actor,procedure_ref:input.procedure_ref,expected_procedure_revision:procedure.procedure.revision,action:clone(input.action)});
}
export function validateStageLifecycleAvailability(raw:StageLifecycleAvailability|undefined,snapshot:StudioSnapshot,action:NativeLifecycleAction['kind']):StageLifecycleAvailability {
 if(!raw)return {state:'unavailable',reason:`The native ${action} event/currentness/material receiver factory is not paired.`};
 if(raw.state==='unavailable'){if(!scalarText(raw.reason))throw Error('The native lifecycle owner omitted its unavailable reason');return clone(raw);}
 if(raw.state!=='available'||raw.expression_ref!==snapshot.view.document.expression_ref||raw.document_revision!==snapshot.view.document.revision||![raw.owner,raw.source_ref,raw.source_revision].every(scalarText))throw Error('The native lifecycle capability belongs to another Source/Document basis');return clone(raw);
}
export function lifecycleStanding(state:StageLifecycleObservation['state']):string {
 switch(state){case 'material_abandoned':return 'Source confirms the cancelled material was abandoned. Scene flow, body and sound release remain unconfirmed.';case 'prepared':return 'Native intent prepared; material receiving is pending.';case 'pending_reception':return 'Native material receiving is pending; retain the original operation.';case 'applied':return 'Native material settlement reported. Scene flow, body and sound observations remain separate.';case 'historical_retry':return 'Historical original receipt inspected; current Source requalification is required. No native request or material effect was replayed.';case 'source_refused':return 'Native Source refused the original intent; retain it for inspection.';case 'revision_conflict':return 'The native Document changed; retain the original target and intent.';case 'reconciliation_required':return 'Receiving standing is unresolved; inspect the same native owner before another action.';}
}

const u64=(value:unknown):value is string=>typeof value==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(value)&&BigInt(value)<(1n<<64n);
function need(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
/** Exact observation of the existing native owner, without a new clock.
 * Performance Boundary/committed P samples and queue admission horizon are
 * distinct from the outer held FIELD cursor and its source generation. */
export function validateStageLifecycleBoundary(position:Record<string,unknown>,timing:Record<string,unknown>,host:Record<string,unknown>):void {
 const field=host.field as Record<string,unknown>|undefined;
 need(host.schema==='ql.field-host-receipt/v1'&&host.status==='ok'&&host.available===true&&scalarText(host.instance_ref)&&u64(host.request_id)&&host.last_request_id===host.request_id,'Lifecycle omitted its genuine canonical native host acknowledgement');
 need(field?.schema==='ql.continuous-field/v1'&&scalarText(field.subject_ref)&&scalarText(field.event_ref)&&u64(field.generation)&&u64(field.samples_elapsed)&&Array.isArray(field.audio)&&field.audio.length===0,'Lifecycle omitted its complete actual nonadvancing native FIELD evidence');
 need(position&&scalarText(position.instance_ref)&&position.instance_ref===host.instance_ref&&scalarText(position.subject_ref)&&scalarText(position.event_ref)&&position.subject_ref===field.subject_ref&&position.event_ref===field.event_ref&&u64(position.generation)&&u64(position.samples_elapsed),'Lifecycle Source lacks its exact actual instance/subject/event/generation/sample boundary');
 need(timing&&scalarText(timing.owner_ref)&&scalarText(timing.epoch_ref)&&Number.isSafeInteger(timing.requested_cursor)&&Number(timing.requested_cursor)>=0&&Object.hasOwn(timing,'time_mapping_ref')&&(timing.time_mapping_ref===null||scalarText(timing.time_mapping_ref)),'Lifecycle Source lacks its complete native timing binding; unsafe dates cannot be rounded');
 if(timing.domain==='native_field_samples'){
  need(!Object.hasOwn(host,'native_timing_pulse')&&position.generation===field.generation&&position.samples_elapsed===field.samples_elapsed&&BigInt(timing.requested_cursor as number)===BigInt(position.samples_elapsed as string),'Lifecycle Source and its actual FIELD timing boundary disagree');
 }else if(timing.domain==='native_samples'){
  const pulse=host.native_timing_pulse as Record<string,unknown>|undefined,payload=pulse?.payload as Record<string,unknown>|undefined,fact=payload?.timing_fact as Record<string,unknown>|undefined,binding=fact?.binding as Record<string,unknown>|undefined,reading=pulse?.reading as Record<string,unknown>|undefined,scope=reading?.scope as Record<string,unknown>|undefined,physical=reading?.physical as Record<string,unknown>|undefined;
  need(pulse?.schema==='ql.performance-worker-reply/v1'&&pulse.accepted===true&&fact?.schema==='ql.native-performance-timing-fact/v1'&&fact.moment==='boundary'&&sameNative(fact.native_position,position),'Lifecycle omitted its genuine SAME performance Boundary pulse');
  need(binding&&Object.keys(binding).length===5&&['owner_ref','domain','epoch_ref','requested_cursor','time_mapping_ref'].every(key=>Object.hasOwn(binding,key))&&u64(binding.requested_cursor)&&u64(fact.admission_horizon)&&u64(fact.requested_cursor)&&u64(fact.admitted_cursor)&&(fact.applied_cursor===null||u64(fact.applied_cursor))&&u64(fact.committed_cursor)&&u64(fact.transport_epoch)&&Object.hasOwn(fact,'queued')&&typeof fact.device_callbacks_running==='boolean'&&object(fact.source),'Lifecycle performance pulse omitted its exact original timing/queue/source standing');
  need(scalarText(reading?.session_ref)&&binding.owner_ref===reading.session_ref&&binding.owner_ref===timing.owner_ref&&binding.domain==='native_samples'&&binding.domain===timing.domain&&binding.epoch_ref===`ql:performance/transport-epoch/${fact.transport_epoch}`&&binding.epoch_ref===timing.epoch_ref&&binding.time_mapping_ref===null&&sameNative(binding.time_mapping_ref,timing.time_mapping_ref)&&BigInt(binding.requested_cursor)===BigInt(timing.requested_cursor as number)&&binding.requested_cursor===fact.admission_horizon&&BigInt(fact.admission_horizon)>=BigInt(position.samples_elapsed as string),'Lifecycle Source differs from its actual performance owner/domain/epoch/mapping/admission horizon');
  need(scope?.instance_ref===position.instance_ref&&scope.event_ref===position.event_ref&&scope.subject_ref===position.subject_ref&&physical?.source_generation===position.generation&&fact.committed_cursor===reading.samples_elapsed&&fact.committed_cursor===physical.samples_elapsed&&fact.committed_cursor===position.samples_elapsed&&fact.transport_epoch===reading.transport_epoch,'Lifecycle Source is detached from its copied performance committed body cursor/source generation');
 }else throw Error('Lifecycle Source timing domain has no paired actual native owner');
}
/** Read-only discrimination after the SAME InstrumentSession has consumed a
 * genuine host ACK. This validator does not issue native authority, infer an
 * ACK from metadata, or feed historical evidence back into that session. */
export function validateStageLifecycleReply(snapshot:StudioSnapshot,intent:NativeLifecycleIntent,raw:unknown,originalPreparation?:NativeLifecycleReply):StageLifecycleObservation {
 need(object(raw),'The native lifecycle reply is unknown; retain the full original intent');const reply=raw as unknown as NativeLifecycleReply;
 need(reply.schema==='oi.expression-procedural-lifecycle/v1'&&sameNative(reply.original_intent,intent)&&['prepared','pending_reception','applied','historical_retry','source_refused','revision_conflict','reconciliation_required'].includes(reply.state)&&typeof reply.source_current==='boolean'&&typeof reply.replayed==='boolean','The native lifecycle receipt differs from its full original intent or receiving standing');
 need(reply.document?.schema==='oi.expression/v1'&&reply.document.expression_ref===intent.expression_ref&&Number.isSafeInteger(reply.document.revision)&&reply.document.revision>=intent.expected_revision,'The native lifecycle reply omitted its actual current Document');
 const view=kernelDocumentToJourney(reply.document,{identity:{expression:snapshot.view.journey.id,scenes:Object.fromEntries(Object.entries(snapshot.view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:snapshot.view.entity_ids},pages:Object.fromEntries(Object.values(snapshot.view.bindings).map(b=>[b.scene_ref,b.page]))});
 const result:StageLifecycleObservation={original_intent:clone(intent),native_reply:clone(reply),state:reply.state,standing:lifecycleStanding(reply.state),view};
 if(reply.state==='historical_retry'){
  need(reply.native_receipt===null&&object(reply.historical_native_receipt)&&reply.replayed===true&&reply.source_current===false,'Historical lifecycle evidence cannot become a live host ACK or Source grant');return result;
 }
 need(reply.replayed===false&&reply.historical_native_receipt===undefined,'A fresh lifecycle receipt cannot relabel a historical native acknowledgement');
 if(['source_refused','revision_conflict','reconciliation_required'].includes(reply.state)){
  need(reply.source_current===false&&typeof reply.reason==='string'&&!!reply.reason,'Native refusal omitted its exact current Source/reconciliation reason');
  need(!reply.operation||reply.operation.status!=='applied','A refused lifecycle cannot simultaneously report settled material');return result;
 }
 need(reply.source_current===true&&object(reply.native_receipt),'Current lifecycle receiving requires its actual same-owner host receipt and current Source');
 const host=reply.native_receipt,conduct=host.procedural as Record<string,unknown>|undefined,position=conduct?.native_position as Record<string,unknown>|undefined;
 need(conduct?.schema==='ql.procedural-conduct-receipt/v1'&&conduct.procedure_ref===intent.procedure_ref&&position,'Lifecycle Source and its actual host boundary disagree');
 const admission=reply.preparation;need(admission&&/^procedure-source:[a-f0-9]{64}$/.test(admission.producer_ref)&&admission.expression_ref===intent.expression_ref&&admission.document_revision===intent.expected_revision&&object(admission.prepared)&&admission.source,'The actual native lifecycle producer admission is unavailable');
 const prepared=admission.prepared,edit=prepared.native_edit as Record<string,unknown>|undefined,original=prepared.original_procedure as Record<string,unknown>|undefined,lifecycle=prepared.lifecycle_intent as Record<string,unknown>|undefined;
 const saved=snapshot.view.document.scenes.flatMap(scene=>scene.presentation?.scene?retention(scene.presentation.scene).procedures:[]).filter(row=>row.procedure_ref===intent.procedure_ref),definition=(saved[0] as unknown as {definition?:unknown}|undefined)?.definition;
 need(object(definition)&&sameNative(original,definition)&&saved.every(row=>sameNative((row as unknown as {definition?:unknown}).definition,definition)),'Lifecycle preparation differs from the full original saved native Procedure definition');
 if(reply.state==='prepared'||reply.state==='pending_reception')validateStageLifecycleBoundary(position,prepared.timing as Record<string,unknown>,host);
 else {
  const field=host.field as Record<string,unknown>|undefined;
  need(host.schema==='ql.field-host-receipt/v1'&&host.status==='ok'&&host.available===true&&scalarText(host.instance_ref)&&u64(host.request_id)&&host.last_request_id===host.request_id&&field?.schema==='ql.continuous-field/v1'&&scalarText(field.subject_ref)&&scalarText(field.event_ref)&&u64(field.generation)&&u64(field.samples_elapsed)&&Array.isArray(field.audio)&&field.audio.length===0,'Lifecycle settlement omitted its actual current host ACK; timing/field evidence is separate');
  const prior=originalPreparation?.native_receipt?.procedural as Record<string,unknown>|undefined;
  need(originalPreparation&&(originalPreparation.state==='prepared'||originalPreparation.state==='pending_reception')&&sameNative(originalPreparation.original_intent,intent)&&sameNative(originalPreparation.preparation,admission)&&prior?.status==='prepared'&&sameNative(prior.prepared,prepared)&&sameNative(conduct.original_preparation,prepared)&&sameNative(conduct.retained_original_native_position,prior.native_position),'Lifecycle settlement differs from its retained full original live Source preparation/position');
  need(object(prior.native_position)&&scalarText(prior.native_position.instance_ref)&&prior.native_position.instance_ref===host.instance_ref&&scalarText(prior.native_position.subject_ref)&&prior.native_position.subject_ref===field.subject_ref&&scalarText(prior.native_position.event_ref)&&prior.native_position.event_ref===field.event_ref&&u64(prior.native_position.generation)&&u64(prior.native_position.samples_elapsed),'Lifecycle settlement omitted its canonical retained same-owner/subject/event original Source position');
 }
 need(prepared.operation_ref===intent.operation_ref&&original?.procedure_ref===intent.procedure_ref&&original.revision===intent.expected_procedure_revision&&edit?.operation==='edit'&&edit.expression_ref===intent.expression_ref&&edit.expected_revision===intent.expected_revision&&edit.actor===intent.actor&&Array.isArray(edit.changes)&&edit.changes.length>0,'The native lifecycle preparation differs from the full original Procedure/actor/CAS/material');
 need(lifecycle?.schema==='ql.procedural-lifecycle-intent/v1'&&lifecycle.expression_ref===intent.expression_ref&&lifecycle.document_revision===intent.expected_revision&&lifecycle.scene_ref===intent.scene_ref&&lifecycle.operation_ref===intent.operation_ref&&lifecycle.actor_ref===intent.actor&&lifecycle.procedure_ref===intent.procedure_ref&&lifecycle.expected_procedure_revision===intent.expected_procedure_revision&&sameNative(lifecycle.action,intent.action)&&scalarText(lifecycle.source_read_receipt_ref),'The native lifecycle preparation omitted its exact source-read identity');
 if(reply.state==='prepared'||reply.state==='pending_reception'){
  need(reply.document.revision===intent.expected_revision&&sameNative(reply.document,snapshot.view.document),'The actual native Document changed before lifecycle S preparation; full original intent remains retained');
  const source=conduct.lifecycle as Record<string,unknown>|undefined;
  need(conduct.status==='prepared'&&sameNative(conduct.prepared,prepared)&&source?.schema==='ql.procedural-lifecycle-receipt/v1'&&sameNative(source.action,intent.action)&&source.operation_ref===intent.operation_ref&&source.state==='pending_material'&&source.consumer_release==='unconfirmed'&&source.actor_ref===intent.actor&&source.document_revision===intent.expected_revision&&source.source_read_receipt_ref===lifecycle.source_read_receipt_ref,'Source metadata does not establish native material settlement');
  if(reply.prepare_request){need(reply.prepare_request.operation==='prepare','Lifecycle omitted the actual native S Prepare request');const envelope=validateEnvelope(reply.prepare_request.envelope);need(envelope.operation_ref===intent.operation_ref&&envelope.expression_ref===intent.expression_ref&&envelope.expected_revision===intent.expected_revision&&envelope.actor===intent.actor&&envelope.producer_ref===admission.producer_ref&&sameNative(envelope.changes,edit.changes),'The native-issued lifecycle Envelope differs from the original admitted Source edit');}
  return result;
 }
 // Only the protected SAME Source material_readback and exact actual S
 // journal/current Document can settle a lifecycle. Generic applied edits,
 // saved labels or producer metadata cannot satisfy this gate.
 const settled=conduct.lifecycle as Record<string,unknown>|undefined;
 need(conduct.status==='material_received'&&settled?.schema==='ql.procedural-lifecycle-receipt/v1'&&settled.state==='material_received'&&settled.operation_ref===intent.operation_ref&&sameNative(settled.action,intent.action)&&settled.consumer_release==='unconfirmed','Lifecycle has no protected same-Source material readback with exact action; physical release remains unconfirmed');const operation=validateOperation(conduct.native_material_record);
 need(operation.status==='applied'&&operation.envelope.operation_ref===intent.operation_ref&&operation.envelope.expression_ref===intent.expression_ref&&operation.envelope.expected_revision===intent.expected_revision&&operation.envelope.actor===intent.actor&&operation.envelope.producer_ref===admission.producer_ref&&sameNative(operation.envelope.changes,edit.changes)&&operation.applied_revision!<=reply.document.revision,'Lifecycle material readback differs from its original native preparation');
 const journal=reply.document.scenes.flatMap(scene=>scene.presentation?.scene?retention(scene.presentation.scene).operations:[]).filter(row=>row.envelope.operation_ref===intent.operation_ref);need(journal.length>0&&journal.every(row=>sameNative(row,operation)),'The actual current native Document omitted or changed the settled lifecycle journal');
 if(reply.operation)need(sameNative(reply.operation,operation),'Lifecycle operation differs from the actual Source material readback');result.operation=operation;return result;
}

/** A cancellation identifies only the original pending procedure and the
 * actual post-S Cancel Document. It never transports a copied native_record,
 * a Source reader, contributors, a cursor, or a timing/release witness. */
export function validateStageLifecycleCancelIntent(view:KernelConversion,original:NativeLifecycleIntent,originalPreparation:NativeLifecycleReply,raw:unknown,actualOperation:unknown):NativeLifecycleCancelIntent {
 need(object(raw),'Retain the complete original native lifecycle cancellation intent');
 exact(raw,['operation','expression_ref','expected_revision','scene_ref','operation_ref','actor','procedure_ref','expected_procedure_revision']);
 const intent=raw as unknown as NativeLifecycleCancelIntent,doc=view.document;
 need(intent.operation==='lifecycle_cancel'&&intent.expression_ref===original.expression_ref&&intent.expression_ref===doc.expression_ref&&intent.expected_revision===doc.revision&&Number.isSafeInteger(intent.expected_revision)&&intent.scene_ref===original.scene_ref&&intent.operation_ref===original.operation_ref&&intent.actor===original.actor&&intent.procedure_ref===original.procedure_ref&&intent.expected_procedure_revision===original.expected_procedure_revision,'Lifecycle cancellation differs from its full original identity or actual post-Cancel Document/CAS');
 need(sameNative(originalPreparation.original_intent,original)&&['prepared','pending_reception'].includes(originalPreparation.state)&&originalPreparation.document.revision===original.expected_revision&&originalPreparation.preparation&&doc.scenes.some(scene=>scene.scene_ref===intent.scene_ref),'Lifecycle cancellation lacks its original native Source preparation/Scene');
 const operation=validateOperation(actualOperation),admission=originalPreparation.preparation,edit=admission.prepared.native_edit as Record<string,unknown>|undefined;
 need(originalPreparation.prepare_request?.operation==='prepare'&&sameNative(operation.envelope,validateEnvelope(originalPreparation.prepare_request.envelope)),'The actual cancellation envelope differs from its full original native-issued S preparation');
 need(operation.status==='cancelled'&&operation.applied_revision===null&&operation.failure===null&&operation.observations.length===0&&operation.accepted_revision!==null&&operation.accepted_revision<=doc.revision&&operation.envelope.expression_ref===original.expression_ref&&operation.envelope.operation_ref===original.operation_ref&&operation.envelope.actor===original.actor&&operation.envelope.expected_revision===original.expected_revision&&operation.envelope.producer_ref===admission.producer_ref&&sameNative(operation.envelope.changes,edit?.changes),'Lifecycle abandonment requires the actual full original native S cancellation/withdrawal');
 const journal=doc.scenes.flatMap(scene=>scene.presentation?.scene?retention(scene.presentation.scene).operations:[]).filter(row=>row.envelope.operation_ref===intent.operation_ref);
 need(journal.length>0&&journal.every(row=>sameNative(row,operation)),'The actual post-Cancel Document differs from its full native cancellation journal');
 return clone(intent);
}
export function stageLifecycleCancelIntent(view:KernelConversion,original:NativeLifecycleIntent,originalPreparation:NativeLifecycleReply,actualOperation:unknown):NativeLifecycleCancelIntent {
 return validateStageLifecycleCancelIntent(view,original,originalPreparation,{operation:'lifecycle_cancel',expression_ref:original.expression_ref,expected_revision:view.document.revision,scene_ref:original.scene_ref,operation_ref:original.operation_ref,actor:original.actor,procedure_ref:original.procedure_ref,expected_procedure_revision:original.expected_procedure_revision},actualOperation);
}
/** SAME session consumed the fresh HostACK before this receiver runs. Source
 * abandonment is clock-free: its retained position is an original reference,
 * while the outer FIELD ACK remains current, separate native owner evidence. */
export function validateStageLifecycleCancelReply(view:KernelConversion,original:NativeLifecycleIntent,originalPreparation:NativeLifecycleReply,intent:NativeLifecycleCancelIntent,actualOperation:unknown,raw:unknown):StageLifecycleObservation {
 validateStageLifecycleCancelIntent(view,original,originalPreparation,intent,actualOperation);
 need(object(raw),'Native cancellation receiving is unknown; retain its original full intent and native S record');const reply=raw as unknown as NativeLifecycleReply;
 need(reply.schema==='oi.expression-procedural-lifecycle/v1'&&sameNative(reply.original_intent,intent)&&['material_abandoned','historical_retry','source_refused','revision_conflict','reconciliation_required'].includes(reply.state)&&reply.source_current===false&&typeof reply.replayed==='boolean','Native lifecycle cancellation differs from its full original intent or receiving standing');
 need(reply.document?.schema==='oi.expression/v1'&&reply.document.expression_ref===intent.expression_ref&&Number.isSafeInteger(reply.document.revision)&&reply.document.revision>=intent.expected_revision,'Cancellation omitted its actual current native Document');
 const current=kernelDocumentToJourney(reply.document,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});
 const observed:StageLifecycleObservation={original_intent:clone(original),native_reply:clone(reply),state:reply.state,standing:lifecycleStanding(reply.state),view:current};
 need(reply.preparation===null&&!reply.prepare_request,'Cancellation cannot manufacture a new Source admission or native S preparation');
 if(reply.state==='historical_retry'){need(reply.native_receipt===null&&object(reply.historical_native_receipt)&&reply.replayed===true,'Historical cancellation evidence is not a new native HostACK or release');return observed;}
 need(reply.replayed===false&&reply.historical_native_receipt===undefined,'Fresh cancellation cannot relabel an old native acknowledgement');
 if(reply.state!=='material_abandoned'){need(scalarText(reply.reason)&&(!reply.operation||reply.operation.status!=='applied'),'Cancellation refusal omitted its exact original receiving reason');return observed;}
 need(sameNative(reply.document,view.document)&&object(reply.native_receipt),'Source abandonment must preserve the actual post-Cancel Document and genuine current HostACK');
 const host=reply.native_receipt,field=host.field as Record<string,unknown>|undefined,source=host.procedural as Record<string,unknown>|undefined,life=source?.lifecycle as Record<string,unknown>|undefined,prior=originalPreparation.native_receipt?.procedural as Record<string,unknown>|undefined;
 need(host.schema==='ql.field-host-receipt/v1'&&host.status==='ok'&&host.available===true&&scalarText(host.instance_ref)&&u64(host.request_id)&&host.last_request_id===host.request_id&&field?.schema==='ql.continuous-field/v1'&&scalarText(field.subject_ref)&&scalarText(field.event_ref)&&u64(field.generation)&&u64(field.samples_elapsed)&&Array.isArray(field.audio)&&field.audio.length===0,'Cancellation omitted its actual canonical same-session native host acknowledgement');
 const retained=source?.retained_native_position as Record<string,unknown>|undefined;
 need(prior?.status==='prepared'&&sameNative(prior.prepared,originalPreparation.preparation!.prepared)&&sameNative(source?.original_preparation,originalPreparation.preparation!.prepared)&&sameNative(retained,prior.native_position)&&retained&&retained.instance_ref===host.instance_ref&&retained.subject_ref===field.subject_ref&&retained.event_ref===field.event_ref&&u64(retained.generation)&&u64(retained.samples_elapsed),'Cancellation differs from its retained full original Source preparation/position; no fresh timing is inferred');
 need(source?.schema==='ql.procedural-conduct-receipt/v1'&&source.status==='material_abandoned'&&source.procedure_ref===original.procedure_ref&&source.prepared===null&&life?.schema==='ql.procedural-lifecycle-receipt/v1'&&life.state==='material_abandoned'&&sameNative(life.action,original.action)&&life.operation_ref===intent.operation_ref&&life.actor_ref===intent.actor&&life.document_revision===intent.expected_revision&&scalarText(life.source_read_receipt_ref)&&life.consumer_release==='unconfirmed','Source has not confirmed exact lifecycle material abandonment; physical/audio release remains unconfirmed');
 const operation=validateOperation(source.native_cancelled_record);need(sameNative(operation,validateOperation(actualOperation)),'Source abandonment changed the full actual native S cancelled record');
 if(reply.operation)need(sameNative(reply.operation,operation),'Cancellation outer operation differs from the actual S cancelled journal');
 observed.operation=operation;return observed;
}

export interface StageLifecycleEditor {panel:HTMLElement;refresh():void;retainedIntent():NativeLifecycleIntent|null;submit(intent:NativeLifecycleIntent):Promise<StageLifecycleObservation>;dispose():void}
export function installStageLifecycleEditor(port:StageLifecyclePort,report:(message:string)=>void):StageLifecycleEditor {
 const panel=document.createElement('details');panel.open=true;panel.className='stage-lifecycle';panel.setAttribute('aria-label','Procedural material and Scene continuation');
 const summary=document.createElement('summary');summary.textContent='Procedural material and Scene continuation';
 const controls=document.createElement('div'),facts=document.createElement('div'),status=document.createElement('p');status.className='control-note';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const select=(title:string)=>{const field=document.createElement('select');field.setAttribute('aria-label',title);return field;};
 const scene=select('Native procedure Scene'),procedure=select('Native Procedure identity'),contribution=select('Native contribution identity'),from=select('Continuation source Scene'),to=select('Continuation destination Scene'),policy=select('Scene instance continuation policy');
 for(const [value,title]of [['continue','Continue'],['hold','Hold'],['checkpoint_release','Checkpoint and release']]){const option=document.createElement('option');option.value=value;option.textContent=title;policy.append(option);}const blank=document.createElement('option');blank.value='';blank.textContent='Choose an explicit policy';policy.prepend(blank);policy.value='';
 const actor=document.createElement('input');actor.setAttribute('aria-label','Lifecycle actor');actor.value='human:expressions-app';
 const label=(title:string,field:HTMLElement)=>{const node=document.createElement('label');node.className='control';const text=document.createElement('span');text.textContent=title;node.append(text,field);return node;};
 controls.append(label('Native Scene',scene),label('Procedure',procedure),label('Contribution',contribution),label('Source Scene',from),label('Destination Scene',to),label('Continuation policy',policy),label('Actor',actor));panel.append(summary,controls,facts,status);
 let disposed=false,busy=false,retained:NativeLifecycleIntent|null=null;
 const buttons=new Map<NativeLifecycleAction['kind'],HTMLButtonElement>();
 function say(message:string){status.textContent=message;report(message);}
 function update(field:HTMLSelectElement,rows:Array<[string,string]>,empty:string){const value=field.value,next=[['',empty] as [string,string],...rows];if(value&&!next.some(([id])=>id===value))next.push([value,'Original native target unavailable; intent retained']);if(field.options.length!==next.length||[...field.options].some((o,i)=>o.value!==next[i][0]||o.textContent!==next[i][1]))field.replaceChildren(...next.map(([id,title])=>{const option=document.createElement('option');option.value=id;option.textContent=title;return option;}));field.value=value;}
 function refresh(){if(disposed)return;const snapshot=port.snapshot();try{
  if(retained&&!busy){const observed=port.settled?.(clone(retained));if(observed&&['applied','material_abandoned'].includes(observed.state)&&sameNative(observed.original_intent,retained)&&snapshot&&sameNative(observed.view.document,snapshot.view.document)){say(observed.standing);retained=null;}}
  const choices=snapshot?stageLifecycleChoices(snapshot):[],selected=choices.find(row=>row.scene_ref===scene.value),defined=selected?.procedures.find(row=>row.procedure.procedure_ref===procedure.value);
  const scenes=choices.map(row=>[row.scene_ref,`${row.title} · ${row.scene_ref}`] as [string,string]);update(scene,scenes,'Choose actual Procedure Scene');update(from,scenes,'Choose actual source Scene');update(to,scenes,'Choose actual destination Scene');update(procedure,(selected?.procedures??[]).map(row=>[row.procedure.procedure_ref,`${row.procedure.procedure_ref} · saved revision ${row.procedure.revision}`]),'Choose saved Procedure');update(contribution,(defined?.contributions??[]).map(row=>[row.contribution_ref,`${row.output_slot} · saved ${row.status} · ${row.contribution_ref}`]),'Choose actual contribution');
  facts.replaceChildren();if(defined){const note=document.createElement('p');note.className='control-note';note.textContent=`Saved Procedure ${defined.procedure.state}; ${defined.scene_refs.length} native Scene occurrences; ${defined.contributions.length} retained contributions. Saved status does not establish a running instance.`;facts.append(note);}
  const reasons:string[]=[];for(const [action,button]of buttons){const cap=snapshot?validateStageLifecycleAvailability(port.capability(action,snapshot),snapshot,action):{state:'unavailable' as const,reason:'Open a native Expression before lifecycle inspection.'};button.disabled=busy||!!retained||cap.state!=='available';button.title=cap.state==='unavailable'?cap.reason:retained?'Inspect/retry the retained original operation before another intent.':'';if(cap.state==='unavailable')reasons.push(`${action.replaceAll('_',' ')}: ${cap.reason}`);}
  if(!busy&&!retained)status.textContent=reasons.join(' ')||'Native lifecycle owner is qualified at this current Document. Review exact stable targets before submitting.';
 }catch(error){for(const button of buttons.values())button.disabled=true;say(error instanceof Error?error.message:String(error));}}
 async function submit(intent:NativeLifecycleIntent){if(disposed||busy)throw Error('The lifecycle editor is already receiving or closed');const original=clone(intent);if(retained&&!sameNative(retained,original))throw Error('Another full original lifecycle intent remains retained');const snapshot=port.snapshot();if(!snapshot)throw Error('The native lifecycle Workspace is unavailable');validateStageLifecycleIntent(snapshot,original);const cap=validateStageLifecycleAvailability(port.capability(original.action.kind,snapshot),snapshot,original.action.kind);if(cap.state==='unavailable')throw Error(cap.reason);
  retained=original;busy=true;refresh();try{const result=await port.submit(clone(original));if(!sameNative(result.original_intent,original))throw Error('The native lifecycle reply changed the complete original intent');say(result.standing);if(['applied','material_abandoned'].includes(result.state))retained=null;return result;}finally{busy=false;refresh();}}
 function collect(kind:NativeLifecycleAction['kind']){const snapshot=port.snapshot();if(!snapshot)throw Error('Open the actual native Expression');let action:NativeLifecycleAction={kind:'retire'};if(kind==='contribution_detach')action={kind,contribution_ref:contribution.value};if(kind==='scene_policy'){if(!policy.value)throw Error('Choose the explicit Scene continuation policy');action={kind,from_scene_ref:from.value,to_scene_ref:to.value,policy:policy.value as 'continue'|'hold'|'checkpoint_release'};}return stageLifecycleIntent(snapshot,{scene_ref:scene.value,procedure_ref:procedure.value,actor:actor.value,operation_ref:`operation:stage-lifecycle-${crypto.randomUUID()}`,action});}
 for(const [kind,title]of [['retire','Retire procedure · preserve edited material'],['contribution_detach','Detach selected contribution'],['scene_policy','Set native Scene instance policy']] as const){const button=document.createElement('button');button.type='button';button.textContent=title;button.addEventListener('click',()=>{try{void submit(collect(kind)).catch(error=>say(error instanceof Error?error.message:String(error)));}catch(error){say(error instanceof Error?error.message:String(error));}});buttons.set(kind,button);controls.append(button);}
 const retry=document.createElement('button');retry.type='button';retry.textContent='Inspect/retry original native lifecycle operation';retry.addEventListener('click',()=>{if(busy||disposed)return;void (async()=>{if(!retained)throw Error('No original lifecycle intent is retained');busy=true;refresh();try{const result=await port.retry(clone(retained));if(!sameNative(result.original_intent,retained))throw Error('Native recovery returned another full original lifecycle intent');say(result.standing);}finally{busy=false;refresh();}})().catch(error=>say(error instanceof Error?error.message:String(error)));});controls.append(retry);
 for(const field of [scene,procedure,contribution,from,to,policy])field.addEventListener('change',refresh);refresh();
 return {panel,refresh,retainedIntent:()=>clone(retained),submit,dispose(){disposed=true;retained=null;}};
}
