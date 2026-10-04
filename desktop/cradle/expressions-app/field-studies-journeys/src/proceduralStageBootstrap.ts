import {emptyRetention,retention,type ProceduralRetention,type ManifestationBinding,type ProceduralScene} from './proceduralRetention';
/** Original Source authorship and receipt discrimination. The native Source
 * compiler owns graph/profile/currentness/timing interpretation. This module
 * supplies no Scene read, graph, held witness, sample clock or native grant. */
import {clone} from './model';
import {sameNative} from './proceduralProtocol';
import {studioBasis,type StudioBasis,type StudioSnapshot} from './proceduralStudio';
import {validateFullNativeSubject,type FullNativeSubject,type NativeSceneSource} from './proceduralStageSource';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge';

export const STAGE_PROFILE_AXES={
 participation:['dialogical','authorised-undertaking'],content:['CT0','CT1','CT2','CT3','CT4',"CT4b'",'CT5'],
 position:['4.0','4.1','4.2','4.3','4.4','4.5'],thread:['CFP0','CFP1','CFP2','CFP3','CFP4','CFP5'],
 sequence:['CS0','CS1','CS2','CS3','CS4','CS5'],direction:['forward','returning'],
} as const;
export interface StageCPrimeProfile {
 participation:typeof STAGE_PROFILE_AXES.participation[number];content:typeof STAGE_PROFILE_AXES.content[number];
 position:typeof STAGE_PROFILE_AXES.position[number];thread:typeof STAGE_PROFILE_AXES.thread[number];
 sequence:typeof STAGE_PROFILE_AXES.sequence[number];direction:typeof STAGE_PROFILE_AXES.direction[number];
}
export interface NativeStageCoordinate {position:number;face:string;}
export interface NativeStageMember {subject_ref:string;coordinate:NativeStageCoordinate;}
export interface NativeStageReturn {from_ref:string;anchor_ref:string;ground_ref:string;face:string;kind:string;}
export interface NativeStageRelation {row:NativeStageCoordinate;column:NativeStageCoordinate;relation_ref:string;evidence:string[];}
export interface NativeStageFrame {id:string;lens:string;basis:string;face:string;positions:string;}
export interface StagePlannedLeg {unit_ref:string;subject_ref:string;scope_ref:string;input_refs:string[];result_ref:string;after:string[];parent:string|null;}
export interface StageThreadPlan {legs:StagePlannedLeg[];aggregation_ref:string|null;continuation_ref:string|null;stop_condition_ref:string|null;}
/** Exact original SOURCE-BOOTSTRAP-7 authoring surface. Contributors are full
 * native read subjects; the principal remains the actual held native subject. */
export interface StageSourceAuthorship {
 actor_ref:string;standing_ref:string;principal_role:'being'|'thing';contributors:FullNativeSubject[];
 members:NativeStageMember[];source_returns:NativeStageReturn[];relations:NativeStageRelation[];
 category:string;ground_ref:string;ground_face:string;frame:NativeStageFrame;
 language:Record<string,unknown>|null;profile:StageCPrimeProfile;resolve_path:string;context_resolution:string;
 authority:string|null;thread_plan:StageThreadPlan;
}
export interface StageSourceBootstrapIntent {basis:StudioBasis;operation_ref:string;authorship:StageSourceAuthorship;}
export interface NativeStageBootstrapInput {
 schema:'oi.expression-procedural-source-bootstrap-intent/v1';scene_ref:string;operation_ref:string;authorship:StageSourceAuthorship;
}
export interface NativeStageBootstrapCommand {schema:'ql.procedural-conduct/v1';action:'source_bootstrap';input:NativeStageBootstrapInput;}
export interface NativeStageBootstrapSource extends Record<string,unknown> {
 schema:'ql.native-procedural-source-bootstrap/v1';native_owner:'ql-mef';expression_ref:string;scene_ref:string;document_revision:number;
 native_scene_source:NativeSceneSource;binding:Record<string,unknown>;native_field_receipt:Record<string,unknown>|null;native_position:Record<string,unknown>;native_timing_pulse?:Record<string,unknown>;
}
export interface StageSourceBootstrapReceipt {
 schema:'oi.expression-procedural-source-bootstrap/v1';original_intent:NativeStageBootstrapInput;
 source:NativeStageBootstrapSource;native_receipt:Record<string,unknown>|null;historical_native_receipt?:Record<string,unknown>;native_procedural_receipts?:unknown[];state?:'historical_retry';
 binding_adoption:{state:'adopted'|'unchanged';document_revision_before:number;document_revision_after:number;document_receipt:{state:'ready';document:KernelExpressionDocument;[key:string]:unknown}};
 source_current:boolean;replayed:boolean;qualification:'live_native_owner'|'historical_unqualified';
}
export interface StageSourceBootstrapRefusalObservation {
 schema:'oi.stage-source-bootstrap-refusal-observation/v1';original_intent:NativeStageBootstrapInput;
 native_reply:Record<string,unknown>;
 document_receipt:{state:'ready';document:KernelExpressionDocument;[key:string]:unknown};
}
export type StageSourceBootstrapOutcome=StageSourceBootstrapReceipt|StageSourceBootstrapRefusalObservation;
export interface PendingNativeSourceBootstrap {kind:'native-source-bootstrap';intent:StageSourceBootstrapIntent;request:NativeStageBootstrapCommand;observation?:StageSourceBootstrapRefusalObservation;}

