/** Selected current native Scene opening. Public input is four refs/CAS only.
 * A returned constructor is evidence from the Kernel, never a browser grant.
 * The existing controller/Session still admits its actual native opening. */
import {clone} from './model';
import {sameSceneData} from './sceneCorrespondence';
import type {KernelConversion,KernelExpressionDocument} from './kernelDocumentBridge';

export interface NativeSelectedSceneRequest {expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number;}
export type SelectedSceneCommand='open_selected_scene'|'recover_selected_scene'|'abandon_selected_scene';
export interface PendingNativeSelectedScene {kind:'native-selected-scene-open';request:NativeSelectedSceneRequest;native_reply?:unknown;recovery_reply?:unknown;abandonment_reply?:unknown;}
export type SelectedSceneOpening=Record<string,unknown>&{schema:'oi.native-expression-open/v1';lease:string;selected_scene:NativeSelectedSceneRequest;source_current:true;qualification:'pending_source_bootstrap';};
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=4096;
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const need=(value:unknown,reason:string):void=>{if(!value)throw Error('selected native Scene: '+reason);};
const same=sameSceneData;
export function selectedSceneRequest(view:KernelConversion,sceneId:string):NativeSelectedSceneRequest {
 const binding=view.bindings[sceneId],document=view.document;
 need(binding&&document.selection?.scene_ref===binding.scene_ref,'select the exact current native Scene before opening its retained World');
 const rows=document.scenes.filter(scene=>scene.scene_ref===binding.scene_ref);
 need(rows.length===1,'the selected native Scene is absent or ambiguous');
 const request={expression_ref:document.expression_ref,document_revision:document.revision,scene_ref:rows[0].scene_ref,scene_revision:Number(rows[0].revision)};
 validateSelectedSceneRequest(request,view);return clone(request);
}
export function validateSelectedSceneRequest(raw:unknown,view:KernelConversion):NativeSelectedSceneRequest {
 const value=raw as NativeSelectedSceneRequest;
 need(object(value)&&same(Object.keys(value).sort(),['document_revision','expression_ref','scene_ref','scene_revision']),'only original Expression/Document/Scene revisions are accepted; no world, graph or constructor input');
 need(text(value.expression_ref)&&text(value.scene_ref)&&Number.isSafeInteger(value.document_revision)&&value.document_revision>0&&Number.isSafeInteger(value.scene_revision)&&value.scene_revision>0&&value.scene_revision<=value.document_revision,'actual original Document/Scene CAS is required');
 const doc=view.document,rows=doc.scenes.filter(scene=>scene.scene_ref===value.scene_ref);
 need(value.expression_ref===doc.expression_ref&&value.document_revision===doc.revision&&rows.length===1&&rows[0].revision===value.scene_revision&&doc.selection?.scene_ref===value.scene_ref,'the original selected native Document/Scene/CAS changed');
 return clone(value);
}
/** Read-only disclosure. The native Kernel alone locates/qualifies the actual
 * source carrier in the complete Document and recreates its original World. */
