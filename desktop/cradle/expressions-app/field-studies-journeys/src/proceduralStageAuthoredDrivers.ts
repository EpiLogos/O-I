/** Normal Stage authoring over the actual Source-owned driver catalogue.
 * The host uses SAME retained Workspace writer; this panel owns no document,
 * modulation evaluator, clock, source graph or receiving authority. */
import {clone,type Scene} from './model';
import {NATIVE_BINDINGS,automationTarget,entityTargets} from './nativeParameters';
import {nativeControlTarget} from './proceduralNativeControls';
import {controlCapabilities,type PropertyCapability} from './proceduralControls';
import {retention,addressKey,type StageAddress,type ControlRetention,type ProceduralScene} from './proceduralRetention';
import {sameNative,type Scope} from './proceduralProtocol';
import {studioBasis,scopeContains,studioControlContext,propertyReadings,type StudioSnapshot} from './proceduralStudio';
import {validateNativeSceneSource,resolvedSourceReadAddresses,type NativeSceneSource} from './proceduralStageSource';
import {stageLifecycleChoices} from './proceduralStageLifecycle';

import {proceduralChanges} from './proceduralProtocol';
import {entityParamDefs} from '../../src/engine/paramRegistry';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge';

export interface AuthoredDriverDescriptor {
 kind:'scene'|'entity';key:string;bind:string;path:string;type:'scalar';units:string;
 minimum:number;maximum:number;default_value?:number;native_factor:number;
 rate_class:'frame'|'prepare_reset';native_parameter_factory?:boolean;shared_bucket?:'values'|'pointer';
}

export interface AuthoredDriverCatalog {schema:'ql.authored-driver-catalog/v1';native_owner:'expressions';field:AuthoredDriverDescriptor[];entity:AuthoredDriverDescriptor[];}
export interface AuthoredDriverTarget {kind:'scene'|'entity';key:string;entity_ref:string|null;}
export interface AuthoredDriverGroupMember {lane_ref:string;target:AuthoredDriverTarget;minimum:number;maximum:number;blend:'replace'|'add'|'multiply';enabled:boolean;}
export interface AuthoredDriverGroup {
 group_ref:string;clock_ref:string;mixing_operator:'expressions.original_base_declaration_order/v1';
 driver_type:'lfo'|'ramp';wave:'sine'|'triangle'|'square'|'saw'|'steps'|'smooth'|'morph';
 rate:number;phase:number;duration:number;delay:number;loop_mode:'once'|'loop'|'pingpong';
 easing:'linear'|'smooth'|'easeIn'|'easeOut'|'elastic'|'bounce';members:AuthoredDriverGroupMember[];
}
export interface AuthoredDriverGroupRetention {schema:'ql.authored-driver-group/v1';group_ref:string;clock_ref:string;mixing_operator:AuthoredDriverGroup['mixing_operator'];configuration:AuthoredDriverGroup;definition:Record<string,unknown>;catalog_revision:string;lane_refs:string[];target_addresses:StageAddress[];domain_policy:'expressions.native_registry_domain/v1';state:'active'|'retired';actor:string;operation_ref:string;revision:number;}
export type AuthoredDriverAction =
 |{kind:'set_base';value:number}|{kind:'takeover';value:number;lifetime:'gesture'|'persistent'}
 |{kind:'release'}|{kind:'release_gesture';takeover_operation_ref:string}
 |{kind:'record';value:number;track_ref:string}|{kind:'group';definition:AuthoredDriverGroup}
 |{kind:'group_remove';group_ref:string};
export interface NativeAuthoredDriverIntent {
 operation:'authored_driver';expression_ref:string;expected_revision:number;scene_ref:string;
 procedure_ref:string;expected_procedure_revision:string;actor:string;operation_ref:string;
 scope:Scope;catalog_revision:string;target:AuthoredDriverTarget;action:AuthoredDriverAction;
}
export interface NativeAuthoredDriverReadRequest {operation:'read_authored_drivers';expression_ref:string;expected_revision:number;scene_ref:string;scope:Scope;}
export interface NativeAuthoredDriverReading {
 schema:'ql.authored-driver-reading/v1';source:NativeSceneSource;catalog_revision:string;
 entity_refs:Record<string,string>;current_presentation:unknown;scope:StageAddress[];
 recording_position?:{schema:string;original_timing:unknown;time_mapping_ref:string;local_seconds:number;owner_position_ref:string}|null;
}
/** Exact public read projection is paired to Root's protected current reader.
 * No caller can provide the Source/position or this native response. */
export interface NativeAuthoredSourceStamp {schema:'oi.native-expression-composed-source/v1';ql_executable:string;ql_selection:string;ql_revision:string|null;request_sha256:string;result_sha256:string;original_request:unknown;compiled_at_unix_ms:number}
export interface NativeAuthoredHeldSourceStamp {schema:'oi.native-expression-composed-source/v1';ql_executable:string;native_binding:Record<string,unknown>;native_request_id:string;original_host_envelope:Record<string,unknown>;original_request:unknown;request_sha256:string;result_sha256:string}
export interface NativeAuthoredSourceResponse {schema:'oi.expression-procedure-source-response/v1';source:NativeAuthoredSourceStamp;native_result:{schema:'ql.scene-procedural-response/v1';operation:string;registry_revision?:string;source_revision?:string;result:Record<string,unknown>}}
export interface NativeAuthoredDriverReadReply {
 schema:'oi.expression-procedural/v1';operation:'read_authored_drivers';expression_ref:string;
 document_revision:number;scene_ref:string;catalog_revision:string;catalog:AuthoredDriverCatalog;
 original_intent:NativeAuthoredDriverReadRequest;original_scope:Scope;reading:NativeAuthoredDriverReading;controls:ControlRetention[];source:NativeAuthoredSourceStamp;catalogue_response:NativeAuthoredSourceResponse;native_scene_read:Record<string,unknown>;source_current:boolean;reason:string|null;effective_state:'native_consumers_not_yet_observed';
}
export interface StageAuthoredDriverTarget {
 target:AuthoredDriverTarget;address:StageAddress;label:string;descriptor:AuthoredDriverDescriptor;
 base:number;local_target:string;native_parameter:boolean;
}
export interface AuthoredDriverDisclosure {address:StageAddress;target:AuthoredDriverTarget;units:string;authored_base:number;active:string[];takeover:boolean;shared:boolean;effective:null;}
/** Existing native converter/Studio driver inspection, over accepted material.
 * The normal Stage already owns qualified effective observations. This editor
 * does not infer reception from driver configuration or a Source read. */
export function authoredDriverDisclosure(snapshot:StudioSnapshot,scope:Scope,catalog:AuthoredDriverCatalog,target:AuthoredDriverTarget):AuthoredDriverDisclosure {
 const selected=selectedTarget(snapshot,scope,catalog,target),accepted={...snapshot,journey:snapshot.view.journey};
 const property=propertyReadings(accepted,scope,null).find(p=>addressKey(p.capability.address)===addressKey(selected.address));need(property,'The exact accepted driver inspection target disappeared');need(typeof property.base==='number'&&Number.isFinite(property.base),'The retained scalar authored basis is unavailable');
 return {address:clone(selected.address),target:clone(selected.target),units:selected.descriptor.units,authored_base:property.base,active:clone(property.active),takeover:property.takeover,shared:property.shared,effective:null};
}
export type StageAuthoredDriverAvailability =
 |{state:'available';expression_ref:string;document_revision:number;catalog_revision:string;owner:string}
 |{state:'unavailable';reason:string};