export interface StageSourceBootstrapResult {receipt:StageSourceBootstrapReceipt;view:KernelConversion;}
function need(value:unknown,reason:string):asserts value {if(!value)throw Error(reason);}
const ref=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&new TextEncoder().encode(value).length<=16384&&!/\p{Cc}/u.test(value);
function exact(value:unknown,keys:string[],label:string):asserts value is Record<string,unknown>{need(!!value&&typeof value==='object'&&!Array.isArray(value),`${label} is unavailable`);need(Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)),`${label} contains missing or undeclared fields`);}
function nullable(value:unknown,label:string){need(value===null||ref(value),`${label} needs an explicit native ref or no ref`);}
function refs(value:unknown,limit:number,label:string):asserts value is string[]{need(Array.isArray(value)&&value.length<=limit&&value.every(ref),`${label} contains an unavailable or unbounded native ref`);}
function coordinate(value:unknown){exact(value,['position','face'],'Structural coordinate');need(Number.isInteger(value.position)&&Number(value.position)>=0&&Number(value.position)<=255&&ref(value.face),'Choose an explicit native structural coordinate/face');}
/** Structural wire admission only. Native semantics, Source membership and
 * profile/thread compatibility remain the one actual compiler's validation. */
export function validateStageSourceAuthorship(value:unknown):StageSourceAuthorship {
 exact(value,['actor_ref','standing_ref','principal_role','contributors','members','source_returns','relations','category','ground_ref','ground_face','frame','language','profile','resolve_path','context_resolution','authority','thread_plan'],'Source authorship');
 const a=value as unknown as StageSourceAuthorship;
 for(const key of ['actor_ref','standing_ref','category','ground_ref','ground_face','resolve_path','context_resolution'] as const)need(ref(a[key]),`Enter the original ${key.replaceAll('_',' ')}`);
 need(a.principal_role==='being'||a.principal_role==='thing','Choose the actual principal presentation role');
 need(Array.isArray(a.contributors)&&a.contributors.length<=64,'Source contributors exceed the native budget');a.contributors.forEach(subject=>{exact(subject,['subject_ref','native_owner','presentation_role','sources','readings','actions'],'Native contributor');validateFullNativeSubject(subject);});
 need(new Set(a.contributors.map(subject=>subject.subject_ref)).size===a.contributors.length,'A contributor subject was repeated');
 exact(a.frame,['id','lens','basis','face','positions'],'Source context frame');Object.values(a.frame).forEach(value=>need(ref(value),'Enter all original context frame axes'));
 exact(a.profile,Object.keys(STAGE_PROFILE_AXES),'C′ profile');for(const key of Object.keys(STAGE_PROFILE_AXES) as (keyof StageCPrimeProfile)[])need((STAGE_PROFILE_AXES[key] as readonly string[]).includes(a.profile[key]),`Choose the original native ${key}`);
 nullable(a.authority,'Authority');need(a.language===null||!!a.language&&typeof a.language==='object'&&!Array.isArray(a.language),'Retain an actual full language binding or explicit absence');
 need(Array.isArray(a.members)&&a.members.length<=12,'Structural members exceed the native budget');for(const row of a.members){exact(row,['subject_ref','coordinate'],'Source member');need(ref(row.subject_ref),'Enter the actual structural member subject');coordinate(row.coordinate);}
 need(Array.isArray(a.source_returns)&&a.source_returns.length<=64,'Source returns exceed the native budget');for(const row of a.source_returns){exact(row,['from_ref','anchor_ref','ground_ref','face','kind'],'Source return');Object.values(row).forEach(value=>need(ref(value),'Enter every original Source return ref/face/kind'));}
 need(Array.isArray(a.relations)&&a.relations.length<=144,'Source relations exceed the native budget');for(const row of a.relations){exact(row,['row','column','relation_ref','evidence'],'Source relation');coordinate(row.row);coordinate(row.column);need(ref(row.relation_ref),'Enter the original relation Source ref');refs(row.evidence,4096,'Relation evidence');}
 exact(a.thread_plan,['legs','aggregation_ref','continuation_ref','stop_condition_ref'],'Native thread plan');
 for(const key of ['aggregation_ref','continuation_ref','stop_condition_ref'] as const)nullable(a.thread_plan[key],key);
 need(Array.isArray(a.thread_plan.legs)&&a.thread_plan.legs.length>0&&a.thread_plan.legs.length<=4096,'Author a bounded nonempty original thread plan');
 for(const row of a.thread_plan.legs){exact(row,['unit_ref','subject_ref','scope_ref','input_refs','result_ref','after','parent'],'Native planned leg');for(const key of ['unit_ref','subject_ref','scope_ref','result_ref'] as const)need(ref(row[key]),'Enter every original native thread leg identity');refs(row.input_refs,4096,'Thread inputs');refs(row.after,4096,'Thread predecessors');nullable(row.parent,'Thread parent');}
 need(JSON.stringify(a).length<=8*1024*1024,'Original Source authorship exceeds the native intake budget');return clone(a);
}
export function stageBootstrapCommand(intent:StageSourceBootstrapIntent):NativeStageBootstrapCommand {
 exact(intent,['basis','operation_ref','authorship'],'Stage Source intent');exact(intent.basis,['expression_ref','document_revision','scene_ref'],'Original native Source basis');
 need(ref(intent.basis.expression_ref)&&ref(intent.basis.scene_ref)&&Number.isSafeInteger(intent.basis.document_revision)&&intent.basis.document_revision>=1&&ref(intent.operation_ref),'Source bootstrap requires its actual Expression/Scene/CAS and retained operation ID');
 return {schema:'ql.procedural-conduct/v1',action:'source_bootstrap',input:{schema:'oi.expression-procedural-source-bootstrap-intent/v1',scene_ref:intent.basis.scene_ref,operation_ref:intent.operation_ref,authorship:validateStageSourceAuthorship(intent.authorship)}};
}
export function pendingStageBootstrap(intent:StageSourceBootstrapIntent,view:KernelConversion):PendingNativeSourceBootstrap {
 const request=stageBootstrapCommand(intent);need(view.document.expression_ref===intent.basis.expression_ref&&view.document.revision===intent.basis.document_revision&&Object.values(view.bindings).some(binding=>binding.scene_ref===intent.basis.scene_ref),'The original Source Scene/Document changed; its intent remains retained');return {kind:'native-source-bootstrap',intent:clone(intent),request};
}
export function validatePendingStageBootstrap(pending:PendingNativeSourceBootstrap,view:KernelConversion){
 const expected=pendingStageBootstrap(pending.intent,view);
 if(pending.observation){const o=pending.observation;expected.observation=validateStageBootstrapRefusal(pending.intent,o.native_reply,view,o.document_receipt);}
 need(pending.kind==='native-source-bootstrap'&&sameNative(pending,expected),'The retained Source bootstrap differs from its full original input');
}
export function isStageBootstrapRefusal(value:unknown):boolean{return !!value&&typeof value==='object'&&['source_refused','source_attribution_refused','reconciliation_required'].includes(String((value as {state?:unknown}).state));}
export function isStageBootstrapRefusalObservation(value:StageSourceBootstrapOutcome):value is StageSourceBootstrapRefusalObservation{return value.schema==='oi.stage-source-bootstrap-refusal-observation/v1';}
/** Called AFTER the SAME InstrumentSession accounted the real original ACK.
 * The inspected Document is an observation; retained/cold JSON grants no
 * Source, edit, fresh request or new lease. Original intent stays pending. */
