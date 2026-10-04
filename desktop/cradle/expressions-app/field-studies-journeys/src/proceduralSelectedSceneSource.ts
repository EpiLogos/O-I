/** Native World asset retention through the admitted opening's SAME session.
 * Public intent contains selected refs/CAS and actor; the real transaction
 * supplies its lease/ordinal/unchanged FIELD position. No Source grant. */
import {clone} from './model.js';
import {sameSceneData as same} from './sceneCorrespondence.js';
import {validateSelectedSceneRequest,type NativeSelectedSceneRequest} from './proceduralSelectedScene.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import type {NativeDocumentTransactionContext,NativeDocumentTransactionResult} from './native-field/ql/instrument-session.mjs';
export interface NativeSelectedSceneSourceRequest {
 selection:NativeSelectedSceneRequest;lease:string;actor:string;
 expected_request_id:string;expected_generation:string;expected_samples_elapsed:string;
}
export interface PendingNativeSelectedSceneSource {
 kind:'native-selected-scene-source';selection:NativeSelectedSceneRequest;actor:string;
 request?:NativeSelectedSceneSourceRequest;context?:NativeDocumentTransactionContext;
 native_reply?:unknown;recovery_reply?:unknown;
}
export type SelectedSceneSourceCapture=(request:NativeSelectedSceneSourceRequest,context:NativeDocumentTransactionContext)=>Promise<void>;
export type SelectedSceneSourcePort=(selection:NativeSelectedSceneRequest,actor:string,capture:SelectedSceneSourceCapture,receive:(reply:unknown)=>Promise<void>,original?:{request:NativeSelectedSceneSourceRequest;context:NativeDocumentTransactionContext})=>Promise<unknown>;
export type SelectedSceneSourceReply=NativeDocumentTransactionResult&Record<string,any>;
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=4096&&!/[\u0000-\u001f\u007f]/.test(v);
const u64=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<(1n<<64n);
const need=(v:unknown,why:string):void=>{if(!v)throw Error('selected native source: '+why);};
export function validateSelectedSourceContext(raw:unknown):NativeDocumentTransactionContext {
 const c=raw as NativeDocumentTransactionContext;
 need(object(c)&&c.schema==='ql.native-document-transaction/v1'&&[c.instance_ref,c.event_ref,c.subject_ref].every(text)&&[c.last_request_id,c.next_request_id,c.expected_generation,c.expected_samples_elapsed].every(u64)&&BigInt(c.next_request_id)===BigInt(c.last_request_id)+1n,'actual SAME-session transaction identity/next ordinal is required');return clone(c);
}
export function selectedSceneSourceRequest(selection:NativeSelectedSceneRequest,actor:string,lease:string,context:NativeDocumentTransactionContext):NativeSelectedSceneSourceRequest {
 const c=validateSelectedSourceContext(context);need(text(actor)&&text(lease),'original actor and actual admitted lease required');
 return {selection:clone(selection),actor,lease,expected_request_id:c.next_request_id,expected_generation:c.expected_generation,expected_samples_elapsed:c.expected_samples_elapsed};
}
export function validatePendingSelectedSource(raw:unknown,view:KernelConversion):PendingNativeSelectedSceneSource {
 const p=raw as PendingNativeSelectedSceneSource;
 need(object(p)&&p.kind==='native-selected-scene-source'&&Object.keys(p).every(k=>['kind','selection','actor','request','context','native_reply','recovery_reply'].includes(k))&&text(p.actor),'complete original source intent required');validateSelectedSceneRequest(p.selection,view);
 need(!!p.request===!!p.context,'request and actual original transaction context must remain paired');
 if(p.request&&p.context)need(same(p.request,selectedSceneSourceRequest(p.selection,p.actor,p.request.lease,p.context)),'saved request differs from its original SAME-session context');
 return clone(p); // Restored bytes disclose uncertainty; never grant a lease.
}
/** Validate only receipt routing before the real Session processes full FIELD
 * state/source/PCM. A missing original ACK must make that owner uncertain. */
export function selectedSourceOrderedResult(raw:unknown,request:NativeSelectedSceneSourceRequest,context:NativeDocumentTransactionContext):SelectedSceneSourceReply {
 const c=validateSelectedSourceContext(context),r=raw as Record<string,any>,n=r?.native_result,ack=n?.host_receipt;
 need(object(r)&&r.schema==='oi.native-expression-selected-scene-source/v1'&&same(r.original_request,request)&&r.lease===request.lease&&r.replayed===false,'native result omitted its complete original source request');
 need(r.recovered===false||(r.recovered===true&&r.recovery_current===true&&r.recovery_currentness===null),'historical source recovery cannot account an original consumed ordinal');
 need(r.native_ordered_receipt_pending===false,'consumed native source ordinal is unknown; retain the original request and actual owner for qualified recovery');
 need(object(n)&&n.schema==='ql.native-act-owner-result/v1'&&n.available===true&&n.instance_ref===c.instance_ref&&n.request_id===request.expected_request_id&&n.last_request_id===request.expected_request_id,'actual Act result/ordinal differs from the original SAME-session request');
 need(object(ack)&&ack.schema==='ql.field-host-receipt/v1'&&ack.available===true&&ack.instance_ref===c.instance_ref&&ack.request_id===request.expected_request_id&&ack.last_request_id===request.expected_request_id&&ack.status===n.status&&['ok','refused'].includes(ack.status),'actual same-operation FieldHost receipt is absent or foreign');
 need(object(ack.field)&&ack.field.event_ref===c.event_ref&&ack.field.subject_ref===c.subject_ref&&ack.field.generation===request.expected_generation&&ack.field.samples_elapsed===request.expected_samples_elapsed&&same(ack.field.audio,[]),'source observation changed FIELD identity/position or replayed PCM');
 need(Array.isArray(r.native_procedural_receipts)&&r.native_procedural_receipts.length===1&&same(r.native_procedural_receipts[0],ack),'native receipt list differs from original actual Host receipt');
 return r as SelectedSceneSourceReply;
}
/** This exact native endpoint is a pure original-outcome lookup. Historical
 * receipt bytes remain diagnostic; no original ACK is sent to Session again. */
