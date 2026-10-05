import {readNativeCapture,captureCounterNames,type NativeCaptureBatch} from './nativeCapture.js';
import {readSourceApplication} from './temporalCapture.js';
import {readPerformance,nativeInstrumentRampTargets,type NativePerformanceReading} from './protocol.js';
import type {installNativeWorkspace} from '../nativeWorkspace.js';
import {NativePerformanceClient} from './client.js';
import {readNativeEditedRender} from './render.js';
import {NativeFieldController} from '../native-field/controller.js';
import {readNativeActPlayback,readNativePlaybackStartPhase,hasNativePlaybackDeviceCallback,readNativePlaybackCurrentSource,sameNativePlaybackJson,type NativeScorePlaybackRange} from './playback.js';
const need=(value:unknown,reason:string):void=>{if(!value)throw Error('Actual mounted score acceptance: '+reason);};
function authoredInput(surface:HTMLElement,label:string,value:string){
 const input=surface.querySelector(`[aria-label="${label}"]`);need(input instanceof HTMLInputElement&&!input.disabled,'the actual '+label+' editor is absent');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input!.dispatchEvent(new Event('input',{bubbles:true}));
}
function authoredSelect(surface:HTMLElement,label:string,value:number){
 const select=surface.querySelector(`[aria-label="${label}"]`);need(select instanceof HTMLSelectElement&&!select.disabled,'the actual '+label+' editor is absent');
 (select as HTMLSelectElement).value=String(value);select!.dispatchEvent(new Event('change',{bubbles:true}));
}
function button(surface:HTMLElement,name:string):HTMLButtonElement {
 const value=surface.querySelector(`[data-performance="${name}"]`);
 need(value instanceof HTMLButtonElement&&!value.disabled,'the actual normal '+name+' control is absent or disabled');return value as HTMLButtonElement;
}
function setRange(surface:HTMLElement,name:string,value:string){
 const input=surface.querySelector(`[data-performance="${name}"]`);need(input instanceof HTMLInputElement,'actual score range input absent');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
}
function chooseCut(surface:HTMLElement,index:number){
 const select=surface.querySelector('[data-performance="score-cut"]');need(select instanceof HTMLSelectElement,'actual retained cut selector absent');
 (select as HTMLSelectElement).value=String(index);select.dispatchEvent(new Event('change',{bubbles:true}));
}
function actualPhysicalTargets(controller:NativeFieldController,requireMotion:boolean){
 const reading=controller.musicalReading!,gpu=controller.inspectPhysicalTargets();
 need(gpu?.scope&&gpu.transport_epoch===reading.transport_epoch&&gpu.samples_elapsed===reading.samples_elapsed&&gpu.scope.preparation_ref===reading.scope.preparation_ref&&gpu.scope.state_ref===reading.scope.state_ref&&gpu.scope.body_revision===reading.scope.body_revision,'actual P reading is disconnected from the retained GPU body');
 need(gpu!.native_rest&&Number.isFinite(gpu!.display.magnification),'the actual native rest/display policy is absent');
 const rest=new Map(gpu!.native_rest!.node_ids.map((id,i)=>[id,gpu!.native_rest!.rest_metres[i]])),nodes=new Map(reading.physical.node_ids.map((id,i)=>[id,reading.physical.positions_metres[i]])),m=gpu!.target_map.metre_to_presentation;
 let maximum=0;
 for(const [targets,lane] of [[gpu!.target_a,gpu!.target_map.target_a_node_ids],[gpu!.target_b,gpu!.target_map.target_b_node_ids]] as const){
  need(targets instanceof Float32Array&&lane.length===gpu!.partition.end-gpu!.partition.start,'actual retained GPU target storage is absent');
  for(let i=0;i<lane.length;i++){const p=nodes.get(lane[i]),origin=rest.get(lane[i]);need(p&&origin,'the actual GPU lane lost a native descendant');
   maximum=Math.max(maximum,Math.hypot(...p!.map((v,a)=>v-origin![a])));
   const [x,y,z]=p!.map((v,a)=>origin![a]+gpu!.display.magnification*(v-origin![a]));
   const expected=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]].map(Math.fround);
   need(expected.every((v,a)=>Object.is(v,targets[(gpu!.partition.start+i)*4+a])),'the visible target differs from its SAME native P displacement and declared view magnification');
  }
 }
 need(Object.is(maximum,gpu!.display.native_max_displacement_metres),'the displayed physical magnitude differs from the actual metres');
 if(requireMotion)need(maximum>0,'the actual native physical body has no observed displacement');
 return{gpu,maximum};
}
/** Observer deadlines measure the test driver, never a native audio sample or
 * operation. Admission still uses the one actual controller/Session. */
function observed(controller:NativeFieldController,ready:()=>boolean,action?:()=>void,surface?:HTMLElement):Promise<void>{
 return new Promise((resolve,reject)=>{let done=false,unsubscribe=()=>{};const mutations=surface?new MutationObserver(()=>check()):null;
  const finish=(error?:unknown)=>{if(done)return;done=true;clearTimeout(timer);unsubscribe();mutations?.disconnect();error?reject(error):resolve();};
  const check=()=>{try{const custody=controller.scorePlayback.custody() as any,render=controller.scorePlayback.renderCustody() as any;need(!custody?.held,custody?.reason??'original native playback effect is held');need(!render?.held,render?.reason??'original native export effect is held');if(ready())finish();}catch(error){finish(error);}};
  const timer=setTimeout(()=>finish(Error('The actual original native operation/callback did not complete within the observation deadline.')),12000);
  unsubscribe=controller.scorePlayback.subscribe(check);if(surface)mutations!.observe(surface,{subtree:true,childList:true,attributes:true});try{action?.();check();}catch(error){finish(error);}
 });
}
/** The custodian calls this with the ACTUAL current mounted Expressions
 * controller and connected DOM AFTER the normal source/Act/device producer.
 * It cannot create a World, substitute a native reply, or fake audible PCM.
 * Each detector starts from an actual admitted result; after every refusal the
 * complete normal Play, real callback/P/GPU observation and Stop repeat. */
/** Independently decode the actual earlier full pending-source observation,
 * then the real first device callback. Opaque custody is reconstructed only
 * from those original replies/full Documents, never a copied public handle. */
function readActualFirstPlaybackSource(custody:any,first:any,programme:any,plan:any,returned=first.result.native_reply.result){
 const observed=custody.source_observation;
 const prior=observed?readNativePlaybackCurrentSource(observed.result.native_reply.result,programme,plan,observed.document,observed.cas,observed.reading).custody:undefined;
 return readNativePlaybackCurrentSource(returned,programme,plan,first.document,first.cas,first.reading,prior);
}

export async function runMountedNativeScorePlaybackAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 need(controller instanceof NativeFieldController&&surface instanceof HTMLElement&&surface.isConnected&&document.contains(surface),'the actual mounted native controller/DOM is required');
 const receipts:any[]=[];
 const positive=async()=>{
  need(controller.scorePlayback.snapshot()?.available,'the exact compiled native programme/current source provider is unavailable');
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);
  // Let the real React handlers publish the authored controls; no native tick.
  await Promise.resolve();
  const before=controller.reading.native.last_request_id;
  await observed(controller,()=>controller.scorePlayback.snapshot()?.running===true,()=>button(surface,'play-score').click());
  const original=controller.scorePlayback.custody() as any;need(original?.result?.accepted===true,'native programme start is absent');
  const id=original.request?.request?.request_id;need(BigInt(id)===BigInt(before)+1n,'normal Play allocated another outer ordinal');
  const actual=readNativeActPlayback(original.result,original.result.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,id,original.transaction_ref);
  const first=original.first_current;need(first&&!original.first_current_pending,'the actual first callback/current-source admission is absent');
  readActualFirstPlaybackSource(original,first,actual.programme,actual.plan);
  need(first.result.native_reply.result.native_pulse.native_capture.counters.has_callback_readback===true,'a stopped/pre-programme observation was promoted as the first callback');
  await observed(controller,()=>{const capture=controller.nativeSoundCaptureCustody as any,gpu=controller.inspectPhysicalTargets();return !!capture.current&&!capture.failure&&(gpu?.display.native_max_displacement_metres??0)>0&&capture.current.audio_blocks.some((b:any)=>b.output_linear.some((n:number)=>n!==0))&&capture.current.device_blocks.some((b:any)=>b.output_linear.some((n:number)=>n!==0));});
  const reading=controller.musicalReading!,gpu=controller.inspectPhysicalTargets(),capture=controller.nativeSoundCaptureCustody as any;
  need(gpu?.scope&&gpu.transport_epoch===reading.transport_epoch&&gpu.samples_elapsed===reading.samples_elapsed&&gpu.scope.preparation_ref===reading.scope.preparation_ref&&gpu.scope.state_ref===reading.scope.state_ref&&gpu.scope.body_revision===reading.scope.body_revision,'actual P reading is disconnected from the retained GPU body');
  const physical=actualPhysicalTargets(controller,true);
  need(capture.current.session_ref===reading.session_ref&&capture.current.transport_epoch===reading.transport_epoch&&capture.current.capture_enabled&&capture.current.counters.has_callback_readback,'captured original sound is disconnected from the SAME native callback');
  need(capture.current.device_blocks.every((b:any)=>b.has_host_time&&b.has_device_sample_time&&b.clock_continuous),'actual native device timestamps are absent/discontinuous');
  need(['dropped_audio_blocks_at_readback','dropped_readbacks_at_readback','native_queue_overflows_at_readback','device_capture_drops','device_callback_failures','device_timestamp_discontinuities'].every(k=>capture.current.counters[k]==='0'),'original native sound reports loss; zero-loss playback cannot be claimed');
  receipts.push({request_id:id,programme_ref:actual.programme.programme_ref,session_ref:reading.session_ref,transport_epoch:reading.transport_epoch,native_sample:reading.samples_elapsed,body_revision:reading.scope.body_revision,native_max_displacement_metres:physical.maximum,display_magnification:physical.gpu!.display.magnification,original_files:actual.files.files,device_blocks:capture.current.device_blocks.length,audio_blocks:capture.current.audio_blocks.length});
  await observed(controller,()=>controller.musicalReading?.device.state!=='running',()=>button(surface,'stop-score').click());
  return original;
 };
 let original=await positive();
 const mutations:[string,'start'|'current',(result:any)=>void][]=[
  ['label-only start','start',r=>{r.native_reply.result.native_pulse.accepted=false;}],
  ['disconnected programme','start',r=>{delete r.native_reply.result.native_programme_admission;}],
  ['lost original file','start',r=>{r.original_playback_files.files.pop();}],
  ['lost original programme request','start',r=>{r.original_playback_files.files=r.original_playback_files.files.filter((row:any)=>row.descriptor.kind!=='playback.programme.original_request');}],
  ['wrong native ordinal','start',r=>{r.native_reply.result.host_receipt.request_id='0';}],
  ['wrong selected cut','start',r=>{r.native_reply.result.original_plan.checkpoint_ref='unqualified:wrong-cut';}],
  ['lost original source','start',r=>{delete r.native_reply.result.native_programme_admission.origin_native_basis;}],
  ['incomplete original receipt','start',r=>{r.diagnostics.receipts[0].complete=false;}],
  ['lost current source proof','current',r=>{delete r.native_reply.result.current_source_proof;}],
  ['wrong performed source epoch','current',r=>{const selected=r.native_reply.result.current_source_selection;selected.source_index=selected.source_index===0?1:0;}],
  ['stale callback source progress','current',r=>{r.native_reply.result.current_source_proof.progress.current_source_ref='unqualified:stale-source';}],
  ['lost full native source','current',r=>{delete r.native_reply.result.source_artifact.source_assets;}]
 ];
 for(const [name,kind,mutate] of mutations){const changed=structuredClone(kind==='start'?original.result:original.first_current.result);mutate(changed);let refused=false;
  try{
   if(kind==='start')readNativeActPlayback(changed,changed.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,original.request.request.request_id,original.transaction_ref);
   else{const first=original.first_current,start=original.result.native_reply.result;readActualFirstPlaybackSource(original,first,start.native_programme_admission,start.original_plan,changed.native_reply.result);}
  }catch{refused=true;}
  need(refused,name+' was accepted by the actual production decoder');original=await positive();
 }
 return{schema:'oi.actual-mounted-native-score-playback-acceptance/v1',receipts,detectors:mutations.map(([name])=>name),standing:'Actual normal controls/native programme/device/P/GPU/original files and sound observed. This finite activity does not replace the full commissioned workload, body/M4 epochs, loss-source tests or final owner live acceptance.'};
}