export function validateStageBootstrapRefusal(intent:StageSourceBootstrapIntent,raw:unknown,original:KernelConversion,inspected:unknown):StageSourceBootstrapRefusalObservation {
 const reply=raw as Record<string,unknown>,documentReceipt=inspected as StageSourceBootstrapRefusalObservation['document_receipt'],host=reply?.native_receipt as Record<string,unknown>|undefined,field=host?.field as Record<string,unknown>|undefined,ownerDocument=reply?.document_receipt as {state?:unknown;document?:unknown}|undefined;
 need(reply?.schema==='oi.expression-procedural-source-bootstrap/v1'&&sameNative(reply.original_intent,stageBootstrapCommand(intent).input)&&isStageBootstrapRefusal(reply)&&reply.source_current===false&&reply.replayed===false,'Source refusal differs from its complete original intent or invents current qualification');
 need(reply.state==='source_refused'?reply.qualification==='source_refused'&&host?.status==='refused':reply.qualification==='unqualified'&&host?.status==='ok'&&reply.source===null&&ref(reply.reason),'The Source refusal has another native host/attribution standing');
 need(host?.schema==='ql.field-host-receipt/v1'&&host.available===true&&ref(host.instance_ref)&&u64(host.request_id)&&host.last_request_id===host.request_id&&field?.schema==='ql.continuous-field/v1'&&ref(field.event_ref)&&ref(field.subject_ref)&&u64(field.generation)&&u64(field.samples_elapsed)&&Array.isArray(field.audio)&&field.audio.length===0,'Source refusal lacks its complete actual nonadvancing native acknowledgement');
 need(documentReceipt?.state==='ready'&&documentReceipt.document?.expression_ref===intent.basis.expression_ref&&documentReceipt.document.revision>=intent.basis.document_revision,'Source refusal lacks the actual current inspected native Document');
 if(ownerDocument?.state==='ready')need(sameNative(ownerDocument.document,documentReceipt.document),'Native Document changed after its Source refusal; the original intent remains uncertain');
 if(reply.state==='source_attribution_refused')need(sameNative(original.document,documentReceipt.document),'A claimed unchanged Source refusal changed the actual Document');
 kernelDocumentToJourney(documentReceipt.document); // genuine model/converter validation, no Source grant
 return {schema:'oi.stage-source-bootstrap-refusal-observation/v1',original_intent:clone(reply.original_intent as NativeStageBootstrapInput),native_reply:clone(reply),document_receipt:clone(documentReceipt)};
}


