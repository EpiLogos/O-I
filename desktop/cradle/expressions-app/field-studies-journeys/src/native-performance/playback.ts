import {readNativeCapture} from './nativeCapture.js';
import {readLiveTemporalProgress,readSourceApplication,temporalKeys,temporalDecimal} from './temporalCapture.js';
import type {RetainedPerformanceAct} from './retainedAct.js';
import type {NativeRecordingCas} from './sceneRecording.js';
import {counter,readPerformance,readTransportAcknowledgement,type NativePerformanceReading} from './protocol.js';
export interface NativeScorePlaybackRange {from_sample:string;to_sample:string;checkpoint_index:number}
export interface NativeScorePlaybackSnapshot {
 expression_ref:string;scene_ref:string;available:boolean;running:boolean;device_started:boolean;first_current_pending:boolean;reason:string|null;
 duration_samples:string;sample_rate:number;programme_ref:string|null;can_export:boolean;export_file:string|null;
 checkpoints:{index:number;checkpoint_ref:string;sample:string;stopped:boolean}[];
}
export interface NativeScorePlaybackPort {
 snapshot():NativeScorePlaybackSnapshot|null;subscribe(listener:()=>void):()=>void;
 play(range:NativeScorePlaybackRange):Promise<unknown>;render(range:NativeScorePlaybackRange):Promise<unknown>;stop():Promise<void>;custody():unknown;renderCustody():unknown;
}
const need=(ok:unknown,reason:string):void=>{if(!ok)throw Error(reason);};
const object=(v:unknown):Record<string,any>=>{need(v!==null&&typeof v==='object'&&!Array.isArray(v),'The actual native score playback object is absent.');return v as Record<string,any>;};
/** A comparison of original native evidence, including signed zero. It creates
 * no Source, programme, currentness, clock or receiving authority. */
export function sameNativePlaybackJson(a:any,b:any):boolean {
 if(Object.is(a,b))return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameNativePlaybackJson(v,b[i]));
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameNativePlaybackJson(a[k],b[k]));
}
export function readPlaybackRange(range:NativeScorePlaybackRange,duration:string):NativeScorePlaybackRange {
 need(Object.keys(object(range)).sort().join(',')==='checkpoint_index,from_sample,to_sample','Only a score range and an actual selected stopped cut are authored.');
 counter(range.from_sample);counter(range.to_sample);counter(duration);
 need(BigInt(range.from_sample)<BigInt(range.to_sample)&&BigInt(range.to_sample)<=BigInt(duration)&&Number.isSafeInteger(range.checkpoint_index)&&range.checkpoint_index>=0,'Choose a nonempty range within this score and an actual retained cut.');
 return {...range};
}
/** Descriptor projection of the actual C63-qualified fsynced originals.
 * Native C validates every full original file; these exact zero-index rows
 * preserve its causal cohort and never issue source/restoration authority. */
export function requireNativeProgrammeOriginalCohort(files:any,mode:'playback'|'edited-render'){
 const rows=files.files;need(Array.isArray(rows),'The genuine native programme file cohort is absent.');
 const one=(kind:string)=>{const found=rows.filter((row:any)=>row.descriptor.kind===kind);need(found.length===1&&found[0].descriptor.original_index==='0','The actual original programme file is lost, repeated or relabelled: '+kind);counter(found[0].descriptor.receipt_ordinal);return BigInt(found[0].descriptor.receipt_ordinal);};
 const request=one('playback.programme.original_request'),admission=one('playback.programme.admission'),stopped=one('playback.programme.stopped_prepare');
 need(request<admission&&admission<stopped,'The original request/admission/stopped programme files changed causal order.');
 if(mode==='playback')need(stopped<one('playback.device.start'),'The actual DeviceStart preceded its installed stopped programme.');
 else need(!rows.some((row:any)=>row.descriptor.kind==='playback.device.start'),'Stopped export acquired an unowned live DeviceStart original.');
 const prior=['playback.prior_before_resident_restoration','playback.prior_resident_restoration_original_request','playback.prior_resident_restoration'];
 if(rows.some((row:any)=>prior.includes(row.descriptor.kind))){const before=one(prior[0]),intent=one(prior[1]),after=one(prior[2]);need(before<intent&&intent<after&&after<request,'Prior restitution originals are incomplete or detached from the actual new programme.');}
}

