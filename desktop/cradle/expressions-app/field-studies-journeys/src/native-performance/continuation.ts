import type {RetainedPerformanceAct} from './retainedAct.js';
import {readPerformance,readTransportAcknowledgement,type NativePerformanceReading} from './protocol.js';
const need=(ok:unknown,reason:string):void=>{if(!ok)throw Error(reason);};
const object=(value:unknown):Record<string,any>=>{need(value&&typeof value==='object'&&!Array.isArray(value),'The original native continuation object is absent.');return value as Record<string,any>;};
/** Order-independent comparison of copied native JSON. This grants no lease,
 * source authority or checkpoint import; the private native Act reader does. */
export function sameNativeContinuationJson(a:any,b:any):boolean{
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>sameNativeContinuationJson(value,b[index]));
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&sameNativeContinuationJson(a[key],b[key]));
}
const wire=(value:unknown)=>{need(typeof value==='string'&&value.length>0&&value.length<=64*1024*1024,'The complete original native checkpoint exceeds its existing host bound.');return object(JSON.parse(value as string));};
/** Qualify the SAME completed C47 native result. Complete source/checkpoint
 * originals remain in controller custody; no extra Inspect or Begin occurs. */
export function readNativeActContinuation(result:any,performanceReply:any,selected:RetainedPerformanceAct,transaction_ref:string){
 need(result?.schema==='oi.native-scene-recording-result/v1'&&result.accepted===true&&Object.prototype.hasOwnProperty.call(result.currentness??{},'Ok')&&result.application?.Ok?.data?.document,'The original native continuation did not commit its current Scene.');
 const native=object(result.native_reply),returned=object(native.result),evidence=object(returned.selection),selection=selected.selection;
 need(native.schema==='ql.native-act-owner-result/v1'&&native.available===true&&native.status==='ok'&&returned.readmitted===true&&returned.error===null,'The selected native Act was not actually readmitted.');
 need(evidence.schema==='ql.native-act-source-lease-evidence/v1'&&evidence.source_custody==='recorded-act'&&evidence.act_ref===selected.act_ref&&evidence.act_revision===selection.expected_act_revision&&evidence.edition_position===selection.edition_position&&evidence.expression_ref===selected.document.expression_ref&&evidence.expression_revision===selection.expected_expression_revision&&evidence.scene_ref===selection.scene_ref&&evidence.scene_revision===selection.expected_scene_revision&&evidence.performance_digest===selection.performance_digest,'The original native readmission belongs to another Act edition or current Document.');
 const scene=selected.document.scenes.find(row=>row.scene_ref===selection.scene_ref),performance=object(scene?.performance),checkpoint=object(performance.checkpoints?.[selected.checkpoint_index]);
 need(checkpoint.management&&checkpoint.acknowledged_stopped===true,'The selected saved checkpoint lost its complete stopped input custody.');
 const readmission=object(returned.receiving_readmission),pulse=object(returned.native_pulse);
 need(readmission.schema==='ql.native-receiving-readmission/v1'&&pulse.operation==='restore-current-receiving'&&pulse.accepted===true&&sameNativeContinuationJson(pulse.payload?.receiving_readmission,readmission),'The original native receiving pulse/source return is disconnected.');
 const original=wire(readmission.original_checkpoint_wire),operative=wire(readmission.operative_checkpoint_wire),before=wire(readmission.before_checkpoint_wire),after=wire(readmission.after_checkpoint_wire);
 const saved={...checkpoint.management,native_pair:{schema:'ql.performance-physical-checkpoint/v1',audio:checkpoint.audio,physical:checkpoint.physical}};
 need(sameNativeContinuationJson(original,saved),'The actual native restore did not retain the complete selected saved checkpoint.');
 need(performanceReply?.schema==='ql.performance-management-reply/v1'&&performanceReply.operation==='performance-continue-act'&&performanceReply.accepted===true&&performanceReply.refusal===null&&sameNativeContinuationJson(performanceReply.reading,pulse.reading),'The controller continuation reply replaced its original native readback.');
 const transition=readTransportAcknowledgement(performanceReply.transport_transition);need(transition,'The actual native continuation omitted its transport acknowledgement.');
 need(sameNativeContinuationJson(transition,readmission.transport_ack)&&sameNativeContinuationJson(transition,pulse.payload?.transport_ack)&&transition!.transaction_ref===transaction_ref&&transition!.checkpoint_ref===checkpoint.checkpoint_ref&&transition!.target_sample===checkpoint.sample,'The actual transport acknowledgement differs from the selected restore.');
 need(transition!.previous_epoch===before.transport_epoch&&transition!.previous_cursor===before.native_pair?.audio?.cursor&&transition!.previous_sequence===before.native_pair?.audio?.accepted_sequence&&transition!.epoch===after.transport_epoch&&transition!.target_sample===after.native_pair?.audio?.cursor&&transition!.accepted_sequence===after.native_pair?.audio?.accepted_sequence,'The native acknowledgement differs from its complete before/after checkpoints.');
 const reading:NativePerformanceReading=readPerformance(performanceReply.reading,undefined,transition);
 need(reading.device.state!=='running'&&reading.available&&reading.session_ref===after.session_ref,'The restored native owner is not stopped and available.');
 const sourceSelection=object(returned.retained_source_selection),keys=['schema','expression_ref','scene_ref','checkpoint_ref','source_index','basis_index','basis_digest','identity','source_reading','source_sample'];
 need(Object.keys(sourceSelection).length===keys.length&&keys.every(key=>Object.hasOwn(sourceSelection,key))&&sourceSelection.schema==='ql.native-retained-performance-source-selection/v1'&&sourceSelection.expression_ref===selected.document.expression_ref&&sourceSelection.scene_ref===selection.scene_ref&&sourceSelection.checkpoint_ref===checkpoint.checkpoint_ref,'The original native continuation omitted its exact saved source epoch.');
 const sourceIndex=sourceSelection.source_index,basis=sourceSelection.basis_index;
 need(Number.isSafeInteger(sourceIndex)&&sourceIndex>=0&&Number.isSafeInteger(basis)&&basis>=0&&basis<=65535&&Array.isArray(performance.native_sources)&&Array.isArray(performance.bases),'The original restored source/basis indices are invalid.');
 const asset=object(performance.native_sources[sourceIndex]),retainedBasis=object(performance.bases[basis]);
 need(performance.native_sources.filter((row:any)=>sameNativeContinuationJson(row,asset)).length===1&&performance.bases.filter((row:any)=>row.content_digest===asset.basis_digest).length===1&&sourceSelection.basis_digest===asset.basis_digest&&asset.basis_digest===checkpoint.basis_digest&&retainedBasis.content_digest===asset.basis_digest&&sameNativeContinuationJson(sourceSelection.identity,asset.identity)&&sameNativeContinuationJson(retainedBasis.identity,asset.identity)&&sameNativeContinuationJson(checkpoint.identity,asset.identity),'The restored full source asset lost its unique saved musical basis/identity.');
 const sourceReading=sourceSelection.source_reading;
 need(sourceReading?.availability==='available'&&sourceReading.revision==='oi.expression-performance-source-asset/v1'&&typeof sourceReading.ref==='string'&&/^sha256:[0-9a-f]{64}$/.test(sourceReading.ref)&&typeof sourceSelection.source_sample==='string'&&/^(0|[1-9][0-9]*)$/.test(sourceSelection.source_sample)&&sourceSelection.source_sample===asset.native_bundle?.current_receiving?.native_admission?.operation?.native_sample,'The original native source-part reading/date is unavailable.');
 // The native C reader verifies the complete part hash and both source histories.
 // This copied reading identifies that returned part; it grants no live owner.
 const adopted=result.application.Ok.data.document,adoptedScene=adopted.scenes?.find((row:any)=>row.scene_ref===selection.scene_ref);
 need(adopted.expression_ref===selected.document.expression_ref&&sameNativeContinuationJson(adoptedScene?.performance?.native_sources?.[sourceIndex],asset)&&sameNativeContinuationJson(adoptedScene?.performance?.bases?.[basis],retainedBasis),'The original continuation Document changed its selected full source asset/basis.');
 const body=retainedBasis.prepared_body;
 need(body&&reading.scope.preparation_ref===body.request?.preparation_ref&&reading.scope.state_ref===body.request?.state_ref&&reading.scope.body_revision===String(body.request?.body_revision)&&reading.physical.source_generation===String(body.source_generation)&&readmission.current_receiving?.schema==='ql.current-performance-receiving/v1','The operative cold native body/source differs from its selected saved asset.');
 const configuration=asset.native_bundle?.acoustic_receiving?.packet?.configuration;
 need(configuration?sameNativeContinuationJson(asset.native_bundle.acoustic_receiving.packet,readmission.original_saved_acoustic):!Object.hasOwn(readmission,'original_saved_acoustic'),'The original saved receiver configuration was changed or invented during readmission.');
 const retainedSource={asset:structuredClone(asset),selection:structuredClone(sourceSelection),current_receiving:structuredClone(readmission.current_receiving),original_saved_acoustic:readmission.original_saved_acoustic?structuredClone(readmission.original_saved_acoustic):null};
 return{reading,transition:transition!,basis,original,operative,before,after,retainedSource};
}