interface NativeBootstrapPerformancePulse {
 schema?:unknown;accepted?:unknown;
 payload?:{timing_fact?:{
  schema?:unknown;moment?:unknown;native_position?:unknown;
  binding?:{owner_ref?:unknown;domain?:unknown;epoch_ref?:unknown;requested_cursor?:unknown;time_mapping_ref?:unknown};
  admission_horizon?:unknown;requested_cursor?:unknown;admitted_cursor?:unknown;applied_cursor?:unknown;
  committed_cursor?:unknown;transport_epoch?:unknown;queued?:unknown;device_callbacks_running?:unknown;source?:unknown;
 }};
 reading?:{session_ref?:unknown;samples_elapsed?:unknown;transport_epoch?:unknown;
  scope?:{instance_ref?:unknown;event_ref?:unknown;subject_ref?:unknown};
  physical?:{source_generation?:unknown;samples_elapsed?:unknown};
 };
}
const u64=(value:unknown):value is string=>typeof value==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(value)&&BigInt(value)<(1n<<64n);
/** Observe the exact producer boundary. Performance committed P cursor and
 * queue admission horizon remain different owner facts. This JSON receiver
 * creates no lease, timing witness, body application or audio acknowledgement. */
export function validateStageBootstrapBoundary(s:NativeStageBootstrapSource,hostReceipt:Record<string,unknown>):void {
 const position=s.native_position,timing=s.timing as Record<string,unknown>,fieldSource=s.native_field_source as {schema?:string;instance_ref?:string;current_basis?:{input?:{m3?:{subject_ref?:string};m1?:{event_ref?:string}}}};
 need(ref(hostReceipt.instance_ref)&&ref(position?.instance_ref)&&ref(position.event_ref)&&ref(position.subject_ref)&&position.instance_ref===hostReceipt.instance_ref&&u64(position.generation)&&u64(position.samples_elapsed),'Native Source omitted its exact actual instance/subject/event/generation/sample boundary');
 need(hostReceipt.schema==='ql.field-host-receipt/v1'&&hostReceipt.status==='ok'&&hostReceipt.available===true&&u64(hostReceipt.request_id),'The actual Source host receipt is not an accepted canonical owner request');
 const field=hostReceipt.field as Record<string,unknown>|undefined;
 need(field&&field.schema==='ql.continuous-field/v1'&&ref(field.subject_ref)&&ref(field.event_ref)&&u64(field.generation)&&u64(field.samples_elapsed)&&position.subject_ref===field.subject_ref&&position.event_ref===field.event_ref,'Source and its actual host field identity disagree');
 need(timing&&ref(timing.owner_ref)&&ref(timing.epoch_ref)&&Number.isSafeInteger(timing.requested_cursor)&&Number(timing.requested_cursor)>=0&&Object.hasOwn(timing,'time_mapping_ref')&&(timing.time_mapping_ref===null||ref(timing.time_mapping_ref)),'Native Source lacks its complete exact registered timing binding; unsafe dates cannot be rounded');
 if(timing.domain==='native_field_samples'){
  need(!Object.hasOwn(s,'native_timing_pulse')&&s.native_field_receipt&&sameNative(field,s.native_field_receipt.field??s.native_field_receipt)&&position.generation===field.generation&&position.samples_elapsed===field.samples_elapsed,'Source and its actual FIELD position/receipt disagree');
  need(BigInt(timing.requested_cursor as number)===BigInt(position.samples_elapsed as string),'Native Source lacks its genuine exact registered field timing boundary; no instance/epoch/cursor alias is accepted');
 }else if(timing.domain==='native_samples'){
  need(s.native_field_receipt===null,'A performance Source cannot reuse a stale FIELD receipt');
  const pulse=s.native_timing_pulse as NativeBootstrapPerformancePulse|undefined;
  need(pulse?.schema==='ql.performance-worker-reply/v1'&&pulse.accepted===true&&sameNative(hostReceipt.native_timing_pulse,pulse),'The complete actual performance timing pulse is absent or detached from the same host evidence');
  const fact=pulse.payload?.timing_fact,binding=fact?.binding,reading=pulse.reading,physical=reading?.physical,scope=reading?.scope;
  need(fact?.schema==='ql.native-performance-timing-fact/v1'&&fact.moment==='boundary'&&sameNative(fact.native_position,position),'Native Source has another performance Boundary position');
  need(binding&&Object.keys(binding).length===5&&['owner_ref','domain','epoch_ref','requested_cursor','time_mapping_ref'].every(key=>Object.hasOwn(binding,key))&&u64(binding.requested_cursor)&&u64(fact.admission_horizon)&&u64(fact.requested_cursor)&&u64(fact.admitted_cursor)&&(fact.applied_cursor===null||u64(fact.applied_cursor))&&u64(fact.committed_cursor)&&u64(fact.transport_epoch)&&Object.hasOwn(fact,'queued')&&typeof fact.device_callbacks_running==='boolean'&&fact.source&&typeof fact.source==='object'&&!Array.isArray(fact.source),'Native performance timing fact lacks its complete exact original source/dates/queue standing');
  need(ref(reading?.session_ref)&&binding.owner_ref===reading.session_ref&&binding.domain==='native_samples'&&binding.epoch_ref===`ql:performance/transport-epoch/${fact.transport_epoch}`&&binding.time_mapping_ref===null&&binding.owner_ref===timing.owner_ref&&binding.domain===timing.domain&&binding.epoch_ref===timing.epoch_ref&&sameNative(binding.time_mapping_ref,timing.time_mapping_ref)&&BigInt(binding.requested_cursor)===BigInt(timing.requested_cursor as number)&&binding.requested_cursor===fact.admission_horizon&&BigInt(fact.admission_horizon)>=BigInt(position.samples_elapsed as string),'Native Source differs from its original performance owner/domain/epoch/mapping/admission horizon');
  need(scope?.instance_ref===position.instance_ref&&scope.event_ref===position.event_ref&&scope.subject_ref===position.subject_ref&&physical?.source_generation===position.generation&&fact.committed_cursor===reading.samples_elapsed&&fact.committed_cursor===physical.samples_elapsed&&fact.committed_cursor===position.samples_elapsed&&fact.transport_epoch===reading.transport_epoch,'Native Source is detached from the copied performance committed body cursor/source generation');
 }else throw Error('Native Source timing domain has no paired actual owner');
 need(position.subject_ref===s.native_scene_source?.principal?.subject_ref&&fieldSource?.schema==='ql.native-held-field-source/v1'&&fieldSource.instance_ref===position.instance_ref&&fieldSource.current_basis?.input?.m3?.subject_ref===position.subject_ref&&fieldSource.current_basis?.input?.m1?.event_ref===position.event_ref,'Native Source lacks its same actual held principal/event/source instance');
}