/** The same mounted normal Export action, actual native files and full stopped
 * restitution repeat after every production-decoder detector. File/PCM byte
 * replay belongs to the paired C63 native activity, not a browser fake WAV. */
export async function runMountedNativeEditedRenderAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 need(controller instanceof NativeFieldController&&surface instanceof HTMLElement&&surface.isConnected&&document.contains(surface),'the real mounted Expressions owner/DOM is required');
 const receipts:any[]=[];
 const positive=async()=>{
  need(controller.scorePlayback.snapshot()?.can_export,'the actual current compiled native edited-render consumer is unavailable');
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  const before=controller.reading.native.last_request_id;
  const expected=(BigInt(before)+1n).toString();
  await observed(controller,()=>{const current=controller.scorePlayback.renderCustody() as any;return current?.request?.request?.request_id===expected&&current.result?.accepted===true&&!current.held&&typeof current.file==='string'&&current.file.length>0&&controller.scorePlayback.snapshot()?.export_file===current.file;},()=>button(surface,'export-score-wav').click());
  const original=controller.scorePlayback.renderCustody() as any;need(original?.result?.accepted===true&&!original.held,'the actual native export/file/result is held');
  const id=original.request?.request?.request_id;need(BigInt(id)===BigInt(before)+1n,'normal Export allocated another outer ordinal');
  const render=readNativeEditedRender(original.result,original.result.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,id,original.before);
  const gpu=controller.inspectPhysicalTargets(),reading=controller.musicalReading!;
  need(reading.transport_epoch===render.reading.transport_epoch&&reading.samples_elapsed===render.boundary.samples_elapsed&&reading.accepted_sequence===render.boundary.accepted_sequence&&gpu?.transport_epoch===reading.transport_epoch&&gpu.samples_elapsed===reading.samples_elapsed,'actual export did not restitute the same stopped native/GPU performance');
  actualPhysicalTargets(controller,false);
  receipts.push({request_id:id,file:original.file,wav:render.wav,original_files:render.files.files,restoration:render.restoration});return original;
 };
 let original=await positive();
 const mutations:[string,(r:any)=>void][]=[
  ['label-only render',r=>{r.native_reply.result.rendered=false;}],
  ['wrong actual render range',r=>{r.native_reply.result.scope.start_sample='0';r.native_reply.result.scope.frames='0';}],
  ['wrong original native ordinal',r=>{r.native_reply.result.host_receipt.request_id='0';}],
  ['lossy WAV size',r=>{r.original_render_files.rendered_wav.receipt.bytes+=4;}],
  ['lost native WAV hash',r=>{r.original_render_files.rendered_wav.receipt.file_sha256='';}],
  ['lost original restitution file',r=>{r.original_render_files.files=r.original_render_files.files.filter((f:any)=>f.descriptor.kind!=='playback.resident_restoration');}],
  ['wrong restored resident cursor',r=>{r.native_reply.result.restoration.original_cursor='18446744073709551615';}],
  ['incomplete native original',r=>{r.diagnostics.receipts[0].complete=false;}]
 ];
 for(const [name,mutate] of mutations){const changed=structuredClone(original.result);mutate(changed);let refused=false;try{readNativeEditedRender(changed,changed.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,original.request.request.request_id,original.before);}catch{refused=true;}need(refused,name+' was accepted by the actual production export parser');original=await positive();}
 return{schema:'oi.actual-mounted-native-edited-render-acceptance/v1',receipts,detectors:mutations.map(([name])=>name),standing:'Actual normal Export/native render/original files/WAV receipt/stopped restitution and GPU observed. Paired original C63 tests must compare every actual native callback f32 bit with exported WAV, full mixed source history, layer mute, save/reopen/continuation and required workload.'};
}

/** Required actual-device race activity. A start that already carries its first
 * callback cannot count as delayed-start coverage. The native custodian must
 * supply a genuinely delayed first callback, never a replacement JSON reply. */
export async function runMountedNativeFirstCallbackAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange,client:NativePerformanceClient){
 need(controller instanceof NativeFieldController&&client instanceof NativePerformanceClient&&surface.isConnected&&document.contains(surface),'the real mounted native owner/client/DOM is required');
 need(controller.scorePlayback.snapshot()?.available,'actual prepared output/retained programme is required');
 setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
 const before=controller.musicalReading!,clientBefore=client.state.reading,beforeGpu=controller.inspectPhysicalTargets(),ordinal=controller.reading.native.last_request_id;
 let pendingSeen=false,pendingUiSeen=false,startRequest:any=null;
 const unsubscribe=controller.scorePlayback.subscribe(()=>{
  const state=controller.scorePlayback.snapshot(),custody=controller.scorePlayback.custody() as any;
  if(!state?.first_current_pending)return;
  pendingSeen=true;startRequest=custody.request;
 });
 try{
  await observed(controller,()=>{
   const state=controller.scorePlayback.snapshot(),custody=controller.scorePlayback.custody() as any;
   if(state?.first_current_pending){
    need(state.device_started&&!state.running&&!state.available&&!state.can_export&&!controller.performance.current,'start acknowledgement leaked a current playback/source grant');
    need(controller.musicalReading===before&&sameNativePlaybackJson(controller.inspectPhysicalTargets(),beforeGpu),'the prior source/P was projected as the new current callback');
    need(client.state.reading===clientBefore,'the historical Start transport baseline became the displayed current client P');
    const stop=surface.querySelector('[data-performance="stop-score"]'),blocked=['play-score','play-whole-score','export-score-wav'].every(name=>{const value=surface.querySelector(`[data-performance="${name}"]`);return value instanceof HTMLButtonElement&&value.disabled;});
    if(stop instanceof HTMLButtonElement&&!stop.disabled&&blocked)pendingUiSeen=true;
    need(custody?.result?.accepted===true&&readNativePlaybackStartPhase(custody.pending_result.native_reply.result,custody.result.native_reply.result.native_programme_admission,custody.pending_reading,!!custody.source_observation)==='pending-first-callback','pending state replaced the original absent-callback start');
   }
   return state?.running===true;
  },()=>button(surface,'play-score').click(),surface);
  const custody=controller.scorePlayback.custody() as any,first=custody?.first_current;
  need(pendingSeen&&pendingUiSeen&&startRequest&&first,'actual delayed first callback was not observed; this required race case was not executed');
  need(sameNativePlaybackJson(startRequest,custody.request)&&BigInt(startRequest.request.request_id)===BigInt(ordinal)+1n,'DeviceStart/original Play was reissued');
  need(first.request.request.operation==='command'&&first.request.request.command.operation==='performance-inspect'&&BigInt(first.request.request.request_id)>BigInt(startRequest.request.request_id),'first currentness bypassed the existing same-session native observer');
  const start=readNativeActPlayback(custody.result,custody.result.native_reply.result.host_receipt.performance,custody.selected,custody.range,custody.cas,custody.request.request.request_id,custody.transaction_ref);
  readActualFirstPlaybackSource(custody,first,start.programme,start.plan);
  need(first.result.native_reply.result.native_pulse.native_capture.counters.has_callback_readback===true,'first-current evidence has no original callback fence');
  need(!client.state.reason&&client.state.reading?.transport_epoch===first.reading.transport_epoch&&BigInt(client.state.reading.samples_elapsed)>=BigInt(first.reading.samples_elapsed),'the original Start transport ACK was lost before the actual current client callback');
  await observed(controller,()=>{const capture=controller.nativeSoundCaptureCustody as any;return !!capture.current&&!capture.failure&&capture.current.audio_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0))&&capture.current.device_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0));});
  const physical=actualPhysicalTargets(controller,true);
  await observed(controller,()=>{const actual=controller.scorePlayback.custody() as any;return actual?.stop_result?.native_reply?.result?.host_receipt?.performance?.accepted===true&&actual.stop_result.native_reply.result.host_receipt.performance.reading.device.state!=='running';},()=>button(surface,'stop-score').click());
  return{schema:'oi.actual-mounted-native-first-callback-acceptance/v1',original_start:custody.result,first_current:first,native_max_displacement_metres:physical.maximum,standing:"Actual normal Play waited on the same owner's original first callback, source proof, capture and P/GPU. Full independent replay and workload remain required."};
 }finally{unsubscribe();}
}

/** Actual protective Stop before the first device callback; a callback that
 * wins this race cannot count as the required pending-Stop detector. */
export async function runMountedNativeFirstCallbackStopAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 need(controller instanceof NativeFieldController&&surface.isConnected&&document.contains(surface),'the real mounted native owner/DOM is required');
 need(controller.scorePlayback.snapshot()?.available,'actual prepared output/retained programme is required');
 setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
 const before=controller.musicalReading!,gpu=controller.inspectPhysicalTargets();
 await observed(controller,()=>{const state=controller.scorePlayback.snapshot(),stop=surface.querySelector('[data-performance="stop-score"]');return state?.first_current_pending===true&&stop instanceof HTMLButtonElement&&!stop.disabled;},()=>button(surface,'play-score').click(),surface);
 const original=controller.scorePlayback.custody() as any;need(original.first_current===null&&original.first_current_pending,'the actual callback already won the race; pending Stop was not exercised');
 const closed=await new Promise<any>((resolve,reject)=>{
  let done=false,unsubscribe=()=>{};
  const finish=(error?:unknown,receipt?:any)=>{if(done)return;done=true;clearTimeout(deadline);unsubscribe();error?reject(error):resolve(receipt);};
  const check=()=>{try{
   const custody=controller.scorePlayback.custody() as any,close=controller.reading.lifetime.last_close;
   if(controller.reading.lifetime.close_error)throw Error('The exact native close acknowledgement is unknown: '+controller.reading.lifetime.close_error);
   if(custody?.first_current)throw Error('The first callback won before pending Stop; this required race case was not executed.');
   const stop=custody?.stop_result?.native_reply?.result?.host_receipt;
   if(stop?.performance?.accepted===true&&stop.performance.reading.device.state!=='running'&&close?.closed===true&&close.lease===original.request.lease){
    need(controller.musicalReading===before&&sameNativePlaybackJson(controller.inspectPhysicalTargets(),gpu),'stopping before first currentness granted or projected a replacement P');
    need(!controller.performance.current&&custody.held&&sameNativePlaybackJson(custody.request,original.request),'pending Stop revived currentness or reissued Play');
    finish(undefined,{original_start:original.result,original_stop:custody.stop_result,exact_close:close});
   }
  }catch(error){finish(error);}};
  const deadline=setTimeout(()=>finish(Error('The actual pending Stop/owned close did not acknowledge within the observation deadline.')),12000);
  unsubscribe=controller.scorePlayback.subscribe(check);try{button(surface,'stop-score').click();check();}catch(error){finish(error);}
 });
 return{schema:'oi.actual-mounted-native-first-callback-stop-acceptance/v1',...closed,standing:'Actual original pending Start, same-session native Stop and exact owned close; no first callback or replacement body is claimed. A new independently admitted lifetime must repeat the normal passage afterward.'};
}