export interface StageAuthoredDriverObservation {
 original_intent:NativeAuthoredDriverIntent;native_reply:unknown;
 state:'document_applied'|'source_refused'|'revision_conflict'|'reconciliation_required'|'historical_retry';
 standing:string;view?:KernelConversion;
}
export interface PendingNativeAuthoredDriver {kind:'native-authored-driver';intent:NativeAuthoredDriverIntent;reading:NativeAuthoredDriverReadReply;raw_reply?:unknown}
export interface NativeAuthoredDriverReply {
 schema:'oi.expression-procedural/v1';operation:'authored_driver';original_intent:NativeAuthoredDriverIntent;
 state:'document_applied'|'source_refused'|'revision_conflict'|'reconciliation_required';
 driver_preparation:Record<string,unknown>|null;native_result:Record<string,unknown>|null;native_edit_receipt:unknown;source:NativeAuthoredHeldSourceStamp|null;
 native_receipt:Record<string,unknown>|null;native_source_channel:unknown;document:KernelExpressionDocument;
 cache:{provenance:'live_native_owner'|'unqualified';restored:boolean;replayed:boolean;document_sha256?:string};
 effective_state:'native_consumers_not_yet_observed';source_current?:boolean;reason?:string;
}
export interface StageAuthoredDriverHost {
 snapshot():StudioSnapshot|null;scope():Scope;actor:string;
 /** Same Workspace flush/read barrier; a changed original basis refuses. */
 read?(request:NativeAuthoredDriverReadRequest):Promise<NativeAuthoredDriverReadReply>;
 capability?(kind:AuthoredDriverAction['kind'],request:NativeAuthoredDriverReadRequest,reading:NativeAuthoredDriverReadReply):StageAuthoredDriverAvailability;
 /** Full original intent/checkpoint/actual ACK accounting/adoption belong to
  * NativeWorking. A callback may not be an ordinary metadata Edit. */
 submit?(intent:NativeAuthoredDriverIntent,reading:NativeAuthoredDriverReadReply):Promise<StageAuthoredDriverObservation>;
 retry?(intent:NativeAuthoredDriverIntent):Promise<StageAuthoredDriverObservation>;
 settled?(intent:NativeAuthoredDriverIntent):StageAuthoredDriverObservation|null;
 retained?():{intent:NativeAuthoredDriverIntent;reading:NativeAuthoredDriverReadReply}|null;
 report(message:string):void;
}
const text=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=4096&&!/[\u0000-\u001f\u007f]/.test(value);
function need(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,allowed:string[],required=allowed){need(required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>allowed.includes(k)),'The full original authored driver intent has missing or unknown fields');}
export function authoredDriverReadRequest(snapshot:StudioSnapshot,scope:Scope):NativeAuthoredDriverReadRequest {
 const basis=studioBasis(snapshot);return {operation:'read_authored_drivers',expression_ref:basis.expression_ref,expected_revision:basis.document_revision,scene_ref:basis.scene_ref,scope:clone(scope)};
}
/** Compare native source descriptors with the existing actual Registry. This
 * is a discrimination check, not a second converter or catalogue issuer. */
export function validateAuthoredDriverCatalog(raw:unknown,scene:Scene):AuthoredDriverCatalog {
 const c=raw as AuthoredDriverCatalog;need(c?.schema==='ql.authored-driver-catalog/v1'&&c.native_owner==='expressions'&&Array.isArray(c.field)&&Array.isArray(c.entity)&&c.field.length<=2048&&c.entity.length<=2048,'The native authored driver catalogue is unavailable');
 need(c.field.every(d=>d.kind==='scene')&&c.entity.every(d=>d.kind==='entity'),'The native catalogue changed descriptor owner/kind');
 const entityKeys=entityParamDefs(0,{}).map(d=>d.path.replace(/^entities\.0\./,''));need(c.entity.length===entityKeys.length&&entityKeys.every(key=>c.entity.some(d=>d.key===key)),'The native Source catalogue omits or substitutes Entity descriptors');
 const identities=new Set<string>();
 for(const d of [...c.field,...c.entity]){
  need(object(d)&&['scene','entity'].includes(d.kind)&&d.type==='scalar'&&d.rate_class===(d.path==='particleCount'?'prepare_reset':'frame')&&[d.key,d.bind,d.path,d.units].every(text)&&Number.isFinite(d.minimum)&&Number.isFinite(d.maximum)&&d.minimum<=d.maximum&&Number.isFinite(d.native_factor)&&d.native_factor>0,'The native driver descriptor has no typed units/domain');
  need(!identities.has(d.kind+':'+d.key),'Duplicate native driver descriptor');identities.add(d.kind+':'+d.key);
  keys(d,['kind','key','bind','path','type','units','minimum','maximum','default_value','native_factor','rate_class','native_parameter_factory','shared_bucket'],['kind','key','bind','path','type','units','minimum','maximum','native_factor','rate_class']);
  const b=d.kind==='scene'?NATIVE_BINDINGS.find(row=>row.key===d.key):entityTargets(scene).find(row=>row.key===d.key);
  // A genuine Scene may contain no eligible Entity; its Entity catalogue is
  // still visible but cannot create a target or an Entity manifestation.
  if(!b&&d.kind==='entity')continue;
  need(b&&b.bind===d.bind&&(d.kind==='scene'?b.path:b.path.replace(/^entities\.\d+\./,''))===d.path&&b.factor===d.native_factor&&b.hardMin===d.minimum&&b.hardMax===d.maximum&&(b.unit??'dimensionless')===d.units,'Source driver catalogue differs from the actual Registry projection');
 }
 need(c.field.length===NATIVE_BINDINGS.length&&NATIVE_BINDINGS.every(b=>c.field.some(d=>d.key===b.key)),'The native Source catalogue omits or substitutes Field descriptors');return clone(c);
}
export function authoredDriverTargets(snapshot:StudioSnapshot,scope:Scope,catalog:AuthoredDriverCatalog):StageAuthoredDriverTarget[] {
 const basis=studioBasis(snapshot),scene=snapshot.view.journey.scenes.find(s=>s.id===snapshot.sceneId);need(scene,'The accepted native Scene view is unavailable');
 validateAuthoredDriverCatalog(catalog,scene);
 return controlCapabilities(scene,studioControlContext(snapshot)).flatMap((capability:PropertyCapability)=>{
  if(!scopeContains(scope,capability.address,snapshot))return [];
  const b=automationTarget(scene,capability.target);need(b,'The actual native Registry target disappeared');
  const d=(b.entityId?catalog.entity:catalog.field).find(row=>row.key===b.key);if(!d)return [];
  const scalarOwner=nativeControlTarget({...snapshot,journey:snapshot.view.journey},capability);need(scalarOwner.state!=='available'||d.native_parameter_factory===true,'The Source catalogue silently bypassed the actual native scalar Parameter owner');
  const nativeEntity=b.entityId?snapshot.view.bindings[snapshot.sceneId].occurrences.find(row=>row.view_entity_id===b.entityId):null;
  need(!b.entityId||nativeEntity,'The native driver Entity occurrence is disconnected');
  return [{target:{kind:b.entityId?'entity' as const:'scene' as const,key:d.key,entity_ref:nativeEntity?.entity_ref??null},address:clone(capability.address),label:b.label,descriptor:clone(d),base:capability.base,local_target:b.target,native_parameter:d.native_parameter_factory===true}];
 });
}
const sha256=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const u64=(value:unknown):value is string=>typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)&&BigInt(value)<=18446744073709551615n;
/** The native receiver owns private channel/currentness authority. This parser
 * binds its complete Source stamp/intake; a saved stamp or digest grants none. */
export function validateAuthoredSourceStamp(raw:unknown,request:unknown):NativeAuthoredSourceStamp {
 const s=raw as NativeAuthoredSourceStamp;need(s?.schema==='oi.native-expression-composed-source/v1'&&text(s.ql_executable)&&text(s.ql_selection)&&text(s.ql_revision)&&sha256(s.request_sha256)&&sha256(s.result_sha256)&&Number.isSafeInteger(s.compiled_at_unix_ms)&&s.compiled_at_unix_ms>0&&sameNative(s.original_request,request),'The actual Source stamp lost its selected revision/full original intake');return clone(s);
}
/** Private held Source differs from the read-only CLI catalogue stamp. The
 * existing session has already consumed this exact ACK; these fields bind its
 * actual Source command and ordinal without issuing a capability from JSON. */