/** The real session already accounts native_receipt before this document
 * admission. Historical replies may describe the original edit; they never
 * qualify a new current Source or become a new native lease. */
export function validateStageBootstrapReceipt(intent:StageSourceBootstrapIntent,raw:unknown,original:KernelConversion):StageSourceBootstrapResult {
 const command=stageBootstrapCommand(intent),reply=raw as StageSourceBootstrapReceipt;
 need(reply?.schema==='oi.expression-procedural-source-bootstrap/v1'&&sameNative(reply.original_intent,command.input),'Native Source returned another original intent');
 const s=reply.source,adoption=reply.binding_adoption,doc=adoption?.document_receipt?.document;
 need(s?.schema==='ql.native-procedural-source-bootstrap/v1'&&s.native_owner==='ql-mef'&&s.expression_ref===intent.basis.expression_ref&&s.scene_ref===intent.basis.scene_ref&&s.document_revision===intent.basis.document_revision,'The native Source result belongs to another original Scene/CAS');
 const hostReceipt=reply.qualification==='historical_unqualified'?reply.historical_native_receipt:reply.native_receipt;
 if(reply.qualification==='historical_unqualified')need(reply.state==='historical_retry'&&reply.native_receipt===null&&Array.isArray(reply.native_procedural_receipts)&&reply.native_procedural_receipts.length===0&&reply.replayed===true,'Historical Source must be an actual known-unexchanged owner lookup, never a current host ACK');
 need(hostReceipt?.schema==='ql.field-host-receipt/v1'&&sameNative(hostReceipt.procedural,s),'The full Source result is detached from its actual native host evidence');
 validateStageBootstrapBoundary(s,hostReceipt);
 for(const key of ['registry_revision','source_read_receipt_ref','source_material_fingerprint','source_composition','authored_cprime','currentness','currentness_observation','thread_plan','source_basis','timing','native_field_source','native_act_source','standing'])need(Object.hasOwn(s,key)&&s[key]!==null&&s[key]!==undefined,`Actual native Source omitted ${key}`);
 need(sameNative(s.thread_plan,intent.authorship.thread_plan)&&(s.authored_cprime as Record<string,unknown>)?.actor===intent.authorship.actor_ref&&sameNative(s.native_scene_source?.contributors,intent.authorship.contributors),'Actual Source replaced original actor, contributors or native thread plan');
 const originalScene=original.document.scenes.find(scene=>scene.scene_ref===intent.basis.scene_ref);need(originalScene?.presentation,'The actual original Scene material is unavailable');
 const projected=clone(originalScene.presentation);delete (projected.scene as {procedural?:unknown}).procedural;
 need(sameNative(s.native_scene_source.presentation,projected),'Actual Source was issued for another native Scene material');
 const expectedBinding={address:{expression_ref:intent.basis.expression_ref,scene_ref:intent.basis.scene_ref,entity_ref:null,component:'scene',constituent_ref:null,property:null},principal:s.native_scene_source.principal,contributors:s.native_scene_source.contributors,locus:{ref:s.native_scene_source.locus_ref,revision:s.native_scene_source.locus_revision,availability:'available'},tags:[]};
 need(sameNative(s.binding,expectedBinding),'Native binding widened its actual Scene/principal/contributor/locus coordinates');
 validateFullNativeSubject(s.native_scene_source.principal);s.native_scene_source.contributors.forEach(validateFullNativeSubject);
 need(s.native_scene_source?.document_revision===s.document_revision&&s.native_scene_source.expression_ref===s.expression_ref&&s.native_scene_source.scene_ref===s.scene_ref,'Native Scene Source was relabelled after binding adoption');
 need(adoption?.document_revision_before===intent.basis.document_revision&&(adoption.state==='adopted'?adoption.document_revision_after===intent.basis.document_revision+1:adoption.state==='unchanged'&&adoption.document_revision_after===intent.basis.document_revision),'Native Source binding adoption returned another Document transition');
 need(adoption.document_receipt.state==='ready'&&doc?.expression_ref===intent.basis.expression_ref&&doc.revision===adoption.document_revision_after,'Native Source has no exact actual Application document receipt');
 need(typeof reply.source_current==='boolean'&&typeof reply.replayed==='boolean'&&['live_native_owner','historical_unqualified'].includes(reply.qualification),'Native Source qualification is unavailable');
 need(reply.source_current===(adoption.state==='unchanged'&&!reply.replayed&&reply.qualification==='live_native_owner'&&s.document_revision===doc.revision),'Native Source currentness was inferred from a historical or pre-adoption revision');
 // Discriminate the actual narrow native binding Edit. No material, Entity,
 // sibling Scene, operation journal, checkpoint or existing Source row may be
 // replaced under a Source adoption receipt.
 if(original.document.revision===intent.basis.document_revision){
  const expected=clone(original.document),scene=expected.scenes.find(row=>row.scene_ref===intent.basis.scene_ref);need(scene?.presentation,'The original native Scene material is absent');
  const retained=retention(scene.presentation.scene),rows=retained.bindings.filter(row=>sameNative(row.address,s.binding.address));
  need(rows.length<=1&&rows.every(row=>sameNative(row,s.binding)),'Native bootstrap replaced an existing authored Scene binding');
  if(!rows.length)retained.bindings.push(clone(s.binding) as unknown as ManifestationBinding);
  need(Array.isArray(s.source_basis)&&s.source_basis.length>0,'Actual native Source basis rows are unavailable');
  for(const raw of s.source_basis){const source=raw as {source_ref?:unknown;revision?:unknown};need(ref(source.source_ref)&&ref(source.revision),'Native Source basis lacks its original ref/revision');const row={ref:source.source_ref,revision:source.revision,availability:'available' as const};if(!retained.source_basis.some(prior=>sameNative(prior,row)))retained.source_basis.push(row);}
  if(adoption.state==='adopted'){scene.presentation.scene={...scene.presentation.scene,procedural:retained} as ProceduralScene;expected.revision=adoption.document_revision_after;scene.revision=expected.revision;}
  else need(sameNative(retained,retention(scene.presentation.scene)),'Unchanged Source binding receipt omitted required native basis rows');
  need(sameNative(expected,doc),'Native Source adoption changed material, sibling state or an existing retained intervention');
 }else need(reply.qualification==='historical_unqualified'&&sameNative(original.document,doc),'A historical Source retry lacks the exact current native Document receipt');
 // This exact converter preserves existing native/view identities and paging;
 // it does not manufacture a new Expression or substitute a sampled field.
 const view=kernelDocumentToJourney(doc,{identity:{expression:original.journey.id,scenes:Object.fromEntries(Object.entries(original.bindings).map(([id,b])=>[b.scene_ref,id])),entities:original.entity_ids},pages:Object.fromEntries(Object.values(original.bindings).map(b=>[b.scene_ref,b.page]))});
 need(Object.values(view.bindings).some(binding=>binding.scene_ref===intent.basis.scene_ref),'The actual adopted Source Scene no longer exists');
 return {receipt:clone(reply),view};
}
export function requireCurrentStageBootstrap(intent:StageSourceBootstrapIntent,snapshot:StudioSnapshot){need(sameNative(studioBasis(snapshot),intent.basis),'The original Source basis changed. Retain the complete input and explicitly requalify its current Scene.');}

/** A miss is a genuine SAME owner lookup at the unchanged original Document;
 * it cannot clear unknown field standing or authorize an automatic fresh run. */
export function validateStageBootstrapCacheMiss(intent:StageSourceBootstrapIntent,raw:unknown,view:KernelConversion):void {
 const reply=raw as Record<string,unknown>,request=stageBootstrapCommand(intent);
 need(reply?.schema==='oi.expression-procedural-source-bootstrap/v1'&&reply.state==='cache_miss'&&sameNative(reply.original_intent,request.input)&&reply.expression_ref===intent.basis.expression_ref&&reply.document_revision===intent.basis.document_revision&&view.document.expression_ref===intent.basis.expression_ref&&view.document.revision===intent.basis.document_revision&&reply.native_receipt===null&&reply.historical_native_receipt===null&&Array.isArray(reply.native_procedural_receipts)&&reply.native_procedural_receipts.length===0&&reply.source_current===false&&reply.replayed===false&&reply.qualification==='unqualified','The original Source cache has unknown/conflicting standing; retain its full intent and original CAS');
}