/** Qualify the original C63 result. Native C remains the full selected Act,
 * Scene constructor, source-history and programme authority. The browser never
 * substitutes an ordinary DeviceStart, saved label or immutable origin basis. */
export function readNativeActPlayback(result:any,performanceReply:any,selected:RetainedPerformanceAct,
 range:NativeScorePlaybackRange,cas:NativeRecordingCas,requestId:string,transactionRef:string){
 counter(requestId);need(BigInt(requestId)>0n,'The original native playback ordinal is absent.');
 need(result?.schema==='oi.native-scene-recording-result/v1'&&result.accepted===true&&Object.hasOwn(result.currentness??{},'Ok')&&Object.hasOwn(result.application??{},'Ok')&&result.application.Ok===null,'The actual current Scene did not admit score playback.');
 const native=object(result.native_reply),returned=object(native.result),selection=object(returned.selection),chosen=selected.selection;
 need(native.schema==='ql.native-act-owner-result/v1'&&native.available===true&&native.status==='ok'&&returned.playback_started===true,'The actual native score programme did not start.');
 need(native.request_id===requestId&&native.last_request_id===requestId&&selection.native_request_id===requestId&&selection.act_ref===selected.act_ref&&selection.act_revision===chosen.expected_act_revision&&selection.edition_position===chosen.edition_position&&selection.scene_ref===cas.scene_ref&&selection.scene_revision===cas.scene_revision&&selection.performance_digest===chosen.performance_digest,'The original playback acknowledgement belongs to another Act, cut or native ordinal.');
 need(selected.document.expression_ref===cas.expression_ref&&selected.document.revision===cas.document_revision&&chosen.expected_expression_revision===cas.document_revision&&chosen.expected_scene_revision===cas.scene_revision,'The selected actual Edition differs from the current Document.');
 const scene=selected.document.scenes.find(s=>s.scene_ref===cas.scene_ref),score=object(scene?.performance),checkpoint=object(score.checkpoints?.[range.checkpoint_index]),plan=object(returned.original_plan);
 need(scene?.revision===cas.scene_revision&&checkpoint.acknowledged_stopped===true&&plan.schema==='oi.native-retained-act-playback-plan/v1'&&plan.expression_ref===cas.expression_ref&&plan.scene_ref===cas.scene_ref&&plan.performance_digest===chosen.performance_digest&&plan.from_sample===range.from_sample&&plan.to_sample===range.to_sample&&plan.checkpoint_index===range.checkpoint_index&&plan.checkpoint_ref===checkpoint.checkpoint_ref&&plan.checkpoint_digest===checkpoint.content_digest&&plan.reconstruction_sample===checkpoint.sample,'The native programme replaced its actual retained range or stopped cut.');
 const pulse=object(returned.native_pulse),host=object(returned.host_receipt),programme=temporalKeys(returned.native_programme_admission,['schema','operation','session_ref','transport_epoch','preparation_cursor','origin_sample','sample_rate','programme_ref','origin_native_basis','origin_source_packet','preparation_source_index','preparation_source_ref','preparation_native_basis','preparation_source_packet','origin_physical_eigenbasis','origin_receiving','epochs','steps','maximum_callback_frames','configured_device_buffer_frames','maximum_normal_pulse_bytes']);
 need(host.schema==='ql.field-host-receipt/v1'&&host.request_id===requestId&&host.last_request_id===requestId&&sameNativePlaybackJson(host.performance,performanceReply)&&performanceReply?.schema==='ql.performance-management-reply/v1'&&performanceReply.operation==='performance-playback'&&performanceReply.accepted===true&&sameNativePlaybackJson(performanceReply.native_pulse,pulse)&&sameNativePlaybackJson(performanceReply.reading,pulse.reading)&&pulse.operation==='device-start'&&pulse.accepted===true,'Play requires the original same-ordinal programme and actual DeviceStart acknowledgement.');
 const transition=readTransportAcknowledgement(performanceReply.transport_transition);
 if(transition)need(transition.transaction_ref===transactionRef&&transition.checkpoint_ref===checkpoint.checkpoint_ref&&transition.target_sample===checkpoint.sample,'The original selected-cut transport acknowledgement was replaced.');
 const reading:NativePerformanceReading=readPerformance(performanceReply.reading,undefined,transition);
 need(Number.isSafeInteger(plan.selected_source_index)&&plan.selected_source_index>=0&&Array.isArray(score.native_sources),'The actual native selected origin asset is absent.');
 object(score.native_sources[plan.selected_source_index]);
 object(returned.score);
 counter(programme.origin_sample);counter(programme.preparation_cursor);
 need(programme.schema==='ql.native-live-temporal-programme-admission/v1'&&programme.operation==='live-temporal-prepare'&&typeof programme.programme_ref==='string'&&programme.programme_ref.length>0&&programme.session_ref===reading.session_ref&&programme.transport_epoch===reading.transport_epoch&&programme.sample_rate===score.sample_rate&&BigInt(programme.origin_sample)<=BigInt(programme.preparation_cursor)&&BigInt(checkpoint.sample)<=BigInt(programme.preparation_cursor)&&BigInt(programme.preparation_cursor)<=BigInt(range.from_sample)&&BigInt(programme.preparation_cursor)<=BigInt(reading.samples_elapsed)&&reading.available&&reading.device.state==='running','The actual native programme, selected-cut prelude or device readback is disconnected.');
 counter(programme.maximum_normal_pulse_bytes);
 need(programme.origin_sample===plan.reconstruction_sample&&programme.preparation_cursor===plan.reconstruction_sample,'The actual stopped programme was detached from its original reconstruction cut.');
 need(Array.isArray(programme.epochs)&&programme.epochs.length>=1&&programme.epochs.length<=256&&Array.isArray(programme.steps)&&programme.steps.length+1===programme.epochs.length&&programme.maximum_callback_frames===512&&[0,128,256].includes(programme.configured_device_buffer_frames)&&[128,256].includes(reading.device.buffer_frames)&&BigInt(programme.maximum_normal_pulse_bytes)>0n&&BigInt(programme.maximum_normal_pulse_bytes)<=32n*1024n*1024n,'The admitted original native epoch inventory/callback bounds differ.');
 const origin=object(programme.epochs[0]),prepared=programme.epochs.filter((epoch:any)=>epoch.source_index===programme.preparation_source_index&&epoch.source_ref===programme.preparation_source_ref);
 need(prepared.length===1&&sameNativePlaybackJson(programme.origin_native_basis,origin.native_basis)&&sameNativePlaybackJson(programme.origin_source_packet,origin.source_packet)&&programme.origin_physical_eigenbasis===origin.physical_eigenbasis&&sameNativePlaybackJson(programme.origin_receiving,origin.receiving)&&sameNativePlaybackJson(programme.preparation_native_basis,prepared[0].native_basis)&&sameNativePlaybackJson(programme.preparation_source_packet,prepared[0].source_packet),'The immutable origin and actual preparation epoch were conflated or lost.');
 for(const epoch of [origin,prepared[0]]){const asset=object(score.native_sources[epoch.source_index]);need(sameNativePlaybackJson(epoch.native_bundle,asset.native_bundle)&&sameNativePlaybackJson(epoch.native_basis,epoch.source_packet?.native_basis),'An admitted origin/preparation source differs from its retained complete native asset.');for(const name of ['native_physical_source_history','native_acoustic_source_history','native_contact_admission_history'])need(Object.hasOwn(epoch,name)&&(Object.hasOwn(asset,name)?sameNativePlaybackJson(epoch[name],asset[name]):epoch[name]===null),'The native admitted source lost its original '+name+'.');}
 const files=object(result.original_playback_files),ordinals=new Set<string>(),kinds=new Map<string,number>();
 need(files.schema==='oi.native-recording-playback-original-files/v1'&&files.available===true&&files.request_id===requestId&&typeof files.directory==='string'&&files.directory.length>0&&files.encoding==='serde-json-value-utf8/v1'&&Array.isArray(files.files)&&files.files.length>0,'The complete original playback files were not durably returned.');
 const diagnostics=object(result.diagnostics);
 need(diagnostics.schema==='oi.native-act-diagnostic-custody/v1'&&diagnostics.encoding===files.encoding&&Array.isArray(diagnostics.receipts)&&diagnostics.receipts.length===files.files.length,'The complete original native diagnostic cohort differs from the saved file cohort.');
 const originals=new Map<string,any>();
 for(const original of diagnostics.receipts){const descriptor=object(original.descriptor);counter(descriptor.receipt_ordinal);need(original.complete===true&&original.received_bytes===descriptor.bytes&&!originals.has(descriptor.receipt_ordinal),'An original native playback receipt is incomplete or repeated.');originals.set(descriptor.receipt_ordinal,descriptor);}
 const allowed=new Set(['playback.programme.original_request','playback.programme.admission','playback.programme.stopped_prepare','playback.device.start','playback.prior_before_resident_restoration','playback.prior_resident_restoration_original_request','playback.prior_resident_restoration','playback.source_original','playback.source_application','playback.contact_original','playback.contact_admission','playback.contact_pending','playback.event_admission','playback.event_pending','playback.native_callback','playback.selected_checkpoint','playback.resident_restoration']);
 for(const row of files.files){need(Object.keys(object(row)).sort().join(',')==='descriptor,file','An original playback file row was replaced.');const descriptor=object(row.descriptor);need(Object.keys(descriptor).sort().join(',')==='bytes,kind,original_index,parts,receipt_ordinal,sha256'&&sameNativePlaybackJson(descriptor,originals.get(descriptor.receipt_ordinal)),'The saved playback file differs from its complete original diagnostic descriptor.');counter(descriptor.receipt_ordinal);counter(descriptor.original_index);counter(descriptor.bytes);counter(descriptor.parts);need(BigInt(descriptor.receipt_ordinal)>0n&&!ordinals.has(descriptor.receipt_ordinal)&&BigInt(descriptor.bytes)>0n&&BigInt(descriptor.parts)>0n&&allowed.has(descriptor.kind)&&/^sha256:[0-9a-f]{64}$/.test(descriptor.sha256)&&row.file===`original-${descriptor.receipt_ordinal}.json`,'An original playback file descriptor is absent, repeated or malformed.');ordinals.add(descriptor.receipt_ordinal);kinds.set(descriptor.kind,(kinds.get(descriptor.kind)??0)+1);}
 need(['playback.programme.original_request','playback.programme.admission','playback.device.start'].every(kind=>kinds.get(kind)===1&&files.files.find((row:any)=>row.descriptor.kind===kind).descriptor.original_index==='0'),'The actual programme request, admission and device originals must each be retained exactly once at original index zero.');
 requireNativeProgrammeOriginalCohort(files,'playback');
 return{reading,transition,programme,plan,returned,files};
}

