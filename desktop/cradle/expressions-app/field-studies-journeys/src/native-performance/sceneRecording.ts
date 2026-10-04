import type {RetainedPerformanceAct} from './retainedAct.js';
import type {PhysicalTargetMap} from './physicalSnapshotProjection.js';
import {currentNativePhysicalRest,type NativePhysicalRest} from './physicalDisplay.js';
import type {NativePerformanceReading} from './protocol.js';
import {currentScore,type NativeScoreOperation,type NativeScoreSnapshot} from './scoreProtocol.js';
import type {KernelConversion} from '../kernelDocumentBridge.js';
import type {NativeFieldController} from '../native-field/controller.js';
export interface NativeRecordingCas {expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number;actor:string}
export interface NativeRecordingDefinition {declared_seed:string;performance_ref:string;layer_ref:string;title:string;duration_samples:string;ppq:number;micros_per_quarter:number;max_reconstruction_samples:string}
export interface NativeSceneRecordingBinding {
 capture:()=>NativeRecordingCas;
 document:()=>NonNullable<KernelConversion['document']>;
 accept:(result:unknown,expected:NativeRecordingCas)=>Promise<void>;
 acceptPhysical:(result:unknown,expected:NativeRecordingCas)=>Promise<void>;
 receivingMap:(reading:NativePerformanceReading)=>PhysicalTargetMap;
 basis:number;layer:number;
 score:()=>Omit<NativeScoreSnapshot,'stopped'|'playback_current'|'reason'>;
 edit:(operations:NativeScoreOperation[],expected:NativeRecordingCas)=>Promise<void>;
 resolve:()=>Promise<void>;
 physicalRest:(reading:NativePerformanceReading)=>NativePhysicalRest;
}
/** The normal app binds the actual current Document, selected Scene and
 * acknowledged source to the SAME controller. This contains only CAS/authoring
 * intent; full source, original Return, body and pulse remain native-owned. */
export type NativeSceneInstrumentInput={controller:NativeFieldController;view:()=>KernelConversion|undefined;sceneId:string;current:()=>boolean;
 adopt:(result:unknown,expected:NativeRecordingCas)=>Promise<KernelConversion>;adoptPhysical:(result:unknown,expected:NativeRecordingCas)=>Promise<KernelConversion>;receivingMap:(reading:NativePerformanceReading)=>PhysicalTargetMap;edit:(expected:NativeRecordingCas,operations:NativeScoreOperation[])=>Promise<KernelConversion>;resolve:()=>Promise<KernelConversion>;advanced:(view:KernelConversion)=>void};
function sceneRecordingBinding(input:NativeSceneInstrumentInput):NativeSceneRecordingBinding{
 const {controller,sceneId,current}=input;
 const capture=():NativeRecordingCas=>{
  const view=input.view(),binding=view?.bindings[sceneId],scene=view?.document.scenes.find(s=>s.scene_ref===binding?.scene_ref);
  if(!current()||!view||!binding||!scene||!Number.isSafeInteger(scene.revision))throw Error('The actual native Document or selected Scene changed before recording admission.');
  return{expression_ref:view.document.expression_ref,document_revision:view.document.revision,scene_ref:binding.scene_ref,scene_revision:scene.revision as number,actor:'human:expressions-app'};
 };
 const binding:NativeSceneRecordingBinding={capture,receivingMap:input.receivingMap,acceptPhysical:async(result,expected)=>{const view=await input.adoptPhysical(result,expected);input.advanced(view);},document:()=>{capture();return input.view()!.document;},basis:0,layer:0,physicalRest:reading=>{if(!current())throw Error('The current Document changed before its physical rest reading.');return currentNativePhysicalRest(input.view(),sceneId,reading);},score:()=>currentScore(input.view(),sceneId),resolve:async()=>{const view=await input.resolve();input.advanced(view);},edit:async(operations,expected)=>{const view=await input.edit(expected,operations);input.advanced(view);},accept:async(result,expected)=>{const view=await input.adopt(result,expected);input.advanced(view);}};
 return binding;
}
export async function retainPreparedSceneInstrument(input:NativeSceneInstrumentInput){
 const {controller,sceneId}=input;controller.bindNativeSceneRecording(sceneRecordingBinding(input));
 let view=input.view()!,scene=view.document.scenes.find(s=>s.scene_ref===view.bindings[sceneId].scene_ref)!;
 if(!scene.performance){
  const ref=`performance:${crypto.randomUUID()}`;
  await controller.prepareNativeScenePerformance({declared_seed:'1',performance_ref:ref,layer_ref:`${ref}/layer/1`,title:'Performance 1',duration_samples:'28800000',ppq:960,micros_per_quarter:500000,max_reconstruction_samples:'28800000'});
  view=input.view()!;scene=view.document.scenes.find(s=>s.scene_ref===view.bindings[sceneId].scene_ref)!;
 }
 const performance=scene.performance as {bases?:unknown[];checkpoints?:{sample?:string;basis?:number}[]}|undefined;
 if(!performance?.bases?.length)throw Error('The same native Scene did not retain its full source performance.');
 // Existing origins cannot be overwritten. Saved work needs its actual native
 // checkpoint/timeline restore; starting a fresh empty engine is not replay.
 if(performance.checkpoints?.length)throw Error('The retained performance needs its native checkpoint and timeline restored before continuation; its original history is preserved.');
 await controller.beginNativeSceneRecording(`checkpoint:${crypto.randomUUID()}`);
 return controller.musicalReading;
}

/** Saved work reaches the actual same-store Act reader and native checkpoint
 * readmission. The same recording binding then captures every control pulse. */
export function continueRetainedSceneInstrument(input:NativeSceneInstrumentInput&{select:()=>Promise<RetainedPerformanceAct>;makeMap:(reading:NativePerformanceReading)=>PhysicalTargetMap}){
 return input.controller.continueNativeScenePerformance(sceneRecordingBinding(input),input.select,input.makeMap,input.current);
}