/** Fast native Start must publish its already-qualified first callback to the
 * ACTUAL mounted client before another native observer request can repair it.
 * A delayed Start cannot count as this separate required native activity. */
export async function runMountedNativeFastStartAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange,client:NativePerformanceClient){
 need(controller instanceof NativeFieldController&&client instanceof NativePerformanceClient&&surface.isConnected&&document.contains(surface),'actual mounted native owner/client/DOM required');
 const receipts:any[]=[];
 for(let repeat=0;repeat<2;repeat++){
  need(controller.scorePlayback.snapshot()?.available,'the genuine prepared output and retained programme are unavailable');
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  const before=controller.musicalReading!,ordinal=controller.reading.native.last_request_id;
  await observed(controller,()=>controller.scorePlayback.snapshot()?.running===true,()=>button(surface,'play-score').click(),surface);
  const custody=controller.scorePlayback.custody() as any,first=custody?.first_current,id=custody?.request?.request?.request_id;
  need(first&&!custody.first_current_pending&&first.result===custody.result&&first.request.request.request_id===id,'this actual Start had no first-current callback; it cannot count as fast-start coverage');
  need(BigInt(id)===BigInt(ordinal)+1n&&controller.reading.native.last_request_id===id,'a later observer request concealed the missing immediate native client publication');
  const start=readNativeActPlayback(custody.result,custody.result.native_reply.result.host_receipt.performance,custody.selected,custody.range,custody.cas,id,custody.transaction_ref);
  need(readNativePlaybackStartPhase(start.returned,start.programme,start.reading)==='current-source-present','fast Start lacks its original full current qualifiers');
  readActualFirstPlaybackSource(custody,first,start.programme,start.plan);
  need(first.result.native_reply.result.native_pulse.native_capture.counters.has_callback_readback===true,'fast Start promoted a stopped/pre-programme source observation');
  need(BigInt(first.reading.transport_epoch)>BigInt(before.transport_epoch),'the native test did not exercise a real acknowledged transport transition');
  need(controller.performance.current&&!client.state.reason&&sameNativePlaybackJson(client.state.reading,first.reading),'the current native owner exposed old client keys/body or lost the original native ACK');
  actualPhysicalTargets(controller,false);
  await observed(controller,()=>{const capture=controller.nativeSoundCaptureCustody as any,gpu=controller.inspectPhysicalTargets();return !!capture.current&&!capture.failure&&(gpu?.display.native_max_displacement_metres??0)>0&&capture.current.audio_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0))&&capture.current.device_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0));});
  const physical=actualPhysicalTargets(controller,true),sound=controller.nativeSoundCaptureCustody as any,reading=controller.musicalReading!;
  need(sound.current.session_ref===reading.session_ref&&sound.current.transport_epoch===reading.transport_epoch&&sound.current.counters.has_callback_readback,'fast-start sound detached from the actual current callback owner');
  need(['dropped_audio_blocks_at_readback','dropped_readbacks_at_readback','native_queue_overflows_at_readback','device_capture_drops','device_callback_failures','device_timestamp_discontinuities'].every(k=>sound.current.counters[k]==='0'),'actual fast-start native sound reports original loss');
  await observed(controller,()=>{const stopped=controller.scorePlayback.custody() as any;return stopped?.stop_result?.native_reply?.result?.host_receipt?.performance?.accepted===true&&stopped.stop_result.native_reply.result.host_receipt.performance.reading.device.state!=='running';},()=>button(surface,'stop-score').click());
  receipts.push({repeat,request_id:id,original_start:custody.result,first_current:first,actual_stop:(controller.scorePlayback.custody() as any).stop_result,observed_native_sample:reading.samples_elapsed,native_max_displacement_metres:physical.maximum});
 }
 return{schema:'oi.actual-mounted-native-fast-start-acceptance/v1',receipts,standing:'Two complete actual normal fast-start/current native client/P/GPU/Engine+device sound/Stop activities. No subsequent Inspect may conceal stale initial client source. Delayed-first hardware race and all original workload/commission gates remain separately required.'};
}

/** Actual normal Play and subsequent SAME serial observer. This cannot mint a
 * positive from edited JSON: the custodian supplies the real mounted owner,
 * actual native source/Act/device and a score with an observable stable epoch.
 * The native branch must omit the redundant full artifact in a later pulse.
 * Each negative is followed by the complete actual Play/sound/P/GPU/Stop. */
export async function runMountedNativeRetainedSourcePulseAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 need(controller instanceof NativeFieldController&&surface.isConnected&&document.contains(surface),'the actual mounted native owner/DOM is required');
 const receipts:any[]=[];
 const positive=async()=>{
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  await observed(controller,()=>controller.scorePlayback.snapshot()?.running===true,()=>button(surface,'play-score').click());
  const startCustody=controller.scorePlayback.custody() as any,first=startCustody.first_current;
  need(first&&!startCustody.held,'the actual first current callback is absent');
  const start=readNativeActPlayback(startCustody.result,startCustody.result.native_reply.result.host_receipt.performance,startCustody.selected,startCustody.range,startCustody.cas,startCustody.request.request.request_id,startCustody.transaction_ref);
  const admitted=readActualFirstPlaybackSource(startCustody,first,start.programme,start.plan);
  await observed(controller,()=>{
   const result=controller.nativeRecording as any,returned=result?.native_reply?.result,reading=controller.musicalReading;
   return !!reading&&result?.accepted===true&&!!returned?.current_source_selection&&!!returned?.current_source_proof&&!Object.hasOwn(returned,'source_artifact')&&sameNativePlaybackJson(returned.current_source_proof.progress,first.reading.live_temporal)&&returned.native_pulse?.reading?.samples_elapsed===reading.samples_elapsed&&BigInt(reading.samples_elapsed)>BigInt(first.reading.samples_elapsed);
  });
  const original=controller.nativeRecording as any,request=controller.nativeRecordingRequest as any,returned=original.native_reply.result,reading=controller.musicalReading!,doc=original.application?.Ok?.data?.document;
  need(doc&&Object.hasOwn(original.currentness??{},'Ok')&&request.request.operation==='command'&&request.request.command.operation==='performance-inspect','the later currentness did not traverse the ordinary captured native observer and Doc CAS');
  const scene=doc.scenes.find((s:any)=>s.scene_ref===startCustody.cas.scene_ref);
  need(scene,'the actual later native Document lost its selected Scene');
  const cas={expression_ref:doc.expression_ref,document_revision:doc.revision,scene_ref:scene.scene_ref,scene_revision:scene.revision,actor:request.request.actor};
  const current=readNativePlaybackCurrentSource(returned,start.programme,start.plan,doc,cas,reading,admitted.custody);
  need(current.custody===admitted.custody&&!Object.hasOwn(returned,'source_artifact'),'the observer invented another source/artifact or retained history');
  need(BigInt(request.request.request_id)>BigInt(first.request.request.request_id)&&returned.host_receipt.request_id===request.request.request_id,'the normal observer lost its sole actual native ordinal');
  const capture=controller.nativeSoundCaptureCustody as any;
  need(controller.performance.current&&!capture.failure&&capture.current?.counters?.has_callback_readback===true&&capture.current.session_ref===reading.session_ref&&capture.current.transport_epoch===reading.transport_epoch,'the original later callback/capture was replaced by a saved source');
  need(capture.current.audio_blocks.some((block:any)=>block.output_linear.some((n:number)=>n!==0))&&capture.current.device_blocks.some((block:any)=>block.output_linear.some((n:number)=>n!==0)),'the actual later Engine and device sound were not observed');
  const physical=actualPhysicalTargets(controller,true);
  receipts.push({request:request,result:original,reading,native_max_displacement_metres:physical.maximum,full_artifact_retransmitted:false});
  await observed(controller,()=>controller.musicalReading?.device.state!=='running',()=>button(surface,'stop-score').click());
  return{original,reading,doc,cas,start,admitted};
 };
 let actual=await positive();
 const negatives:[string,(returned:any)=>void][]=[
  ['lost fresh selector',r=>{delete r.current_source_selection;}],
  ['lost fresh current proof',r=>{delete r.current_source_proof;}],
  ['null source artifact is not absence',r=>{r.source_artifact=null;}],
  ['foreign native lifetime',r=>{r.current_source_proof.session_ref='unqualified:other-session';}],
  ['foreign transport epoch',r=>{r.current_source_proof.transport_epoch='0';}],
  ['changed source without artifact',r=>{r.current_source_selection.source_index=r.current_source_selection.source_index===0?1:0;}],
  ['stopped source promoted as callback',r=>{r.native_pulse.reading.callback_output_committed=false;}]
 ];
 for(const [name,mutate] of negatives){const changed=structuredClone(actual.original.native_reply.result);mutate(changed);let refused=false;
  try{readNativePlaybackCurrentSource(changed,actual.start.programme,actual.start.plan,actual.doc,actual.cas,actual.reading,actual.admitted.custody);}catch{refused=true;}
  need(refused,name+' was accepted by the production decoder');actual=await positive();
 }
 for(const [name,prior] of [['imported source handle',{}],['copied admitted handle',structuredClone(actual.admitted.custody)]] as const){let refused=false;
  try{readNativePlaybackCurrentSource(actual.original.native_reply.result,actual.start.programme,actual.start.plan,actual.doc,actual.cas,actual.reading,prior as any);}catch{refused=true;}
  need(refused,name+' became a current source');actual=await positive();
 }
 return{schema:'oi.actual-mounted-native-retained-source-pulse-acceptance/v1',receipts,detectors:negatives.map(([name])=>name).concat(['imported source handle','copied admitted handle']),standing:'Actual normal Play, first full source, later artifact-absent native observer, original sound and P/GPU, Stop; every negative followed by complete native repeat. Requires retained owner/custodian execution and the full commissioned workload separately.'};
}

/** Real authored event edit -> same-store retained Edition -> normal Export ->
 * native restitution -> normal Play -> actual callback/P/GPU/device PCM -> Stop.
 * The custodian supplies the actual mounted editor/client and a genuinely
 * recorded note in the chosen range. No fake score, reply or device is admitted. */
export async function runMountedNativeEditedScoreAdmissionAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange,client:NativePerformanceClient,workspace:ReturnType<typeof installNativeWorkspace>){
 need(controller instanceof NativeFieldController&&client instanceof NativePerformanceClient&&surface.isConnected&&document.contains(surface),'actual mounted instrument/editor/client required');
 const receipts:any[]=[];
 for(let repeat=0;repeat<2;repeat++){
  const before=controller.score.snapshot(),body=controller.musicalReading,clientBefore=client.state.reading;
  need(before&&body&&before.stopped&&controller.scorePlayback.snapshot()?.can_export,'the actual stopped recorded score and compiled native export are required');
  const refresh=[...surface.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Refresh score'));
  need(refresh instanceof HTMLButtonElement&&!refresh.disabled,'the normal native score reader is absent');refresh!.click();await Promise.resolve();
  const event=before!.performance.pages.flatMap(page=>page.events).find(e=>e[3]===0&&typeof e[4]==='object'&&Array.isArray(e[4].n)&&e[4].n.length===4&&BigInt(e[1])>=BigInt(range.from_sample)&&BigInt(e[1])<BigInt(range.to_sample)&&surface.querySelector(`[data-performance-event="${e[0]}"]`));
  need(event,'a genuine recorded Note On in this displayed passage is required');
  const choice=surface.querySelector(`[data-performance-event="${event![0]}"]`);need(choice instanceof HTMLButtonElement,'the actual recorded event selector is absent');choice!.click();await Promise.resolve();
  const input=surface.querySelector('[aria-label="Event velocity"]');need(input instanceof HTMLInputElement,'the normal authored velocity editor is absent');
  const originalNote=(event![4] as any).n,value=originalNote[3]===0.8?0.6:0.8;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,String(value));input!.dispatchEvent(new Event('input',{bubbles:true}));await Promise.resolve();
  await observed(controller,()=>{const after=controller.score.snapshot(),state=controller.scorePlayback.snapshot();return !!after&&after.document_revision>before!.document_revision&&after.performance.pages.flatMap(page=>page.events).some(e=>e[0]===event![0]&&typeof e[4]==='object'&&(e[4] as any).n?.[3]===value)&&state?.available===true&&state.can_export;},()=>button(surface,'edit-event').click(),surface);
  const preEditCut=controller.nativeRecording;
  need(preEditCut?.accepted===true&&preEditCut.original_cut_files?.available===true&&preEditCut.native_reply?.result?.host_receipt?.request_id===controller.reading.native.last_request_id,'the edit was not preceded by its genuine same-owner stopped cut and durable original files');
  const savedBefore=workspace.inspect().file;need(savedBefore,'the actual existing normal native saved project is required for Save/readback coverage');
  const savedDocument=workspace.nativeView()?.document,saveOrdinal=controller.reading.native.last_request_id;
  const save=document.getElementById('native-save');need(save instanceof HTMLButtonElement&&!save.disabled&&save.dataset.action==='native-save','the actual app Save control is absent');
  await observed(controller,()=>{const state=workspace.inspect();return !state.busy&&!state.pending&&state.file?.document_revision===controller.score.snapshot()?.document_revision&&state.file?.document_revision!==savedBefore!.document_revision;},()=>save!.click(),surface);
  await workspace.idle();const saved=await workspace.confirmSaved();
  need(saved&&saved.document_revision===controller.score.snapshot()?.document_revision&&sameNativePlaybackJson(workspace.nativeView()?.document,savedDocument),'normal Save did not independently read back the exact edited native Document');
  need(controller.reading.native.last_request_id===saveOrdinal&&!controller.performance.current&&controller.scorePlayback.snapshot()?.available,'edited-only Save drained/re-cut/replayed native P or lost retained-score admission');
  const edited=controller.score.snapshot()!;
  need(!controller.performance.current&&!edited.playback_current&&controller.musicalReading===body&&client.state.reading===clientBefore,'authored score/Act retention granted live input or replaced actual P before native admission');
  need(sameNativePlaybackJson(edited.performance.bases,before!.performance.bases),'authored velocity edit replaced original native musical bases');
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  const exportOrdinal=controller.reading.native.last_request_id;
  await observed(controller,()=>{const exportResult=controller.scorePlayback.renderCustody() as any;return exportResult?.request?.request?.request_id===(BigInt(exportOrdinal)+1n).toString()&&exportResult.result?.accepted===true&&!exportResult.held&&typeof exportResult.file==='string';},()=>button(surface,'export-score-wav').click(),surface);
  const exported=controller.scorePlayback.renderCustody() as any,id=exported.request.request.request_id;
  const render=readNativeEditedRender(exported.result,exported.result.native_reply.result.host_receipt.performance,exported.selected,exported.range,exported.cas,id,exported.before);
  need(sameNativePlaybackJson(exported.selected.document.scenes.find((row:any)=>row.scene_ref===edited.scene_ref)?.performance.pages,edited.performance.pages),'WAV export selected another native edited Edition');
  need(!controller.performance.current&&controller.scorePlayback.snapshot()?.available&&controller.scorePlayback.snapshot()?.can_export,'stopped export granted live-input readiness or lost retained-score admission');
  need(controller.musicalReading!.samples_elapsed===body!.samples_elapsed&&controller.musicalReading!.accepted_sequence===body!.accepted_sequence,'edited export lost the original stopped native cursor/queue boundary');
  actualPhysicalTargets(controller,false);
  const playOrdinal=controller.reading.native.last_request_id;
  await observed(controller,()=>controller.scorePlayback.snapshot()?.running===true,()=>button(surface,'play-score').click(),surface);
  const playback=controller.scorePlayback.custody() as any,first=playback?.first_current,playId=playback.request.request.request_id;
  need(BigInt(playId)===BigInt(playOrdinal)+1n&&first&&!playback.first_current_pending,'normal edited Play lacks its one original request or first native callback');
  const start=readNativeActPlayback(playback.result,playback.result.native_reply.result.host_receipt.performance,playback.selected,playback.range,playback.cas,playId,playback.transaction_ref);
  readActualFirstPlaybackSource(playback,first,start.programme,start.plan);
  need(sameNativePlaybackJson(playback.selected.document,exported.selected.document),'normal Play and Export did not select the SAME actual edited native Edition');
  need(controller.performance.current&&!client.state.reason&&client.state.reading?.transport_epoch===controller.musicalReading!.transport_epoch,'the real native restitution/start ACK was lost while edited live input remained held');
  await observed(controller,()=>{const capture=controller.nativeSoundCaptureCustody as any,gpu=controller.inspectPhysicalTargets();return !!capture.current&&!capture.failure&&(gpu?.display.native_max_displacement_metres??0)>0&&capture.current.audio_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0))&&capture.current.device_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0));});
  const physical=actualPhysicalTargets(controller,true),capture=controller.nativeSoundCaptureCustody as any;
  need(capture.current.device_blocks.every((b:any)=>b.has_host_time&&b.has_device_sample_time&&b.clock_continuous),'actual edited sound lacks qualified device timestamps');
  need(['dropped_audio_blocks_at_readback','dropped_readbacks_at_readback','native_queue_overflows_at_readback','device_capture_drops','device_callback_failures','device_timestamp_discontinuities'].every(k=>capture.current.counters[k]==='0'),'actual edited performance has original capture loss');
  await observed(controller,()=>{const stopped=controller.scorePlayback.custody() as any;return stopped?.stop_result?.native_reply?.result?.host_receipt?.performance?.accepted===true&&stopped.stop_result.native_reply.result.host_receipt.performance.reading.device.state!=='running';},()=>button(surface,'stop-score').click());
  receipts.push({repeat,authored_event_sequence:event![0],authored_velocity:value,pre_edit_cut:preEditCut,actual_saved_file:saved,edited_document_revision:edited.document_revision,actual_export:exported.result,actual_wav:render.wav,actual_start:playback.result,first_current:first,actual_stop:(controller.scorePlayback.custody() as any).stop_result,native_max_displacement_metres:physical.maximum});
 }
 return{schema:'oi.actual-mounted-native-edited-score-admission-acceptance/v1',receipts,standing:'Two complete genuine pre-edit physical cuts, authored velocity edits, ordinary native Save/readback and normal Export/restitution/Play/current source/callback/P/GPU/device sound/Stop passages. Native eligible-cut refusals, WAV bit equality, other score branches, save/reopen, all original workload and owner live delivery remain required.'};
}

/** Actual current-device gate: derives positives only from the mounted native
 * programme, AUHAL capture and original Engine PCM. Negative copies cannot
 * authorize a source. Repeat complete real normal activity after every refusal. */
export async function runMountedNativeDeviceEpochAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 need(controller instanceof NativeFieldController&&surface.isConnected&&document.contains(surface),'actual mounted native controller/DOM required');
 const receipts=[];
 const observe=async()=>{
  await runMountedNativeScorePlaybackAcceptance(controller,surface,range);
  const custody=controller.scorePlayback.custody() as any,first=custody?.first_current;
  need(first&&custody.result?.accepted===true&&!custody.first_current_pending,'actual first current native device output absent');
  const programme=custody.result.native_reply.result.native_programme_admission,returned=first.result.native_reply.result,reading=first.reading;
  need(hasNativePlaybackDeviceCallback(returned,programme,reading),'original mounted output did not qualify its actual DeviceStart epoch/PCM/source span');
  receipts.push({request:first.request,result:first.result,reading,start:reading.device.start_epoch,baseline:reading.device.start_callback_baseline});
  return{programme,returned,reading};
 };
 const actual=await observe(),mutants:Array<[string,(r:any)=>void]>=[
  ['prior device epoch',r=>{for(const b of r.native_pulse.native_capture.device_blocks)b.device_epoch=String(BigInt(r.native_pulse.reading.device.start_epoch)-1n);}],
  ['offline Engine capture only',r=>{r.native_pulse.native_capture.device_blocks=[];}],
  ['unadvanced actual callback baseline',r=>{r.native_pulse.reading.device.start_callback_baseline=r.native_pulse.reading.device.callbacks;}],
  ['foreign device',r=>{for(const b of r.native_pulse.native_capture.device_blocks)b.device_id=b.device_id===1?2:1;}],
  ['missing device clock validity',r=>{for(const b of r.native_pulse.native_capture.device_blocks)b.clock_continuous=false;}],
  ['replaced actual device PCM bit',r=>{for(const b of r.native_pulse.native_capture.device_blocks)b.output_linear[0]=Object.is(b.output_linear[0],0)?-0:0;}],
  ['foreign current source span',r=>{for(const a of r.native_pulse.native_capture.audio_blocks)for(const span of a.source_spans??[])span.source_ref+=':foreign';}]
 ];
 for(const[name,mutate]of mutants){const returned=structuredClone(actual.returned);mutate(returned);let refused=false;try{refused=!hasNativePlaybackDeviceCallback(returned,actual.programme,returned.native_pulse.reading);}catch{refused=true;}need(refused,'actual current-device negative was admitted: '+name);await observe();}
 return{schema:'oi.actual-mounted-native-device-epoch-acceptance/v1',receipts,detectors:mutants.map(([name])=>name),standing:'Original actual DeviceStart epoch/baseline, valid AUHAL output, bit-equal native Engine PCM and full source spans with complete real independent passage after every negative. No replaced positive or inferred epoch.'};
}

/** This hardware case needs a genuinely rendered stopped prelude and a delayed
 * first AUHAL callback. Earlier offline Engine output must remain historical. */
export async function runMountedNativeOfflinePreludeDeviceAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange,client:NativePerformanceClient){
 const receipts=[];
 for(let repeat=0;repeat<2;repeat++){
  const stopped=controller.scorePlayback.snapshot()?.checkpoints.find(row=>row.index===range.checkpoint_index);
  need(stopped&&BigInt(range.from_sample)>BigInt(stopped.sample),'the real selected cut/range must require a stopped reconstruction prelude');
  const actual=await runMountedNativeFirstCallbackAcceptance(controller,surface,range,client);
  const start=actual.original_start.native_reply.result,reading=start.native_pulse.reading,programme=start.native_programme_admission;
  need(reading.callback_output_committed===true&&start.native_pulse.payload.live_source_pending===true,'the actual offline-callback/device-not-yet-current race was not observed');
  need(!hasNativePlaybackDeviceCallback(start,programme,reading),'prior offline sound was admitted as current AUHAL output');
  const first=actual.first_current;
  need(hasNativePlaybackDeviceCallback(first.result.native_reply.result,programme,first.reading),'the subsequent SAME native observer did not carry actual current-epoch device PCM');
  receipts.push(actual);
 }
 return{schema:'oi.actual-mounted-native-offline-prelude-device-acceptance/v1',receipts,standing:'Two actual prelude/accepted Start/device-pending/SAME observer/current AUHAL source and PCM/visible body/Stop activities. No replaced callback, epoch or positive.'};
}