/** Qualify actual current AUHAL output separately from prior offline Engine
 * callbacks. Start epoch/baseline are read from the native device owner; never
 * derive either from a transport epoch, prior capture, label or guessed +1. */
export function hasNativePlaybackDeviceCallback(returned:any,programme:any,reading:NativePerformanceReading):boolean {
 const pulse=object(returned.native_pulse),device=reading.device;
 need(sameNativePlaybackJson(pulse.reading,reading)&&pulse.accepted===true,'Current device evidence differs from the SAME original native pulse.');
 counter(device.start_epoch);counter(device.start_callback_baseline);counter(device.callbacks);
 need(BigInt(device.start_callback_baseline)<=BigInt(device.callbacks),'Native DeviceStart callback baseline exceeds its actual counter.');
 const capture=readNativeCapture(pulse.native_capture,reading);
 if(device.state!=='running'||device.start_epoch==='0'||BigInt(device.callbacks)<=BigInt(device.start_callback_baseline)||!capture.capture_enabled||!capture.counters.has_callback_readback||!reading.live_temporal)return false;
 const progress=readLiveTemporalProgress(reading.live_temporal,reading.samples_elapsed);
 need(progress.programme_ref===programme.programme_ref&&!progress.failed,'Device capture belongs to another or failed source programme.');
 const epoch=object(programme.epochs?.[progress.next]);
 for(const block of capture.device_blocks){
  const start=BigInt(block.native_start_sample),end=start+BigInt(block.frames);
  if(block.device_epoch!==device.start_epoch||block.device_id!==device.device_id||block.sample_rate!==device.client_rate||!block.has_host_time||!block.has_device_sample_time||!block.clock_continuous||block.host_time==='0'||block.callback_begin_host_time==='0'||block.callback_end_host_time==='0'||start<BigInt(programme.preparation_cursor))continue;
  let covered=start,currentSource=false;
  // All samples must be the original SAME callback Engine output. Mixed
  // blocks preserve every source span; their first body cannot label the end.
  for(const audio of capture.audio_blocks){
   const a=BigInt(audio.start_sample),b=a+BigInt(audio.frames);
   if(b<=covered||a>=end)continue;
   if(a>covered||audio.schema!=='ql.native-audio-capture/v2'||audio.live_temporal?.programme_ref!==programme.programme_ref)break;
   const stop=b<end?b:end;
   for(let sample=covered;sample<stop;sample++)need(Object.is(Math.fround(audio.output_linear[Number(sample-a)]),Math.fround(block.output_linear[Number(sample-start)])),'Original device PCM differs from its SAME native Engine callback bits.');
   for(const span of audio.source_spans!){
    const spanStart=a+BigInt(span.offset),spanEnd=spanStart+BigInt(span.frames);
    if(spanEnd<=covered||spanStart>=stop)continue;
    if(span.source_ref===progress.current_source_ref&&span.source_index===progress.current_source_index){
     need(sameNativePlaybackJson(span.determination,epoch.determination)&&sameNativePlaybackJson(span.physical_body,epoch.source_packet?.physical_body)&&span.physical_eigenbasis===epoch.physical_eigenbasis&&span.physical_eigenbasis===reading.physical.eigenbasis_identity,'Actual device source span differs from the full admitted current native body.');
     currentSource=true;
    }
   }
   covered=stop;if(covered===end)break;
  }
  if(covered===end&&currentSource)return true;
 }
 return false;
}

