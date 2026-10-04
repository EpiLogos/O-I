/** Studio intent for the existing native Parameter/control owner. The native
 * Source worker prepares driver topology and overlays; this module owns no
 * driver, automation evaluator, source graph, checkpoint store or field clock. */
import {clone} from './model.js';
import {automationTarget} from './nativeParameters.js';
import {kernelEntityControlValues,nativeSceneMaterial,kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {addressKey,validateAddress,type StageAddress} from './proceduralRetention.js';
import {sameNative} from './proceduralProtocol.js';
import {controlCapabilities,type PropertyCapability} from './proceduralControls.js';
import type {StudioBasis,StudioSnapshot} from './proceduralStudio.js';

export type NativeControlParameter=keyof ReturnType<typeof kernelEntityControlValues>;
export type NativeControlAction={kind:'takeover';value:number;lifetime:'gesture'|'persistent'}|{kind:'set_base';value:number}|{kind:'release'}|{kind:'release_gesture';takeover_operation_ref:string};
export interface NativeDriverScene {scene_ref:string;entity_refs:Record<string,string>;presentation:Record<string,unknown>;parameter_candidate:null}
export interface NativeParameterDriverReading {schema:'ql.native-parameter-driver/v1';expression_ref:string;document_revision:number;entity_ref:string;parameter:NativeControlParameter;native_parameter:{value:number;automation?:unknown};addresses:StageAddress[];scenes:NativeDriverScene[]}
export interface NativeDriverRequest {operation:'read_driver';expression_ref:string;expected_revision:number;address:StageAddress;parameter:NativeControlParameter}
export interface NativeControlRequest {operation:'control';expression_ref:string;expected_revision:number;procedure_ref:string;address:StageAddress;parameter:NativeControlParameter;actor:string;operation_ref:string;action:NativeControlAction}
/** Captured authored input, kept distinct from a native Source preparation. */
export interface StudioNativeControlIntent {basis:StudioBasis;operation_ref:string;procedure_ref:string;address:StageAddress;target:string;action:{kind:'takeover';value:number;lifetime:'gesture'|'persistent'}|{kind:'set_base';value:number}|{kind:'release'}|{kind:'release_gesture';takeover_operation_ref:string}}
export interface StudioNativeDriverIntent {basis:StudioBasis;address:StageAddress;target:string}
export interface NativeControlCache {provenance:'live_native_owner'|'unqualified';restored:boolean;replayed:boolean;document_sha256?:string}
export interface NativeControlReply {schema:'oi.expression-procedural/v1';operation:'control';operation_ref:string;original_intent:NativeControlRequest;state:'document_applied'|'source_refused'|'revision_conflict';native_procedural_receipts:[];cache:NativeControlCache;native_edit_receipt?:unknown;source?:unknown;native_parameter_driver?:unknown;document?:KernelExpressionDocument;reason?:string;restored?:boolean}
export interface NativeControlResult {intent:StudioNativeControlIntent;request:NativeControlRequest;receipt:NativeControlReply;view?:KernelConversion;driver?:NativeParameterDriverReading}
export type NativeControlCapability=Pick<PropertyCapability,'address'|'target'|'min'|'max'>;

const bindings:Record<NativeControlParameter,{component:'entity'|'force';property:string;bind:string}>={
 x:{component:'entity',property:'position.x',bind:'entity.position.x'},y:{component:'entity',property:'position.y',bind:'entity.position.y'},z:{component:'entity',property:'position.z',bind:'entity.position.z'},
 scale:{component:'entity',property:'scale',bind:'entity.scale'},rotation:{component:'entity',property:'rotation',bind:'entity.rotation'},
 force_strength:{component:'force',property:'strength',bind:'entity.force.strength'},force_spin:{component:'force',property:'spin',bind:'entity.force.spin'},force_radius:{component:'force',property:'radius',bind:'entity.force.radius'},
};
function need(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message);}
function scalar(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function keys(value:Record<string,unknown>,required:string[],optional:string[]=[]){need(required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key)),'Native control wire has missing or unknown fields');}

/** These are the exact published SourceControl bindings, intersected with the
 * actual registry target and actual current Document Parameter vocabulary. */