export function validateAuthoredHeldSourceStamp(raw:unknown,command:unknown,receipt:unknown):NativeAuthoredHeldSourceStamp {
 const s=raw as NativeAuthoredHeldSourceStamp,r=receipt as Record<string,unknown>;need(s?.schema==='oi.native-expression-composed-source/v1'&&text(s.ql_executable)&&s.ql_executable.startsWith('/')&&object(s.native_binding)&&Object.keys(s.native_binding).length>0&&u64(s.native_request_id)&&BigInt(s.native_request_id)>0n&&sha256(s.request_sha256)&&sha256(s.result_sha256)&&sameNative(s.original_request,command),'The actual held Source stamp lost its private binding/full original command/ordinal');
 const envelope=s.original_host_envelope;need(object(envelope)&&!Object.hasOwn(envelope,'command')&&envelope.schema==='ql.field-host-request/v1'&&envelope.request_id===s.native_request_id&&[envelope.instance_ref,envelope.event_ref,envelope.subject_ref].every(text)&&u64(envelope.expected_generation)&&u64(envelope.expected_samples_elapsed),'The held Source stamp omitted the complete original native request envelope');
 need(object(r)&&r.schema==='ql.field-host-receipt/v1'&&r.available===true&&r.status==='ok'&&r.instance_ref===envelope.instance_ref&&r.request_id===s.native_request_id&&r.last_request_id===s.native_request_id&&object(r.field)&&r.field.subject_ref===envelope.subject_ref&&r.field.event_ref===envelope.event_ref&&r.field.generation===envelope.expected_generation&&r.field.samples_elapsed===envelope.expected_samples_elapsed&&Array.isArray(r.audio)&&r.audio.length===0,'The held Source stamp differs from its full consumed same-owner native ACK');return clone(s);
}
export function validateAuthoredDriverRead(snapshot:StudioSnapshot,request:NativeAuthoredDriverReadRequest,raw:unknown):NativeAuthoredDriverReadReply {
 const r=raw as NativeAuthoredDriverReadReply,basis=studioBasis(snapshot);need(r?.schema==='oi.expression-procedural/v1'&&r.operation==='read_authored_drivers'&&r.expression_ref===request.expression_ref&&r.document_revision===request.expected_revision&&r.scene_ref===request.scene_ref&&sameNative(request,authoredDriverReadRequest(snapshot,request.scope))&&text(r.catalog_revision)&&sameNative(r.original_intent,request)&&sameNative(r.original_scope,request.scope),'The native driver read is stale or belongs to another original Scene/Scope');
 need(r.source_current===true,r.reason&&text(r.reason)?r.reason:'The actual Source/current selected-Scene reader is unavailable');
 need(r.effective_state==='native_consumers_not_yet_observed','A driver read cannot declare renderer/body/audio reception');
 validateAuthoredSourceStamp(r.source,null);
 need(r.catalogue_response?.schema==='oi.expression-procedure-source-response/v1'&&sameNative(r.catalogue_response.source,r.source)&&r.catalogue_response.native_result?.schema==='ql.scene-procedural-response/v1'&&r.catalogue_response.native_result.operation==='authored_catalog'&&sameNative(r.catalogue_response.native_result.result?.catalog,r.catalog)&&r.catalogue_response.native_result.result?.catalog_revision===r.catalog_revision,'The actual executed Source catalogue response differs from its current projected descriptors/revision');
 need(r.reading?.schema==='ql.authored-driver-reading/v1'&&r.reading.catalog_revision===r.catalog_revision,'The native driver read lacks its exact Source catalogue revision');
 const source=r.reading.source;validateNativeSceneSource(source,snapshot,{ref:source?.source_basis?.source_ref,revision:source?.source_basis?.revision,availability:'available'});
 const read=r.native_scene_read;need(object(read)&&text(read.source_read_receipt_ref)&&['native_owner','expression_ref','scene_ref','document_revision','source_basis','material_fingerprint','presentation'].every(key=>sameNative(read[key],(source as unknown as Record<string,unknown>)[key]))&&object(read.locus)&&read.locus.ref===source.locus_ref&&read.locus.revision===source.locus_revision&&read.locus.availability==='available','The actual privately selected native Source read differs from its current material/locus');
 need(source.scene_ref===basis.scene_ref,'The driver Source Scene differs from the original selected Scene');
 const native=snapshot.view.document.scenes.find(s=>s.scene_ref===request.scene_ref);const bounded=native?.presentation?proceduralChanges([{change:'scene_material_set',scene_ref:native.scene_ref,presentation:native.presentation}])[0].presentation:null;need(native&&sameNative(r.reading.current_presentation,bounded),'The native driver read changed actual retained material/controls');
 const material=(native.presentation?.scene as Scene|undefined);need(material,'The actual native driver material is absent');
 need(sameNative(r.reading.entity_refs,Object.fromEntries(material.entities.map(e=>[e.id,e.id]))),'The driver read changed actual material/native Entity correspondence');
 need(Array.isArray(r.controls)&&sameNative(r.controls,retention(material).controls),'The read did not retain the exact actual native controls');
 const expectedScope=resolvedSourceReadAddresses(snapshot,request.scope).filter(a=>a.scene_ref===request.scene_ref||a.scene_ref===null);
 need(Array.isArray(r.reading.scope)&&r.reading.scope.length>0&&r.reading.scope.length===expectedScope.length&&new Set(r.reading.scope.map(addressKey)).size===expectedScope.length&&r.reading.scope.every(a=>expectedScope.some(e=>addressKey(e)===addressKey(a))),'The native driver read dropped, duplicated or widened the original scope');
 validateAuthoredDriverCatalog(r.catalog,snapshot.view.journey.scenes.find(s=>s.id===snapshot.sceneId)!);return clone(r);
}
function selectedTarget(snapshot:StudioSnapshot,scope:Scope,catalog:AuthoredDriverCatalog,target:AuthoredDriverTarget):StageAuthoredDriverTarget {
 need(object(target),'Choose an actual accepted driver target');keys(target,['kind','key','entity_ref']);const row=authoredDriverTargets(snapshot,scope,catalog).find(row=>sameNative(row.target,target));need(row,'The original exact native target is unavailable; no replacement was chosen');return row;
}
const safeIdentity=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
function nativeValue(row:StageAuthoredDriverTarget,value:unknown):asserts value is number {
 need(typeof value==='number'&&Number.isFinite(value)&&(value>=row.descriptor.minimum&&value<=row.descriptor.maximum),'The authored value exceeds the actual Registry domain/units');
}
function actionGroup(raw:Record<string,unknown>):boolean{return raw.kind==='group'||raw.kind==='group_remove';}
export function validateAuthoredDriverAction(snapshot:StudioSnapshot,scope:Scope,catalog:AuthoredDriverCatalog,target:AuthoredDriverTarget,raw:unknown):AuthoredDriverAction {
 need(object(raw),'Choose an explicit native driver action');const row=selectedTarget(snapshot,scope,catalog,target);
 need(!row.native_parameter||actionGroup(raw),'This global native Parameter uses the existing Source-owned scalar control route');
 need(row.descriptor.path!=='particleCount','Allocation needs its explicit native prepare/reset owner, not a frame scalar driver');
 const action=raw as unknown as AuthoredDriverAction;
 if(action.kind==='set_base'){keys(raw,['kind','value']);nativeValue(row,action.value);}
 else if(action.kind==='takeover'){keys(raw,['kind','value','lifetime']);nativeValue(row,action.value);need(['gesture','persistent'].includes(action.lifetime),'Choose an explicit takeover lifetime');}
 else if(action.kind==='release')keys(raw,['kind']);
 else if(action.kind==='release_gesture'){keys(raw,['kind','takeover_operation_ref']);need(text(action.takeover_operation_ref),'Retain the original gesture lifetime operation');}
 else if(action.kind==='record'){keys(raw,['kind','value','track_ref']);nativeValue(row,action.value);need(safeIdentity(action.track_ref),'Choose an explicit safe retained recording track identity');}
 else if(action.kind==='group_remove'){keys(raw,['kind','group_ref']);need(safeIdentity(action.group_ref),'Choose the original retained group identity');}
 else if(action.kind==='group'){
  keys(raw,['kind','definition']);const d=action.definition;need(object(d),'The full named group definition is absent');keys(d,['group_ref','clock_ref','mixing_operator','driver_type','wave','rate','phase','duration','delay','loop_mode','easing','members']);
  need([d.group_ref,d.clock_ref].every(safeIdentity)&&d.mixing_operator==='expressions.original_base_declaration_order/v1'&&['lfo','ramp'].includes(d.driver_type)&&['sine','triangle','square','saw','steps','smooth','morph'].includes(d.wave)&&['once','loop','pingpong'].includes(d.loop_mode)&&['linear','smooth','easeIn','easeOut','elastic','bounce'].includes(d.easing)&&[d.rate,d.phase,d.duration,d.delay].every(Number.isFinite)&&d.rate>=0&&d.duration>=0&&d.delay>=0,'The declared native group driver/operator is incomplete');
  need(Array.isArray(d.members)&&d.members.length>0&&d.members.length<=256,'Choose bounded explicit ordered group members');const ids=new Set<string>();
  for(const member of d.members){need(object(member),'The ordered group member is absent');keys(member,['lane_ref','target','minimum','maximum','blend','enabled']);need(safeIdentity(member.lane_ref)&&!ids.has(member.lane_ref)&&['replace','add','multiply'].includes(member.blend)&&typeof member.enabled==='boolean','Group member identity/order/blend is invalid');ids.add(member.lane_ref);const targetRow=selectedTarget(snapshot,scope,catalog,member.target);need(targetRow.descriptor.path!=='particleCount','This group allocation member needs its separate native prepare/reset owner');for(const endpoint of [member.minimum,member.maximum]){need(Number.isFinite(endpoint),'The group endpoint is not finite');const commanded=member.blend==='add'?targetRow.base+endpoint:member.blend==='multiply'?targetRow.base*endpoint:endpoint;nativeValue(targetRow,commanded);}}
 }else throw Error('Unknown authored driver action');
 return clone(action);
}
/** Retained native rows constrain release/group revision/recording identities.
 * These checks inspect accepted material; they never construct attribution. */