/** Literal pending source or device output grants no current P/input. A real
 * stopped prelude may leave callback_output_committed=true; preserve that raw
 * observation while waiting for current-epoch device PCM through the sole pump. */
export function readNativePlaybackStartPhase(returned:any,programme:any,reading:NativePerformanceReading,admittedSource=false):'pending-first-callback'|'current-source-present' {
 object(returned);
 const progress=Object.hasOwn(reading,'live_temporal'),selector=Object.hasOwn(returned,'current_source_selection'),proof=Object.hasOwn(returned,'current_source_proof'),artifact=Object.hasOwn(returned,'source_artifact');
 const pulse=object(returned.native_pulse);
 need(sameNativePlaybackJson(pulse.reading,reading)&&pulse.accepted===true,'The native start phase differs from its actual pulse.');
 if(!selector&&!proof&&!artifact){
  need(pulse.payload?.live_source_pending===true,'Pending first currentness requires the actual native pending observation.');
  if(progress)need(reading.live_temporal?.programme_ref===programme.programme_ref&&!reading.live_temporal.failed,'The pending native observation belongs to another programme or has failed.');
  return 'pending-first-callback';
 }
 need(progress&&selector&&proof&&(artifact||admittedSource)&&pulse.reading.callback_output_committed===true,'The native source supplied incomplete first-current evidence.');
 need(reading.live_temporal?.programme_ref===programme.programme_ref,'The native callback belongs to another programme.');
 if(!hasNativePlaybackDeviceCallback(returned,programme,reading)){
  need(pulse.payload?.live_source_pending===true,'Native playback claimed currentness without its current device callback.');
  return 'pending-first-callback';
 }
 return 'current-source-present';
}

