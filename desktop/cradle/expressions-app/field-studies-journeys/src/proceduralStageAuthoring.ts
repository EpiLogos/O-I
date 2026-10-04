/** Identity-only reads of native authoring intent. These request creators name
 * an actual accepted native Document/Scene; they issue no Source/timing grant. */
import {selectedSceneRequest,type NativeSelectedSceneRequest} from './proceduralSelectedScene';
import type {KernelConversion} from './kernelDocumentBridge';
import type {NativeSceneSource} from './proceduralStageSource';
export type NativeStageAuthorshipRequest=
 | {operation:'source_authorship';request:{selection:NativeSelectedSceneRequest;actor:string}}
 | {operation:'procedure_authorship';request:{selection:NativeSelectedSceneRequest;source_material_fingerprint:string}};
function nativeRef(value:unknown):value is string{return typeof value==='string'&&!!value.trim()&&value.length<=4096&&!/[\u0000-\u001f\u007f]/.test(value);}
export function sourceAuthorshipRequest(view:KernelConversion,sceneId:string,actor:string):Extract<NativeStageAuthorshipRequest,{operation:'source_authorship'}> {
 if(!nativeRef(actor))throw Error('Enter the requesting actor before reading native Source authorship');
 const selection=selectedSceneRequest(view,sceneId);
 if(view.document.selection?.scene_ref!==selection.scene_ref)throw Error('Source authorship must name the actual selected native Scene');
 return {operation:'source_authorship',request:{selection,actor}};
}
export function procedureAuthorshipRequest(view:KernelConversion,source:NativeSceneSource):Extract<NativeStageAuthorshipRequest,{operation:'procedure_authorship'}> {
 const sceneIds=Object.keys(view.bindings).filter(id=>view.bindings[id].scene_ref===source.scene_ref);
 if(sceneIds.length!==1||source.expression_ref!==view.document.expression_ref||source.document_revision!==view.document.revision||!nativeRef(source.material_fingerprint))throw Error('The actual native procedure Source basis is unavailable or changed');
 const selection=selectedSceneRequest(view,sceneIds[0]);
 if(view.document.selection?.scene_ref!==selection.scene_ref)throw Error('Procedure authorship must name the actual selected native Scene');
 return {operation:'procedure_authorship',request:{selection,source_material_fingerprint:source.material_fingerprint}};
}
import {sameNative} from './proceduralProtocol';
import {clone} from './model';
import {validateStageSourceAuthorship,type StageSourceAuthorship} from './proceduralStageBootstrap';
import {validateProcedureAuthorship,type ProcedureAuthorship} from './proceduralStageSource';
export interface NativeAuthorshipOrigin {
 schema:'oi.procedural-authorship-origin/v1';kind:'accepted_original'|'commissioned_draft';
 standing_ref:string|null;policy_ref:string|null;basis:NativeSelectedSceneRequest;
 source:Record<string,unknown>;choices:Record<string,unknown>;editable:true;native_grant:false;
}
export interface NativeAuthorshipReading {
 schema:'oi.expression-procedural-source-authorship/v1'|'oi.expression-procedural-procedure-authorship/v1';
 basis:NativeSelectedSceneRequest;authorship:StageSourceAuthorship|ProcedureAuthorship;
 origin:NativeAuthorshipOrigin;source_context_ref:string|null;
 qualification:'authoring_intent_only';source_current:false;native_procedural_receipts:[];
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
/** Discriminate native read intent from Source/consumer authority before any
 * authored field is loaded. Actual native before/after currentness is producer
 * custody; this receiving fence checks the complete returned basis/provenance. */
export function validateNativeAuthorshipReading(request:NativeStageAuthorshipRequest,raw:unknown,source?:NativeSceneSource):NativeAuthorshipReading {
 if(!object(raw)||!sameNative(raw.basis,request.request.selection)||raw.qualification!=='authoring_intent_only'||raw.source_current!==false||!Array.isArray(raw.native_procedural_receipts)||raw.native_procedural_receipts.length!==0)throw Error('Native authorship reading lacks the exact readonly basis/no-ordinal intent boundary');
 if(raw.schema==='oi.expression-procedural-authorship-refusal/v1'){
  if(raw.operation!==request.operation||raw.state!=='refused'||!nativeRef(raw.reason))throw Error('Native authoring refusal belongs to another original read');
  throw Error(raw.reason);
 }
 const expected=request.operation==='source_authorship'?'oi.expression-procedural-source-authorship/v1':'oi.expression-procedural-procedure-authorship/v1';
 const origin=raw.origin;
 if(raw.schema!==expected||!object(origin)||origin.schema!=='oi.procedural-authorship-origin/v1'||!['accepted_original','commissioned_draft'].includes(String(origin.kind))||!sameNative(origin.basis,request.request.selection)||origin.editable!==true||origin.native_grant!==false||!object(origin.source)||!object(origin.choices))throw Error('Native authoring origin/basis or explicit intent-only standing is unavailable');
 if(origin.kind==='commissioned_draft'&&(origin.standing_ref!=='EpiLogos/QL-MEF#296'||origin.policy_ref!=='ql.ta-onta-commissioned-authoring-intent/v1')||origin.kind==='accepted_original'&&origin.policy_ref!==null)throw Error('Native commissioned/saved authoring provenance is inconsistent');
 if(request.operation==='source_authorship'){
  const authored=validateStageSourceAuthorship(raw.authorship);
  if(raw.source_context_ref!==null||origin.standing_ref!==authored.standing_ref)throw Error('Structural authoring intent misstates its saved/commissioned standing');
  if(origin.kind==='accepted_original'){
   const original=origin.source.original_intent;
   if(!object(original)||!sameNative(original.authorship,authored)||origin.source.requested_actor!==request.request.actor)throw Error('Native saved Source authoring intent/order or original requested actor differs');
  }else if(authored.actor_ref!==request.request.actor||!sameNative(origin.choices.profile,authored.profile))throw Error('Native commissioned Source actor/canonical profile differs from its explicit draft choices');
 }else{
  validateProcedureAuthorship(raw.authorship as ProcedureAuthorship);
  const authored=raw.authorship as ProcedureAuthorship,context=raw.source_context_ref,original=origin.source.original_source;
  if(!nativeRef(context)||origin.source.source_read_receipt_ref!==context||origin.source.source_material_fingerprint!==request.request.source_material_fingerprint||!source||!object(original)||original.schema!=='ql.native-procedural-source-bootstrap/v1'||original.expression_ref!==request.request.selection.expression_ref||original.scene_ref!==request.request.selection.scene_ref||original.document_revision!==request.request.selection.document_revision||original.source_read_receipt_ref!==context||!sameNative(original.native_scene_source,source)||!sameNative(original.authored_cprime,authored.composition)||!sameNative(original.timing,authored.timing))throw Error('Procedure authoring is not bound to the exact current native Source/Cprime/timing context');
 }
 return clone(raw) as unknown as NativeAuthorshipReading;
}
export function nativeAuthorshipDisclosure(reading:NativeAuthorshipReading):string {
 const origin=reading.origin;
 return `${origin.kind==='accepted_original'?'Accepted original authoring intent':'Commissioned editable draft'} · standing ${origin.standing_ref??'unobserved'} · policy ${origin.policy_ref??'original authored choices'} · Document ${reading.basis.document_revision}. Authoring intent only; native Source and consumers remain separately qualified.`;
}
import type {SourceBasis} from './proceduralRetention';
/** Native ReadSource accepts the exact current selected Scene's disclosed
 * source_basis or exact principal.sources. These persisted readings provide
 * profile choices for inspection; they cannot grant a live producer/context. */
export function declaredNativeAuthorshipProfiles(view:KernelConversion,sceneId:string,ownerRows:readonly SourceBasis[]=[]):SourceBasis[] {
 const selection=selectedSceneRequest(view,sceneId),scene=view.document.scenes.find(row=>row.scene_ref===selection.scene_ref)!;
 const retained=(scene.presentation as {scene?:{procedural?:unknown}}|undefined)?.scene?.procedural;
 const rows:unknown[]=[...ownerRows];
 if(retained!==undefined){
  if(!object(retained)||retained.schema!=='oi.expression-procedural/v1'||!Array.isArray(retained.source_basis)||!Array.isArray(retained.bindings))throw Error('Current native Scene Source basis metadata is malformed');
  rows.push(...retained.source_basis);
  const address={expression_ref:selection.expression_ref,scene_ref:selection.scene_ref,entity_ref:null,component:'scene',constituent_ref:null,property:null};
  for(const binding of retained.bindings){if(object(binding)&&sameNative(binding.address,address)&&object(binding.principal)){if(!Array.isArray(binding.principal.sources))throw Error('Current native principal sources are malformed');rows.push(...binding.principal.sources);}}
 }
 const seen=new Map<string,SourceBasis>();
 for(const raw of rows){if(!object(raw)||!nativeRef(raw.ref)||!nativeRef(raw.revision)||!['available','unavailable','withheld','stale'].includes(String(raw.availability)))throw Error('Native declared Source reading is unavailable or malformed');const value=raw as unknown as SourceBasis,key=JSON.stringify([value.ref,value.revision]),previous=seen.get(key);if(previous&&previous.availability!==value.availability)throw Error('Current native Source availability conflicts; re-read its actual owner');if(!previous)seen.set(key,clone(value));}
 return [...seen.values()];
}