export function retainedAuthoredDriverGroups(snapshot:StudioSnapshot,scope:Scope,catalog:AuthoredDriverCatalog,controls:readonly ControlRetention[],procedure?:unknown):Array<{address:StageAddress;group:AuthoredDriverGroupRetention}> {
 const basis=studioBasis(snapshot),seen=new Set<string>(),rows:Array<{address:StageAddress;group:AuthoredDriverGroupRetention}>=[];
 for(const row of controls as Array<ControlRetention&{procedure_ref?:string;authored_group?:AuthoredDriverGroupRetention}>){const g=row.authored_group;if(!g||g.state!=='active')continue;
  need(g.schema==='ql.authored-driver-group/v1'&&safeIdentity(g.group_ref)&&!seen.has(g.group_ref)&&sha256(g.catalog_revision)&&g.mixing_operator==='expressions.original_base_declaration_order/v1'&&g.domain_policy==='expressions.native_registry_domain/v1'&&object(g.definition)&&text(row.procedure_ref)&&g.definition.procedure_ref===row.procedure_ref&&Number.isSafeInteger(g.revision)&&g.revision>0&&g.revision<=basis.document_revision,'The retained native Source group identity/custody is malformed');seen.add(g.group_ref);
  need(g.configuration?.members?.length&&g.configuration.group_ref===g.group_ref&&g.configuration.clock_ref===g.clock_ref&&sameNative(g.lane_refs,g.configuration.members.map(m=>m.lane_ref))&&row.target==='driver:'+g.group_ref,'The native Source group changed its original ordered lane/clock identities');
  const driver:StageAddress={expression_ref:basis.expression_ref,scene_ref:basis.scene_ref,entity_ref:null,component:'driver',constituent_ref:row.target,property:null};need(addressKey(row.address)===addressKey(driver),'The Source-owned group metadata is not its exact existing Driver');
  const addresses=g.configuration.members.map(m=>selectedTarget(snapshot,{kind:'expression'},catalog,m.target).address),unique=[...new Map(addresses.map(a=>[addressKey(a),a])).values()];need(Array.isArray(g.target_addresses)&&g.target_addresses.length===unique.length&&new Set(g.target_addresses.map(addressKey)).size===unique.length&&g.target_addresses.every(a=>unique.some(e=>addressKey(e)===addressKey(a))),'The retained native Source group targets differ from its full original member configuration');
  if(!g.target_addresses.every(a=>scopeContains(scope,a,snapshot)))continue;
  if(procedure!==undefined)need(sameNative(g.definition,procedure),'The retained Source group replaced the complete original Procedure definition');rows.push({address:clone(row.address),group:clone(g)});
 }
 return rows;
}
function validateRetainedAction(snapshot:StudioSnapshot,reading:NativeAuthoredDriverReadReply,intent:NativeAuthoredDriverIntent,procedure:unknown):void {
 const selected=selectedTarget(snapshot,intent.scope,reading.catalog,intent.target),controls=reading.controls,matching=controls.filter(c=>addressKey(c.address)===addressKey(selected.address));
 need(matching.length<=1,'Conflicting retained control rows select the same actual native target');
 const action=intent.action;
 if(action.kind==='release'||action.kind==='release_gesture'){
  const takeover=matching[0]?.takeover as (ControlRetention['takeover']&{lifetime_operation_ref?:string})|undefined;need(takeover,'The original selected native takeover is unavailable');
  if(action.kind==='release_gesture')need(takeover.lifetime==='gesture'&&(takeover.lifetime_operation_ref??takeover.operation_ref)===action.takeover_operation_ref,'Retain the exact original gesture lifetime operation');
 }
 if(action.kind==='record'){
  need(!matching.some(c=>c.takeover),'Reconcile the exact selected takeover before native recording');
  const scene=snapshot.view.journey.scenes.find(s=>s.id===snapshot.sceneId)!;const target=automationTarget(scene,selected.local_target)!;
  const sameTrack=(scene.propertyTracks??[]).filter(track=>track.bind===target.bind&&track.entityId===target.entityId);
  need(sameTrack.length<=1,'The exact recording target has conflicting retained tracks');
  need(!sameTrack.length||sameTrack[0].id===action.track_ref,'Retain the existing track identity for this exact target; it was not replaced');
  need(!(scene.propertyTracks??[]).some(track=>track.id===action.track_ref&&!sameTrack.includes(track)),'The typed track identity belongs to another actual native target');
 }
 if(action.kind==='group'||action.kind==='group_remove'){
  const group_ref=action.kind==='group'?action.definition.group_ref:action.group_ref,all=retainedAuthoredDriverGroups(snapshot,{kind:'expression'},reading.catalog,controls),rows=all.filter(row=>row.group.group_ref===group_ref);
  if(action.kind==='group_remove')need(rows.length>0&&rows[0].group.configuration.members.some(m=>sameNative(m.target,intent.target)),'The original Source-owned group/member is unavailable; no legacy group was substituted');
  for(const row of rows){need(sameNative(row.group.definition,procedure)&&row.group.catalog_revision===reading.catalog_revision&&row.group.target_addresses.every(a=>scopeContains(intent.scope,a,snapshot)),'The original group Source definition or scalar scope differs');if(action.kind==='group')need(row.group.clock_ref===action.definition.clock_ref,'A group revision must preserve the original retained clock identity');}
 }
}
export function validateAuthoredDriverIntent(snapshot:StudioSnapshot,reading:NativeAuthoredDriverReadReply,raw:unknown):NativeAuthoredDriverIntent {
 need(object(raw),'Retain the full original native driver intent');keys(raw,['operation','expression_ref','expected_revision','scene_ref','procedure_ref','expected_procedure_revision','actor','operation_ref','scope','catalog_revision','target','action']);const intent=raw as unknown as NativeAuthoredDriverIntent;
 const request=authoredDriverReadRequest(snapshot,intent.scope);validateAuthoredDriverRead(snapshot,request,reading);
 need(intent.operation==='authored_driver'&&intent.expression_ref===request.expression_ref&&intent.expected_revision===request.expected_revision&&intent.scene_ref===request.scene_ref&&intent.catalog_revision===reading.catalog_revision&&[intent.actor,intent.operation_ref,intent.procedure_ref,intent.expected_procedure_revision].every(text),'The full original native driver intent changed Source/CAS/identity');
 const procedure=stageLifecycleChoices(snapshot).find(s=>s.scene_ref===intent.scene_ref)?.procedures.find(p=>p.procedure.procedure_ref===intent.procedure_ref);
 need(procedure?.procedure.revision===intent.expected_procedure_revision,'The exact saved native Procedure revision is unavailable');validateAuthoredDriverAction(snapshot,intent.scope,reading.catalog,intent.target,intent.action);need(object(procedure.procedure.definition),'The full original native Procedure definition is unavailable');validateRetainedAction(snapshot,reading,intent,procedure.procedure.definition);
 if(intent.action.kind==='record'){const p=reading.reading.recording_position;need(p&&p.schema==='ql.authored-driver-recording-position/v1'&&text(p.time_mapping_ref)&&text(p.owner_position_ref)&&Number.isFinite(p.local_seconds)&&p.local_seconds>=0&&p.local_seconds<=3600&&sameNative(p.original_timing,procedure.procedure.definition.timing)&&(p.original_timing as {time_mapping_ref?:string})?.time_mapping_ref===p.time_mapping_ref,'The native recording position owner is unavailable; no caller time was supplied');}
 return clone(intent);
}
/** Retained read/intake is historical basis, never a fresh currentness grant. */
export function authoredDriverSnapshot(view:KernelConversion,scene_ref:string):StudioSnapshot {
 const sceneId=Object.entries(view.bindings).find(([,binding])=>binding.scene_ref===scene_ref)?.[0];need(sceneId,'The original authored driver Scene is no longer bound');return {view,journey:view.journey,sceneId,selected:[]};
}
export function validatePendingAuthoredDriver(pending:PendingNativeAuthoredDriver,view:KernelConversion):void {
 need(object(pending),'The full original pending driver operation is absent');keys(pending,['kind','intent','reading','raw_reply'],['kind','intent','reading']);need(pending.kind==='native-authored-driver','Another native operation owns this checkpoint');validateAuthoredDriverIntent(authoredDriverSnapshot(view,pending.intent.scene_ref),pending.reading,pending.intent);
}
/** Receipt discrimination after the real native gateway has accounted its
 * channel. The Source computes changes; this code checks the exact one-Scene
 * material delta against the actual normal Edit without evaluating a driver. */