const retainedSourceBrand:unique symbol=Symbol('actual admitted native playback source');
/** An opaque in-memory continuation of this decoder's completed original source.
 * A copied handle, imported artifact, saved label or another lifetime cannot
 * populate the private evidence map. It grants no native lease or clock. */
export interface NativePlaybackSourceCustody {readonly [retainedSourceBrand]:true}
interface RetainedPlaybackSource {artifact:Record<string,any>;selector:any;progress:any;session_ref:string;transport_epoch:string;programme_ref:string;sample:string}
const retainedSources=new WeakMap<NativePlaybackSourceCustody,RetainedPlaybackSource>();
function freezeOriginal(value:any):any{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeOriginal(child);Object.freeze(value);}return value;}
/** Current source is qualified from THIS actual native pulse and the original
 * admission; the immutable selected origin cannot stand in for its successor. */
export function readNativePlaybackCurrentSource(returned:any,programme:any,plan:any,document:any,cas:NativeRecordingCas,reading:NativePerformanceReading,prior?:NativePlaybackSourceCustody|null){
 const selector=temporalKeys(returned.current_source_selection,['schema','expression_ref','scene_ref','checkpoint_ref','source_index','basis_index','basis_digest','identity','source_reading','source_sample']);
 const proof=temporalKeys(returned.current_source_proof,['schema','session_ref','transport_epoch','programme_ref','progress','current_source_application','preparation_source_index','preparation_source_ref']);
 const pulse=object(returned.native_pulse),scene=document.scenes?.find((s:any)=>s.scene_ref===cas.scene_ref),performance=object(scene?.performance);
 need(document.expression_ref===cas.expression_ref&&document.revision===cas.document_revision&&scene?.revision===cas.scene_revision&&pulse.accepted===true&&pulse.reading.callback_output_committed===true&&sameNativePlaybackJson(pulse.reading,reading),'The actual current source differs from the same pulse/current Document.');
 need(selector.schema==='ql.native-retained-performance-source-selection/v1'&&selector.expression_ref===cas.expression_ref&&selector.scene_ref===cas.scene_ref&&selector.checkpoint_ref===plan.checkpoint_ref&&Number.isSafeInteger(selector.source_index)&&selector.source_index>=0&&selector.source_index<=255&&Number.isSafeInteger(selector.basis_index)&&selector.basis_index>=0&&selector.basis_index<=65535,'The native performed source lost its exact selected original.');
 need(proof.schema==='ql.native-playback-current-source-proof/v1'&&proof.session_ref===reading.session_ref&&proof.transport_epoch===reading.transport_epoch&&proof.programme_ref===programme.programme_ref&&proof.preparation_source_index===programme.preparation_source_index&&proof.preparation_source_ref===programme.preparation_source_ref,'The native current-source proof belongs to another programme/preparation.');
 const progress=readLiveTemporalProgress(proof.progress,reading.samples_elapsed);
 need(!progress.failed&&sameNativePlaybackJson(progress,reading.live_temporal)&&progress.programme_ref===programme.programme_ref&&progress.current_source_index===selector.source_index&&progress.current_source_ref===selector.source_reading?.ref&&Array.isArray(programme.epochs)&&programme.epochs.length===progress.count+1&&Array.isArray(programme.steps)&&programme.steps.length===progress.count,'The original source programme/progress lost a descendant or differs from its same callback.');
 const retained=prior?retainedSources.get(prior):undefined,hasArtifact=Object.hasOwn(returned,'source_artifact');
 if(!hasArtifact)need(retained&&retained.session_ref===reading.session_ref&&retained.transport_epoch===reading.transport_epoch&&retained.programme_ref===programme.programme_ref&&sameNativePlaybackJson(retained.selector,selector)&&sameNativePlaybackJson(retained.progress,progress)&&BigInt(reading.samples_elapsed)>=BigInt(retained.sample),'A changed or first native source requires its complete actual artifact; an imported or stale handle cannot replace it.');
 const asset=object(performance.native_sources?.[selector.source_index]),basis=object(performance.bases?.[selector.basis_index]),epoch=object(programme.epochs[progress.next]),artifact=hasArtifact?object(returned.source_artifact):retained!.artifact,bundle=object(asset.native_bundle);
 need(artifact.schema==='ql.retained-source-performance-fixture/v1'&&selector.basis_digest===asset.basis_digest&&basis.content_digest===asset.basis_digest&&performance.bases.filter((b:any)=>b.content_digest===asset.basis_digest).length===1&&sameNativePlaybackJson(selector.identity,asset.identity)&&sameNativePlaybackJson(basis.identity,asset.identity)&&sameNativePlaybackJson(artifact.basis?.identity,basis.identity)&&sameNativePlaybackJson(artifact.basis?.prepared_body,basis.prepared_body),'The current performed source lost its unique full native body/musical basis.');
 need(epoch.source_index===selector.source_index&&epoch.source_ref===progress.current_source_ref&&sameNativePlaybackJson(epoch.native_bundle,bundle)&&sameNativePlaybackJson(artifact.source_assets,bundle)&&sameNativePlaybackJson(epoch.native_basis,artifact.native_basis)&&sameNativePlaybackJson(epoch.source_packet,artifact.native_preparation),'The full native current source/packet/basis differs from its original admitted epoch.');
 // Optional empty histories stay literally absent. Present rows must preserve
 // every original native source/receipt; a basis label cannot select an epoch.
 for(const name of ['native_physical_source_history','native_acoustic_source_history','native_contact_admission_history'])need(Object.hasOwn(asset,name)===Object.hasOwn(artifact,name)&&sameNativePlaybackJson(asset[name],artifact[name])&&Object.hasOwn(epoch,name)&&(Object.hasOwn(asset,name)?sameNativePlaybackJson(epoch[name],asset[name]):epoch[name]===null),'The native current source lost or changed its complete original '+name+'.');
 const sr=object(selector.source_reading);need(sr.availability==='available'&&sr.revision==='oi.expression-performance-source-asset/v1'&&/^sha256:[0-9a-f]{64}$/.test(sr.ref),'The native source-part reading is unavailable.');
 temporalDecimal(selector.source_sample);need(selector.source_sample===bundle.current_receiving?.native_admission?.operation?.native_sample,'The original native source admission date was changed.');
 if(progress.next===0)need(proof.current_source_application===null&&pulse.payload?.current_source_application===null&&progress.current_source_effective_sample===programme.origin_sample,'The origin acquired an invented callback source application/date.');
 else{const application=readSourceApplication(proof.current_source_application,reading.samples_elapsed),original=object(programme.steps[progress.next-1]);
  need(sameNativePlaybackJson(application,pulse.payload?.current_source_application)&&application.source_application_ordinal===String(progress.next)&&application.after_source_index===selector.source_index&&application.after_source_ref===progress.current_source_ref&&application.playback_sample===progress.current_source_effective_sample,'The current source has no same-pulse completed original application.');
  for(const name of ['before_source_ref','after_source_ref','before_source_index','after_source_index','original_native_request_id','original_sample','playback_sample','transaction','before_body_revision','after_body_revision','kind'])need(sameNativePlaybackJson(application[name as keyof typeof application],original[name]),'The current application replaced its original source/body/date/transaction.');
 }
 const body=object(basis.prepared_body),request=object(body.request);
 need(request.preparation_ref===reading.scope.preparation_ref&&request.state_ref===reading.scope.state_ref&&String(request.body_revision)===reading.scope.body_revision&&String(body.source_generation)===reading.physical.source_generation&&sameNativePlaybackJson(epoch.determination.identity,{instance:reading.scope.instance_ref,event:reading.scope.event_ref,subject:reading.scope.subject_ref,m1_revision:reading.scope.m1_revision,m2_generation:reading.scope.m2_generation})&&typeof epoch.physical_eigenbasis==='string'&&epoch.physical_eigenbasis.length>0&&epoch.physical_eigenbasis===reading.physical.eigenbasis_identity,'The actual callback P body differs from its native-selected epoch.');
 // Keep one full immutable source per admitted epoch. Every subsequent pulse
 // still qualifies its fresh selector/proof, full current Doc source and actual
 // callback P above. No fake source_artifact is inserted into that original.
 let custody=prior;
 if(!retained||retained.session_ref!==reading.session_ref||retained.transport_epoch!==reading.transport_epoch||retained.programme_ref!==programme.programme_ref||!sameNativePlaybackJson(retained.selector,selector)||!sameNativePlaybackJson(retained.progress,progress)||!sameNativePlaybackJson(retained.artifact,artifact)){
  custody=Object.freeze({[retainedSourceBrand]:true}) as NativePlaybackSourceCustody;
  retainedSources.set(custody,{artifact:freezeOriginal(structuredClone(artifact)),selector:freezeOriginal(structuredClone(selector)),progress:freezeOriginal(structuredClone(progress)),session_ref:reading.session_ref,transport_epoch:reading.transport_epoch,programme_ref:programme.programme_ref,sample:reading.samples_elapsed});
 }
 return{selector,proof,asset,basis,artifact:retainedSources.get(custody!)!.artifact,custody:custody!};
}