export function nativeControlTarget(snapshot:StudioSnapshot,capability:NativeControlCapability):{state:'available';parameter:NativeControlParameter;entity_ref:string}|{state:'unavailable';reason:string} {
 const a=validateAddress(capability.address),entry=Object.entries(bindings).find(([,b])=>a.component===b.component&&a.property===b.property&&a.constituent_ref===null) as [NativeControlParameter,typeof bindings[NativeControlParameter]]|undefined;
 if(!entry||!a.entity_ref||!a.scene_ref)return {state:'unavailable',reason:'This field or constituent has no paired native scalar Parameter/control mapping.'};
 const sceneId=Object.entries(snapshot.view.bindings).find(([,b])=>b.scene_ref===a.scene_ref)?.[0],scene=snapshot.journey.scenes.find(s=>s.id===sceneId),occurrence=sceneId?snapshot.view.bindings[sceneId].occurrences.find(o=>o.entity_ref===a.entity_ref):undefined;
 const target=scene?automationTarget(scene,capability.target):undefined;
 if(a.expression_ref!==snapshot.view.document.expression_ref||!target||target.bind!==entry[1].bind||target.entityId!==occurrence?.view_entity_id||capability.min!==target.hardMin||capability.max!==target.hardMax||!snapshot.view.document.entities[a.entity_ref]?.parameters[entry[0]])return {state:'unavailable',reason:'The exact Registry target/domain/native occurrence/Parameter mapping is unavailable on this Document.'};
 return {state:'available',parameter:entry[0],entity_ref:a.entity_ref};
}
export function nativeDriverRequest(snapshot:StudioSnapshot,capability:NativeControlCapability):NativeDriverRequest {
 const target=nativeControlTarget(snapshot,capability);need(target.state==='available',target.state==='unavailable'?target.reason:'Native control unavailable');
 return {operation:'read_driver',expression_ref:snapshot.view.document.expression_ref,expected_revision:snapshot.view.document.revision,address:clone(capability.address),parameter:target.parameter};
}
function projectedPresentation(presentation:unknown):unknown {
 const p=clone(presentation) as {scene?:{procedural?:{operations?:unknown[]}}};if(p?.scene?.procedural)p.scene.procedural.operations=[];return p;
}
export function validateNativeDriver(snapshot:StudioSnapshot,request:NativeDriverRequest,raw:unknown):NativeParameterDriverReading {
 const d=raw as NativeParameterDriverReading,doc=snapshot.view.document;
 need(object(d),'The native owner returned no driver reading');keys(d,['schema','expression_ref','document_revision','entity_ref','parameter','native_parameter','addresses','scenes']);
 need(d.schema==='ql.native-parameter-driver/v1'&&d.expression_ref===request.expression_ref&&d.document_revision===request.expected_revision&&doc.expression_ref===request.expression_ref&&doc.revision===request.expected_revision&&d.entity_ref===request.address.entity_ref&&d.parameter===request.parameter,'The native driver reading differs from its original Parameter/Document basis');
 need(object(d.native_parameter)&&scalar(d.native_parameter.value),'The native driver has no finite actual Parameter value');keys(d.native_parameter,['value'],['automation']);
 need(sameNative(d.native_parameter,doc.entities[d.entity_ref]?.parameters[d.parameter]),'The native driver value/automation differs from the actual accepted Document Parameter');
 need(Array.isArray(d.addresses)&&Array.isArray(d.scenes)&&d.scenes.length>0&&d.scenes.length<=2048&&d.addresses.length===d.scenes.length,'The driver omits complete native Scene manifestations');
 const locations=doc.scenes.filter(s=>s.entity_refs.includes(d.entity_ref)),bound=bindings[d.parameter];
 const expected=locations.map(s=>validateAddress({expression_ref:doc.expression_ref,scene_ref:s.scene_ref,entity_ref:d.entity_ref,component:bound.component,constituent_ref:null,property:bound.property}));
 need(d.scenes.length===locations.length&&d.addresses.every(a=>{validateAddress(a);return expected.some(e=>sameNative(e,a));})&&new Set(d.addresses.map(addressKey)).size===expected.length&&d.addresses.some(a=>sameNative(a,request.address)),'The native driver omits, duplicates or widens an actual scalar manifestation');
 const seen=new Set<string>();for(const scene of d.scenes){need(object(scene),'Native driver Scene is absent');keys(scene,['scene_ref','entity_refs','presentation','parameter_candidate']);const native=locations.find(s=>s.scene_ref===scene.scene_ref);need(native&&!seen.has(scene.scene_ref),'The native driver Scene is missing, duplicate or foreign');seen.add(scene.scene_ref);
  need(scene.parameter_candidate===null,'A read-only driver cannot carry a caller/native control preview');
  const material=nativeSceneMaterial(doc,native);need(material.entities.some(e=>e.id===d.entity_ref),'The native driver has no actual material manifestation');
  const expectedPresentation=native.presentation??{schema:'oi.journey-scene/v1',scene:material,saved:null};
  need(sameNative(scene.presentation,projectedPresentation(expectedPresentation)),'The native driver changed its actual full current Scene material/source/driver basis');
  need(sameNative(scene.entity_refs,Object.fromEntries(material.entities.map(e=>[e.id,e.id]))),'The native driver changed the actual material/native Entity map');
 }
 return clone(d);
}
export function nativeControlRequest(snapshot:StudioSnapshot,capability:NativeControlCapability,intent:StudioNativeControlIntent,driver:NativeParameterDriverReading,actor='human:expressions-app'):NativeControlRequest {
 need(object(intent),'The original native control intent is absent');keys(intent,['basis','operation_ref','procedure_ref','address','target','action']);need(object(intent.action),'The original native control action is absent');
 if(intent.action.kind==='takeover'){keys(intent.action,['kind','value','lifetime']);need(['gesture','persistent'].includes(intent.action.lifetime),'Choose the actual native control lifetime');}
 else if(intent.action.kind==='set_base')keys(intent.action,['kind','value']);
 else if(intent.action.kind==='release')keys(intent.action,['kind']);
 else if(intent.action.kind==='release_gesture')keys(intent.action,['kind','takeover_operation_ref']);
 else throw Error('Unknown native control action');
 const read=nativeDriverRequest(snapshot,capability);validateNativeDriver(snapshot,read,driver);
 need(sameNative(intent.basis,{expression_ref:read.expression_ref,document_revision:read.expected_revision,scene_ref:snapshot.view.bindings[snapshot.sceneId]?.scene_ref})&&sameNative(intent.address,capability.address)&&intent.target===capability.target,'The original control intent changed its native Scene/Registry target');
 need(!!intent.operation_ref&&!!intent.procedure_ref&&!!actor,'Native control needs an original operation, accepted Procedure and actor');
 const definitions=snapshot.view.document.scenes.flatMap(s=>((s.presentation?.scene as {procedural?:{procedures?:Array<{procedure_ref:string;definition?:unknown}>}}|undefined)?.procedural?.procedures??[])).filter(p=>p.procedure_ref===intent.procedure_ref);
 need(definitions.length>0&&definitions.every(p=>p.definition&&sameNative(p.definition,definitions[0].definition)),'The original complete native Procedure is unavailable or differs across Scenes');
 let action:NativeControlAction=clone(intent.action);
 if(action.kind==='set_base'||action.kind==='takeover'){
  need(scalar(action.value)&&action.value>=capability.min&&action.value<=capability.max,'The authored value is outside the actual Registry scalar domain');
  const sceneId=Object.entries(snapshot.view.bindings).find(([,b])=>b.scene_ref===intent.address.scene_ref)?.[0],scene=snapshot.journey.scenes.find(s=>s.id===sceneId),target=scene?automationTarget(scene,intent.target):undefined,entity=scene?.entities.find(e=>e.id===target?.entityId);
  need(entity&&target,'The original authored control Entity is unavailable');
  const candidate=clone(entity),path=target.bind.slice('entity.'.length).split('.');let parent=candidate as unknown as Record<string,unknown>;for(const key of path.slice(0,-1)){need(object(parent[key]),'Actual authored control parent is unavailable');parent=parent[key] as Record<string,unknown>;}parent[path.at(-1)!]=action.value;
  const nativeValue=kernelEntityControlValues(candidate)[read.parameter];need(scalar(nativeValue),'The existing converter did not produce a finite native scalar');action={...action,value:nativeValue};
 }else if(action.kind==='release_gesture')need(!!action.takeover_operation_ref,'Gesture release must retain its actual original takeover operation');
 else need(action.kind==='release','Unknown native control action');
 return {operation:'control',expression_ref:read.expression_ref,expected_revision:read.expected_revision,procedure_ref:intent.procedure_ref,address:clone(read.address),parameter:read.parameter,actor,operation_ref:intent.operation_ref,action};
}
export function validateNativeControlReply(snapshot:StudioSnapshot,intent:StudioNativeControlIntent,request:NativeControlRequest,raw:unknown):NativeControlResult {
 const receipt=raw as NativeControlReply;need(object(receipt),'The native control reply is unknown; retain its original intent and operation');
 need(receipt.schema==='oi.expression-procedural/v1'&&receipt.operation==='control'&&receipt.operation_ref===request.operation_ref&&sameNative(receipt.original_intent,request)&&['document_applied','source_refused','revision_conflict'].includes(receipt.state),'The native control reply differs from its complete original intent');
 need(Array.isArray(receipt.native_procedural_receipts)&&receipt.native_procedural_receipts.length===0,'Native Source control must return the actual known unexchanged field receipt list');
 need(object(receipt.cache),'Native control has no private owner cache provenance');keys(receipt.cache,['provenance','restored','replayed'],['document_sha256']);
 need(typeof receipt.cache.restored==='boolean'&&typeof receipt.cache.replayed==='boolean','Native control cache has no actual restored/replay standing');
 const result:NativeControlResult={intent:clone(intent),request:clone(request),receipt:clone(receipt)};
 if(receipt.state!=='document_applied'){
  need((receipt.native_edit_receipt as {state?:unknown}|undefined)?.state!=='ready','A refused control reply cannot simultaneously acknowledge an applied Edit');
  need(receipt.cache.provenance==='unqualified'&&receipt.cache.restored===true&&receipt.cache.replayed===false,'A refused control cannot grant live cache or replay authority');
  need(receipt.document?.schema==='oi.expression/v1'&&receipt.document.expression_ref===request.expression_ref&&Number.isSafeInteger(receipt.document.revision)&&receipt.document.revision>=request.expected_revision&&typeof receipt.reason==='string'&&receipt.reason.length>0,'The native refusal lost its actual current Document or reason');
  return result;
 }
 need(receipt.restored!==true&&receipt.cache.provenance==='live_native_owner'&&receipt.cache.restored===false&&typeof receipt.cache.document_sha256==='string'&&/^[a-f0-9]{64}$/.test(receipt.cache.document_sha256),'A cold/restored control history cannot authorize replay; retain the original intent for current native source requalification');
 const edit=receipt.native_edit_receipt as {state?:string;document?:KernelExpressionDocument;native_procedural_receipts?:unknown};need(edit?.state==='ready'&&edit.document?.schema==='oi.expression/v1'&&edit.document.expression_ref===request.expression_ref&&edit.document.revision===request.expected_revision+1,'Native control has no exact original+1 actual Edit receipt');
 need(Array.isArray(edit.native_procedural_receipts)&&edit.native_procedural_receipts.length===0,'The actual control Edit receipt must retain its known unexchanged native field standing');
 const view=kernelDocumentToJourney(edit.document,{identity:{expression:snapshot.view.journey.id,scenes:Object.fromEntries(Object.entries(snapshot.view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:snapshot.view.entity_ids},pages:Object.fromEntries(Object.values(snapshot.view.bindings).map(b=>[b.scene_ref,b.page]))});
 need(object(receipt.source)&&receipt.native_parameter_driver,'The applied native control lost its actual Source provenance or reread driver');
 const after={...snapshot,view,journey:view.journey},nextRead:NativeDriverRequest={operation:'read_driver',expression_ref:request.expression_ref,expected_revision:edit.document.revision,address:request.address,parameter:request.parameter};
 result.driver=validateNativeDriver(after,nextRead,receipt.native_parameter_driver);result.view=view;return result;
}

export interface PendingNativeControl {kind:'native-control';intent:StudioNativeControlIntent;request:NativeControlRequest;driver:NativeParameterDriverReading}
export function nativeControlSnapshot(view:KernelConversion,intent:StudioNativeControlIntent):StudioSnapshot {
 const sceneId=Object.entries(view.bindings).find(([,b])=>b.scene_ref===intent.basis.scene_ref)?.[0];need(sceneId,'The original control Scene is absent');return {view,journey:view.journey,sceneId,selected:[]};
}
/** Recovery validates actual model/Registry conversion and the complete original
 * native wire. A saved reading is retained basis, never live Source authority. */
export function validatePendingNativeControl(pending:PendingNativeControl,view:KernelConversion):void {
 need(object(pending),'The retained native control is absent');keys(pending,['kind','intent','request','driver']);need(pending.kind==='native-control','The pending operation is not a native control');
 const snapshot=nativeControlSnapshot(view,pending.intent),sceneId=Object.entries(view.bindings).find(([,b])=>b.scene_ref===pending.intent.address.scene_ref)?.[0];need(sceneId,'The addressed native control Scene is absent');
 const context={expression_ref:view.document.expression_ref,scene_ref:pending.intent.address.scene_ref!,occurrences:Object.fromEntries(view.bindings[sceneId].occurrences.map(o=>[o.view_entity_id,o.entity_ref]))},scene=view.journey.scenes.find(s=>s.id===sceneId)!;
 const capability=controlCapabilities(scene,context).find(c=>c.target===pending.intent.target&&sameNative(c.address,pending.intent.address));need(capability,'The retained native control lost its actual Registry target');
 const expected=nativeControlRequest(snapshot,capability,pending.intent,pending.driver,pending.request.actor);need(sameNative(expected,pending.request),'The retained control wire differs from its complete original authored/native intent');
}