export function validateNativeAuthoredDriverReply(view:KernelConversion,pending:PendingNativeAuthoredDriver,raw:unknown):StageAuthoredDriverObservation {
 const r=raw as NativeAuthoredDriverReply,intent=pending.intent;need(r?.schema==='oi.expression-procedural/v1'&&r.operation==='authored_driver'&&sameNative(r.original_intent,intent)&&['document_applied','source_refused','revision_conflict','reconciliation_required'].includes(r.state)&&r.effective_state==='native_consumers_not_yet_observed','The native driver reply differs from its full original intent or claims consumer reception');
 need(r.document?.schema==='oi.expression/v1'&&r.document.expression_ref===intent.expression_ref&&Number.isSafeInteger(r.document.revision)&&r.document.revision>=intent.expected_revision,'The driver reply lost its actual current native Document');
 const result:StageAuthoredDriverObservation={original_intent:clone(intent),native_reply:clone(raw),state:r.state,standing:''};result.standing=authoredDriverStanding(result);
 if(r.state!=='document_applied'){need(text(r.reason)&&r.source_current===false,'The refused/unresolved native driver result lost its exact reason/currentness');return result;}
 validatePendingAuthoredDriver(pending,view);
 need(r.cache?.provenance==='live_native_owner'&&r.cache.restored===false&&typeof r.cache.replayed==='boolean'&&sha256(r.cache.document_sha256),'Cold history cannot authorize native driver replay/adoption');
 const preparation=r.driver_preparation;need(object(preparation)&&preparation.schema==='ql.authored-driver-preparation/v1'&&preparation.operation===(intent.action.kind==='release_gesture'?'release':intent.action.kind)&&preparation.operation_ref===intent.operation_ref&&preparation.catalog_revision===intent.catalog_revision&&preparation.consumer_state==='unconfirmed','The native Source returned another driver preparation or receiving standing');
 const original=stageLifecycleChoices(authoredDriverSnapshot(view,intent.scene_ref)).find(s=>s.scene_ref===intent.scene_ref)?.procedures.find(p=>p.procedure.procedure_ref===intent.procedure_ref)?.procedure.definition;need(object(original)&&sameNative(preparation.original_procedure,original),'The Source driver preparation replaced the full original native Procedure');
 const reading=preparation.driver_reading as NativeAuthoredDriverReading;need(reading?.schema==='ql.authored-driver-reading/v1'&&reading.catalog_revision===pending.reading.catalog_revision&&sameNative(reading.source,pending.reading.reading.source)&&sameNative(reading.current_presentation,pending.reading.reading.current_presentation)&&sameNative(reading.entity_refs,pending.reading.reading.entity_refs)&&sameNative(reading.scope,pending.reading.reading.scope),'The actual Source driver intake changed original material/subject/Scope/catalogue');
 const nativeInput={procedure:original,reading,target:intent.target,actor_ref:intent.actor,operation_ref:intent.operation_ref,action:intent.action},command={action:'authored_driver',input:{input:nativeInput,scene_read:pending.reading.native_scene_read,contributors:pending.reading.reading.source.contributors}};validateAuthoredHeldSourceStamp(r.source,command,r.native_receipt);
 need(object(r.native_result)&&sameNative(r.native_result,r.native_receipt)&&sameNative(r.native_result.procedural,preparation),'The complete actual native Source Host result differs from its emitted preparation');
 const channel=r.native_source_channel as {schema?:unknown;result?:{native_receipt?:unknown}};need(channel?.schema==='ql.native-act-owner-result/v1'&&sameNative(channel.result?.native_receipt,r.native_receipt),'The Source driver result lost its full same native source channel receipt');
 const edit=preparation.native_edit as {operation?:string;expression_ref?:string;expected_revision?:number;actor?:string;changes?:Array<Record<string,unknown>>};need(edit?.operation==='edit'&&edit.expression_ref===intent.expression_ref&&edit.expected_revision===intent.expected_revision&&edit.actor===intent.actor&&edit.changes?.length===1,'The Source driver Edit differs from its original native target/CAS/actor');
 const change=edit.changes[0];need(change.change==='scene_material_set'&&change.scene_ref===intent.scene_ref&&object(change.presentation),'The Source driver edit widens beyond the exact selected Scene');
 const receipt=r.native_edit_receipt as {state?:string;document?:KernelExpressionDocument};need(receipt?.state==='ready'&&receipt.document?.revision===intent.expected_revision+1&&sameNative(receipt.document,r.document),'The native Source driver has no exact original+1 actual normal Edit receipt');
 const expected=clone(view.document),scene=expected.scenes.find(s=>s.scene_ref===intent.scene_ref);need(scene,'The original native driver Scene is absent');
 const next=clone(change.presentation) as typeof scene.presentation;need(next?.schema==='oi.journey-scene/v1'&&next.scene,'The Source driver material is not native Scene presentation');
 const oldJournal=scene.presentation?retention(scene.presentation.scene).operations:[];const nextScene=next.scene as Partial<ProceduralScene>;if(nextScene.procedural){need(Array.isArray(nextScene.procedural.operations)&&nextScene.procedural.operations.length===0,'Source driver intents may not copy old full journals');nextScene.procedural.operations=clone(oldJournal);}
 scene.presentation=next;scene.revision=intent.expected_revision+1;expected.revision=intent.expected_revision+1;need(sameNative(expected,r.document),'The actual native driver Edit changed unrelated material, selection, Entity or control metadata');
 result.view=kernelDocumentToJourney(r.document,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});return result;
}
export function authoredDriverStanding(observation:StageAuthoredDriverObservation):string {
 return observation.state==='document_applied'?'Native driver configuration applied. Renderer, body and sound reception remain separately unobserved.':observation.state==='historical_retry'?'Historical driver receipt retained; current Source requalification is required.':observation.state==='source_refused'?'Native Source refused this original driver intent; retain it.':observation.state==='revision_conflict'?'The native Document changed; retain the exact original driver target.':'Driver receiving is unresolved; inspect the same native owner before another action.';
}