/** Source8's actual stopped admission and prior restitution come from the
 * ordinary mounted Play path. Remove complete original descriptors only as
 * negatives; every refusal repeats the full genuine native device passage. */
export async function runMountedNativeProgrammeCustodyAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 const receipts:any[]=[];
 const observe=async()=>{
  await runMountedNativeScorePlaybackAcceptance(controller,surface,range);
  const custody=controller.scorePlayback.custody() as any;
  need(custody?.first_current&&!custody.first_current_pending&&!custody.held,'actual full native programme/current-device passage absent');
  readNativeActPlayback(custody.result,custody.result.native_reply.result.host_receipt.performance,custody.selected,custody.range,custody.cas,custody.request.request.request_id,custody.transaction_ref);
  receipts.push(custody);return custody;
 };
 await observe();const original=await observe();
 need(original.result.original_playback_files.files.some((row:any)=>row.descriptor.kind==='playback.prior_resident_restoration'),'actual repeated normal Play did not exercise prior live restitution');
 const omit=(result:any,kind:string)=>{result.original_playback_files.files=result.original_playback_files.files.filter((row:any)=>row.descriptor.kind!==kind);result.diagnostics.receipts=result.diagnostics.receipts.filter((row:any)=>row.descriptor.kind!==kind);};
 const mutations:Array<[string,(result:any)=>void]>=[
  ['lost actual stopped prepare',r=>omit(r,'playback.programme.stopped_prepare')],
  ['lost actual original programme request',r=>omit(r,'playback.programme.original_request')],
  ['lost prior restitution request',r=>omit(r,'playback.prior_resident_restoration_original_request')],
  ['manufactured numeric size bound',r=>{r.native_reply.result.native_programme_admission.maximum_normal_pulse_bytes=Number(r.native_reply.result.native_programme_admission.maximum_normal_pulse_bytes);}],
  ['stopped programme wrong original index',r=>{for(const rows of [r.original_playback_files.files,r.diagnostics.receipts])for(const row of rows)if(row.descriptor.kind==='playback.programme.stopped_prepare')row.descriptor.original_index='1';}],
  ['prior restoration wrong original family',r=>{for(const rows of [r.original_playback_files.files,r.diagnostics.receipts])for(const row of rows)if(row.descriptor.kind==='playback.prior_resident_restoration')row.descriptor.kind='playback.resident_restoration';}]
 ];
 for(const[name,mutate]of mutations){const changed=structuredClone(original.result);mutate(changed);let refused=false;try{readNativeActPlayback(changed,changed.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,original.request.request.request_id,original.transaction_ref);}catch{refused=true;}need(refused,'original programme custody negative was admitted: '+name);await observe();}
 return{schema:'oi.actual-mounted-native-programme-custody-acceptance/v1',receipts,detectors:mutations.map(([name])=>name),standing:'Actual normal repeated Play/Stop, installed stopped programme, qualified prior restitution and current device/Engine/P/source originals; complete genuine native passage after every negative. Native file/ACK/full-state detectors remain paired C63 duties.'};
}


/** Requires a genuine recorded programme with a physical epoch followed by a
 * same-body M4 epoch. Every positive is the normal mounted Play/device/P/pulse
 * activity; only negative copies are mutated. No native reply is fabricated. */
export async function runMountedNativeAcousticObservationAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange){
 need(controller instanceof NativeFieldController&&surface.isConnected&&document.contains(surface),'actual mounted native controller/DOM required');
 const receipts:any[]=[];
 const positive=async()=>{
  need(controller.scorePlayback.snapshot()?.available,'actual recorded mixed-source programme and native caller required');
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  const originalOrdinal=controller.reading.native.last_request_id;
  let physical:{batch:NativeCaptureBatch,reading:NativePerformanceReading}|undefined,acoustic:typeof physical;
  const seen=new Set<NativeCaptureBatch>();
  const collect=()=>{
   const actual=controller.nativeSoundCaptureCustody as any,reading=controller.musicalReading,custody=controller.scorePlayback.custody() as any;
   if(custody?.request?.request?.request_id!==(BigInt(originalOrdinal)+1n).toString()||!custody.first_current||custody.first_current_pending)return;
   need(!actual.failure,'the actual native mixed-source capture failed: '+String(actual.failure));
   if(!actual.current||!reading||seen.has(actual.current))return;
   // Only the two required original observations are retained, never a second
   // browser performance history. The native Act store owns historical pages.
   need(reading.live_temporal?.programme_ref===custody.result.native_reply.result.native_programme_admission.programme_ref,'mixed-source observation belongs to a previous programme');
   const batch=readNativeCapture(actual.current,reading);seen.clear();seen.add(actual.current);
   if(!physical&&batch.source_applications?.some(row=>row.kind===0))physical={batch,reading};
   if(!acoustic&&batch.source_applications?.some(row=>row.kind===1&&row.physical.before_energy_joules>0))acoustic={batch,reading};
  };
  await observed(controller,()=>{
   collect();const custody=controller.scorePlayback.custody() as any,capture=controller.nativeSoundCaptureCustody as any;
   return !!physical&&!!acoustic&&!!custody?.first_current&&!custody.first_current_pending&&controller.scorePlayback.snapshot()?.running===true&&capture.current?.audio_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0))&&capture.current?.device_blocks.some((b:any)=>b.output_linear.some((v:number)=>v!==0));
  },()=>button(surface,'play-score').click(),surface);
  const custody=controller.scorePlayback.custody() as any;
  need(custody.request.request.request_id===(BigInt(originalOrdinal)+1n).toString(),'mixed-source normal Play used another outer counter');
  const first=custody.first_current,start=readNativeActPlayback(custody.result,custody.result.native_reply.result.host_receipt.performance,custody.selected,custody.range,custody.cas,custody.request.request.request_id,custody.transaction_ref);
  readActualFirstPlaybackSource(custody,first,start.programme,start.plan);need(hasNativePlaybackDeviceCallback(first.result.native_reply.result,start.programme,first.reading),'mixed-source positive has no real current-device output');
  for(const observation of [physical!,acoustic!]){
   need(captureCounterNames.every(k=>observation.batch.counters[k]==='0'),'mixed-source original capture has observed loss');
   for(const row of observation.batch.source_applications??[])readSourceApplication(row,observation.reading.samples_elapsed);
  }
  const gpu=actualPhysicalTargets(controller,true);
  await observed(controller,()=>{const stopped=controller.scorePlayback.custody() as any;return stopped?.stop_result?.native_reply?.result?.host_receipt?.performance?.accepted===true&&stopped.stop_result.native_reply.result.host_receipt.performance.reading.device.state!=='running';},()=>button(surface,'stop-score').click());
  const entry={request:custody.request,start:custody.result,first_current:first,physical:physical!,acoustic:acoustic!,native_max_displacement_metres:gpu.maximum,stop:(controller.scorePlayback.custody() as any).stop_result};receipts.push(entry);return entry;
 };
 let actual=await positive();
 const mutations:Array<[string,'physical'|'acoustic',(row:any)=>void]>=[
  ['acoustic default physical receipt','acoustic',r=>{r.physical.kind=0;r.physical.policy=0;}],
  ['acoustic mismatched transaction','acoustic',r=>{r.physical.transaction='0';}],
  ['acoustic changed body revision','acoustic',r=>{r.physical.after_revision=String(BigInt(r.physical.after_revision)+1n);}],
  ['acoustic wrong observed sample','acoustic',r=>{r.physical.samples_elapsed=String(BigInt(r.playback_sample)+1n);}],
  ['acoustic changed measured energy','acoustic',r=>{r.physical.after_energy_joules=r.physical.before_energy_joules===Number.MAX_VALUE?0:Number.MAX_VALUE;}],
  ['acoustic negative-zero external work','acoustic',r=>{r.physical.external_work_joules=-0;}],
  ['acoustic nonzero external work','acoustic',r=>{r.physical.external_work_joules=1;}],
  ['acoustic missing complete observation','acoustic',r=>{delete r.physical.samples_elapsed;}],
  ['physical observation-policy substitution','physical',r=>{r.physical.kind=2;r.physical.policy=2;}],
  ['physical changed actual energy/work','physical',r=>{r.physical.external_work_joules=r.physical.external_work_joules===0?1:0;}]
 ];
 for(const[name,kind,mutate]of mutations){
  const observation=actual[kind],changed=structuredClone(observation.batch);
  for(const row of changed.source_applications??[])if(row.kind===(kind==='physical'?0:1))mutate(row);
  let refused=false;try{readNativeCapture(changed,observation.reading);}catch{refused=true;}
  need(refused,'mixed-source original negative was admitted: '+name);actual=await positive();
 }
 return{schema:'oi.actual-mounted-native-acoustic-observation-acceptance/v1',receipts,detectors:mutations.map(([name])=>name),standing:'Actual normal mixed-source Play, original physical and nonzero same-P M4 receipts, real current-device sound/Engine PCM/P/GPU/Stop; full independent native passage after each strict production-decoder refusal. Native checkpoint/cold restitution/source lease and full workload remain separate required activities.'};
}

/** Drives the actual route/automation editor, installed programme, device
 * callback, stopped native cut, FileSave/readback, exact owner close, FileOpen
 * and ordinary selected-body Continue. Positives are never rewritten JSON.
 * The actual app/NativeHost must call this on its mounted owner and saved work. */
export async function runMountedNativeInstrumentRampAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange,workspace:ReturnType<typeof installNativeWorkspace>){
 need(controller instanceof NativeFieldController&&surface.isConnected&&document.contains(surface),'the real mounted instrument/editor is required');
 const initial=controller.score.snapshot(),file=workspace.inspect().file;
 need(initial?.stopped&&controller.performance.current&&file&&controller.scorePlayback.snapshot()?.available,'the actual stopped saved native performance and compiled programme are required');
 const from=(BigInt(range.from_sample)+128n).toString(),to=(BigInt(range.from_sample)+4096n).toString();
 need(BigInt(to)<BigInt(range.to_sample),'the real range must contain the complete authored automation passage');
 const refresh=[...surface.querySelectorAll('button')].find(value=>value.textContent?.startsWith('Refresh score'));
 need(refresh instanceof HTMLButtonElement&&!refresh.disabled,'the actual retained score reader is absent');refresh!.click();await Promise.resolve();
 const authored=[];
 for(const target of nativeInstrumentRampTargets){
  let score=controller.score.snapshot()!;
  const index=score.performance.parameters.findIndex(value=>value.target_ref===target),parameter=score.performance.parameters[index];
  need(parameter&&parameter.scope==='instrument'&&parameter.native_owner==='ql.performance.Engine'&&BigInt(parameter.smoothing_samples)>0n,'an actual enum parameter with native smoothing is unavailable: '+target);
  const routeCount=score.performance.routes.length,revision=score.document_revision;
  authoredSelect(surface,'Automation destination',index);
  const amount=(parameter.maximum-parameter.minimum)/16*(parameter.baseline>(parameter.minimum+parameter.maximum)/2?-1:1);
  need(Number.isFinite(amount)&&amount!==0,'the actual parameter has no nonzero authored automation range');
  authoredInput(surface,'Automation route amount',String(amount));await Promise.resolve();
  await observed(controller,()=>{const next=controller.score.snapshot();return !!next&&next.document_revision>revision&&next.performance.routes.length===routeCount+1;},()=>button(surface,'route-create').click(),surface);
  score=controller.score.snapshot()!;const route=score.performance.routes[routeCount];
  need(route.enabled&&route.transfer==='add'&&route.amount===amount&&sameNativePlaybackJson(route.destination,parameter),'ordinary route creation replaced its actual native target or smoothing policy');
  authoredSelect(surface,'Retained automation route',routeCount);authoredInput(surface,'Automation start sample',from);authoredInput(surface,'Automation end sample',to);authoredInput(surface,'Automation start value','0');authoredInput(surface,'Automation end value','1');await Promise.resolve();
  const before=score.document_revision;
  await observed(controller,()=>{const next=controller.score.snapshot();return !!next&&next.document_revision>before&&next.performance.pages.flatMap(page=>page.events).filter(event=>typeof event[4]==='object'&&Array.isArray((event[4] as any).a)&&(event[4] as any).a[0]===routeCount).length===2;},()=>button(surface,'automate').click(),surface);
  authored.push({route_ref:route.route_ref,target_ref:target,native_smoothing_samples:parameter.smoothing_samples,amount,from_sample:from,to_sample:to});
 }
 const receipts:any[]=[];
 const passage=async()=>{
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  await observed(controller,()=>controller.scorePlayback.snapshot()?.running===true,()=>button(surface,'play-score').click(),surface);
  await observed(controller,()=>{const reading=controller.musicalReading,capture=controller.nativeSoundCaptureCustody as any;return !!reading?.instrument_parameter_ramps&&reading.instrument_parameter_ramps.every(row=>row.duration_samples!=='0'&&BigInt(row.start_sample)>=BigInt(to)&&row.remaining_samples==='0')&&capture.current?.audio_blocks.some((block:any)=>block.output_linear.some((value:number)=>value!==0))&&capture.current?.device_blocks.some((block:any)=>block.output_linear.some((value:number)=>value!==0));});
  const played=controller.musicalReading!,capture=controller.nativeSoundCaptureCustody as any;
  readPerformance(played);actualPhysicalTargets(controller,true);
  need(!capture.failure&&captureCounterNames.every(name=>capture.current.counters[name]==='0'),'the actual automation passage lost original audio/device evidence');
  for(let index=0;index<nativeInstrumentRampTargets.length;index++){
   const row=played.instrument_parameter_ramps![index],parameter=played.parameters.find(value=>value.target_ref===nativeInstrumentRampTargets[index])!,route=controller.score.snapshot()!.performance.routes.find(value=>value.route_ref===authored[index].route_ref)!;
   need(Object.is(row.target_value,route.destination.baseline+route.amount)&&Object.is(parameter.effective,row.target_value),'the authored route target was not actually applied by the same native callback');
   const output=surface.querySelector(`[data-performance-ramp="${parameter.target_ref}"]`);need(output instanceof HTMLOutputElement&&output.textContent?.includes('reached'),'the visible control is disconnected from its actual completed native ramp');
  }
  await observed(controller,()=>controller.musicalReading?.device.state!=='running',()=>button(surface,'stop-score').click(),surface);
  const beforeFile=workspace.inspect().file,save=document.getElementById('native-save');
  need(beforeFile&&save instanceof HTMLButtonElement&&!save.disabled&&save.dataset.action==='native-save','the actual saved-project Save control is unavailable');
  await observed(controller,()=>{const state=workspace.inspect(),cut=controller.nativeRecording;return !state.busy&&!state.pending&&state.file?.revision!==beforeFile!.revision&&cut?.accepted===true&&cut.original_cut_files?.available===true;},()=>save!.click(),surface);
  await workspace.idle();const saved=await workspace.confirmSaved(),savedDocument=structuredClone(workspace.nativeView()?.document),cutResult=controller.nativeRecording,stopped=controller.musicalReading!;
  need(saved&&savedDocument&&cutResult?.accepted===true&&cutResult.original_cut_files?.available===true&&Object.hasOwn(cutResult.currentness??{},'Ok'),'Save lacks its genuine stopped cut, durable originals or independent file readback');
  const stoppedCapture=controller.nativeSoundCaptureCustody as any;
  need(stoppedCapture.current&&!stoppedCapture.failure&&captureCounterNames.every(name=>stoppedCapture.current.counters[name]==='0'),'the final genuine stopped pulse exposes capture loss; a declared poll cadence is not evidence of zero loss');
  const actualSaved=saved!,actualDocument=savedDocument!;
  const scene=actualDocument.scenes.find(value=>value.scene_ref===controller.score.snapshot()!.scene_ref),performance=scene?.performance as any,cut=performance?.checkpoints?.find((value:any)=>value.checkpoint_ref===controller.nativeRecordingRequest?.request?.checkpoint_ref);
  need(cut&&cut.acknowledged_stopped&&cut.sample===stopped.samples_elapsed&&cut.audio.schema==='ql.performance-checkpoint/v6'&&cut.audio.has_instrument_ramps===true,'the native saved checkpoint did not preserve the actual ramp extension');
  need(sameNativePlaybackJson(cut.audio.instrument_parameter_ramps,stopped.instrument_parameter_ramps),'the native cut rows differ from the same stopped reading');
  const fields=['force_newtons','attack_seconds','release_seconds','cutoff_hertz','master_linear','body_linear','monitor_linear'];
  for(let index=0;index<fields.length;index++){const row=cut.audio.instrument_parameter_ramps[index],parameter=stopped.parameters.find(value=>value.target_ref===nativeInstrumentRampTargets[index])!;need(Object.is(cut.audio.source_parameters[fields[index]],row.target_value)&&Object.is(cut.audio.effective_parameters[fields[index]],parameter.effective),'the actual full native checkpoint source/effective state differs from its row/readback');}
  const oldLease=controller.reading.lease;
  await controller.release();const closed=controller.reading.lifetime;
  need(!closed.close_pending&&!closed.close_error&&closed.last_close?.closed===true&&closed.last_close.lease===oldLease&&!controller.musicalReading,'the exact real native owner did not acknowledge close');
  need(await workspace.openFile(actualSaved.location.path,{location:actualSaved.location,revision:actualSaved.revision,expression_ref:actualSaved.expression_ref})===true,'the ordinary native FileOpen refused the actual saved revision');await workspace.idle();
  need(sameNativePlaybackJson(workspace.nativeView()?.document,actualDocument),'cold FileOpen substituted another full native Document');
  const prepare=document.querySelector('[data-performance="prepare-current-scene"]');need(prepare instanceof HTMLButtonElement&&!prepare.disabled,'the ordinary selected-body Continue control is absent');
  await observed(controller,()=>!!controller.nativeContinuation&&controller.performance.current,()=>(prepare as HTMLButtonElement).click(),surface);
  const continuation=controller.nativeContinuation!,restored=controller.musicalReading!,reply=continuation.result?.native_reply?.result;
  need(continuation.result?.accepted===true&&reply?.host_receipt?.performance?.operation==='performance-continue-act'&&continuation.result.original_continuation_files?.available===true,'reopen did not use the genuine native saved-source Continue and durable originals');
  need(reply.retained_source_selection?.checkpoint_ref===cut.checkpoint_ref&&restored.samples_elapsed===cut.sample&&sameNativePlaybackJson(restored.instrument_parameter_ramps,cut.audio.instrument_parameter_ramps),'the actual restored source/cut/ramp state differs from the saved native owner');
  need(controller.nativeOutputCalibration.declaration===null,'saved Continue reapplied fresh instrument calibration');
  for(let index=0;index<fields.length;index++)need(Object.is(restored.parameters.find(value=>value.target_ref===nativeInstrumentRampTargets[index])?.effective,cut.audio.effective_parameters[fields[index]]),'the cold native effective parameter changed');
  actualPhysicalTargets(controller,false);
  const original={played,capture:capture.current,cut_result:cutResult,saved_file:saved,saved_document:savedDocument,checkpoint:cut,close:closed.last_close,continuation,restored};receipts.push(original);return original;
 };
 let actual=await passage();
 const mutations:Array<[string,(reading:any)=>void]>=[
  ['lost native row',reading=>reading.instrument_parameter_ramps.pop()],
  ['extra ramp field',reading=>reading.instrument_parameter_ramps[0].source='unqualified'],
  ['remaining greater than native duration',reading=>reading.instrument_parameter_ramps[0].remaining_samples=String(BigInt(reading.instrument_parameter_ramps[0].duration_samples)+1n)],
  ['foreign future ramp date',reading=>reading.instrument_parameter_ramps[0].start_sample=String(BigInt(reading.samples_elapsed)+1n)],
  ['noncanonical native count',reading=>reading.instrument_parameter_ramps[0].duration_samples='01'],
  ['changed actual effective value',reading=>{const value=reading.parameters.find((parameter:any)=>parameter.target_ref===nativeInstrumentRampTargets[0]);value.effective=value.effective===value.minimum?value.maximum:value.minimum;}],
  ['foreign Engine parameter',reading=>reading.parameters.find((parameter:any)=>parameter.target_ref===nativeInstrumentRampTargets[0]).native_owner='foreign'],
  ['foreign physical sample rate',reading=>reading.physical.sample_rate=reading.physical.sample_rate===48000?96000:48000],
  ['inactive signed-zero state',reading=>reading.instrument_parameter_ramps[0]={start_value:-0,target_value:0,start_sample:'0',duration_samples:'0',remaining_samples:'0'}]
 ];
 for(const [name,mutate] of mutations){const changed=structuredClone(actual.played);mutate(changed);let refused=false;try{readPerformance(changed);}catch{refused=true;}need(refused,'the production native ramp decoder admitted '+name);actual=await passage();}
 return{schema:'oi.actual-mounted-native-instrument-ramp-acceptance/v1',authored,receipts,detectors:mutations.map(([name])=>name),standing:'Real normal seven-target route/automation edits, native programme and current device sound/body/GPU, stopped CPv6 cut, Save/readback, exact native close, same-file cold reopen and saved-source Continue; complete genuine passage repeated after every negative. Native in-progress/interruption/N0/full-queue CP cases remain mandatory paired producer activities; this driver does not claim they occurred from completed rows.'};
}

/** Requires two genuine retained score ranges: an actual no-route named
 * vector-force+note passage and an actual operative N9 passage. Both run through
 * normal Play, the one native pump, current AUHAL/Engine/P/GPU and Stop.
 * A copied capture is used only to test refusal, never as a positive source. */