export function selectedSourceLookupResult(raw:unknown,request:NativeSelectedSceneSourceRequest):SelectedSceneSourceReply {
 const r=raw as Record<string,any>;
 need(object(r)&&r.schema==='oi.native-expression-selected-scene-source/v1'&&same(r.original_request,request)&&r.lease===request.lease&&r.replayed===false&&r.recovered===true&&typeof r.recovery_current==='boolean'&&(r.recovery_currentness===null||typeof r.recovery_currentness==='string')&&typeof r.native_ordered_receipt_pending==='boolean'&&Array.isArray(r.native_procedural_receipts)&&r.native_procedural_receipts.length<=1&&object(r.native_result),'native original-outcome lookup omitted its exact retained request/result');
 return r as SelectedSceneSourceReply; // Original evidence only; Working fences current adoption separately.
}
/** Complete native Document delta discrimination. Native codec owns source
 * compression/digest; the frontend preserves its original bytes without a
 * duplicate encoder or reinterpretation of immutable sample coordinates. */
export function selectedSourceReplyView(view:KernelConversion,request:NativeSelectedSceneSourceRequest,raw:unknown,actual:KernelExpressionDocument,recover=false):KernelConversion {
 validateSelectedSceneRequest(request.selection,view);
 const r=raw as Record<string,any>;
 need(object(r)&&r.schema==='oi.native-expression-selected-scene-source/v1'&&same(r.original_request,request)&&r.lease===request.lease&&r.replayed===false,'native source reply names a different original request');
 need(recover?r.recovered===true&&r.recovery_current===true&&r.recovery_currentness===null:r.recovered===false,'recovery is historical or its actual same owner/current Document changed');
 need(r.source_current===true&&r.source_currentness===null&&r.qualification==='pending_source_bootstrap'&&r.native_ordered_receipt_pending===false,'actual source retention refused; original complete result remains retained and has no Source grant');
 const result=r.document_result,doc=result?.document;
 need(object(result)&&result.state==='ready'&&object(doc)&&same(doc,actual)&&Array.isArray(r.document_receipts),'actual native Application document receipt/current inspect or normal Kernel event receipts differ');
 const carriers=view.document.scenes.filter(s=>object((s.presentation as any)?.scene?.epiWorld));need(carriers.length===1,'original full Document has no unique World carrier');
 const origin=carriers[0],expected=clone(view.document),carrier=expected.scenes.find(s=>s.scene_ref===origin.scene_ref)!;
 const returned=doc.scenes?.find((s:Record<string,any>)=>s.scene_ref===origin.scene_ref),asset=returned?.native_field_source,native=r.native_result?.result?.native_field_source;
 need(object(native)&&native.schema==='ql.native-held-field-source/v1'&&native.instance_ref===r.native_result.instance_ref&&same(native.original_basis,(origin.presentation as any).scene.epiWorld.world.basis)&&same(native.current_basis,native.original_basis),'actual full original native FIELD source/basis differs');
 need(object(asset)&&asset.schema==='oi.expression-native-field-source/v1'&&asset.instance_ref===native.instance_ref&&typeof asset.canonical_source_sha256==='string'&&/^sha256:[a-f0-9]{64}$/.test(asset.canonical_source_sha256)&&Number.isSafeInteger(asset.sample_count)&&asset.sample_count>0&&asset.sample_count===native.original_field?.samples?.length,'actual native FIELD asset identity/sample correspondence differs');
 if(origin.native_field_source!=null)need(same(origin.native_field_source,asset),'existing continuing World asset cannot be replaced by an initial observation');
 const changed=!same(origin.native_field_source,asset);carrier.native_field_source=clone(asset);
 if(changed){need(r.document_receipts.length>0,'actual changed asset edit omitted its normal Kernel event receipts');expected.revision++;carrier.revision=expected.revision;}else need(r.document_receipts.length===0,'unchanged asset emitted another native edit event');
 need(same(expected,doc),'source retention changed other material/identity/selection or violated exact one-CAS native delta');
 const coordinates=(s:typeof origin)=>({expression_ref:expected.expression_ref,document_revision:expected.revision,scene_ref:s.scene_ref,scene_revision:s.revision});
 need(same(r.selected_scene,coordinates(expected.scenes.find(s=>s.scene_ref===request.selection.scene_ref)!))&&same(r.world_source_scene,coordinates(carrier)),'returned selected/origin Scene coordinates differ from actual Application document');
 return kernelDocumentToJourney(doc,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});
}

/** Existing immutable native asset availability, not a live Source grant. */
export function selectedSourceAssetPresent(view:KernelConversion):boolean {
 const carriers=view.document.scenes.filter(s=>object((s.presentation as any)?.scene?.epiWorld));
 if(carriers.length!==1)return false;
 const asset=carriers[0].native_field_source;
 return object(asset)&&asset.schema==='oi.expression-native-field-source/v1'&&text(asset.instance_ref)&&typeof asset.canonical_source_sha256==='string'&&/^sha256:[a-f0-9]{64}$/.test(asset.canonical_source_sha256)&&Number.isSafeInteger(asset.sample_count)&&asset.sample_count>0;
}