export interface StageAuthoredDriverEditor {panel:HTMLElement;refresh():void;retainedIntent():NativeAuthoredDriverIntent|null;submit(intent:NativeAuthoredDriverIntent):Promise<StageAuthoredDriverObservation>;retry():Promise<StageAuthoredDriverObservation>;dispose():void;}
/** Stable form nodes retain typed input and exact intent through native pulses.
 * Unknown operations stay with the existing Working recovery owner. */
export function installStageAuthoredDriverEditor(host:StageAuthoredDriverHost):StageAuthoredDriverEditor {
 const panel=document.createElement('details');panel.open=true;panel.className='stage-drivers';panel.setAttribute('aria-label','Authored drivers and named modifiers');
 const title=document.createElement('summary');title.textContent='Authored drivers and named modifiers';
 const note=document.createElement('p');note.className='control-note';
 const form=document.createElement('div');form.className='procedural-controls';
 const targetFacts=document.createElement('div');targetFacts.className='control-note';targetFacts.setAttribute('aria-label','Accepted target basis and active drivers');
 const procedure=document.createElement('select'),target=document.createElement('select'),action=document.createElement('select'),lifetime=document.createElement('select');
 const value=document.createElement('input'),track=document.createElement('input'),takeover=document.createElement('input'),groupId=document.createElement('input'),clock=document.createElement('input');
 value.type='number';value.step='any';value.placeholder='Explicit authored value';
 track.placeholder='Retained recording track identity';takeover.placeholder='Original gesture operation';
 groupId.placeholder='Named group identity';clock.placeholder='Authored retained clock identity';
 const group=document.createElement('fieldset'),groupLegend=document.createElement('legend');groupLegend.textContent='Ordered group targets';group.append(groupLegend);
 const savedGroup=document.createElement('select'),loadGroup=document.createElement('button');loadGroup.type='button';loadGroup.textContent='Load current accepted group values';
 const driver=document.createElement('select'),wave=document.createElement('select'),loop=document.createElement('select'),easing=document.createElement('select');
 const rate=document.createElement('input'),phase=document.createElement('input'),duration=document.createElement('input'),delay=document.createElement('input');
 for(const [input,hint]of [[rate,'Rate · Hz'],[phase,'Phase · cycles'],[duration,'Duration · seconds'],[delay,'Delay · seconds']] as const){input.type='number';input.step='any';input.placeholder=hint;}
 const members=document.createElement('div'),add=document.createElement('button');add.type='button';add.textContent='Add an explicit target';
 const read=document.createElement('button'),apply=document.createElement('button'),retry=document.createElement('button');
 for(const button of [read,apply,retry])button.type='button';read.textContent='Read current native drivers';apply.textContent='Apply native driver intent';retry.textContent='Inspect/retry retained operation';
 const shared=document.createElement('p');shared.className='control-note';shared.textContent='Whole-Expression shared controls need the separate native expression_shared reader across every affected Scene. No Scene field is substituted for that scope.';
 const operator=document.createElement('p');operator.className='control-note';operator.textContent='Named operation: original authored base with explicit declaration order. Each add/multiply uses the retained base; local ranges and enabled flags stay distinct.';
 function field(label:string,input:HTMLElement){const row=document.createElement('label'),caption=document.createElement('span');caption.textContent=label;row.append(caption,input);return row;}
 function staticOptions(select:HTMLSelectElement,rows:Array<[string,string]>){select.append(new Option('Choose explicitly',''));for(const [id,label]of rows)select.append(new Option(label,id));}
 staticOptions(action,[['set_base','Edit base; retain active drivers'],['takeover','Take over the effective target'],['release','Release to retained driver'],['release_gesture','End original gesture'],['record','Record through native position owner'],['group','Author named driver group'],['group_remove','Remove original named group']]);
 staticOptions(lifetime,[['gesture','Gesture'],['persistent','Persistent authored override']]);
 staticOptions(driver,[['lfo','Cycle'],['ramp','Ramp']]);staticOptions(wave,['sine','triangle','square','saw','steps','smooth','morph'].map(id=>[id,id]));staticOptions(loop,['once','loop','pingpong'].map(id=>[id,id]));staticOptions(easing,['linear','smooth','easeIn','easeOut','elastic','bounce'].map(id=>[id,id]));
 form.append(field('Accepted Procedure',procedure),field('Exact native target',target),field('Operation',action),field('Value in declared authored units',value),field('Takeover lifetime',lifetime),field('Recording track',track),field('Original gesture operation',takeover),field('Group identity',groupId));
 group.append(field('Current Source-owned group',savedGroup),loadGroup,field('Retained group clock identity',clock),field('Driver',driver),field('Wave',wave),field('Rate',rate),field('Phase',phase),field('Duration',duration),field('Delay',delay),field('Loop',loop),field('Easing',easing),operator,members,add);
 panel.append(title,note,read,form,targetFacts,group,apply,retry,shared);
 interface MemberEditor {node:HTMLElement;lane:HTMLInputElement;target:HTMLSelectElement;low:HTMLInputElement;high:HTMLInputElement;blend:HTMLSelectElement;enabled:HTMLInputElement;}
 let disposed=false,busy=false,reading:NativeAuthoredDriverReadReply|null=null,readRequest:NativeAuthoredDriverReadRequest|null=null,retained:NativeAuthoredDriverIntent|null=null;
 const memberRows:MemberEditor[]=[],targetRows=new Map<string,StageAuthoredDriverTarget>();
 const targetKey=(row:AuthoredDriverTarget)=>JSON.stringify([row.kind,row.key,row.entity_ref]);
 function options(select:HTMLSelectElement,rows:Array<[string,string]>,initial:string){
  const selected=select.value,old=new Map(Array.from(select.options).map(option=>[option.value,option])),wanted=new Set(['',...rows.map(row=>row[0])]);
  if(!old.has(''))select.prepend(new Option(initial,''));
  for(const [id,label]of rows){const option=old.get(id)??new Option(label,id);option.textContent=label;delete option.dataset.originalLabel;option.disabled=false;if(!option.parentNode)select.append(option);}
  for(const option of Array.from(select.options)){if(wanted.has(option.value))continue;if(option.value===selected){option.dataset.originalLabel??=option.textContent??'';option.textContent='Unavailable original target · '+option.dataset.originalLabel;option.disabled=true;}else option.remove();}
  select.value=selected;
 }
 function current():StudioSnapshot {const snapshot=host.snapshot();need(snapshot,'Open the native Expression before authoring drivers');return snapshot;}
 function report(error:unknown){const message=error instanceof Error?error.message:String(error);note.textContent=message;host.report(message);}
 function selection():StageAuthoredDriverTarget {const selected=targetRows.get(target.value);need(selected,'Choose an explicit current native target');return selected;}
 function number(input:HTMLInputElement){need(input.value.trim()!=='','Retain an explicit typed value');const n=Number(input.value);need(Number.isFinite(n),'Enter a finite authored value');return n;}
 function actualAction():AuthoredDriverAction {
  switch(action.value){
   case 'set_base':return {kind:'set_base',value:number(value)};
   case 'takeover':need(['gesture','persistent'].includes(lifetime.value),'Choose a takeover lifetime');return {kind:'takeover',value:number(value),lifetime:lifetime.value as 'gesture'|'persistent'};
   case 'release':return {kind:'release'};
   case 'release_gesture':return {kind:'release_gesture',takeover_operation_ref:takeover.value};
   case 'record':return {kind:'record',value:number(value),track_ref:track.value};
   case 'group_remove':return {kind:'group_remove',group_ref:groupId.value};
   case 'group':return {kind:'group',definition:{group_ref:groupId.value,clock_ref:clock.value,mixing_operator:'expressions.original_base_declaration_order/v1',driver_type:driver.value as 'lfo'|'ramp',wave:wave.value as AuthoredDriverGroup['wave'],rate:number(rate),phase:number(phase),duration:number(duration),delay:number(delay),loop_mode:loop.value as AuthoredDriverGroup['loop_mode'],easing:easing.value as AuthoredDriverGroup['easing'],members:memberRows.map(row=>{const target=targetRows.get(row.target.value);need(target,'Retain each explicit original native group target');return {lane_ref:row.lane.value,target:clone(target.target),minimum:number(row.low),maximum:number(row.high),blend:row.blend.value as AuthoredDriverGroupMember['blend'],enabled:row.enabled.checked};})}};
   default:throw Error('Choose an explicit driver operation');
  }
 }
 function retainIntent():NativeAuthoredDriverIntent {
  need(reading&&readRequest,'Read the current native Source-owned drivers first');const snapshot=current();need(sameNative(readRequest,authoredDriverReadRequest(snapshot,host.scope())),'The original Source/Scope changed; typed input remains retained');
  const chosen=stageLifecycleChoices(snapshot).find(s=>s.scene_ref===readRequest!.scene_ref)?.procedures.find(p=>p.procedure.procedure_ref===procedure.value);need(chosen,'Choose the exact accepted Procedure');
  const input={operation:'authored_driver' as const,expression_ref:readRequest.expression_ref,expected_revision:readRequest.expected_revision,scene_ref:readRequest.scene_ref,procedure_ref:chosen.procedure.procedure_ref,expected_procedure_revision:chosen.procedure.revision,actor:host.actor,operation_ref:'authored-driver:'+crypto.randomUUID(),scope:clone(readRequest.scope),catalog_revision:reading.catalog_revision,target:clone(selection().target),action:actualAction()};
  return validateAuthoredDriverIntent(snapshot,reading,input);
 }
 function available():StageAuthoredDriverAvailability {
  if(!reading||!readRequest||!host.capability||!host.submit)return {state:'unavailable',reason:'The native Source-owned driver reader/retained mutation path is not paired.'};
  const snapshot=current();if(!sameNative(readRequest,authoredDriverReadRequest(snapshot,host.scope())))return {state:'unavailable',reason:'The actual Source/Document/Scope advanced; typed intent remains retained for explicit re-read.'};
  if(!action.value)return {state:'unavailable',reason:'Choose an explicit native driver operation.'};
  if(action.value==='record'&&!reading.reading.recording_position)return {state:'unavailable',reason:'The genuine native named local-seconds mapping owner is not paired for recording. Typed value and track identity remain retained.'};
  const capability=host.capability(action.value as AuthoredDriverAction['kind'],readRequest,reading);
  if(capability.state==='unavailable'){need(text(capability.reason),'Native driver availability has no exact reason');return capability;}
  need(capability.expression_ref===readRequest.expression_ref&&capability.document_revision===readRequest.expected_revision&&capability.catalog_revision===reading.catalog_revision&&text(capability.owner),'The driver capability is stale or belongs to another native owner');return capability;
 }
 function updateFields(){const kind=action.value;value.closest('label')!.hidden=!['set_base','takeover','record'].includes(kind);lifetime.closest('label')!.hidden=kind!=='takeover';track.closest('label')!.hidden=kind!=='record';takeover.closest('label')!.hidden=kind!=='release_gesture';groupId.closest('label')!.hidden=!['group','group_remove'].includes(kind);group.hidden=kind!=='group';refresh();}
 async function accept(observation:StageAuthoredDriverObservation){
  need(retained&&sameNative(observation.original_intent,retained),'Native receiving returned a different full original driver intent');note.textContent=observation.standing||authoredDriverStanding(observation);
  if(observation.state==='document_applied'){const snapshot=current();need(observation.view&&sameNative(observation.view.document,snapshot.view.document)&&observation.view.document.expression_ref===retained.expression_ref&&observation.view.document.revision===retained.expected_revision+1,'The actual native driver Edit adoption is not observed; original intent remains retained');retained=null;reading=null;readRequest=null;}
 }
 async function submit(intent:NativeAuthoredDriverIntent):Promise<StageAuthoredDriverObservation>{
  need(!busy,'The same native writer is busy; full input remains retained');
  if(retained)need(sameNative(retained,intent),'The full original pending driver intent cannot be replaced');
  else{const capability=available();need(capability.state==='available',capability.state==='unavailable'?capability.reason:'Unavailable native owner');need(reading,'Read the actual Source-owned drivers before a fresh intent');validateAuthoredDriverIntent(current(),reading,intent);retained=clone(intent);}
  need(host.submit,'The retained native driver writer is unavailable');busy=true;refresh();try{const result=await host.submit(clone(retained),clone(reading!));await accept(result);return result;}finally{busy=false;refresh();}
 }
 async function retryOriginal():Promise<StageAuthoredDriverObservation>{need(!busy&&retained&&host.retry,'The guarded original native driver owner is unavailable; retain the operation');busy=true;refresh();try{const result=await host.retry(clone(retained));await accept(result);return result;}finally{busy=false;refresh();}}
 async function invoke(mode:'fresh'|'retry'){try{if(mode==='fresh')await submit(retainIntent());else await retryOriginal();}catch(error){report(error);}}
 read.addEventListener('click',()=>{if(busy)return;void(async()=>{try{busy=true;need(!retained,'Resolve the full original pending operation before re-reading Source');need(host.read,'The native Source-owned read_authored_drivers endpoint is unavailable');const snapshot=current(),request=authoredDriverReadRequest(snapshot,host.scope()),raw=await host.read(clone(request)),after=current();reading=validateAuthoredDriverRead(after,request,raw);readRequest=request;targetRows.clear();for(const row of authoredDriverTargets(after,request.scope,reading.catalog))targetRows.set(targetKey(row.target),row);const labels=Array.from(targetRows,([key,row])=>[key,row.label+' · '+row.address.component+' · '+row.base+' '+row.descriptor.units] as [string,string]);options(target,labels,'Choose an exact native target');for(const row of memberRows)options(row.target,labels,'Choose an exact native target');note.textContent='Actual current driver Source read. Recording uses the protected position owner; effective renderer/body/audio state remains separately unobserved.';}catch(error){report(error);}finally{busy=false;refresh();}})();});
 apply.addEventListener('click',()=>{void invoke('fresh');});retry.addEventListener('click',()=>{void invoke('retry');});action.addEventListener('change',updateFields);target.addEventListener('change',refresh);savedGroup.addEventListener('change',refresh);
 function appendMember(initial?:AuthoredDriverGroupMember){const node=document.createElement('fieldset'),lane=document.createElement('input'),target=document.createElement('select'),low=document.createElement('input'),high=document.createElement('input'),blend=document.createElement('select'),enabled=document.createElement('input'),remove=document.createElement('button'),up=document.createElement('button'),down=document.createElement('button');lane.placeholder='Explicit stable lane identity';for(const n of [low,high]){n.type='number';n.step='any';}enabled.type='checkbox';enabled.checked=true;staticOptions(blend,[['replace','Replace'],['add','Add to original base'],['multiply','Multiply original base']]);options(target,Array.from(targetRows,([key,row])=>[key,row.label]),'Choose an exact native target');const row={node,lane,target,low,high,blend,enabled};memberRows.push(row);if(initial){lane.value=initial.lane_ref;target.value=targetKey(initial.target);low.value=String(initial.minimum);high.value=String(initial.maximum);blend.value=initial.blend;enabled.checked=initial.enabled;}node.append(field('Stable lane',lane),field('Native target',target),field('Minimum',low),field('Maximum',high),field('Combination',blend),field('Enabled',enabled));for(const b of [remove,up,down])b.type='button';remove.textContent='Remove this target';up.textContent='Earlier';down.textContent='Later';node.append(up,down,remove);members.append(node);remove.addEventListener('click',()=>{if(busy||retained)return;const index=memberRows.indexOf(row);if(index>=0)memberRows.splice(index,1);node.remove();});function move(delta:number){if(busy||retained)return;const i=memberRows.indexOf(row),j=i+delta;if(j<0||j>=memberRows.length)return;[memberRows[i],memberRows[j]]=[memberRows[j],memberRows[i]];for(const m of memberRows)members.append(m.node);}up.addEventListener('click',()=>move(-1));down.addEventListener('click',()=>move(1));}
 add.addEventListener('click',()=>{if(!busy&&!retained)appendMember();});
 loadGroup.addEventListener('click',()=>{try{need(!busy&&!retained&&reading&&readRequest,'Retain the original pending operation before loading another group');const snapshot=current();validateAuthoredDriverRead(snapshot,readRequest,reading);const row=retainedAuthoredDriverGroups(snapshot,readRequest.scope,reading.catalog,reading.controls).find(row=>row.group.group_ref===savedGroup.value);need(row,'The exact current Source-owned group is unavailable in this scope');const g=row.group,c=g.configuration;need(stageLifecycleChoices(snapshot).find(s=>s.scene_ref===readRequest!.scene_ref)?.procedures.some(p=>sameNative(p.procedure.definition,g.definition)),'The original accepted group Procedure is unavailable');for(const member of memberRows)member.node.remove();memberRows.length=0;for(const member of c.members)appendMember(member);procedure.value=String(g.definition.procedure_ref);target.value=targetKey(c.members[0].target);groupId.value=g.group_ref;clock.value=g.clock_ref;driver.value=c.driver_type;wave.value=c.wave;rate.value=String(c.rate);phase.value=String(c.phase);duration.value=String(c.duration);delay.value=String(c.delay);loop.value=c.loop_mode;easing.value=c.easing;action.value='group';updateFields();note.textContent='Current accepted group loaded explicitly. Its stable lanes, retained clock and declaration order remain the original native identities.';}catch(error){report(error);}});
 function refresh(){
  if(disposed)return;try{
   const snapshot=host.snapshot();if(!snapshot){note.textContent='Open the native Expression to inspect its actual driver targets.';apply.disabled=true;read.disabled=true;return;}
   const pending=host.retained?.();if(pending){need(!retained||sameNative(pending.intent,retained),'Another original native driver operation is retained; current typed input was not redirected');retained??=clone(pending.intent);reading??=clone(pending.reading);readRequest??={operation:'read_authored_drivers',expression_ref:pending.intent.expression_ref,expected_revision:pending.intent.expected_revision,scene_ref:pending.intent.scene_ref,scope:clone(pending.intent.scope)};}
   const basis=studioBasis(snapshot),rows=stageLifecycleChoices(snapshot).find(s=>s.scene_ref===basis.scene_ref)?.procedures??[];
   options(procedure,rows.map(row=>[row.procedure.procedure_ref,row.procedure.procedure_ref+' · '+row.procedure.revision]),'Choose an accepted Procedure');
   if(retained){const observed=host.settled?.(clone(retained));if(observed&&observed.state==='document_applied'&&sameNative(observed.original_intent,retained)&&observed.view&&sameNative(observed.view.document,snapshot.view.document)){retained=null;reading=null;readRequest=null;note.textContent=authoredDriverStanding(observed);}}
   const currentRead=!!reading&&!!readRequest&&sameNative(readRequest,authoredDriverReadRequest(snapshot,host.scope()));if(currentRead){const groups=retainedAuthoredDriverGroups(snapshot,readRequest!.scope,reading!.catalog,reading!.controls);options(savedGroup,groups.map(row=>[row.group.group_ref,row.group.group_ref+' · '+row.group.configuration.members.length+' targets']),'Choose an actual accepted group');}loadGroup.disabled=busy||!!retained||!currentRead||!savedGroup.value;add.disabled=busy||!!retained;
   const capability=available();apply.disabled=busy||!!retained||capability.state!=='available';apply.title=capability.state==='unavailable'?capability.reason:'';read.disabled=busy||!!retained||!host.read;read.title=host.read?'':'The genuine native driver reader is not installed.';retry.disabled=busy||!retained||!host.retry;retry.title=host.retry?'':'Guarded native retry is unavailable; original operation is retained.';
   if(!reading&&!retained)note.textContent=capability.state==='unavailable'?capability.reason:'Read the actual current Source-owned catalogue.';
   targetFacts.replaceChildren();const selected=targetRows.get(target.value);if(selected){value.min=String(selected.descriptor.minimum);value.max=String(selected.descriptor.maximum);value.title=selected.descriptor.units+' · '+selected.descriptor.minimum+'…'+selected.descriptor.maximum;if(selected.native_parameter&&!['group','group_remove'].includes(action.value)){apply.disabled=true;apply.title='This global native Parameter uses the existing Source-owned scalar Studio controls.';}if(selected.descriptor.path==='particleCount'){apply.disabled=true;apply.title='Allocation needs the explicit native prepare/reset lifecycle.';}
    if(reading&&readRequest&&sameNative(readRequest,authoredDriverReadRequest(snapshot,host.scope()))){const basis=authoredDriverDisclosure(snapshot,readRequest.scope,reading.catalog,selected.target);for(const text of ['Authored basis · '+basis.authored_base+' '+basis.units,'Native target · '+basis.address.component+' · '+(basis.address.entity_ref??basis.address.scene_ref??basis.address.expression_ref),...basis.active,'Effective state · use the qualified consumer observations in the Stage inspector; configuration alone is unobserved.']){const row=document.createElement('p');row.textContent=text;targetFacts.append(row);}}
    else{const row=document.createElement('p');row.textContent='The original native read advanced. Typed target and input remain retained; explicitly read its current Source before changing it.';targetFacts.append(row);}
   }
  }catch(error){apply.disabled=true;report(error);}
 }
 updateFields();return {panel,refresh,retainedIntent:()=>clone(retained),submit,retry:retryOriginal,dispose(){disposed=true;memberRows.length=0;targetRows.clear();}};
}