export async function runMountedNativeScalarSourceForceAcceptance(controller:NativeFieldController,surface:HTMLElement,ranges:{scalar:NativeScorePlaybackRange;routed:NativeScorePlaybackRange}){
 need(controller instanceof NativeFieldController&&surface.isConnected&&document.contains(surface),'the actual mounted native instrument and retained force passages are required');
 const receipts:any[]=[];
 const passage=async(kind:'scalar'|'routed')=>{
  need(controller.scorePlayback.snapshot()?.available,'the genuine retained score/native programme is unavailable');
  const range=ranges[kind];
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  const before=controller.reading.native.last_request_id,expected=(BigInt(before)+1n).toString();
  let original:{batch:NativeCaptureBatch;reading:NativePerformanceReading;native_result:any;audio_index:number;span_index:number}|undefined;
  await observed(controller,()=>{
   const custody=controller.scorePlayback.custody() as any,reading=controller.musicalReading,result=controller.nativeRecording;
   if(custody?.request?.request?.request_id!==expected||!custody.first_current||custody.first_current_pending||!reading||!result)return false;
   const start=custody.result.native_reply.result,returned=result.native_reply?.result,pulse=returned?.native_pulse;
   if(!pulse||!sameNativePlaybackJson(pulse.reading,reading))return false;
   need(controller.performance.current&&!controller.nativeSoundCaptureCustody.failure,'the actual current source or original capture is held');
   if(!hasNativePlaybackDeviceCallback(returned,start.native_programme_admission,reading))return false;
   const batch=readNativeCapture(pulse.native_capture,reading);
   need(captureCounterNames.every(name=>batch.counters[name]==='0'),'the real force passage reports lost original callback/device evidence');
   for(let audio_index=0;audio_index<batch.audio_blocks.length;audio_index++){
    const audio=batch.audio_blocks[audio_index];if(audio.schema!=='ql.native-audio-capture/v2')continue;
    for(let span_index=0;span_index<audio.source_spans!.length;span_index++){
     const span=audio.source_spans![span_index];
     if(!span.source_force_programme_ref||!span.source_force_occurrences.length||(span.route_manifest===null)!==(kind==='scalar'))continue;
     const end=span.offset+span.frames;
     if(!audio.source_force_absolute_load_newtons!.slice(span.offset,end).some(value=>value>0)||!audio.note_force_newtons.slice(span.offset,end).some(value=>value!==0)||!audio.output_linear.slice(span.offset,end).some(value=>value!==0))continue;
     const at=BigInt(audio.start_sample)+BigInt(span.offset),stop=at+BigInt(span.frames);
     // The current native epoch/id/clock and full PCM parity are checked above.
     // Require nonzero ORIGINAL device samples that overlap this force span.
     if(!batch.device_blocks.some(block=>block.device_epoch===reading.device.start_epoch&&block.device_id===reading.device.device_id&&block.has_host_time&&block.has_device_sample_time&&block.clock_continuous&&block.output_linear.some((value,index)=>value!==0&&BigInt(block.native_start_sample)+BigInt(index)>=at&&BigInt(block.native_start_sample)+BigInt(index)<stop)))continue;
     original={batch,reading,native_result:result,audio_index,span_index};return controller.scorePlayback.snapshot()?.running===true;
    }
   }
   return false;
  },()=>button(surface,'play-score').click(),surface);
  need(original,'the actual callback never produced the required native vector-force, note, physical pickup and current device output');
  const custody=controller.scorePlayback.custody() as any,start=readNativeActPlayback(custody.result,custody.result.native_reply.result.host_receipt.performance,custody.selected,custody.range,custody.cas,expected,custody.transaction_ref);
  readActualFirstPlaybackSource(custody,custody.first_current,start.programme,start.plan);
  const observation=original!,audio=observation.batch.audio_blocks[observation.audio_index],span=audio.source_spans![observation.span_index],gpu=actualPhysicalTargets(controller,true);
  need(span.source_force_occurrences.length>0,'the actual force observation has no original authored Newton occurrence in its span');
  if(kind==='scalar')need(span.source_force_receipt!.scalar_m1.enabled===true&&Object.is(span.source_force_receipt!.scalar_m1.gain,1)&&span.physical_routes.routes.length===0,'the no-route passage lost its actual scalar witness or credited a default N9 receipt');
  else need(!Object.hasOwn(span.source_force_receipt!,'scalar_m1')&&span.route_manifest!==null&&span.physical_routes.routes.length>0,'the actual routed force passage lost its operative N9 observation');
  await observed(controller,()=>{const stop=(controller.scorePlayback.custody() as any)?.stop_result?.native_reply?.result;return stop?.host_receipt?.performance?.accepted===true&&stop.host_receipt.performance.reading.device.state!=='running';},()=>button(surface,'stop-score').click(),surface);
  const entry={kind,request:custody.request,start:custody.result,first_current:custody.first_current,observation,native_max_displacement_metres:gpu.maximum,stop:(controller.scorePlayback.custody() as any).stop_result};receipts.push(entry);return entry;
 };
 let scalar=await passage('scalar'),routed=await passage('routed');
 const mutants:Array<[string,'scalar'|'routed',(audio:any,span:any)=>void]>=[
  ['missing original scalar witness','scalar',(_a,s)=>{delete s.source_force_receipt.scalar_m1;}],
  ['partial scalar witness','scalar',(_a,s)=>{delete s.source_force_receipt.scalar_m1.gain;}],
  ['extra scalar source grant','scalar',(_a,s)=>{s.source_force_receipt.scalar_m1.source_ref='unqualified';}],
  ['disabled actual M1 scalar','scalar',(_a,s)=>{s.source_force_receipt.scalar_m1.enabled=false;}],
  ['changed actual unit gain','scalar',(_a,s)=>{s.source_force_receipt.scalar_m1.gain=0;}],
  ['signed changed scalar gain','scalar',(_a,s)=>{s.source_force_receipt.scalar_m1.gain=-1;}],
  ['changed original force total','scalar',(_a,s)=>{s.source_force_receipt.peak_total_absolute_force_newtons=Number.MAX_VALUE;}],
  ['disconnected original scalar samples','scalar',(a,s)=>{a.force_newtons[s.offset]=Number.MAX_VALUE;}],
  ['wrong native callback date','scalar',(_a,s)=>{s.source_force_receipt.end_sample=String(BigInt(s.source_force_receipt.end_sample)+1n);}],
  ['unbounded native body force','scalar',(_a,s)=>{s.physical_body.max_force_newtons=0;}],
  ['default N9 scalar receipt promoted','scalar',(_a,s)=>{s.physical_routes.scalar_m1_enabled=true;s.physical_routes.scalar_m1_gain=1;}],
  ['scalar witness on actual routed receipt','routed',(_a,s)=>{s.source_force_receipt.scalar_m1={enabled:true,gain:1};}],
  ['operative N9 manifest lost','routed',(_a,s)=>{s.route_manifest=null;}]
 ];
 for(const [name,kind,mutate] of mutants){
  const actual=kind==='scalar'?scalar:routed,observation=actual.observation,changed=structuredClone(observation.batch),audio=changed.audio_blocks[observation.audio_index],span=audio.source_spans![observation.span_index];
  mutate(audio,span);let refused=false;try{readNativeCapture(changed,observation.reading);}catch{refused=true;}
  need(refused,'the production temporal capture reader admitted '+name);
  const repeated=await passage(kind);if(kind==='scalar')scalar=repeated;else routed=repeated;
 }
 return{schema:'oi.actual-mounted-native-scalar-source-force-acceptance/v1',receipts,detectors:mutants.map(([name])=>name),standing:'Actual normal scalar and operative N9 score Play/Stop, same original source-force/note/P/current-device PCM/full source proof/GPU, with complete genuine passage after each production-decoder refusal. Genuine native cold PCM/queues, cancellation load, future Form/M2/M4 and all workload activities remain mandatory paired producer gates; this driver does not mint or substitute their inputs.'};
}

/** Required genuine changed-body/M4 passage. The custodian supplies the actual
 * authored retained score/range and mounted saved project. Each repetition
 * plays that score through real source epochs and current device PCM, exports
 * via the ordinary control, saves/closes/reopens the same file and Continues
 * the real stopped checkpoint. Copied JSON is used only for negative decoders. */
