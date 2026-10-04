import type {NativePerformanceReading} from './protocol.js';
import type {NativeRecordingCas} from './sceneRecording.js';
import {samePhysicalJson} from './physicalEdit.js';
export interface AuthoredAcousticConfiguration {
 schema:'ql.native-acoustic-receiving-configuration/v1';source_ref:string;source_motion_ref:string;receiver_motion_ref:string;policy_ref:string;policy_revision:string;
 standing:'architecture-model'|'reference'|'tunable-model';revision:number;
 source_translation_metres:[number,number,number];receiver_position_metres:[number,number,number];receiver_forward:[number,number,number];
 source_velocity_metres_per_second:[number,number,number];receiver_velocity_metres_per_second:[number,number,number];
 speed_metres_per_second:number;minimum_distance_metres:number;directivity:'omnidirectional'|'cardioid';propagation_delay:boolean;span_samples:number;
}
export interface NativeAcousticSnapshot {current:boolean;can_declare:boolean;body_revision:string;configuration:AuthoredAcousticConfiguration|null;reason:string|null}
export interface NativeAcousticEditPort {snapshot():NativeAcousticSnapshot|null;apply(configuration:AuthoredAcousticConfiguration):Promise<unknown>;custody():unknown}
const need=(condition:unknown,reason:string):void=>{if(!condition)throw Error(reason);};
const fields=['schema','source_ref','source_motion_ref','receiver_motion_ref','policy_ref','policy_revision','standing','revision','source_translation_metres','receiver_position_metres','receiver_forward','source_velocity_metres_per_second','receiver_velocity_metres_per_second','speed_metres_per_second','minimum_distance_metres','directivity','propagation_delay','span_samples'];
export function readAuthoredAcousticConfiguration(value:any):AuthoredAcousticConfiguration{
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key)),'Complete authored acoustic configuration is required.');
 need(value.schema==='ql.native-acoustic-receiving-configuration/v1'&&['architecture-model','reference','tunable-model'].includes(value.standing),'Declare the acoustic policy and its standing.');
 for(const key of ['source_ref','source_motion_ref','receiver_motion_ref','policy_ref','policy_revision'])need(typeof value[key]==='string'&&value[key].length>0&&value[key].length<=4096&&!value[key].includes('\0'),'An authored acoustic reference is invalid.');
 need(Number.isSafeInteger(value.revision)&&value.revision>0&&Number.isInteger(value.span_samples)&&value.span_samples>0&&value.span_samples<=48000*60,'Acoustic revision or native segment span is invalid.');
 for(const key of ['source_translation_metres','receiver_position_metres','receiver_forward','source_velocity_metres_per_second','receiver_velocity_metres_per_second'])need(Array.isArray(value[key])&&value[key].length===3&&value[key].every(Number.isFinite),'Authored acoustic metric vectors must be finite.');
 need(Math.abs(Math.hypot(...value.receiver_forward)-1)<=1e-6,'Receiver direction must have unit length.');
 need(Number.isFinite(value.speed_metres_per_second)&&value.speed_metres_per_second>=50&&value.speed_metres_per_second<=2000&&Number.isFinite(value.minimum_distance_metres)&&value.minimum_distance_metres>=.001&&value.minimum_distance_metres<=1000,'Acoustic speed or minimum distance is outside native bounds.');
 need(['omnidirectional','cardioid'].includes(value.directivity)&&typeof value.propagation_delay==='boolean','Acoustic directivity or propagation policy is invalid.');
 return structuredClone(value);
}
/** Explicit editable proposal. It grants no source, current receiver or clock;
 * only pressing Apply submits these visible authored metric/policy inputs. */
export function declaredAcousticDraft():AuthoredAcousticConfiguration{
 const ref=`authored-acoustic:${crypto.randomUUID()}`;
 return{schema:'ql.native-acoustic-receiving-configuration/v1',source_ref:`${ref}/emitter`,source_motion_ref:`${ref}/source-motion`,receiver_motion_ref:`${ref}/receiver-motion`,policy_ref:`${ref}/policy`,policy_revision:'1',standing:'architecture-model',revision:1,source_translation_metres:[0,0,0],receiver_position_metres:[0,0,1],receiver_forward:[0,0,-1],source_velocity_metres_per_second:[0,0,0],receiver_velocity_metres_per_second:[0,0,0],speed_metres_per_second:343,minimum_distance_metres:.05,directivity:'omnidirectional',propagation_delay:true,span_samples:48000*60};
}
/** Complete original operation selects one source epoch; musical/body labels
 * alone cannot choose among same-body M4 epochs. No index is incremented. */