export function selectedSceneSourceReason(view:KernelConversion,sceneId:string):string|null {
 try {
  selectedSceneRequest(view,sceneId);
  const carriers=view.document.scenes.filter(scene=>object(scene.presentation)&&object((scene.presentation as any).scene?.epiWorld));
  need(carriers.length===1,'the complete native Document requires one actual retained World source; refresh its native source owner');
  const material=(carriers[0].presentation as any).scene.epiWorld,source=material.native_source;
  need(material.schema==='oi.epi-world-material/v1'&&material.world?.schema==='oi.epi-portable-world/v1'&&source?.schema==='oi.native-expression-composed-source/v1','the retained native World/source schema is incomplete');
  need(typeof source.constructor_request_bytes==='string'&&source.constructor_request_bytes.length>0,'the retained World lacks exact native constructor bytes; refresh its original source owner');
  const original=JSON.parse(source.constructor_request_bytes);
  need(object(original)&&original.schema==='ql.scene-world-request/v1'&&same(original,source.constructor_request),'the original native constructor bytes and saved constituents differ');
  need(original.instance_ref===view.document.expression_ref&&digest(source.request_sha256)&&digest(source.binding_sha256)&&digest(source.ql_executable_sha256),'the saved native provider/World qualification is incomplete');
  return null;
 }catch(error){return error instanceof Error?error.message:String(error);}
}
export function validatePendingSelectedScene(raw:unknown,view:KernelConversion):PendingNativeSelectedScene {
 const value=raw as PendingNativeSelectedScene;
 need(object(value)&&value.kind==='native-selected-scene-open'&&Object.keys(value).every(key=>['kind','request','native_reply','recovery_reply','abandonment_reply'].includes(key)),'retained opening must preserve its complete original request');
 validateSelectedSceneRequest(value.request,view);
 // Retained replies are diagnostic only. A restored checkpoint never grants
 // a lease or feeds an old host ACK into the Session.
 return clone(value);
}
function currentSceneRead(raw:unknown,request:NativeSelectedSceneRequest,document:KernelExpressionDocument):Record<string,any> {
 need(object(raw)&&raw.schema==='oi.expression-native-current-scene-delivery/v1'&&raw.expression_ref===request.expression_ref&&raw.expression_revision===request.document_revision&&raw.scene_ref===request.scene_ref&&raw.scene_revision===request.scene_revision,'the actual current native Scene reader did not return the original full Document/Scene');
 const row=raw as Record<string,any>;
 need(typeof row.canonical_document_bytes==='string'&&typeof row.canonical_scene_bytes==='string'&&digest(row.expanded_document_sha256)&&digest(row.selected_scene_sha256),'the original native canonical source delivery is incomplete');
 const scene=document.scenes.find(scene=>scene.scene_ref===request.scene_ref)!;
 need(same(JSON.parse(row.canonical_document_bytes),document)&&same(JSON.parse(row.canonical_scene_bytes),scene)&&same(row.scene,scene),'the returned full native source Document/Scene differs from its original accepted basis');
 return row;
}
export function validateSelectedSceneOpen(raw:unknown,request:NativeSelectedSceneRequest,view:KernelConversion):SelectedSceneOpening {
 validateSelectedSceneRequest(request,view);
 need(object(raw)&&raw.schema==='oi.native-expression-open/v1'&&text(raw.lease)&&same(raw.selected_scene,request),'the native opening does not name this exact original selected Scene request/lease');
 const reply=raw as Record<string,any>;
 need(reply.source_current===true&&reply.source_currentness===null&&reply.qualification==='pending_source_bootstrap'&&reply.bootstrap===null&&reply.native_source_channel===null,'native World opening is not current or was mistaken for a procedural Source grant');
 const reading=currentSceneRead(reply.source_read_receipt,request,view.document),constructor=reply.native_scene_constructor;
 need(object(constructor)&&constructor.schema==='oi.native-document-scene-constructor/v1'&&constructor.expression_ref===request.expression_ref&&constructor.scene_ref===request.scene_ref&&constructor.document_revision===request.document_revision&&constructor.document_sha256===reading.expanded_document_sha256&&text(constructor.instance_ref)&&Number.isSafeInteger(constructor.construction_generation)&&constructor.construction_generation>0&&constructor.generation_domain==='native-document-scene-construction','the genuine native Scene constructor differs from its full current source reading');
 const carriers=view.document.scenes.filter(scene=>object((scene.presentation as any)?.scene?.epiWorld));
 need(carriers.length===1,'the original full Document has no unique retained native World source');
 const origin=carriers[0];
 need(same(reply.world_source_scene,{expression_ref:request.expression_ref,document_revision:request.document_revision,scene_ref:origin.scene_ref,scene_revision:origin.revision}),'the native World source origin differs from its actual containing Scene in this complete Document');
 const saved=(origin.presentation as any).scene.epiWorld,source=reply.source;
 need(saved.receiving?.scene_ref===origin.scene_ref,'the retained native World is not qualified by its actual containing Scene');
 need(object(source)&&source.schema==='oi.native-expression-composed-source/v1','the actual opening omitted its original native composed source');
 for(const key of ['constructor_request','constructor_request_bytes','request_sha256','binding_sha256','ql_executable_sha256','ql_selection','ql_revision','sky'])
  need(same(source[key],saved.native_source[key]),'the original native composed source/provider changed: '+key);
 const original=JSON.parse(saved.native_source.constructor_request_bytes);
 need(reply.receipt?.instance_ref===original.instance_ref&&reply.receipt?.field?.subject_ref===original.subject_ref&&reply.receipt?.field?.event_ref===original.event_ref,'the actual opened subject/occasion differs from the retained original World');
 // Complete FIELD receipt/topology/PCM admission belongs to InstrumentSession.
 return clone(reply) as SelectedSceneOpening;
}
export function validateSelectedSceneRecovery(raw:unknown,request:NativeSelectedSceneRequest,view:KernelConversion):SelectedSceneOpening {
 need(object(raw)&&raw.schema==='oi.native-expression-selected-scene-recovery/v1'&&raw.replayed===false&&raw.recoverable===true&&raw.source_current===true&&raw.source_currentness===null&&raw.reason===null,'the native owner has no current unconsumed original opening to recover; full intent remains retained');
 return validateSelectedSceneOpen((raw as Record<string,unknown>).original_open,request,view);
}
export function validateSelectedSceneAbandonment(raw:unknown,request:NativeSelectedSceneRequest):void {
 need(object(raw)&&raw.schema==='oi.native-expression-closed/v1'&&text(raw.lease)&&raw.closed===true&&raw.abandoned===true&&same(raw.original_selected_scene,request),'only an actual closed receipt for this exact original native opening permits abandonment');
}