export async function runMountedNativeChangedBodyExportAcceptance(controller:NativeFieldController,surface:HTMLElement,range:NativeScorePlaybackRange,workspace:ReturnType<typeof installNativeWorkspace>){
 need(controller instanceof NativeFieldController&&surface instanceof HTMLElement&&surface.isConnected&&document.contains(surface),'the actual mounted saved Expressions controller/DOM is required');
 const receipts:any[]=[];
 const passage=async()=>{
  need(controller.musicalReading?.available&&controller.musicalReading.device.state!=='running','the genuine stopped native source must already be prepared or Continued');
  if(controller.musicalReading.device.state!=='prepared'){
   const open=[...surface.querySelectorAll('button')].find(value=>value.textContent?.trim()==='Open at 48 kHz');
   need(open instanceof HTMLButtonElement&&!open.disabled,'the ordinary actual selected-output Open control is unavailable');
   await observed(controller,()=>controller.musicalReading?.device.state==='prepared',()=>open!.click(),surface);
  }
  const prePlay=controller.musicalReading!;
  setRange(surface,'score-from',range.from_sample);setRange(surface,'score-to',range.to_sample);chooseCut(surface,range.checkpoint_index);await Promise.resolve();
  await observed(controller,()=>controller.scorePlayback.snapshot()?.running===true,()=>button(surface,'play-score').click(),surface);
  const start=controller.scorePlayback.custody() as any;
  const admitted=readNativeActPlayback(start.result,start.result.native_reply.result.host_receipt.performance,start.selected,start.range,start.cas,start.request.request.request_id,start.transaction_ref);
  need(admitted.programme.steps.some((step:any)=>step.kind===0)&&admitted.programme.steps.some((step:any)=>step.kind===1),'this actual score has no genuine physical and acoustic source transitions; it cannot count as changed-body/M4 coverage');
  await observed(controller,()=>{
   const proof=controller.nativeRecording?.native_reply?.result?.current_source_proof;
   const sound=controller.nativeSoundCaptureCustody as any;
   return !!proof&&proof?.progress?.next===admitted.programme.steps.length&&proof.progress.next>0&&controller.musicalReading?.scope.body_revision!==prePlay.scope.body_revision&&!sound.failure&&sound.current?.audio_blocks.some((block:any)=>block.output_linear.some((value:number)=>value!==0))&&sound.current?.device_blocks.some((block:any)=>block.output_linear.some((value:number)=>value!==0));
  },undefined,surface);
  const performed=controller.scorePlayback.custody() as any,source=performed.source_observation;
  need(source,'the actual final epoch lost its one complete original native source return');
  const prior=readNativePlaybackCurrentSource(source.result.native_reply.result,admitted.programme,admitted.plan,source.document,source.cas,source.reading).custody;
  const currentResult=controller.nativeRecording!,currentReading=controller.musicalReading!,currentDocument=workspace.nativeView()?.document,currentScene=currentDocument?.scenes.find(value=>value.scene_ref===start.cas.scene_ref);
  need(currentDocument&&currentScene&&sameNativePlaybackJson(currentResult.native_reply.result.host_receipt.performance.reading,currentReading),'the actual final callback/current whole Document is unavailable');
  const currentCas={expression_ref:currentDocument!.expression_ref,document_revision:currentDocument!.revision,scene_ref:currentScene!.scene_ref,scene_revision:currentScene!.revision as number,actor:controller.nativeRecordingRequest!.request.actor};
  const performedSource=readNativePlaybackCurrentSource(currentResult.native_reply.result,admitted.programme,admitted.plan,currentDocument,currentCas,currentReading,prior);
  need(hasNativePlaybackDeviceCallback(currentResult.native_reply.result,admitted.programme,currentReading),'a stopped or previous-device callback was counted as the performed body/source');
  need(performedSource.proof.progress.next===admitted.programme.steps.length,'the actual last source application was not output committed');
  const sound=controller.nativeSoundCaptureCustody as any;need(sound.current&&!sound.failure&&captureCounterNames.every(name=>sound.current.counters[name]==='0'),'the full actual native/device sound pulse reports loss');
  const motion=actualPhysicalTargets(controller,true);
  await observed(controller,()=>{const current=controller.scorePlayback.custody() as any;return current?.stop_result?.native_reply?.result?.host_receipt?.performance?.accepted===true&&controller.musicalReading?.device.state!=='running';},()=>button(surface,'stop-score').click(),surface);
  const beforeOrdinal=controller.reading.native.last_request_id,expected=(BigInt(beforeOrdinal)+1n).toString();
  await observed(controller,()=>{const exportResult=controller.scorePlayback.renderCustody() as any;return exportResult?.request?.request?.request_id===expected&&exportResult.result?.accepted===true&&!exportResult.held&&typeof exportResult.file==='string'&&exportResult.file.length>0;},()=>button(surface,'export-score-wav').click(),surface);
  const original=controller.scorePlayback.renderCustody() as any;
  const render=readNativeEditedRender(original.result,original.result.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,original.request.request.request_id,original.before);
  need(render.priorBoundary&&render.boundary.scope.body_revision!==original.before.scope.body_revision,'this export did not genuinely restitute a different post-prior/pre-candidate body; the historical-body branch was not exercised');
  need(BigInt(original.request.request.request_id)===BigInt(beforeOrdinal)+1n&&sameNativePlaybackJson(controller.musicalReading,render.reading),'ordinary Export lost its sole ordinal or actual resident reading');
  actualPhysicalTargets(controller,false);
  const acoustic=controller.acousticEdits.snapshot();need(acoustic,'the restored native source did not rebind the ordinary receiving editor');
  const beforeFile=workspace.inspect().file,save=document.getElementById('native-save');
  need(beforeFile&&save instanceof HTMLButtonElement&&!save.disabled&&save.dataset.action==='native-save','the ordinary saved-project Save is unavailable');
  await observed(controller,()=>{const state=workspace.inspect(),cut=controller.nativeRecording;return !state.busy&&!state.pending&&state.file?.revision!==beforeFile!.revision&&cut?.accepted===true&&cut.original_cut_files?.available===true;},()=>save!.click(),surface);
  await workspace.idle();const saved=await workspace.confirmSaved(),savedDocument=structuredClone(workspace.nativeView()?.document),stopped=controller.musicalReading!,cutResult=controller.nativeRecording;
  need(saved&&savedDocument&&cutResult?.accepted===true&&cutResult.original_cut_files?.available===true&&Object.hasOwn(cutResult.currentness??{},'Ok'),'the actual saved full source/cut lacks native file custody/readback');
  const actualSaved=saved!,actualDocument=savedDocument!,scene=actualDocument.scenes.find(value=>value.scene_ref===original.cas.scene_ref),performance=scene?.performance as any;
  const cut=performance?.checkpoints?.find((value:any)=>value.checkpoint_ref===controller.nativeRecordingRequest?.request?.checkpoint_ref);
  need(cut?.acknowledged_stopped&&cut.sample===stopped.samples_elapsed&&cut.basis_digest===render.restoredSource.retainedSource.asset.basis_digest,'Save substituted another native stopped cut or restored musical basis');
  const histories=['native_physical_source_history','native_acoustic_source_history','native_contact_admission_history'],asset=render.restoredSource.retainedSource.asset;
  need(performance.native_sources.filter((value:any)=>sameNativePlaybackJson(value.native_bundle,asset.native_bundle)&&histories.every(key=>Object.hasOwn(value,key)===Object.hasOwn(asset,key)&&sameNativePlaybackJson(value[key],asset[key]))).length===1,'the saved full native source/all three histories changed or became ambiguous');
  const savedCapture=controller.nativeSoundCaptureCustody as any;need(savedCapture.current&&!savedCapture.failure&&captureCounterNames.every(name=>savedCapture.current.counters[name]==='0'),'the actual final cut/persistence pulse exposes capture loss');
  const lease=controller.reading.lease;await controller.release();const closed=controller.reading.lifetime;
  need(closed.last_close?.closed===true&&closed.last_close.lease===lease&&!closed.close_pending&&!closed.close_error&&!controller.musicalReading,'the exact native owner did not acknowledge close');
  need(await workspace.openFile(actualSaved.location.path,{location:actualSaved.location,revision:actualSaved.revision,expression_ref:actualSaved.expression_ref})===true,'ordinary native Open refused the actual saved file/revision');await workspace.idle();
  need(sameNativePlaybackJson(workspace.nativeView()?.document,actualDocument),'reopen did not recover the same complete saved Document/source history');
  const continueButton=document.querySelector('[data-performance="prepare-current-scene"]');need(continueButton instanceof HTMLButtonElement&&!continueButton.disabled,'the ordinary saved-source Continue is unavailable');
  await observed(controller,()=>!!controller.nativeContinuation&&controller.performance.current,()=>(continueButton as HTMLButtonElement).click(),surface);
  const continuation=controller.nativeContinuation!,returned=continuation.result?.native_reply?.result,restored=controller.musicalReading!,readmission=returned?.receiving_readmission;
  need(continuation.result?.accepted===true&&continuation.result.original_continuation_files?.available===true&&returned?.host_receipt?.performance?.operation==='performance-continue-act'&&returned.retained_source_selection?.checkpoint_ref===cut.checkpoint_ref,'cold Continue lacks its genuine selected-cut ACK/source/original files');
  need(readmission?.schema==='ql.native-receiving-readmission/v1'&&typeof readmission.original_checkpoint_wire==='string','this activity has no original full cold native checkpoint; it cannot count as cold replay coverage');
  const fullSaved={...cut.management,native_pair:{schema:'ql.performance-physical-checkpoint/v1',audio:cut.audio,physical:cut.physical}};
  need(sameNativePlaybackJson(JSON.parse(readmission.original_checkpoint_wire),fullSaved),'the cold native owner changed original q/v/tails/parameters/held/pending queues or their full checkpoint');
  need(restored.samples_elapsed===cut.sample&&sameNativePlaybackJson(restored.scope,stopped.scope)&&sameNativePlaybackJson(restored.parameters,stopped.parameters)&&sameNativePlaybackJson(restored.excitation,stopped.excitation)&&sameNativePlaybackJson(restored.physical.positions_metres,stopped.physical.positions_metres)&&Object.is(restored.physical.energy_joules,stopped.physical.energy_joules)&&restored.active_touches===stopped.active_touches&&restored.active_voices===stopped.active_voices&&restored.sustain===stopped.sustain,'cold Continue changed the actual saved body or parameter/touch state');
  need(controller.nativeOutputCalibration.declaration===null,'cold Continue reapplied fresh instrument calibration');actualPhysicalTargets(controller,false);
  const receipt={start:performed,performed_source:performedSource.selector,sound:sound.current,motion_metres:motion.maximum,export:original,decoded_export:render,saved_file:saved,saved_document:savedDocument,checkpoint:cut,closed:closed.last_close,continuation,restored};receipts.push(receipt);return receipt;
 };
 let actual=await passage();
 const mutations:Array<[string,(result:any)=>void]>=[
  ['lost genuine prior boundary',result=>{delete result.native_reply.result.prior_resident_boundary;}],
  ['wrong fsynced prior hash',result=>{result.native_reply.result.prior_resident_boundary.diagnostic_receipt.sha256='sha256:'+'0'.repeat(64);}],
  ['wrong original prior index',result=>{result.native_reply.result.prior_resident_boundary.diagnostic_receipt.original_index='1';}],
  ['foreign prior cursor',result=>{result.native_reply.result.prior_resident_boundary.native_reading.samples_elapsed='18446744073709551615';}],
  ['lost restored selector',result=>{delete result.native_reply.result.restored_source_selection;}],
  ['lost full native artifact',result=>{delete result.native_reply.result.restored_source_artifact;}],
  ['lost actual fresh receiving',result=>{delete result.native_reply.result.restored_current_receiving;}],
  ['wrong restored checkpoint',result=>{result.native_reply.result.restored_source_selection.checkpoint_ref='unqualified:foreign';}],
  ['wrong native source part',result=>{result.native_reply.result.restored_source_selection.source_index=256;}],
  ['changed whole prepared body',result=>{result.native_reply.result.restored_source_artifact.basis.prepared_body.request.state_ref='unqualified:foreign';}],
  ['sealed digest substituted for raw Return',result=>{result.native_reply.result.restored_source_artifact.basis.content_digest=result.native_reply.result.restored_source_selection.basis_digest;}],
  ['lost Contact history or invented absent-to-empty history',result=>{const artifact=result.native_reply.result.restored_source_artifact;if(Object.hasOwn(artifact,'native_contact_admission_history'))delete artifact.native_contact_admission_history;else artifact.native_contact_admission_history=[];}],
  ['stale operative receiving cursor',result=>{result.native_reply.result.restored_current_receiving.native_admission.operation.native_sample='18446744073709551615';}],
  ['lost complete native binding',result=>{delete result.native_reply.result.restored_current_receiving.native_admission.native_preparation.physical_body;}],
  ['consistent foreign basis across returned native projections',result=>{const r=result.native_reply.result,changed=structuredClone(r.restored_source_artifact.native_basis);changed.input.schema='unqualified:foreign';r.restored_source_artifact.native_basis=changed;r.restored_source_artifact.native_preparation.native_basis=structuredClone(changed);r.restored_current_receiving.native_admission.native_basis=structuredClone(changed);r.restored_current_receiving.native_admission.native_preparation.native_basis=structuredClone(changed);} ],
  ['unqualified source-key extension outside complete original custody',result=>{const r=result.native_reply.result,packet=r.restored_source_artifact.native_preparation,preparation=r.restored_current_receiving.native_admission.native_preparation;if(Object.hasOwn(packet,'source_key_admission')){packet.source_key_admission.physical_standing+=' unqualified';packet.policy_receipts.source_keys=structuredClone(packet.source_key_admission);preparation.policy_receipts.source_keys=structuredClone(packet.source_key_admission);}else packet.source_key_admission={schema:'ql.source-performance-admission/v1',preparation:null,touch_receipts:[],physical_standing:'unqualified',audio_octet_source:'unqualified'};}],
  ['changed original sparse preparation behind unchanged optional admission',result=>{const bundle=result.native_reply.result.restored_source_artifact.source_assets;if(bundle.source_key_preparation===null)bundle.configuration.sparse_condition={unqualified:true};else bundle.source_key_preparation.phase=(bundle.source_key_preparation.phase+1)%2;} ]
 ];
 for(const [name,mutate] of mutations){const original=actual.export,changed=structuredClone(original.result);mutate(changed);let refused=false;try{readNativeEditedRender(changed,changed.native_reply.result.host_receipt.performance,original.selected,original.range,original.cas,original.request.request.request_id,original.before);}catch{refused=true;}need(refused,'the production restored-source export decoder admitted '+name);actual=await passage();}
 return{schema:'oi.actual-mounted-native-changed-body-export-acceptance/v1',receipts,detectors:mutations.map(([name])=>name),standing:'Required real normal Play/body+M4/current-device sound/P/GPU/Stop/native mixed-source WAV+original files/prior and final resident restitution/Save/Close/same-file Reopen/Continue passage, independently repeated after each copied-original negative. Native bit-exact WAV, full callback history, unknown ACK and post-effect renderer-refusal gates remain required in the paired owner activities. This function does not fabricate or execute those prerequisites.'};
}