export function appliedAcousticSource(document:any,cas:NativeRecordingCas,result:any,reading?:NativePerformanceReading){
 need(result?.schema==='oi.native-acoustic-scene-edit-result/v1'&&result.accepted===true&&result.application_committed===true&&result.state==='applied_and_retained','The original native receiving operation is not retained.');
 for(const key of ['expression_ref','document_revision','scene_ref','scene_revision','actor'] as const)need(result.request?.[key]===cas[key],'The original acoustic operation belongs to another authored Document/Scene.');
 const selector=result.current_source_selection,artifact=result.original_application_reply?.result?.source_artifact,scene=document.scenes.find((row:any)=>row.scene_ref===cas.scene_ref),performance=scene?.performance;
 need(document.expression_ref===cas.expression_ref&&selector?.schema==='oi.native-current-performance-source-selection/v1'&&selector.expression_ref===document.expression_ref&&selector.document_revision===document.revision&&selector.scene_ref===scene?.scene_ref&&selector.scene_revision===scene?.revision&&Array.isArray(performance?.native_sources)&&Array.isArray(performance?.bases),'The actual final acoustic source selector differs from its native Document.');
 const sources=performance.native_sources.flatMap((source:any,index:number)=>samePhysicalJson(source.native_bundle,artifact?.source_assets)&&samePhysicalJson(source.native_physical_source_history,artifact?.native_physical_source_history)&&samePhysicalJson(source.native_acoustic_source_history,artifact?.native_acoustic_source_history)?[{source,index}]:[]);
 need(sources.length===1&&selector.source_index===sources[0].index,'The complete actual acoustic source and both original application corpora are absent or ambiguous.');
 const source=sources[0].source,bases=performance.bases.flatMap((basis:any,index:number)=>basis.content_digest===source.basis_digest?[{basis,index}]:[]);
 need(bases.length===1&&selector.basis_index===bases[0].index&&selector.basis_digest===source.basis_digest&&samePhysicalJson(bases[0].basis.identity,artifact.basis.identity)&&samePhysicalJson(bases[0].basis.prepared_body,artifact.basis.prepared_body),'The actual acoustic epoch changed or lost its unique original musical basis/body.');
 need(selector.source_sample===source.native_bundle.current_receiving?.native_admission?.operation?.native_sample&&selector.source_reading?.availability==='available'&&selector.source_reading.revision==='oi.expression-performance-source-asset/v1'&&/^sha256:[0-9a-f]{64}$/.test(selector.source_reading.ref),'The actual native source epoch reading is unavailable.');
 if(reading){const body=bases[0].basis.prepared_body;need(reading.scope.preparation_ref===body.request.preparation_ref&&reading.scope.state_ref===body.request.state_ref&&reading.scope.body_revision===String(body.request.body_revision)&&reading.physical.source_generation===String(body.source_generation),'The actual acoustic receiver detached from its same native body.');}
 return{basis:bases[0].index,source:sources[0].index,configuration:readAuthoredAcousticConfiguration(source.native_bundle.acoustic_receiving?.packet?.configuration),artifact:structuredClone(artifact)};
}
/** An actual original source observation is required for the current baseline.
 * Saved or pre-existing epochs without that observation remain explicit. */
export function acousticSnapshot(document:any,cas:NativeRecordingCas,reading:NativePerformanceReading,artifact:any,restored:any=null):NativeAcousticSnapshot{
 const scene=document.scenes.find((row:any)=>row.scene_ref===cas.scene_ref);
 need(document.expression_ref===cas.expression_ref&&document.revision===cas.document_revision&&scene?.revision===cas.scene_revision,'The current acoustic authoring Document is stale.');
 if(restored){const source=restored.asset,selector=restored.selection,basis=scene.performance.bases?.[selector?.basis_index];
  need(selector?.schema==='ql.native-retained-performance-source-selection/v1'&&selector.expression_ref===document.expression_ref&&selector.scene_ref===cas.scene_ref&&samePhysicalJson(scene.performance.native_sources?.[selector.source_index],source)&&basis?.content_digest===source?.basis_digest&&samePhysicalJson(basis.identity,selector.identity)&&restored.current_receiving?.schema==='ql.current-performance-receiving/v1','The current receiver lost its exact restored native epoch/source.');
  need(basis.prepared_body?.request?.state_ref===reading.scope.state_ref&&String(basis.prepared_body.request.body_revision)===reading.scope.body_revision,'The restored receiver belongs to another current native body.');
  const configuration=source.native_bundle.acoustic_receiving?.packet?.configuration;
  need(configuration?samePhysicalJson(source.native_bundle.acoustic_receiving.packet,restored.original_saved_acoustic):restored.original_saved_acoustic===null,'The restored native receiver changed its saved authored configuration.');
  return{current:reading.available,can_declare:true,body_revision:reading.scope.body_revision,configuration:configuration?readAuthoredAcousticConfiguration(configuration):null,reason:configuration?null:'No receiving policy is installed in this exact restored source. Apply declares a new one.'};
 }
 if(!artifact){const hasRetainedReceiver=scene.performance.native_sources.some((source:any)=>source.native_bundle?.acoustic_receiving);return{current:reading.available,can_declare:!hasRetainedReceiver,body_revision:reading.scope.body_revision,configuration:null,reason:hasRetainedReceiver?'The retained receiver needs its actual current source epoch reading before editing.':'Apply submits an explicit declared receiving draft; the native owner qualifies its current source.'};}
 const matches=scene.performance.native_sources.filter((source:any)=>samePhysicalJson(source.native_bundle,artifact.source_assets)&&samePhysicalJson(source.native_physical_source_history,artifact.native_physical_source_history)&&samePhysicalJson(source.native_acoustic_source_history,artifact.native_acoustic_source_history));
 need(matches.length===1,'The actual current acoustic epoch is missing or ambiguous.');
 const source=matches[0],basis=scene.performance.bases.filter((row:any)=>row.content_digest===source.basis_digest);need(basis.length===1&&basis[0].prepared_body.request.state_ref===reading.scope.state_ref,'The actual acoustic source observation belongs to another body.');
 const configuration=source.native_bundle.acoustic_receiving?.packet?.configuration;
 return{current:reading.available,can_declare:true,body_revision:reading.scope.body_revision,configuration:configuration?readAuthoredAcousticConfiguration(configuration):null,reason:configuration?null:'No installed receiving policy is present in this actual source. Apply declares a new one.'};
}
