import {readNativeEditedRender} from '../native-performance/render.js';
import {NativeTakeRecorder,type NativeTakePort} from '../native-performance/nativeTake.js';
import {readNativeCapture,type NativeCaptureBatch} from '../native-performance/nativeCapture.js';
import {acousticSnapshot,appliedAcousticSource,readAuthoredAcousticConfiguration,type AuthoredAcousticConfiguration,type NativeAcousticEditPort} from '../native-performance/acousticEdit.js';
import {readCurrentOutputCalibration,type NativeCurrentOutputCalibration,readPerformance,type NativePerformanceCommand,type NativePerformanceExchange,type NativePerformanceReading,type NativePerformanceUpdate,type NativeTransportAcknowledgement} from '../native-performance/protocol.js';
import {physicalEditSnapshot,appliedPhysicalBasis,samePhysicalJson,type AuthoredPhysicalEdit,type NativePhysicalEditPort} from '../native-performance/physicalEdit.js';
import {readPlaybackRange,readNativeActPlayback,readNativePlaybackStartPhase,hasNativePlaybackDeviceCallback,readNativePlaybackCurrentSource,sameNativePlaybackJson,type NativeScorePlaybackPort,type NativeScorePlaybackRange,type NativeScorePlaybackSnapshot,type NativePlaybackSourceCustody} from '../native-performance/playback.js';
import type {RetainedPerformanceAct} from '../native-performance/retainedAct.js';
import {readNativeActContinuation,sameNativeContinuationJson} from '../native-performance/continuation.js';
import type {NativeStageAuthorshipRequest} from '../proceduralStageAuthoring.js';
import {nativeAxisRequest,type NativeAxisPhase} from './axis';
import {SCENE_MATERIAL_STANDING,type NativeSceneMaterial} from './material';
import type {NativePhysicalDisplayPort} from '../native-performance/physicalDisplay.js';
import {projectNativeSources,editNativeBasis,NativeDomainReading,NativeBasisEdit} from './domain';
import {InstrumentSession,type NativeDocumentTransactionResult,type NativeDocumentTransactionContext} from './ql/instrument-session.mjs';
import {NativeProjection,type NativeTargetMap} from './projection';
import {SelectedSourceReception} from './selectedSourceReception';
import type {NativePort} from './channel';
import {validateNativeDefinitionTarget,validateNativeDefinitionRequest,type NativeDefinitionPort,type NativeDefinitionTarget,type PendingNativeDefinition,type NativeDefinitionRequest} from '../proceduralNativeDefinition';

import type {NativeScoreOperation,NativeScorePort,NativeScoreSnapshot} from '../native-performance/scoreProtocol.js';
import type {NativeSceneRecordingBinding,NativeRecordingDefinition,NativeRecordingCas} from '../native-performance/sceneRecording.js';
import {PhysicalSnapshotProjection,type PhysicalTargetMap,type PhysicalRetainedPort} from '../native-performance/physicalSnapshotProjection.js';
import {applyPhysicalFormPose} from '../physicalFormActuator';
import {nativeActuatorStanding} from '../nativeActuatorStanding';
import {isScene,SCENE_PROVIDER,SCENE_INFLUENCE,eventFromSources,readScene,editSceneEvent,sceneCausalTrace,type SceneActing,type SceneEdit} from './scene';
export interface NativeSelectedScene {expression_ref:string;document_revision:number;scene_ref:string;scene_revision:number}
export interface NativeSelectedSourceBinding {capture:()=>NativeSelectedScene;current:()=>boolean;adopt:(result:unknown,expected:NativeSelectedScene)=>Promise<void>;authorship:()=>Promise<Record<string,unknown>>}
export interface NativeRenderer {
 retainedTargetPort():any;releaseRetainedField():void;
 retainedTopology?():{tex_width:number;tex_height:number;particle_count:number;slot_count:number}|null;
 onRetainedRecoveryRequired(listener:(state:'lost'|'restored')=>void):()=>void;
 checkpointRetainedField(binding:any):any;restoreRetainedField(binding:any,checkpoint:any):void;
 setNativeDomain(active:boolean):void;
}
export interface NativePlaybackPolicy {blockFrames:number;leadSeconds:number;lookaheadSeconds:number;}
export const EMBEDDED_NATIVE_PLAYBACK:Readonly<NativePlaybackPolicy>=Object.freeze({blockFrames:8192,leadSeconds:.5,lookaheadSeconds:.5});
export type NativeStatus='manual'|'opening'|'following'|'held'|'unavailable';
export type NativeSky='none'|'now'|{epoch:string};
export type NativeSkySnapshot=Readonly<{schema:'ql.sky-snapshot/v1';snapshot_ref:string;[key:string]:unknown}>;
export type NativeWorldInput=Readonly<{instance_ref:string;subject_ref:string;start?:Readonly<Record<string,unknown>>;material?:Readonly<NativeSceneMaterial>}>;
export type EntityTargetBindings=(input:Readonly<{world:unknown;partition:unknown}>)=>NativeTargetMap|Promise<NativeTargetMap>;
/** Presentation, not source: the M1 torus (|x|,|y| ≤ 25/9 m at QL's declared
 * 1 m per torus unit) spans ±333 engine units — 0.83 of the 400-unit stage
 * radius (WORLD_SCALE), leaving the body whole on stage with modal headroom. */
export const INSTRUMENT_PRESENTATION=Object.freeze({units_per_metre:120,
 standing:'presentation scale: ±25/9 m torus → ±333 engine units (0.83 of the 400-unit stage radius); not a source value'});
/** QL scene_field.rs `default_field`: the composed owner's device rate. */
export const SCENE_SAMPLE_RATE=48000;
/** Both source-cited tick rates; neither is fixed by the M1 contract (QL scene_field.rs). */
export const CADENCES=Object.freeze([
 Object.freeze({id:'world',ticks_per_second:1,label:'1 tick/s',source:'M3/M4′ world clock, 1 Hz'}),
 Object.freeze({id:'user',ticks_per_second:12,label:'12 ticks/s',source:'PPS user-facing tick, 12 per second'}),
]);
export const PRESENTATION_LEVEL=Object.freeze({min:0,max:4,initial:1,
 standing:'presentation gain after the native PCM (× the audio receiver\'s 0.1); not a source value'});
/** Owner busy, held mid-beat, or presentation capacity full: a skipped beat. */
const TRANSIENT=/owner busy|held before the event|presentation capacity|requires idle admitted owner/;
type Cadence={rate:number;period:number;source:string;timer:ReturnType<typeof setInterval>;started:number;
 beats:number;issued:number;applied:number;skipped:number;suspended:number;inFlight:boolean;lastEventMs?:number;maxEventMs?:number;stopped?:string;stopped_at?:number};
class NativeCloseError extends Error{}
const sceneObject=(v:any)=>!!v&&typeof v==='object'&&!Array.isArray(v);
const sceneNeed=(ok:unknown,reason:string):void=>{if(!ok)throw new Error(`native scene reading: ${reason}`);};
const sceneInteger=(v:any,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
const sceneU64=(v:any)=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<(1n<<64n);
const sceneText=(v:any)=>typeof v==='string'&&v.length>0&&v.length<=4096;
const sceneSame=(a:any,b:any):boolean=>{
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v:any,i:number)=>sceneSame(v,b[i]));
 if(!sceneObject(a)||!sceneObject(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.prototype.hasOwnProperty.call(b,key)&&sceneSame(a[key],b[key]));
};
/** continuous/scene_field.rs PLANETS; Uranus is the unvoiced anchor, not a tenth voice. */
export const NATIVE_SCENE_VOICES=Object.freeze(['#2-5-0/1','#2-5-2','#2-5-3','#2-5-4','#2-5-5','#2-5-6','#2-5-7','#2-5-8','#2-5-9']);
/** Declared application receiving capacity, not a native semantic restriction.
 * The real 5b2 event/influence are 11,354/13,875 bytes as compact
 * escaped-ASCII JSON (influence13,782 with literal Unicode), at depth5/8.
 * Each supported metadata projection is <=256 KiB (native input/reply ceilings
 * remain32/64 MiB). Count before copy, with a conservative JSON escape bound;
 * explicit depth/breadth caps prevent unknown amplification. */
export const SCENE_METADATA_BUDGET=Object.freeze({escaped_utf8_bytes:256*1024,depth:128,nodes:128*1024,keys:64*1024});
const SCENE_METADATA_KEYS={
 event:new Set(['schema','m1','m2','m3','m3_commands','harmonic_source','frequency_bindings','condition_frequency_bindings','sky_frequency_bindings','source_receipts']),
 influence:new Set(['schema','instance_ref','event_ref','subject_ref','generation','samples_elapsed','m1_revision','m3_generation','shape_ref','address72','voices','geometry','material','material_standing','native_readback','effects']),
 field:new Set(['schema','event_ref','subject_ref','generation','samples_elapsed','shape_ref','geometry_ref','material_ref','model_ref','m2_identity','clock','target_count','amplitude_count']),
};
export function copySceneMetadata(value:any,kind:keyof typeof SCENE_METADATA_KEYS){
 sceneNeed(sceneObject(value),`${kind} metadata unavailable`);
 const budget=SCENE_METADATA_BUDGET,seen=new WeakSet<object>();let bytes=0,nodes=0,keys=0;
 const add=(n:number)=>{bytes+=n;sceneNeed(bytes<=budget.escaped_utf8_bytes,`${kind} metadata exceeds supported receiving byte budget`);};
 const visit=(v:any,depth:number):void=>{
  sceneNeed(depth<=budget.depth&&++nodes<=budget.nodes,`${kind} metadata exceeds supported receiving depth/node budget`);
  if(v===null){add(4);return;}
  if(typeof v==='string'){add(2+6*v.length);return;} // JSON escape upper bound, not serialization/allocation.
  if(typeof v==='number'){sceneNeed(Number.isFinite(v),`${kind} metadata contains a non-JSON number`);add(String(v).length);return;}
  if(typeof v==='boolean'){add(v?4:5);return;}
  sceneNeed(v&&typeof v==='object'&&(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null)&&!seen.has(v),`${kind} metadata contains non-JSON or cyclic objects`);
  seen.add(v);add(2);
  if(Array.isArray(v)){
   sceneNeed(Object.getPrototypeOf(v)===Array.prototype,`${kind} metadata contains a custom array prototype`);
   sceneNeed(v.length<=budget.nodes,`${kind} metadata exceeds supported receiving node budget`);
   // Borrowed enumeration: never allocate Object.keys for an unbounded shape.
   // structuredClone copies enumerable array extras, so refuse them before copy.
   for(const key in v){
    if(!Object.prototype.hasOwnProperty.call(v,key))continue;
    sceneNeed(++keys<=budget.keys,`${kind} metadata exceeds supported receiving key budget`);
    const index=Number(key);
    sceneNeed(Number.isInteger(index)&&index>=0&&index<v.length&&String(index)===key,`${kind} metadata contains a non-index array member`);
    const d=Object.getOwnPropertyDescriptor(v,key);sceneNeed(d&&'value' in d,`${kind} metadata contains array accessors`);
   }
   for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));sceneNeed(d&&'value' in d,`${kind} metadata contains holes/accessors`);add(i?1:0);visit(d!.value,depth+1);}
  }else{
   let first=true;
   for(const key in v){
    if(!Object.prototype.hasOwnProperty.call(v,key))continue;
    sceneNeed(++keys<=budget.keys,`${kind} metadata exceeds supported receiving key budget`);
    if(depth===0)sceneNeed(SCENE_METADATA_KEYS[kind].has(key),`${kind} metadata has an unsupported root field`);
    const d=Object.getOwnPropertyDescriptor(v,key);sceneNeed(d&&'value' in d,`${kind} metadata contains accessors`);
    add((first?0:1)+3+6*key.length);first=false;visit(d!.value,depth+1);
   }
  }
  seen.delete(v);
 };
 visit(value,0);return structuredClone(value);
}
/** Read-only receiving checks against this native receipt. No pitch, phase,
 * geometry, clock, form or unavailable source quantity is computed here.
 * `domain`/`sources` may be supplied only by THIS operation's fresh Inspect. */
export function qualifySceneInfluence(influence:any,field:any,reading:any,domain?:NativeDomainReading,sources?:any){
 const acknowledged=reading?.acknowledged;
 sceneNeed(sceneObject(influence)&&influence.schema===SCENE_INFLUENCE,'acting influence unavailable');
 sceneNeed(influence.instance_ref===reading.instance_ref&&influence.event_ref===reading.event_ref&&influence.subject_ref===reading.subject_ref&&
  influence.generation===acknowledged?.generation&&influence.samples_elapsed===acknowledged?.samples_elapsed,'influence belongs to another native owner/cursor');
 sceneNeed(sceneU64(influence.generation)&&sceneU64(influence.samples_elapsed)&&sceneU64(influence.m1_revision)&&
  Number.isSafeInteger(influence.m3_generation)&&influence.m3_generation>=0,'exact influence revisions unavailable');
 sceneNeed(field?.schema==='ql.continuous-field/v1'&&field.event_ref===reading.event_ref&&field.subject_ref===reading.subject_ref&&
  field.generation===acknowledged.generation&&field.samples_elapsed===acknowledged.samples_elapsed,'influence field/cursor mismatch');
 sceneNeed(field.geometry_ref===`${SCENE_PROVIDER}:m1-torus#1-5-1`&&field.material_ref===`${SCENE_PROVIDER}:declared-linear-medium`&&
  field.model_ref==='ql.continuous-linear-mode/v1','scene field owner bindings unavailable');
 sceneNeed(sceneText(influence.shape_ref)&&influence.shape_ref===field.shape_ref&&sceneInteger(influence.address72,0,71),'shape or 72-address unavailable');
 const voices=influence.voices;
 sceneNeed(Array.isArray(voices)&&voices.length===NATIVE_SCENE_VOICES.length&&(Array.isArray(field.amplitudes_metres)?field.amplitudes_metres.length:field.amplitude_count)===voices.length,'complete native nine-voice body unavailable');
 for(let i=0;i<NATIVE_SCENE_VOICES.length;i++){
  const v=voices[i];
  sceneNeed(sceneObject(v)&&v.planet_ref===NATIVE_SCENE_VOICES[i]&&Number.isFinite(v.longitude_radians)&&Number.isFinite(v.frequency_hz)&&v.frequency_hz>0&&
   sceneInteger(v.m,1,12)&&sceneInteger(v.n,1,12)&&(v.helix==='bimba'||v.helix==='pratibimba')&&sceneInteger(v.ql_position,0,255)&&
   Number.isFinite(v.weight)&&v.weight>=0&&v.weight<=1&&Number.isFinite(v.phase_radians),`voice ${i} is missing, malformed or out of native order`);
 }
 const g=influence.geometry,m=influence.material;
 sceneNeed(sceneObject(g)&&sceneInteger(g.longitude_samples,4,65535)&&sceneInteger(g.latitude_samples,4,65535)&&
  g.longitude_samples*g.latitude_samples<=Math.floor(262144/NATIVE_SCENE_VOICES.length)&&(Array.isArray(field.targets)?field.targets.length:field.target_count)===g.longitude_samples*g.latitude_samples&&
  Number.isFinite(g.metres_per_unit)&&g.metres_per_unit>0&&g.metres_per_unit<=1000&&sceneInteger(g.attachment,0,2),'native geometry outside its supported contract');
 sceneNeed(sceneObject(m)&&Number.isFinite(m.damping_per_second)&&m.damping_per_second>=0&&m.damping_per_second<=1e6&&
  Number.isFinite(m.strike_metres)&&m.strike_metres>0&&m.strike_metres<=1&&Number.isFinite(m.audio_gain_per_metre)&&Math.abs(m.audio_gain_per_metre)<=1e6&&
  typeof m.strike_on_event==='boolean'&&influence.material_standing===SCENE_MATERIAL_STANDING,'declared native material policy unavailable');
 const readback=influence.native_readback;
 sceneNeed(sceneObject(readback)&&readback.schema==='ql.scene-source-reading/v1'&&readback.event_ref===reading.event_ref&&readback.subject_ref===reading.subject_ref&&
  readback.m1_revision===influence.m1_revision&&readback.m3_generation===influence.m3_generation&&
  Number.isSafeInteger(readback.profile_generation)&&readback.profile_generation>=0&&readback.profile_generation===field.m2_identity?.profile_generation&&
  field.m2_identity?.event_ref===reading.event_ref&&sceneObject(readback.continuous_clock_native)&&sceneObject(field.clock)&&sceneSame(readback.continuous_clock_native,field.clock),'native source readback differs from its acknowledged field');
 // These may contain explicit unavailable readings. Preserve their owner shape,
 // rather than inventing scalar values for selected aperture/form/continuation.
 for(const key of ['continuous_clock','m1_clock','m1_carrier','m3_clock','form','selected_aperture','form_process','continuation_start','clock_semantics'])
  sceneNeed(sceneObject(readback[key]),`native source readback omitted ${key}`);
 sceneNeed(readback.form_process.instance_ref===reading.instance_ref,'native form reading belongs to another instance');
 sceneNeed(Array.isArray(influence.effects)&&influence.effects.length===6&&influence.effects.every((e:any)=>sceneObject(e)&&
  ['determinant','through','effect','units','range','timing','consumer','warrant'].every(key=>sceneText(e[key]))),'native influence warrants unavailable');
 if(domain!==undefined){
  sceneNeed(isScene(sources)&&influence.m1_revision===domain.m1.revision&&influence.m3_generation===domain.m3.generation&&
   readback.profile_generation===domain.m2.generation&&influence.address72===sources?.current?.derivation?.mef_table_index,'Inspect influence differs from THIS inspected basis');
  const modes=sources.current.m2.resonator.modes,sky=sources.current.derivation?.sky_voices,quartet=sources.current.m2.vimarsha?.reading?.nodal_quartet;
  sceneNeed(Array.isArray(modes)&&modes.length===9&&Array.isArray(sky)&&sky.length===9&&Array.isArray(quartet)&&quartet.length===4,'Inspect source voice/shape basis unavailable');
  for(let i=0;i<9;i++){
   const v=voices[i],mode=modes[i],node=quartet[i%4];
   sceneNeed(mode?.mode_ref===`scene:planet/${v.planet_ref}`&&mode.source_coordinate===v.planet_ref&&mode.frequency_hz===v.frequency_hz&&
    mode.damping_per_second===m.damping_per_second&&sky[i]?.planet_ref===v.planet_ref&&sky[i].frequency_hz===v.frequency_hz&&
    node?.m===v.m&&node?.n===v.n&&node?.helix===v.helix,`Inspect voice ${i} differs from its actual native determining sources`);
  }
 }
 return influence;
}
type NativeExchangeScope={serial:number;instance_ref:string;event_ref:string;subject_ref:string;acknowledged:{generation:string;samples_elapsed:string}};
type NativeExchangeReceipt={serial:number;epoch:number;session:InstrumentSession;opened:any;lease:string;request:any;reply:any};
import {NativeStageLibraryClient,nativeStageLibraryRequest,type NativeStageLibraryRequest,type NativeStageClientWitness} from '../proceduralNativeStageLibrary';
import type {StageLibraryIntent} from '../proceduralStageSource';
import type {StageCapability,StageCapabilityName} from '../proceduralStageProvider';
import type {StudioBasis} from '../proceduralStudio';
import type {KernelConversion} from '../kernelDocumentBridge';
import {selectedSceneSourceRequest,selectedSourceOrderedResult,selectedSourceLookupResult,validateSelectedSourceContext,type NativeSelectedSceneSourceRequest,type SelectedSceneSourceCapture} from '../proceduralSelectedSceneSource.js';
import type {NativeSelectedSceneRequest} from '../proceduralSelectedScene.js';
import {validateStageSourceAuthorship,type NativeStageBootstrapCommand,type StageSourceBootstrapIntent} from '../proceduralStageBootstrap.js';
export interface NativeConductContext {expression_ref:string;document_revision:number;source_producer_ref?:string|null;}
export type NativeConductContextReader=(request:Readonly<Record<string,unknown>>)=>NativeConductContext|Promise<NativeConductContext>;
export function nativeProceduralConductRequest(lease:string,request:any,basis:NativeConductContext){
 sceneNeed(sceneText(lease),'the current exact native lease is unavailable');
 sceneNeed(sceneObject(basis)&&typeof basis.expression_ref==='string'&&basis.expression_ref.startsWith('expression:')&&
  basis.expression_ref.length<=4096&&Number.isSafeInteger(basis.document_revision)&&basis.document_revision>=0,'current native Document/CAS unavailable');
 sceneNeed(sceneObject(request)&&request.schema==='ql.field-host-request/v1'&&sceneText(request.instance_ref)&&sceneText(request.event_ref)&&sceneText(request.subject_ref)&&
  sceneU64(request.request_id)&&sceneU64(request.expected_generation)&&sceneU64(request.expected_samples_elapsed)&&request.command?.operation==='procedure'&&
  sceneObject(request.command.request)&&sceneText(request.command.request.action),'the original session-issued procedural request is unavailable');
 const bootstrap=request.command.request.action==='source_bootstrap';
 const needsSource=['install','replace','restore'].includes(request.command.request.action);
 sceneNeed(bootstrap?basis.source_producer_ref===null:needsSource?sceneText(basis.source_producer_ref):basis.source_producer_ref===undefined,
  needsSource?'the actual native compiler admission is unavailable':'a compiler admission cannot qualify a different source action');
 return {operation:'procedural_conduct' as const,request:{lease,expression_ref:basis.expression_ref,document_revision:basis.document_revision,
  ...(basis.source_producer_ref!==undefined?{source_producer_ref:basis.source_producer_ref}:{}),request:structuredClone(request)}};
}
export function nativeProceduralConductReceipt(result:any,input:ReturnType<typeof nativeProceduralConductRequest>){
 const bootstrap=input.request.request.command.request.action==='source_bootstrap';
 if(bootstrap){
  // Source/Document attribution can refuse AFTER the original native exchange.
  // Unwrap that original ACK first. SAME InstrumentSession owns its ordinal,
  // lifetime, complete field and PCM validation; Working validates the wrapper.
  sceneNeed(result?.native_receipt?.schema==='ql.field-host-receipt/v1','the protected Kernel did not retain the original bootstrap host acknowledgement');
  return result.native_receipt;
 }
 sceneNeed(result?.schema==='oi.expression-procedural-conduct/v1'&&result.expression_ref===input.request.expression_ref&&result.document_revision===input.request.document_revision,'the protected Kernel returned another native Document/CAS');
 sceneNeed(result.native_receipt?.schema==='ql.field-host-receipt/v1','the protected Kernel did not return the actual unchanged host receipt');
 return result.native_receipt;
}

/** The QL driver schedules PCM/targets; the app remains the sole GPU stage.
 * The controller owns admission/lifetime only, never native math or a second clock.
 * Determinant events (M1 advance, a changed event) go to the same serial owner;
 * the cadence is a request rate, never a local oscillator or tick model.
 */
export class NativeFieldController {
 private session:InstrumentSession|null=null;private projection:NativeProjection|SelectedSourceReception|null=null;
 private context:AudioContext|null=null;private opened:any=null;private epoch=0;private dead=false;
 private recovery:(()=>void)|null=null;private checkpoint:any=null;private contextLost=false;
 private pending:Promise<unknown>=Promise.resolve();private muted=true;private serialDepth=0;
 private sources:any=null;private domain:NativeDomainReading|null=null;
 private openingHold:string|null=null;private closing:Promise<void>|null=null;
 private admission:Promise<void>|null=null;private closeFailure:NativeCloseError|null=null;
 private lastClose:{schema:'oi.native-expression-closed/v1';lease:string;closed:true}|null=null;
 private lastNative:any=null;private holdRevision=0;
 private admitting:number|null=null;
 private suspension:{tokens:Set<symbol>;epoch:number;revision:number;restore:boolean;reason:string}|null=null;
 private restoring:{epoch:number;revision:number}|null=null;
 private scene=false;private ownerKind:'scene'|'supplied'|null=null;private influenceReading:any=null;private acting:SceneActing|null=null;
 private exchangeSerial=0;private exchangeReceipt:NativeExchangeReceipt|null=null;private readingError:string|null=null;
 private event:any=null;private opening:any=null;private sourcesStale=false;private influenceStale=false;private timing:any=null;private timingStart=0;private lastInspect=0;
 private operating=0;private cadence:Cadence|null=null;private lastCadence:Cadence|null=null;
 private refusal:{operation:string;reason:string;at:number}|null=null;
 private level:GainNode|null=null;private levelValue:number=PRESENTATION_LEVEL.initial;
 private selectedSourceBinding:NativeSelectedSourceBinding|null=null;private selectedSourceQualified=false;private lastSourceTransaction:any=null;
 private sourceAuthorshipWindow:{epoch:number;session:InstrumentSession;binding:NativeSelectedSourceBinding;selection:NativeSelectedScene;last_request_id:string;acknowledged:unknown}|null=null;
 private lastSourceAuthorship:unknown=null;
 private nativeTakeRecorder=new NativeTakeRecorder();
 private lastNativeCapture:NativeCaptureBatch|null=null;private lastCaptureCursor:string|null=null;
 private nativeCaptureFailure:{original:unknown;reason:string}|null=null;
 readonly takes:NativeTakePort={snapshot:()=>{try{const state=this.nativeTakeRecorder.snapshot(),cas=this.recordingBinding?.capture();return state&&cas&&state.boundary.expression_ref===cas.expression_ref&&state.boundary.scene_ref===cas.scene_ref?state:null;}catch{return null;}},subscribe:listener=>this.nativeTakeRecorder.subscribe(listener),start:()=>this.startNativeSoundTake(),stop:()=>this.stopNativeSoundTake(),export:kind=>{if(!this.takes.snapshot())return Promise.reject(Error('The original sound artifact is not in the current native Scene.'));return this.nativeTakeRecorder.export(kind);},recover:ref=>{const cas=this.recordingBinding?.capture();if(!cas)return Promise.reject(Error('Select the actual native Scene before recovering its sound artifact.'));return this.nativeTakeRecorder.list(cas.expression_ref,cas.scene_ref).then(rows=>{if(!rows.some(row=>row.take_ref===ref))throw Error('That original sound take belongs to another native Scene.');return this.nativeTakeRecorder.recover(ref);});},list:()=>{const cas=this.recordingBinding?.capture();if(!cas)return Promise.resolve([]);return this.nativeTakeRecorder.list(cas.expression_ref,cas.scene_ref);}};
 get nativeSoundCaptureCustody(){return{current:this.hasCurrentPerformance()&&this.lastNativeCapture!==null?structuredClone(this.lastNativeCapture):null,failure:this.nativeCaptureFailure===null?null:structuredClone(this.nativeCaptureFailure),storage:this.nativeTakeRecorder.custody(),take:this.nativeTakeRecorder.snapshot(),standing:'Current SAME native pulse when source-current; failures and unfinished take remain historical custody, never another Scene grant.'};}
 private async observeNativeCapture(result:any){
  const pulse=result?.native_reply?.result?.native_pulse;
  if(!pulse?.native_capture){if(this.nativeTakeRecorder.snapshot()?.status==='recording'){this.nativeCaptureFailure={original:result,reason:'The SAME original native pulse omitted its enrolled audio/device capture.'};try{await this.nativeTakeRecorder.fail(this.nativeCaptureFailure.reason);}catch(error){this.nativeCaptureFailure.reason+='; '+String(error);}this.holdPerformance(this.nativeCaptureFailure.reason);}return;}
  try{const reading=readPerformance(pulse.reading),batch=readNativeCapture(pulse.native_capture,reading);this.lastNativeCapture=batch;this.lastCaptureCursor=reading.samples_elapsed;await this.nativeTakeRecorder.append(batch);const take=this.nativeTakeRecorder.snapshot();if(take?.status==='recording'&&take.reason){await this.nativeTakeRecorder.fail(take.reason);this.holdPerformance('Original native sound capture lost its complete callback interval; hold the SAME body while retaining originals.');}}
  catch(error){this.nativeCaptureFailure={original:structuredClone(pulse.native_capture),reason:String(error)};this.reason='Original sound capture requires reconciliation: '+String(error);try{await this.nativeTakeRecorder.fail(this.reason);}catch(failure){this.nativeCaptureFailure.reason+='; '+String(failure);}this.holdPerformance('Original native sound capture/storage refused: '+String(error));}
 }
 /** Later Record is a genuine current stopped native cut, never born0/reseed.
  * The same serial lane retains the cut before sound admission resumes. */
 private startNativeSoundTake(){return this.serial(async()=>{
  this.requirePerformanceCurrent();const session=this.session,binding=this.recordingBinding;
  if(!session||!binding||!this.captureNativePulses||!this.recordingReady||this.performanceSaveCut||this.nativeTakeRecorder.snapshot()?.status==='recording')throw Error('Retain/reconcile this native work and stop its previous take before Record.');
  if(!this.lastNativeCapture||this.nativeCaptureFailure)throw Error('The actual native callback capture producer is unavailable or refused; Record cannot claim sound.');
  this.performanceSaving=true;
  try{
   const stopped=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-stop'}});
   await this.acceptRecording(stopped.recording);this.receivePerformance(stopped.performance.reading,stopped.performance.transport_transition??null);
   if(this.performanceReading!.device.state!=='prepared')throw Error('Open the actual native output before Record; its stopped device must remain prepared.');
   const checkpoint_ref=`checkpoint:${crypto.randomUUID()}`,cut=await session.performance({operation:'performance-save-cut',checkpoint_ref});
   await this.acceptRecording(cut.recording);this.requirePerformanceCurrent();
   const cas=binding.capture(),document=binding.document(),scene=document.scenes.find(row=>row.scene_ref===cas.scene_ref),performance=scene?.performance as any;
   const matches=performance?.checkpoints?.filter((row:any)=>row.checkpoint_ref===checkpoint_ref);
   if(matches?.length!==1)throw Error('The actual later-take native checkpoint was not retained exactly once.');
   const cutPerformance=cut.recording?.native_reply?.result?.host_receipt?.performance;
   if(cutPerformance?.schema!=='ql.performance-management-reply/v1')throw Error('The actual save-cut HostReceipt omitted its original management reply; its full cut remains retained.');
   this.receivePerformance(cutPerformance.reading,cutPerformance.transport_transition??null);
   const checkpoint=matches[0],reading=this.performanceReading!,baseline=this.lastNativeCapture;
   const host=cut.recording?.native_reply?.result?.host_receipt;
   if(!baseline||this.nativeCaptureFailure||this.lastCaptureCursor!==reading.samples_elapsed||checkpoint.acknowledged_stopped!==true||checkpoint.sample!==reading.samples_elapsed||checkpoint.audio?.cursor!==reading.samples_elapsed||checkpoint.management?.session_ref!==reading.session_ref||checkpoint.management?.transport_epoch!==reading.transport_epoch||typeof checkpoint.content_digest!=='string'||!host||host.request_id!==host.last_request_id)throw Error('The SAME actual stopped checkpoint/capture/outer acknowledgement differs; its original cut is retained.');
   await this.nativeTakeRecorder.begin({...cas,checkpoint_ref,checkpoint_digest:checkpoint.content_digest,request_id:host.request_id,session_ref:reading.session_ref,transport_epoch:reading.transport_epoch,sample:checkpoint.sample,sample_rate:baseline.sample_rate},baseline);
   const started=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-start'}});
   await this.acceptRecording(started.recording);this.receivePerformance(started.performance.reading,started.performance.transport_transition??null);
   const startedReading=this.musicalReading;
   if(started.performance.accepted!==true||!startedReading||startedReading.device.state!=='running'){await this.nativeTakeRecorder.stop(this.performanceReading!);throw Error('The original take is retained; actual native output did not start.');}
   this.changed();return this.nativeTakeRecorder.snapshot()!;
  }catch(error){try{await this.nativeTakeRecorder.fail('Original native Record start requires reconciliation: '+String(error));}catch(failure){throw new AggregateError([error,failure],'Native Record start and failure storage refused.');}throw error;}finally{this.performanceSaving=false;}
 });}
 private stopNativeSoundTake(){return this.serial(async()=>{
  const session=this.session;if(!session||!this.hasOwnedPerformance()||!this.nativeTakeRecorder.snapshot())throw Error('The original native sound take/owner is unavailable.');
  const stopped=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-stop'}});
  await this.acceptRecording(stopped.recording);this.receivePerformance(stopped.performance.reading,stopped.performance.transport_transition??null);
  const state=await this.nativeTakeRecorder.stop(this.performanceReading!);this.changed();return state;
 });}
 get nativeRecordingRequest(){return this.lastNativeRecordingRequest===null?null:structuredClone(this.lastNativeRecordingRequest);}private lastNativeRecordingRequest:any=null;
 private performanceSaving=false;private lastRecordingCas:any=null;private performanceSaveCut:{result:any;cas:any}|null=null;
 private performanceReading:NativePerformanceReading|null=null;
 private physicalProjection:PhysicalSnapshotProjection|null=null;
 private lastNativePhysicalEdit:any=null;private lastNativeAcousticEdit:any=null;private currentSourceArtifact:any=null;private currentRetainedSource:any=null;private playbackCurrentSource:NativePlaybackSourceCustody|null=null;
 private performanceListeners=new Set<(update:NativePerformanceUpdate)=>void>();
 private performancePolling=false;private lastPerformancePoll=0;private performancePreparing=false;
 private performanceHoldPending=false;private performanceFailure:string|null=null;
 private performanceCurrent:(()=>boolean)|null=null;private performanceStale=false;
 private scoreListeners=new Set<()=>void>();
 private recordingBinding:NativeSceneRecordingBinding|null=null;private captureNativePulses=false;private recordingReady=false;private lastNativeRecording:any=null;private lastNativeContinuation:any=null;private currentOutputCalibration:NativeCurrentOutputCalibration|null=null;private lastNativeCalibration:any=null;private observedCalibrationApplication:any=null;
 /** A receiving seam for the retained work, not another native owner. */
 readonly performance:NativePerformanceExchange=this.performancePort();
 readonly physicalDisplay:NativePhysicalDisplayPort={snapshot:()=>this.physicalProjection?.displayState()??null,setMagnification:value=>this.serial(async()=>{
  this.requirePerformanceCurrent();if(!this.physicalProjection||!this.performanceReading||this.contextLost)throw Error('The exact current native/GPU physical display is unavailable.');
  try{this.physicalProjection.setMagnification(value);this.applyPhysicalReading(this.performanceReading);this.changed();return this.physicalProjection.displayState();}
  catch(error){this.holdPerformance('Physical display rejected its actual native receiving: '+String(error));throw error;}
 })};
 readonly physicalEdits:NativePhysicalEditPort={snapshot:()=>{
  const binding=this.recordingBinding,reading=this.performanceReading;
  if(!binding||!reading||!this.hasCurrentPerformance()||this.performancePreparing)return null;
  try{return physicalEditSnapshot(binding.document(),binding.capture(),reading);}catch{return null;}
 },apply:edit=>this.editNativePhysical(edit),custody:()=>this.lastNativePhysicalEdit===null?null:structuredClone(this.lastNativePhysicalEdit)};
 readonly acousticEdits:NativeAcousticEditPort={snapshot:()=>{const binding=this.recordingBinding,reading=this.performanceReading;if(!binding||!reading||!this.hasCurrentPerformance())return null;try{return acousticSnapshot(binding.document(),binding.capture(),reading,this.currentSourceArtifact,this.currentRetainedSource);}catch{return null;}},apply:configuration=>this.editNativeSource('acoustic',readAuthoredAcousticConfiguration(configuration)),custody:()=>this.lastNativeAcousticEdit===null?null:structuredClone(this.lastNativeAcousticEdit)};
 readonly score:NativeScorePort={snapshot:()=>this.scoreSnapshot(),subscribe:listener=>{this.scoreListeners.add(listener);return()=>{this.scoreListeners.delete(listener);};},edit:operations=>this.editNativeScore(operations),resolve:()=>this.resolveNativeScore()};
 private retainedScoreAdmission:{cas:NativeRecordingCas;selected:RetainedPerformanceAct}|null=null;
 private nativeScoreTransportObservation:{lease:string;request_id:string;reading:NativePerformanceReading;transport_transition:NativeTransportAcknowledgement|null}|null=null;
 private scoreRenderCustody:{selected:RetainedPerformanceAct;range:NativeScorePlaybackRange;cas:any;before:NativePerformanceReading;transaction_ref:string;request:any;result:any;reason:string|null;held:boolean;file:string|null}|null=null;
 private scorePlaybackCustody:{selected:RetainedPerformanceAct;range:NativeScorePlaybackRange;cas:any;transaction_ref:string;request:any;result:any;reason:string|null;held:boolean;start_observation:{reading:NativePerformanceReading;transition:NativeTransportAcknowledgement|null}|null;first_current_pending:boolean;pending_reading:NativePerformanceReading|null;pending_result:any;source_observation:{result:any;document:any;cas:any;reading:NativePerformanceReading}|null;first_current:{request:any;result:any;cas:any;document:any;reading:NativePerformanceReading;transition:NativeTransportAcknowledgement|null}|null;stop_result:any}|null=null;
 readonly scorePlayback:NativeScorePlaybackPort={snapshot:()=>this.scorePlaybackSnapshot(),subscribe:listener=>{this.scoreListeners.add(listener);return()=>{this.scoreListeners.delete(listener);};},play:range=>this.playNativeRetainedScore(range),render:range=>this.renderNativeRetainedScore(range),stop:()=>this.stopNativeRetainedScore(),custody:()=>this.scorePlaybackCustody===null?null:structuredClone(this.scorePlaybackCustody),renderCustody:()=>this.scoreRenderCustody===null?null:structuredClone(this.scoreRenderCustody)};
 private scorePlaybackSnapshot():NativeScorePlaybackSnapshot|null{
  const binding=this.recordingBinding,reading=this.performanceReading;
  if(!binding||!reading||(!this.hasCurrentPerformance()&&!this.hasRetainedScoreAdmission()&&!this.hasPendingNativePlayback()))return null;
  try{
   const cas=binding.capture(),scene=binding.document().scenes.find(row=>row.scene_ref===cas.scene_ref),performance=scene?.performance as any;
   if(!performance||!Array.isArray(performance.checkpoints))return null;
   const compiled=this.lastNativeRecording?.recording_operations?.includes('playback')===true;
   const custody=this.scorePlaybackCustody,current=custody?.cas.expression_ref===cas.expression_ref&&custody?.cas.scene_ref===cas.scene_ref,pending=current&&this.hasPendingNativePlayback();
   return{expression_ref:cas.expression_ref,scene_ref:cas.scene_ref,duration_samples:performance.duration_samples,sample_rate:performance.sample_rate,
    can_export:!pending&&this.lastNativeRecording?.recording_operations?.includes('edited_render')===true&&!!binding.selectAct&&!this.performancePreparing&&!this.performanceSaving&&!this.performanceSaveCut&&this.nativeTakeRecorder.snapshot()?.status!=='recording'&&!this.scoreRenderCustody?.held&&reading.device.state!=='running',
    export_file:this.scoreRenderCustody?.cas.expression_ref===cas.expression_ref&&this.scoreRenderCustody?.cas.scene_ref===cas.scene_ref&&this.scoreRenderCustody?.cas.document_revision===cas.document_revision&&this.scoreRenderCustody?.cas.scene_revision===cas.scene_revision&&!this.scoreRenderCustody.held?this.scoreRenderCustody.file:null,
    available:!pending&&compiled&&!!binding.selectAct&&!this.performancePreparing&&!this.performanceSaving&&!this.performanceSaveCut&&this.nativeTakeRecorder.snapshot()?.status!=='recording'&&!(current&&custody?.held)&&reading.device.state==='prepared',
    running:current&&!pending&&!custody?.held&&!!custody?.first_current&&reading.device.state==='running',device_started:current&&!custody?.held&&custody?.result?.accepted===true&&(pending||reading.device.state==='running'),first_current_pending:!!pending,programme_ref:current&&!custody?.held?custody?.result?.native_reply?.result?.native_programme_admission?.programme_ref??null:null,
    reason:current&&custody?.reason?custody.reason:!compiled?'Native retained-score playback is unavailable for this instrument.':reading.device.state==='closed'?'Open native audio output before playing the retained score.':null,
    checkpoints:performance.checkpoints.map((row:any,index:number)=>({index,checkpoint_ref:row.checkpoint_ref,sample:row.sample,stopped:row.acknowledged_stopped===true}))};
  }catch{return null;}
 }
 private playNativeRetainedScore(input:NativeScorePlaybackRange){return this.serial(async()=>{
  this.requirePerformanceCurrent();if(!this.hasCurrentPerformance()&&!this.hasRetainedScoreAdmission())throw Error('The actual unchanged body or retained edited-score admission is unavailable.');const binding=this.recordingBinding,session=this.session,opened=this.opened;
  if(!binding?.selectAct||!session||!opened||this.performancePreparing||this.performanceSaving||this.performanceSaveCut||this.nativeTakeRecorder.snapshot()?.status==='recording'||this.scorePlaybackCustody?.held||this.scoreRenderCustody?.held)throw Error('Reconcile the original native work and stop its sound take before score playback.');
  if(!this.lastNativeRecording?.recording_operations?.includes('playback'))throw Error('This native instrument has no retained-score playback consumer.');
  const before=this.performanceReading!;
  if(before.device.state!=='prepared'||before.active_touches||before.sustain)throw Error('Stop output and release all touches and sustain before playing this score.');
  const range=readPlaybackRange(input,binding.score().performance.duration_samples);
  this.performancePreparing=true;session.hold('native retained score programme');this.scoreChanged();this.changed();
  let issued=false;
  try{
   await this.idle();const cas=binding.capture(),document=binding.document();
   const selected=await binding.selectAct();this.requirePerformanceCurrent();
   if(!sameNativePlaybackJson(binding.capture(),cas)||!sameNativePlaybackJson(selected.document,document)||!sameNativePlaybackJson(binding.document(),document))throw Error('The actual retained Act edition differs from the selected unchanged Document.');
   const transaction_ref=`transaction:${crypto.randomUUID()}`;
   this.playbackCurrentSource=null;this.scorePlaybackCustody={selected,range,cas,transaction_ref,request:null,result:null,reason:null,held:false,start_observation:null,first_current_pending:false,pending_reading:null,pending_result:null,source_observation:null,first_current:null,stop_result:null};issued=true;
   const reply=await session.performance({operation:'performance-playback',act_ref:selected.act_ref,selection:selected.selection,...range,transaction_ref});
   const custody=this.scorePlaybackCustody,requestId=custody.request?.request?.request_id;
   if(!requestId||reply.recording!==custody.result)throw Error('The original native programme lost its same-session request/result custody.');
   const started=readNativeActPlayback(reply.recording,reply.performance,selected,range,cas,requestId,transaction_ref);
   custody.start_observation={reading:started.reading,transition:started.transition};
   this.nativeScoreTransportObservation={lease:custody.request.lease,request_id:requestId,reading:started.reading,transport_transition:started.transition};
   await this.acceptRecording(reply.recording);this.requirePerformanceCurrent();
   if(this.nativeCaptureFailure)throw Error('The original native playback capture requires reconciliation: '+this.nativeCaptureFailure.reason);
   if(readNativePlaybackStartPhase(started.returned,started.programme,started.reading,this.playbackCurrentSource!==null)==='pending-first-callback'){
    this.retainPendingNativePlaybackSource(started.reading,started.returned,started.programme,started.plan);
    custody.first_current_pending=true;custody.pending_reading=started.reading;custody.pending_result=reply.recording;
    this.status='held';custody.reason=this.reason='Audio output started; waiting for its first native sound and body response.';
    // Previous P/reading remain historical; only the existing frame observer
    // and protective Stop/Hold/Panic may use this accepted native lifetime.
    // Subscribers may preserve the original epoch/ACK as historical transport
    // only. owner.current is false and the displayed P/reading is unchanged.
    const observation=this.performance.transportObservation?.();if(observation)for(const listener of this.performanceListeners)listener({schema:'ql.performance-management-update/v1',reading:observation.reading,transport_transition:observation.transport_transition});
    this.scoreChanged();this.changed();return reply.recording;
   }
   this.adoptNativePlaybackSource(started.reading,started.returned,started.programme,started.plan);
   custody.first_current={request:structuredClone(this.lastNativeRecordingRequest),result:reply.recording,cas:binding.capture(),document:binding.document(),reading:started.reading,transition:started.transition};
   this.applyPhysicalReading(started.reading);this.recordingReady=true;this.retainedScoreAdmission=null;this.publishPerformance(started.reading,started.transition);this.scoreChanged();this.reason='The native score programme and its actual sound/body source are current.';this.changed();return reply.recording;
  }catch(error){
   const custody=this.scorePlaybackCustody;
   if(issued&&custody){custody.reason=String(error);custody.held=true;this.recordingReady=false;
    // An accepted or unknown start cannot be retried or left exciting the old
    // displayed body. Close the exact owned lifetime; retain original results.
    if(custody.result?.delivery_attempted!==false){try{await this.closeOwner(opened);}catch(closeError){custody.reason+='; exact native close failed: '+String(closeError);}}
   }
   this.performanceFailure=String(error);this.status=issued?'unavailable':'held';this.reason=String(error);this.changed();this.scoreChanged();throw error;
  }finally{
   this.performancePreparing=false;
   const custody=this.scorePlaybackCustody,first=custody?.first_current;
   // Fast Start was source-qualified while preparation held client input.
   // Notify its SAME admitted reading after releasing that hold, so keys/body
   // cannot remain on the old source until a later native observer request.
   // Pending/refused Start still publishes no current body. Its original ACK
   // remains separately retained and is not attached to an advanced reading.
   if(first&&first.reading===this.performanceReading&&!custody!.held&&!custody!.first_current_pending&&this.hasCurrentPerformance())for(const listener of this.performanceListeners)listener({schema:'ql.performance-management-update/v1',reading:first.reading,transport_transition:null});
   this.scoreChanged();this.changed();
  }
 });}
 /** Retain genuine source evidence from a stopped/offline callback without
  * changing current basis, P/GPU, displayed reading or live-input readiness. */
 private retainPendingNativePlaybackSource(reading:NativePerformanceReading,returned:any,programme:any,plan:any){
  if(!Object.hasOwn(returned,'current_source_selection'))return;
  const binding=this.recordingBinding;if(!binding)throw Error('The original pending native source has no actual Scene binding.');
  this.requirePerformanceCurrent(true);
  const document=binding.document(),cas=binding.capture();
  this.playbackCurrentSource=readNativePlaybackCurrentSource(returned,programme,plan,document,cas,reading,this.playbackCurrentSource).custody;
  // One bounded original per current source epoch, borrowed from the actual
  // returned result. This supplies independent source replay, never input.
  if(Object.hasOwn(returned,'source_artifact')&&this.scorePlaybackCustody)this.scorePlaybackCustody.source_observation={result:this.lastNativeRecording,document,cas,reading};
 }
 /** Original same-pulse native evidence validates all source descendants before
  * either renderer texture becomes active. A later body is never a label bind. */
 private adoptNativePlaybackSource(reading:NativePerformanceReading,returned:any,programme:any,plan:any){
  const binding=this.recordingBinding;if(!binding)throw Error('The current native source/renderer binding is absent.');
  this.requirePerformanceCurrent(true);const cas=binding.capture(),document=binding.document();
  const current=readNativePlaybackCurrentSource(returned,programme,plan,document,cas,reading,this.playbackCurrentSource);
  if(!this.scorePlaybackCustody?.first_current){
   const original=returned.native_pulse?.native_capture,capture=this.lastNativeCapture;
   if(this.nativeCaptureFailure||original?.capture_enabled!==true||original?.counters?.has_callback_readback!==true||!capture||capture.session_ref!==reading.session_ref||capture.transport_epoch!==reading.transport_epoch||this.lastCaptureCursor!==reading.samples_elapsed||!hasNativePlaybackDeviceCallback(returned,programme,reading))throw Error('The first current native source lacks its SAME original callback capture fence.');
  }
  const existing=this.physicalProjection?.inspect();
  if(existing?.scope?.preparation_ref!==reading.scope.preparation_ref||existing?.scope?.state_ref!==reading.scope.state_ref||existing?.scope?.body_revision!==reading.scope.body_revision||existing?.transport_epoch!==reading.transport_epoch){
   const replacement=new PhysicalSnapshotProjection(this.renderer.retainedTargetPort(),binding.receivingMap(reading),null);
   try{replacement.prepareAdmission(reading,this.physicalReceivingTargets(),binding.physicalRest(reading));this.requirePerformanceCurrent(true);
    if(!sameNativePlaybackJson(binding.capture(),cas)||!sameNativePlaybackJson(binding.document(),document))throw Error('The actual current Document changed during native body admission.');
    replacement.commitPreparedAdmission();const old=this.physicalProjection;this.physicalProjection=replacement;old?.dispose();
   }catch(error){replacement.dispose();throw error;}
  }
  binding.basis=current.selector.basis_index;this.playbackCurrentSource=current.custody;this.currentSourceArtifact=current.artifact;this.currentRetainedSource=null;
  // One actual original for the current epoch supports independent return
  // inspection; the first device callback remains separately immutable.
  if(Object.hasOwn(returned,'source_artifact')&&this.scorePlaybackCustody)this.scorePlaybackCustody.source_observation={result:this.lastNativeRecording,document,cas,reading};
 }
 private renderNativeRetainedScore(input:NativeScorePlaybackRange){return this.serial(async()=>{
  this.requirePerformanceCurrent();if(!this.hasCurrentPerformance()&&!this.hasRetainedScoreAdmission())throw Error('The actual unchanged body or retained edited-score admission is unavailable.');const binding=this.recordingBinding,session=this.session,opened=this.opened,before=this.performanceReading;
  if(!binding?.selectAct||!session||!opened||!before||this.performancePreparing||this.performanceSaving||this.performanceSaveCut||this.nativeTakeRecorder.snapshot()?.status==='recording'||this.scoreRenderCustody?.held||this.scorePlaybackCustody?.held)throw Error('Reconcile the native work and stop its sound take before exporting this score.');
  if(!this.lastNativeRecording?.recording_operations?.includes('edited_render'))throw Error('This native owner has no whole-score WAV export consumer.');
  if(before.device.state==='running'||before.active_touches||before.sustain)throw Error('Stop output and release touches/sustain before the native WAV render.');
  const range=readPlaybackRange(input,binding.score().performance.duration_samples);
  this.performancePreparing=true;session.hold('native edited score WAV');this.scoreChanged();this.changed();let issued=false;
  try{await this.idle();const cas=binding.capture(),document=binding.document(),selected=await binding.selectAct();this.requirePerformanceCurrent();
   if(!sameNativePlaybackJson(binding.capture(),cas)||!sameNativePlaybackJson(selected.document,document)||!sameNativePlaybackJson(binding.document(),document))throw Error('The actual current Act edition changed before WAV export.');
   const transaction_ref=`transaction:${crypto.randomUUID()}`;this.scoreRenderCustody={selected,range,cas,before,transaction_ref,request:null,result:null,reason:null,held:false,file:null};issued=true;
   const reply=await session.performance({operation:'performance-edited-render',act_ref:selected.act_ref,selection:selected.selection,...range,transaction_ref});
   const custody=this.scoreRenderCustody,id=custody.request?.request?.request_id;
   if(!id||reply.recording!==custody.result)throw Error('Native WAV export lost the original same-session request/result.');
   const rendered=readNativeEditedRender(reply.recording,reply.performance,selected,range,cas,id,before);
   await this.acceptRecording(reply.recording);this.requirePerformanceCurrent();
   if(!sameNativePlaybackJson(binding.document(),document))throw Error('The current Document changed during native WAV export.');
   // The native restitution returned its exact genuine restored source/body, qualified by
   // the closed native/C original cohort. Prepare its acknowledged new epoch
   // before committing retained GPU bindings; it grants no replacement body.
   const projection=new PhysicalSnapshotProjection(this.renderer.retainedTargetPort(),binding.receivingMap(rendered.reading),null);
   try{projection.prepareAdmission(rendered.reading,this.physicalReceivingTargets(),binding.physicalRest(rendered.reading));this.requirePerformanceCurrent();projection.commitPreparedAdmission();const old=this.physicalProjection;this.physicalProjection=projection;old?.dispose();}
   catch(error){projection.dispose();throw error;}
   binding.basis=rendered.restoredSource.basis;this.currentSourceArtifact=rendered.restoredSource.artifact;this.currentRetainedSource=rendered.restoredSource.retainedSource;
   this.playbackCurrentSource=null;custody.file=rendered.files.directory.replace(/\/$/,'')+'/'+rendered.wav.file;
   this.nativeScoreTransportObservation={lease:custody.request.lease,request_id:id,reading:rendered.reading,transport_transition:rendered.transition};
   this.publishPerformance(rendered.reading,rendered.transition);this.scoreChanged();this.reason='The native WAV and all original render receipts were saved; the stopped performance was restored.';this.changed();return reply.recording;
  }catch(error){const custody=this.scoreRenderCustody;if(issued&&custody){custody.held=true;custody.reason=String(error);this.recordingReady=false;if(custody.result?.delivery_attempted!==false){try{await this.closeOwner(opened);}catch(closeError){custody.reason+='; exact native close failed: '+String(closeError);}}}this.performanceFailure=String(error);this.reason=String(error);this.status=issued?'unavailable':'held';this.changed();throw error;}
  finally{this.performancePreparing=false;this.scoreChanged();this.changed();}
 });}
 private stopNativeRetainedScore(){return this.serial(async()=>{
  this.requirePerformanceCurrent(true);const session=this.session,custody=this.scorePlaybackCustody;
  if(!session||!this.captureNativePulses||this.performancePreparing||this.performanceSaving||this.performanceSaveCut)throw Error('The same native score owner is not available to stop.');
  const reply=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-stop'}});
  if(custody)custody.stop_result=reply.recording;
  await this.acceptRecording(reply.recording);
  if(reply.performance.accepted!==true||reply.performance.reading?.device.state==='running')throw Error('The actual native output did not acknowledge Stop.');
  this.receivePerformance(reply.performance.reading,reply.performance.transport_transition??null);
  if(custody?.first_current_pending){
   // A Stop before the first callback grants no replacement P. Retire the exact
   // lifetime after genuine Stop, retaining both original acknowledgements.
   custody.held=true;custody.reason=this.reason='Native output stopped before its first current body response. Original start and stop are retained.';
   this.recordingReady=false;this.status='held';const opened=this.opened;
   try{if(opened)await this.closeOwner(opened);}catch(error){custody.reason+='; exact native close failed: '+String(error);this.reason=custody.reason;throw error;}
  }
  this.scoreChanged();this.changed();
 }).catch(error=>{this.failPendingNativePlayback(error);throw error;});}
 private scoreSnapshot():NativeScoreSnapshot|null{
  const binding=this.recordingBinding,reading=this.performanceReading;if(!binding||!reading)return null;
  try{return{...binding.score(),stopped:!this.hasPendingNativePlayback()&&reading.device.state!=='running',playback_current:this.hasCurrentPerformance(),reason:this.reason};}catch{return null;}
 }
 private scoreChanged(){for(const listener of this.scoreListeners)listener();}
 private editNativeScore(operations:NativeScoreOperation[]){return this.serial(async()=>{
  this.requirePerformanceCurrent();const binding=this.recordingBinding,session=this.session;
  if(!binding||!session)throw Error('The actual captured native score is unavailable.');
  if(this.performanceReading!.active_touches||this.performanceReading!.sustain)throw Error('Release all admitted touches and sustain before editing this score.');
  if(this.performanceReading!.device.state==='running'){
   const reply=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-stop'}});if(reply.recording)await this.acceptRecording(reply.recording);this.receivePerformance(reply.performance.reading,reply.performance.transport_transition??null);
  }
  await this.retainPreEditStoppedCut();const cas=binding.capture(),before=binding.document();this.retainedScoreAdmission=null;
  try{await binding.edit(operations,cas);this.recordingReady=false;await this.retainEditedScoreAdmission(before,cas);this.status='held';this.reason='The edited score is ready to play or export. Keys stay held until the instrument responds to playback.';this.changed();this.scoreChanged();const snapshot=this.scoreSnapshot();if(!snapshot)throw Error('The edited native score readback disappeared.');return snapshot;}
  catch(error){this.recordingReady=false;this.reason=String(error);this.status='held';this.changed();this.scoreChanged();throw error;}
 });}

 private resolveNativeScore(){return this.serial(async()=>{
  this.requirePerformanceCurrent();const binding=this.recordingBinding;
  if(!binding||!this.performanceReading||this.performanceReading.device.state==='running')throw Error('Stop the exact native output before reconciling its score.');
  const before=binding.document(),cas=binding.capture();this.retainedScoreAdmission=null;
  await binding.resolve();this.recordingReady=false;await this.retainEditedScoreAdmission(before,cas);this.status='held';this.reason='The reconciled score is ready to play or export. Keys remain held until the instrument responds to playback.';this.changed();this.scoreChanged();
  const snapshot=this.scoreSnapshot();if(!snapshot)throw Error('The reconciled native score readback is unavailable.');return snapshot;
 });}

 /** Preserve actual physical history BEFORE authoring a different score past.
  * A fresh unique same-cursor cut is native-qualified, including pending queues;
  * UI sample/sequence equality never substitutes for the original native cut. */
 private async retainPreEditStoppedCut(){
  if(this.hasRetainedScoreAdmission())return; // unchanged quiet edited custody
  this.requirePerformanceCurrent();const session=this.session;
  if(!session||!this.hasCurrentPerformance()||!this.captureNativePulses||this.performanceReading?.device.state==='running'||!this.lastNativeRecording?.recording_operations?.includes('save_cut'))throw Error('The actual stopped native state must be retained before editing its score.');
  try{
   if(this.nativeTakeRecorder.snapshot()?.status==='recording')await this.nativeTakeRecorder.stop(this.performanceReading!);
   const cut=await session.performance({operation:'performance-save-cut',checkpoint_ref:`checkpoint:${crypto.randomUUID()}`});
   await this.acceptRecording(cut.recording);this.requirePerformanceCurrent();
   if(cut.recording?.accepted!==true||cut.recording?.original_cut_files?.available!==true)throw Error('The original pre-edit native cut/files require reconciliation. The score was not edited.');
   this.receivePerformance(cut.performance.reading,cut.performance.transport_transition??null);
  }catch(error){this.recordingReady=false;this.status='held';this.reason=String(error);this.changed();this.scoreChanged();throw error;}
 }

 private hasRetainedScoreAdmission(){
  const admission=this.retainedScoreAdmission,binding=this.recordingBinding;
  if(!admission||!binding||!this.hasOwnedPerformance()||this.pendingPlaybackBoundary()||this.performancePreparing||this.performanceSaving||this.performanceSaveCut||this.performanceStale||this.performanceCurrent?.()!==true)return false;
  try{return sameNativePlaybackJson(binding.capture(),admission.cas)&&sameNativePlaybackJson(binding.document(),admission.selected.document);}catch{return false;}
 }
 private async retainEditedScoreAdmission(before:any,beforeCas:NativeRecordingCas){
  this.requirePerformanceCurrent();const binding=this.recordingBinding;
  if(!binding?.selectAct||!this.hasOwnedPerformance()||this.performanceReading?.device.state==='running')throw Error('The actual stopped native body and same-store Act reader are required for edited-score admission.');
  const document=binding.document(),cas=binding.capture(),original=before.scenes.find((row:any)=>row.scene_ref===beforeCas.scene_ref)?.performance,after=document.scenes.find((row:any)=>row.scene_ref===cas.scene_ref)?.performance;
  if(cas.expression_ref!==beforeCas.expression_ref||cas.scene_ref!==beforeCas.scene_ref||!original||!after)throw Error('The score edit returned to another actual native work.');
  for(const field of ['bases','native_sources','checkpoints'])if(Object.hasOwn(original,field)!==Object.hasOwn(after,field)||!sameNativePlaybackJson(original[field],after[field]))throw Error('The authored score edit changed its original native source, basis or checkpoint custody.');
  const selected=await binding.selectAct();this.requirePerformanceCurrent();
  if(!sameNativePlaybackJson(binding.capture(),cas)||!sameNativePlaybackJson(binding.document(),document)||!sameNativePlaybackJson(selected.document,document))throw Error('The actual newly retained native Act edition differs from the current unchanged edited Document.');
  this.retainedScoreAdmission={cas:structuredClone(cas),selected};
 }

 private performancePort():NativePerformanceExchange{const controller=this;return{
  get current(){return controller.hasCurrentPerformance();},
  transportObservation:()=>{
   const original=controller.nativeScoreTransportObservation;
   if(!original||controller.scorePlaybackCustody?.held||controller.scoreRenderCustody?.held||!controller.hasOwnedPerformance()||controller.performanceStale||controller.performanceCurrent?.()!==true||original.lease!==controller.opened?.lease||controller.opened?.closing)return null;
   return original;
  },
  outputCalibration:()=>{if(!controller.hasCurrentPerformance()||!controller.currentOutputCalibration)return null;const admission=controller.lastNativeCalibration?.native_reply?.result?.native_pulse?.payload?.score_admission;return{declaration:structuredClone(controller.currentOutputCalibration),stage:!controller.currentOutputCalibration.required?'not-required':controller.observedCalibrationApplication?'applied':'queued',admission_sequence:admission?.event?.sequence??null,effective_force_newtons:controller.performanceReading?.parameters.find(parameter=>parameter.target_ref==='ql:performance/parameter/force-newtons')?.effective??null};},
  supports:(operation)=>controller.hasCurrentPerformance()&&!(operation==='performance-transpose'&&controller.captureNativePulses),
  exchange:(command:NativePerformanceCommand)=>this.exchangePerformance(command),
  subscribe:(listener:(update:NativePerformanceUpdate)=>void)=>{
   this.performanceListeners.add(listener);
   if(this.performanceReading)listener({schema:'ql.performance-management-update/v1',reading:this.performanceReading,transport_transition:null});
   return()=>{this.performanceListeners.delete(listener);};
  },
  holdPerformance:(reason:string)=>this.holdPerformance(reason),
 };}
 private hasOwnedPerformance(){return !this.performanceFailure&&!!this.performanceReading&&!!this.session&&this.current(this.session)&&this.session.reading.available;}
 private pendingPlaybackBoundary(){const custody=this.scorePlaybackCustody;return custody?.first_current_pending===true&&typeof custody.request?.lease==='string'&&custody.request.lease===this.opened?.lease;}
 private hasPendingNativePlayback(){const custody=this.scorePlaybackCustody;return this.hasOwnedPerformance()&&!this.opened?.closing&&this.pendingPlaybackBoundary()&&!custody!.held&&!this.performanceStale&&this.performanceCurrent?.()===true;}
 private failPendingNativePlayback(error:unknown){
  if(!this.pendingPlaybackBoundary())return;
  const custody=this.scorePlaybackCustody!;custody.held=true;custody.reason=String(error);this.recordingReady=false;this.performanceFailure=String(error);this.status='unavailable';this.reason=String(error);
  const opened=this.opened;if(opened)void this.closeOwner(opened).catch(closeError=>{custody.reason+='; exact native close failed: '+String(closeError);this.reason=custody.reason;this.changed();});
  this.scoreChanged();this.changed();
 }
 private hasCurrentPerformance(){return this.hasOwnedPerformance()&&!this.pendingPlaybackBoundary()&&!this.performanceSaveCut&&!this.performancePreparing&&this.recordingReady&&!this.performanceStale&&this.performanceCurrent?.()===true;}
 private requirePerformanceCurrent(allowPending=false){
  if(this.performanceCurrent?.()===true&&!this.performanceStale){if(!allowPending&&this.pendingPlaybackBoundary())throw Error("Wait for the original native programme's first current sound and body response.");return;}
  if(!this.performanceStale){this.performanceStale=true;this.status='held';this.reason='The current Document, Scene or selected native source changed; this physical instrument is held.';
   if(this.pendingPlaybackBoundary()){this.scorePlaybackCustody!.held=true;this.scorePlaybackCustody!.reason=this.reason;const opened=this.opened;if(opened)void this.closeOwner(opened).catch(error=>{this.reason+='; exact native close failed: '+String(error);this.changed();});}else this.holdPerformance(this.reason);if(this.performanceReading)for(const listener of this.performanceListeners)listener({schema:'ql.performance-management-update/v1',reading:this.performanceReading,transport_transition:null});this.changed();}
  throw Error(this.reason??'The retained native performance source is stale.');
 }
 assertCurrentPerformance(){this.requirePerformanceCurrent();if(!this.recordingReady)throw Error('The current native score and pre-play origin are not yet retained.');return this.performanceReading;}
 bindNativeSceneRecording(binding:NativeSceneRecordingBinding){
  if(!this.performanceReading||this.recordingBinding||this.performanceReading.device.state!=='closed'||this.performanceReading.accepted_sequence!=='0')throw Error('Bind the actual native Scene before any output/input admission.');
  this.recordingBinding=binding;
 }
 prepareNativeScenePerformance(definition:NativeRecordingDefinition){return this.serial(async()=>{
  this.requirePerformanceCurrent();const session=this.session;if(!session||!this.recordingBinding||this.captureNativePulses)throw Error('Native Scene preparation requires its held current recording owner.');
  const result=await session.performance({operation:'performance-scene-prepare',definition});await this.acceptRecording(result.recording);this.requirePerformanceCurrent();this.bindNativePhysicalDisplay();return result.recording;
 });}
 beginNativeSceneRecording(checkpoint_ref:string){return this.serial(async()=>{
  this.requirePerformanceCurrent();const session=this.session;if(!session||!this.recordingBinding||this.captureNativePulses)throw Error('The native stopped origin is unavailable or already retained.');
  if(!this.physicalProjection?.displayState().rest_available)this.bindNativePhysicalDisplay();
  const result=await session.performance({operation:'performance-recording-begin',checkpoint_ref});await this.acceptRecording(result.recording);this.requirePerformanceCurrent();
  const checkpoint=result.recording?.native_reply?.result?.native_pulse?.payload?.checkpoint;
  if(!checkpoint)throw Error('The actual native born checkpoint was not returned.');
  this.captureNativePulses=true;this.recordingReady=true;
  if(this.currentOutputCalibration?.required){
   this.performancePreparing=true;this.changed();
   try{
    const calibrated=await session.performance({operation:'performance-exchange',command:{operation:'calibrate-current'}});
    this.lastNativeCalibration=calibrated.recording;
    await this.acceptRecording(calibrated.recording);this.requirePerformanceCurrent();
    const receipt=calibrated.performance;
    const raw=calibrated.recording?.native_reply?.result?.native_pulse,admission=raw?.payload?.score_admission;
    if(receipt?.operation!=='calibrate-current'||receipt.accepted!==true||!samePhysicalJson(receipt.current_output_calibration,this.currentOutputCalibration)||raw?.accepted!==true||!samePhysicalJson(receipt.native_payload?.score_admission,admission)||admission?.queued!==true||admission.input_ref!==null||admission.event?.kind!==5||admission.event.sample!=='0'||admission.event.requested_sample!=='0'||receipt.reading.samples_elapsed!=='0'||receipt.reading.accepted_sequence!==admission.event.sequence||receipt.reading.device.state==='running'||!Array.isArray(raw.applications)||raw.applications.length!==0)throw Error('The original stopped native calibration queue/declaration differs.');
    this.receivePerformance(receipt.reading,receipt.transport_transition??null);
    this.reason='Native output calibration admitted before play; effective Force follows its actual audio callback readback.';
   }catch(error){this.recordingReady=false;this.performanceFailure=String(error);this.status=session.reading.available?'held':'unavailable';this.reason='Original native calibration requires reconciliation: '+String(error);throw error;}
   finally{this.performancePreparing=false;}
  }
  this.scoreChanged();
  if(this.performanceReading)for(const listener of this.performanceListeners)listener({schema:'ql.performance-management-update/v1',reading:this.performanceReading,transport_transition:null});this.changed();return result.recording;
 });}
 private async acceptRecording(result:any){
  const binding=this.recordingBinding,cas=this.lastRecordingCas;
  if(!binding||!cas||result!==this.lastNativeRecording)throw Error('The original native recording transaction lost its exact captured CAS.');
  await this.observeNativeCapture(result);
  try{await binding.accept(result,cas);
   const sequence=this.lastNativeCalibration?.native_reply?.result?.native_pulse?.payload?.score_admission?.event?.sequence;
   if(sequence)for(const application of result?.native_reply?.result?.native_pulse?.applications??[]){
    if(application.kind===5&&application.parameter===0&&application.sequence===sequence&&application.status==='applied'){
     if(this.observedCalibrationApplication&&!samePhysicalJson(this.observedCalibrationApplication,application))throw Error('The actual original calibration application changed after its callback custody.');
     this.observedCalibrationApplication=structuredClone(application);
    }
   }
   if(result.application?.Ok)this.scoreChanged();}
  catch(error){this.recordingReady=false;this.status='held';this.reason='Original native pulse acknowledged; Document adoption requires reconciliation: '+String(error);this.changed();throw error;}
 }
 private async saveRetainedEditedScore<T>(save:()=>Promise<T>):Promise<T>{
  if(!this.hasRetainedScoreAdmission())throw Error('The exact retained edited score is unavailable for its original file save.');
  // Native P describes its authentic pre-edit cut, not the edited past.
  // Ordinary Workspace Save retains the exact current Act Edition and file;
  // this serial pause sends no Stop/Inspect/new cut or calibration command.
  const binding=this.recordingBinding!,cas=binding.capture(),document=binding.document();
  this.performanceSaving=true;this.changed();
  try{const saved=await save();if(saved===false)throw Error('The edited score file save/readback remains unresolved.');this.requirePerformanceCurrent();
   if(!sameNativePlaybackJson(binding.capture(),cas)||!sameNativePlaybackJson(binding.document(),document))throw Error('The edited saved file differs from the actual retained score Edition.');
   this.status='held';this.reason='Edited score saved and read back. Play or export it; keys remain held.';this.changed();return saved;
  }finally{this.performanceSaving=false;this.scoreChanged();this.changed();}
 }
 /** The serial owner remains paused through the native stopped cut AND the
  * ordinary file save/readback. No Inspect can drain a new pulse in between. */
 withNativePerformanceSave<T>(save:()=>Promise<T>):Promise<T>{
  if(!this.performanceReading)return save();
  return this.serial(async()=>{
   this.requirePerformanceCurrent();const session=this.session;
   if(this.hasRetainedScoreAdmission())return this.saveRetainedEditedScore(save);
   if(!session||!this.recordingBinding||!this.captureNativePulses||!this.recordingReady||this.performanceSaveCut)throw Error('Retain/reconcile the actual native recording before saving its current state.');
   this.performanceSaving=true;
   try{
    const stopped=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-stop'}});
    await this.acceptRecording(stopped.recording);this.receivePerformance(stopped.performance.reading,stopped.performance.transport_transition??null);
    if(this.performanceReading!.device.state==='running')throw Error('The exact native output did not acknowledge its stopped state.');
    if(this.nativeTakeRecorder.snapshot()?.status==='recording')await this.nativeTakeRecorder.stop(this.performanceReading!);
    const cut=await session.performance({operation:'performance-save-cut',checkpoint_ref:`checkpoint:${crypto.randomUUID()}`});
    await this.acceptRecording(cut.recording);this.performanceSaveCut={result:cut.recording,cas:structuredClone(this.lastRecordingCas)};this.requirePerformanceCurrent();
    const saved=await save();if(saved===false)throw Error('The native stopped cut is retained; its file save/readback was not acknowledged.');this.requirePerformanceCurrent();this.status='held';this.reason='Native stopped performance saved and read back; continue explicitly.';this.performanceSaveCut=null;this.changed();return saved;
   }finally{this.performanceSaving=false;}
  });
 }
 /** Reconcile the existing file operation under the already captured cut.
  * A retry never replaces that cut or consumes another recording ordinal. */
 withNativePerformanceFileRecovery<T>(save:()=>Promise<T>):Promise<T>{
  if(!this.performanceReading)return save();
  return this.serial(async()=>{
   this.requirePerformanceCurrent();
   if(this.hasRetainedScoreAdmission())return this.saveRetainedEditedScore(save);
   if(!this.session?.reading.available||this.performanceReading!.device.state==='running'||this.performanceSaveCut?.result?.accepted!==true)throw Error('The original stopped native save cut is unavailable for same-file recovery.');
   this.performanceSaving=true;try{const result=await save();if(result===false)throw Error('The original file save remains pending.');this.requirePerformanceCurrent();this.performanceSaveCut=null;this.reason='Original native stopped cut saved and read back; continue explicitly.';this.changed();return result;}finally{this.performanceSaving=false;}
  });
 }
 get nativeRecording(){return this.lastNativeRecording===null?null:structuredClone(this.lastNativeRecording);}
 get nativeOutputCalibration(){return{declaration:this.currentOutputCalibration===null?null:structuredClone(this.currentOutputCalibration),original_recording:this.lastNativeCalibration===null?null:structuredClone(this.lastNativeCalibration),actual_application:this.observedCalibrationApplication===null?null:structuredClone(this.observedCalibrationApplication),current:this.hasCurrentPerformance(),standing:'original native declaration/admission custody; actual effective Force remains native readback'};}
 get nativeContinuation(){return this.hasCurrentPerformance()&&this.lastNativeContinuation?structuredClone(this.lastNativeContinuation):null;}
 get nativeContinuationCustody(){return this.lastNativeContinuation?structuredClone(this.lastNativeContinuation):null;}
 get musicalCaptureReady(){return this.recordingReady&&!this.pendingPlaybackBoundary();}
 private closeOwner(opened:any){
  if(!opened)return Promise.resolve();
  if(opened.closing)return opened.closing as Promise<void>;
  opened.closing=(async()=>{
   try{
    if(typeof opened.lease!=='string'||!opened.lease)throw new Error('the owned opening omitted its exact lease');
    const receipt=await this.port.request({operation:'close',lease:opened.lease});
    if(receipt?.schema!=='oi.native-expression-closed/v1'||receipt.lease!==opened.lease||receipt.closed!==true)throw new Error('native close did not acknowledge this exact lease');
    opened.closed=true;this.lastClose={schema:receipt.schema,lease:receipt.lease,closed:true};
   }catch(error){this.closeFailure=new NativeCloseError(String(error));throw this.closeFailure;}
  })();
  // Keep the acknowledgement for release; a failed close is never reissued.
  opened.closing.catch(()=>{});return opened.closing as Promise<void>;
 }
 /** A bounded, one-use receipt of THIS exchange; the copied adapter validates
  * its acknowledgement before the awaited operation returns. Never lastInfluence. */
 private exchangeScope(session:InstrumentSession):NativeExchangeScope{
  const reading=session.reading;
  return{serial:this.exchangeSerial,instance_ref:reading.instance_ref,event_ref:reading.event_ref,subject_ref:reading.subject_ref,acknowledged:{...reading.acknowledged}};
 }
 private takeAcknowledgedExchange(session:InstrumentSession,operation:string,scope:NativeExchangeScope){
  const receipt=this.exchangeReceipt;this.exchangeReceipt=null;
  sceneNeed(receipt&&receipt.serial>scope.serial&&receipt.serial===this.exchangeSerial&&receipt.session===session&&receipt.epoch===this.epoch&&
   receipt.opened===this.opened&&receipt.lease===this.opened?.lease&&this.current(session),'exchange belongs to another request/lifetime');
  const {request,reply}=receipt!,reading=session.reading,field=reply.field;
  sceneNeed(reading.available&&request.schema==='ql.field-host-request/v1'&&request.command?.operation===operation&&
   request.instance_ref===scope.instance_ref&&request.event_ref===scope.event_ref&&request.subject_ref===scope.subject_ref&&
   request.expected_generation===scope.acknowledged.generation&&request.expected_samples_elapsed===scope.acknowledged.samples_elapsed&&sceneU64(request.request_id)&&
   reply.schema==='ql.field-host-receipt/v1'&&reply.status==='ok'&&reply.available===true&&reply.instance_ref===request.instance_ref&&
   reply.request_id===request.request_id&&reply.last_request_id===request.request_id,'exchange acknowledgement differs from this exact request');
  sceneNeed(field?.event_ref===reading.event_ref&&field?.subject_ref===reading.subject_ref&&field?.generation===reading.acknowledged.generation&&
   field?.samples_elapsed===reading.acknowledged.samples_elapsed&&reading.instance_ref===request.instance_ref,'exchange was not validated at the current acknowledged cursor');
  return reply;
 }
 private invalidateCurrentReading(error:unknown){
  this.domain=null;this.event=null;this.acting=null;this.influenceReading=null;
  this.sourcesStale=true;this.influenceStale=true;this.readingError=String(error instanceof Error?error.message:error);
 }
 private acknowledgedSceneEvent(){
  this.checkpoint=null;this.domain=null;this.event=null;this.acting=null;this.influenceReading=null;
  this.sourcesStale=true;this.influenceStale=true;this.readingError=null;this.refusal=null;
 }
 private async readSources(session:InstrumentSession,held=false){
  const scope=this.exchangeScope(session);
  try{
   const sources=await (held?session.source({operation:'inspect'}):session.inspect()),reply=this.takeAcknowledgedExchange(session,'inspect',scope),reading=session.reading;
   sceneNeed(!reply.metadataRefusal,`THIS native-source Inspect metadata refused: ${reply.metadataRefusal}`);
   const domain=projectNativeSources(sources,{event_ref:reading.event_ref,subject_ref:reading.subject_ref,generation:reading.acknowledged.generation});
   // Provenance of a supplied modal basis does not grant Scene-only operations.
   // Scene Inspect carries both event and influence, even at an unchanged cursor.
   const scene=this.ownerKind==='scene'||this.opened?.source?.schema==='oi.native-expression-composed-source/v1'||reply.hasEvent||reply.hasInfluence;
   sceneNeed(this.ownerKind===null||this.ownerKind===(scene?'scene':'supplied'),'native owner kind changed within its admitted lifetime');
   let influence:any=null,event:any=null,acting:SceneActing|null=null;
   if(scene){
    sceneNeed(!reply.metadataRefusal,`THIS scene-owner Inspect metadata refused: ${reply.metadataRefusal}`);
    sceneNeed(reply.hasEvent&&reply.hasInfluence,'THIS scene-owner Inspect omitted its event or complete acting influence');
    influence=qualifySceneInfluence(reply.influence,reply.field,reading,domain,sources);
    event=eventFromSources(sources);
    // CoupledInput omits an empty sky binding list on serialization. This
    // documented serde default is not a new event or a numerical correction.
    const nativeEvent=structuredClone(reply.event);
    sceneNeed(sceneObject(nativeEvent),'Inspect omitted its native event');
    if(!Object.prototype.hasOwnProperty.call(nativeEvent,'sky_frequency_bindings'))nativeEvent.sky_frequency_bindings=[];
    sceneNeed(sceneSame(nativeEvent,event),'Inspect event differs from its freshly inspected source');
    acting=readScene(sources,influence,this.opened?.source);
   }
   this.sources=sources;this.domain=domain;this.scene=scene;this.ownerKind=scene?'scene':'supplied';
   this.event=event;this.acting=acting;this.influenceReading=influence;this.sourcesStale=false;this.influenceStale=false;this.readingError=null;
   this.lastInspect=performance.now();return sources;
  }catch(error){if(this.current(session))this.invalidateCurrentReading(error);throw error;}
 }
 private async readInfluence(session:InstrumentSession){
  const scope=this.exchangeScope(session);
  try{
   const influence=await session.influence(),reply=this.takeAcknowledgedExchange(session,'influence',scope);
   sceneNeed(!reply.metadataRefusal,`THIS influence acknowledgement metadata refused: ${reply.metadataRefusal}`);
   sceneNeed(this.ownerKind==='scene'&&reply.hasInfluence&&sceneSame(reply.influence,influence),'THIS Scene influence acknowledgement omitted or changed its reading');
   this.admitInfluence(qualifySceneInfluence(reply.influence,reply.field,session.reading));return this.influenceReading;
  }catch(error){if(this.current(session))this.invalidateCurrentReading(error);throw error;}
 }
 private admitInfluence(influence:any){
  // A direct/carried reading may be newer than inspected M1/M3. It is admitted
  // against its own ACK/readback; never rejected against or paired with old M1.
  if(this.domain&&(influence.m1_revision!==this.domain.m1.revision||influence.m3_generation!==this.domain.m3.generation)){
   this.domain=null;this.event=null;this.sourcesStale=true;
  }
  this.influenceReading=influence;this.influenceStale=false;
  this.acting=!this.sourcesStale&&this.sources?readScene(this.sources,influence,this.opened?.source):null;
 }
 private receiveCarriedInfluence(session:InstrumentSession,command:string,scope:NativeExchangeScope){
  const reply=this.takeAcknowledgedExchange(session,command,scope);
  sceneNeed(!reply.metadataRefusal,`THIS determinant ACK metadata refused: ${reply.metadataRefusal}`);
  sceneNeed(this.ownerKind==='scene'&&reply.hasInfluence,'THIS determinant ACK omitted its complete native influence');
  this.admitInfluence(qualifySceneInfluence(reply.influence,reply.field,session.reading));
 }
 private eventWasAcknowledged(session:InstrumentSession,scope:NativeExchangeScope){
  const reading=session.reading;
  // The adapter commits this cursor before scheduling/presentation can fail.
  return this.current(session)&&reading.available&&reading.acknowledged.generation!==scope.acknowledged.generation&&
   reading.acknowledged.samples_elapsed===scope.acknowledged.samples_elapsed;
 }
 status:NativeStatus='manual';reason:string|null=null;
 onChange:()=>void=()=>{};
 constructor(private port:NativePort,private renderer:NativeRenderer,
  private audio:(rate:number)=>AudioContext=rate=>new AudioContext({sampleRate:rate}),
  private playback:NativePlaybackPolicy={blockFrames:512,leadSeconds:.04,lookaheadSeconds:.1}){
  this.playback=Object.freeze({...this.playback});
  port.onHold=reason=>{this.hold(reason);};
 }
 private cadenceReading(){
  const c=this.cadence??this.lastCadence;if(!c)return{playing:false,rate:null,source:null};
  const elapsed=((c.stopped_at??performance.now())-c.started)/1000;
  return{playing:!!this.cadence,rate:c.rate,source:c.source,beats:c.beats,issued:c.issued,applied:c.applied,skipped:c.skipped,suspended:c.suspended,
   achieved_ticks_per_second:elapsed>0?c.applied/elapsed:0,stopped:c.stopped??null,last_event_ms:c.lastEventMs??null,max_event_ms:c.maxEventMs??null,last_event_timing:this.timing,
   law:'serial m1-advance through the one native owner; a beat is skipped, never queued, while the owner is busy'};
 }
 get reading(){
  const physical=this.domain?.m3.physical_form;
  const following=this.status==='following';
  const physical_form_actuator=applyPhysicalFormPose(physical??null,following&&!!physical);
  const unavailable=[
   physical_form_actuator.applied?null:`M3 physical form pose: ${'reason' in physical_form_actuator?physical_form_actuator.reason:'unavailable'}`,
   'material model replacement beyond the existing modal owner requires a new binding'].filter((x):x is string=>!!x);
  const clock=this.projection?.native.lastReceipt?.clock??null;
  const trace=this.scene&&this.influenceReading
   ?{...sceneCausalTrace(this.influenceReading,this.acting,{following,muted:this.muted,targetsConnected:this.projection instanceof NativeProjection||!!this.physicalProjection,clock}),
     physical_form:physical_form_actuator}
   :this.domain?{
    schema:'oi.native-causal-trace/v1',
    layers:[
      {layer:'M1',source_ref:this.domain.m1.coordinate,generation:this.domain.m1.revision,target:'carrier quadrature / harmonic row',actuator:'native domain overlay + continuous topology',observable:'SVG carrier lines / retained topology'},
      {layer:'M2',source_ref:this.domain.m2.modes[0]?.ref??'—',generation:String(this.domain.m2.generation),target:'modal frequency / damping / PCM',actuator:'NativeAudioBinding + material modes',observable:'audio device + modal standing'},
      {layer:'M3',source_ref:this.domain.m3.codon_ref,generation:String(this.domain.m3.generation),target:'transcription + codon (entering the M2 Vimarśā reading)',actuator:'coupled composer; no physical-form pose consumer',observable:'transcription overlay; pose not actuated'},
    ],
    physical_form:physical_form_actuator,
   }:null;
  return{schema:'oi.native-expression-reading/v1',status:this.status,reason:this.reason,
  source:this.opened?.source??null,lease:this.opened?.lease??null,
  lifetime:{admission_pending:!!this.admission,close_pending:!!this.closing||!!this.opened?.closing&&!this.opened?.closed&&!this.closeFailure,operation_pending:this.serialDepth+this.operating,close_error:this.closeFailure?.message??null,last_close:this.lastClose},
  playback_policy:{...this.playback,owner:'QL InstrumentSession / explicit application buffering; no sample-rate change'},
  renderer_requirements:this.renderer.retainedTopology?.()??null,
  presentation_mode:!this.projection?'manual':this.projection.scale===this.opened.presentation.units_per_metre?'domain-follow':'manual-presentation-override',
  presentation_units_per_metre:this.projection?.scale??null,
  presentation_level:{value:this.levelValue,...PRESENTATION_LEVEL},
  native:this.session?.reading??this.lastNative,muted:this.muted,
  pending_presentation:this.session?.reading.pending_presentation??null,presentation_delivery:this.session?.reading.presentation_delivery??null,
  domain:this.domain,source_currentness:this.sourcesStale||this.influenceStale?`native cursor acknowledged; ${this.influenceStale?'acting influence unavailable':'acting influence current'}; complete sources await fresh Inspect`:this.domain?(following?'inspected-native-basis; continuous cursor reported separately':'held-last-inspected-basis'):'unavailable',
  presented_clock:clock,
  instrument:this.scene?{schema:'oi.scene-instrument-reading/v1',acting:this.acting,influence:this.influenceReading,influence_stale:this.influenceStale,
   opening_event_available:!!this.opening,sources_stale:this.sourcesStale,reading_error:this.readingError,cadence:this.cadenceReading(),refusal:this.refusal,
   presentation:INSTRUMENT_PRESENTATION}:null,
  checkpoint:this.checkpoint?{supported:true,scope:'same live GPU and unchanged native cursor',receipt:this.checkpoint.receipt}:null,
  exact_seek:false,restart:'explicit new native process; no implicit rewind',
  domain_owned:['M1/M2/M3 native targets','native PCM','native clock'],
  presentation_owned:['resident particle mechanics','camera','presentation scale','presentation level'],
  presentation_changes_requiring_rebind:['scene membership','target topology or density','authored scene configuration while leased'],
  unavailable_consumers:unavailable,
  causal_trace:trace,
  physical_form_actuator,
  actuator_standing:nativeActuatorStanding({status:this.status,domain:this.domain as any,instrument:this.scene?{voices:this.acting?.voices??null}:null}),
 } as const;}
 private changed(){this.onChange();}
 /** The instrument's primary opening: QL composes a scene binding (`ql scene binding`) for this stage's
  * own retained texture; the kernel supplies the dated sky. No path, no file. */
 private composeRequest(topology:{tex_width:number;tex_height:number},options:{sky?:NativeSky;skySnapshot?:NativeSkySnapshot;snapshotPurpose?:import('../../../../src/nara/identity/types').SnapshotPurpose;event?:unknown;world?:NativeWorldInput}){
  if(options.sky!==undefined&&options.skySnapshot!==undefined)throw new Error('exactly one native sky selector or admitted snapshot is allowed');
  const sky=options.skySnapshot===undefined?(options.sky??'now'):undefined;
  if(options.snapshotPurpose==='retained-occasion'&&options.skySnapshot===undefined)throw Error('A retained occasion requires an existing native sky snapshot');
  if(options.snapshotPurpose==='retained-occasion'&&options.world===undefined)throw Error('Reopen the saved Epi world to play this retained occasion. A standalone field can open a requested sky.');
  if(!(sky===undefined||sky==='none'||sky==='now'||(typeof sky==='object'&&typeof sky?.epoch==='string')))throw new Error('sky must be none, now or a dated epoch');
  if(options.world!==undefined&&options.event!==undefined)throw new Error('world admission and legacy event compose are mutually exclusive');
  return{texture:[topology.tex_width,topology.tex_height],units_per_metre:INSTRUMENT_PRESENTATION.units_per_metre,
   ...(sky!==undefined?{sky}:{}),...(options.skySnapshot!==undefined?{sky_snapshot:options.skySnapshot}:{}),...(options.snapshotPurpose?{snapshot_purpose:options.snapshotPurpose}:{}),
   ...(options.event!==undefined?{event:options.event}:{}),...(options.world!==undefined?{world:options.world}:{})};
 }
 /** Quiet owner preparation: no AudioContext, worker, GPU lease or pump. */
 async prepareWorld(options:{world:NativeWorldInput;sky?:NativeSky;skySnapshot?:NativeSkySnapshot;snapshotPurpose?:import('../../../../src/nara/identity/types').SnapshotPurpose}){
  const topology=this.renderer.retainedTopology?.();
  if(!topology)throw new Error('The retained GPU field must be live before a native world is prepared');
  const prepared=await this.port.request({operation:'prepare_world',request:this.composeRequest(topology,options)});
  if(prepared?.schema!=='oi.native-expression-prepared-world/v1'||prepared.source?.world?.schema!=='ql.scene-world/v1'||prepared.source?.sky?.schema!=='ql.sky-snapshot/v1')throw new Error('native world preparation did not return one atomic owner world');
  return prepared;
 }
 async compose(options:{sky?:NativeSky;skySnapshot?:NativeSkySnapshot;snapshotPurpose?:import('../../../../src/nara/identity/types').SnapshotPurpose;event?:unknown;world?:NativeWorldInput;entityTargetBindings?:EntityTargetBindings}={}){
  const topology=this.renderer.retainedTopology?.();
  if(!topology)throw new Error('The retained GPU field must be live before the instrument opens');
  if(options.entityTargetBindings&&!options.world)throw new Error('entity target bindings require an admitted native world');
  const request=this.composeRequest(topology,options);
  return this.admit(SCENE_SAMPLE_RATE,()=>this.port.request({operation:'compose',request}),options.entityTargetBindings);
 }
 /** A genuine selected-Document opening remains held through source retention
  * and both native bootstrap observations. Legacy compose is never its grant. */
 openSelectedScene(binding:NativeSelectedSourceBinding):Promise<void>;
openSelectedScene(request:NativeSelectedSceneRequest,receive:(reply:unknown)=>Promise<void>,recover?:boolean,binding?:NativeSelectedSourceBinding):Promise<unknown>;
async openSelectedScene(request:NativeSelectedSceneRequest|NativeSelectedSourceBinding,receive?:(reply:unknown)=>Promise<void>,recover=false,binding?:NativeSelectedSourceBinding):Promise<unknown>{
  if('capture' in request){
   const binding=request;
   if(!binding.current())throw Error('The selected native Document changed before opening.');
   this.selectedSourceBinding=binding;this.selectedSourceQualified=false;
   const selection=binding.capture();
   try{await this.admit(SCENE_SAMPLE_RATE,()=>this.port.request({operation:'open_selected_scene',request:selection}),undefined,undefined,true);}
   catch(error){this.selectedSourceQualified=false;throw error;}
   return;
  }
  if(!receive)throw Error('The selected opening requires its actual original Workspace receipt receiver');
  if(binding){
   if(!binding.current()||!sceneSame(binding.capture(),request))throw Error('The actual instrument binding differs from the original selected native opening');
   this.selectedSourceBinding=binding;this.selectedSourceQualified=false;
  }
  const captured=structuredClone(request);let original:unknown;
  await this.admit(SCENE_SAMPLE_RATE,async()=>{
   const reply=await this.port.request({operation:recover?'recover_selected_scene':'open_selected_scene',request:captured});
   if(recover){
    // Preserve the complete genuine owner lookup before admitting its original
    // unconsumed opening as an initial receipt of this NEW local Session.
    await receive(reply);
    if(reply?.schema!=='oi.native-expression-selected-scene-recovery/v1'||reply.recoverable!==true||reply.replayed!==false)throw new Error('The native owner cannot recover this original unconsumed opening');
    original=reply.original_open;return original;
   }
   original=reply;return reply;
  },undefined,recover?undefined:receive,!!binding);
  if(!original||this.opened!==original||!this.session)throw new Error('The original selected native World was not admitted');
  return original;
 }
 qualifySelectedSceneSource(retained?:unknown){return this.serial(async()=>{
  const session=this.session,binding=this.selectedSourceBinding;
  if(!session||!binding||!binding.current()||this.opened?.qualification!=='pending_source_bootstrap'||this.selectedSourceQualified)throw Error('The genuine held selected-Scene opening is unavailable or already qualified.');
  try{
   let expected=binding.capture();
   let sourceAsset:any;
   if(retained!==undefined){
    const owned=this.selectedSourceAsset,original=owned?.result as any;
    if(!owned||owned.session!==session||owned.epoch!==this.epoch||owned.opened!==this.opened||!this.current(session)||!sceneSame(retained,original)||original?.lease!==this.opened?.lease||!sceneSame(original.original_request,owned.request)||session.reading.last_request_id!==owned.request.expected_request_id)throw Error('The retained source is not this SAME Session original already-accounted source observation');
    const host=original.native_result?.host_receipt,held=session.reading;
    if(original.source_current!==true||original.source_currentness!==null||original.qualification!=='pending_source_bootstrap'||original.native_ordered_receipt_pending!==false||original.recovered===true&&original.recovery_current!==true||!sceneSame(original.selected_scene,expected)||host?.request_id!==held.last_request_id||host.last_request_id!==held.last_request_id||host.instance_ref!==held.instance_ref||host.field?.event_ref!==held.event_ref||host.field?.subject_ref!==held.subject_ref||host.field?.generation!==held.acknowledged.generation||host.field?.samples_elapsed!==held.acknowledged.samples_elapsed)throw Error('The original source receipt or current adopted native selection changed before qualification');
    sourceAsset=original;
   }else{
    sourceAsset=await session.source({operation:'selected-source-retain'});
    await binding.adopt(sourceAsset,expected);
   }
   if(sourceAsset?.schema!=='oi.native-expression-selected-scene-source/v1'||sourceAsset.source_current!==true||!binding.current())throw Error('The actual selected source edit was not adopted at its current native CAS.');
   if(session.reading.in_flight||!session.reading.available)throw Error('The same selected source owner has not settled for its authoring read.');
   const held=session.reading;
   const aperture={epoch:this.epoch,session,binding,selection:binding.capture(),last_request_id:held.last_request_id,acknowledged:structuredClone(held.acknowledged)};
   this.sourceAuthorshipWindow=aperture;
   let authorship:Record<string,unknown>;
   try{authorship=structuredClone(await binding.authorship());}
   finally{if(this.sourceAuthorshipWindow===aperture)this.sourceAuthorshipWindow=null;}
   if(!authorship||typeof authorship!=='object'||!authorship.profile||!authorship.thread_plan||!authorship.ground_ref)throw Error('The complete native authored source profile, thread and ground are unavailable.');
   const bootstrap=async()=>{
    const selection=binding.capture(),intent={schema:'oi.expression-procedural-source-bootstrap-intent/v1',scene_ref:selection.scene_ref,operation_ref:`source-bootstrap:${crypto.randomUUID()}`,authorship};
    const original=await session.source({operation:'selected-source-bootstrap',intent});
    await binding.adopt(original,selection);return original;
   };
   let source=await bootstrap();
   if(source?.source_current===false&&source?.binding_adoption?.state==='adopted')source=await bootstrap();
   if(source?.schema!=='oi.expression-procedural-source-bootstrap/v1'||source.source_current!==true||source.replayed!==false||source.qualification!=='live_native_owner'||!binding.current())throw Error('The fresh original native source did not qualify this current Document and Scene.');
   await this.readSources(session,true);
   if(!binding.current())throw Error('The selected source changed during its complete native readback.');
   this.selectedSourceQualified=true;this.status='held';this.reason='The selected native source is qualified; its physical instrument can prepare.';this.changed();return source;
  }catch(error){this.selectedSourceQualified=false;this.status='held';this.reason=String(error);this.changed();throw error;}
 });}
 /** Called only by the current qualification's Workspace callback while its
  * original serial owner is already held. This pure native read has no FIELD
  * ordinal; queuing another serial action here would await itself. */
 readSelectedSourceAuthorship(request:NativeStageAuthorshipRequest):Promise<unknown>{
  const aperture=this.sourceAuthorshipWindow;
  if(!aperture||request.operation!=='source_authorship'||!sceneSame(request.request.selection,aperture.selection))return Promise.reject(Error('The actual selected-source authoring read aperture is unavailable.'));
  const current=()=>this.sourceAuthorshipWindow===aperture&&this.epoch===aperture.epoch&&!this.dead&&this.current(aperture.session)&&aperture.binding===this.selectedSourceBinding&&aperture.binding.current()&&sceneSame(aperture.binding.capture(),aperture.selection)&&aperture.session.reading.available&&!aperture.session.reading.in_flight&&aperture.session.reading.last_request_id===aperture.last_request_id&&JSON.stringify(aperture.session.reading.acknowledged)===JSON.stringify(aperture.acknowledged);
  if(!current())return Promise.reject(Error('The exact native authoring source boundary changed before its pure read.'));
  return this.port.request(structuredClone(request)).then(result=>{
   if(!current())throw Error('The native authoring intent returned after its original selected source boundary changed.');
   this.lastSourceAuthorship=structuredClone(result);
   return result;
  });
 }
 sourceAuthorshipCurrent(basis:{expression_ref:string;scene_ref:string}){
  const binding=this.selectedSourceBinding,reading=this.lastSourceAuthorship as any;
  if(!binding?.current()||!this.session?.reading.available||this.dead||!reading?.basis)return false;
  const current=binding.capture();
  return current.expression_ref===basis.expression_ref&&current.scene_ref===basis.scene_ref&&reading.basis.expression_ref===basis.expression_ref&&reading.basis.scene_ref===basis.scene_ref;
 }
 get sourceAuthorshipReading(){const reading=this.lastSourceAuthorship as any;return reading?.basis&&this.sourceAuthorshipCurrent(reading.basis)?structuredClone(reading):null;}
 /** Original reply is historical custody, never a fresh Source grant. */
 get sourceAuthorshipCustody(){return this.lastSourceAuthorship===null?null:structuredClone(this.lastSourceAuthorship);}
 selectedSceneSourceCurrent(selection:NativeSelectedScene){return this.selectedSourceQualified&&this.selectedSourceBinding?.current()===true&&sceneSame(selection,this.selectedSourceBinding.capture())&&this.session?.reading.available===true;}
 get nativeSourceTransaction(){return this.lastSourceTransaction===null?null:structuredClone(this.lastSourceTransaction);}

 /** Inspect depth: an explicit Central binding document. */
 async connect(path:string,revision:string,sampleRate:number){
  return this.admit(sampleRate,()=>this.port.request({operation:'open',path,expected_revision:revision}));
 }
 private stage(context:AudioContext){
  // One presentation gain stage between the native receiver and the device.
  // The receiver keeps its own gain and clip law; nothing is synthesised here.
  const level=context.createGain();level.gain.value=this.levelValue;level.connect(context.destination);this.level=level;
  return new Proxy(context,{get:(target,key)=>{if(key==='destination')return level;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as AudioContext;
 }
 private admit(sampleRate:number,open:()=>Promise<any>,entityTargetBindings?:EntityTargetBindings,receive?:(reply:unknown)=>Promise<void>,selected=false){
  if(this.admission)return Promise.reject(new Error('the previous native admission has not settled'));
  const admission=this.admitOwner(sampleRate,open,entityTargetBindings,receive,selected);this.admission=admission;
  return admission.finally(()=>{if(this.admission===admission)this.admission=null;});
 }
 private async admitOwner(sampleRate:number,open:()=>Promise<any>,entityTargetBindings?:EntityTargetBindings,receive?:(reply:unknown)=>Promise<void>,selected=false){
  if(this.closeFailure)throw new Error('native release acknowledgement unknown: '+this.closeFailure.message);
  if(this.dead||this.status==='opening'||this.session||this.closing||this.suspension)throw new Error('release the current native owner and instrument suspension before opening another');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('native binding must supply its actual sample rate');
  const epoch=++this.epoch;this.admitting=epoch;this.status='opening';this.reason=null;this.openingHold=null;this.lastNative=null;this.refusal=null;this.changed();
  let context:AudioContext|null=null;
  try{
   // This is invoked directly by the person's open action; no microphone and no
   // autoplay on mode entry. A failed audio device prevents opening native work.
   context=this.audio(sampleRate);this.context=context;await context.resume();
   if(epoch!==this.epoch||this.dead){if(context.state!=='closed')await context.close();return;}
   if(context.sampleRate!==sampleRate||context.state!=='running')throw new Error('audio device/native rate or activation mismatch');
   const opened=await open();
   if(epoch!==this.epoch||this.dead){await this.closeOwner(opened);return;}
   this.opened=opened;
   if(receive)await receive(opened);
   if(epoch!==this.epoch||this.dead)throw new Error('Selected native opening belongs to a released lifetime');
   if(opened.schema!=='oi.native-expression-open/v1'||opened.receipt?.field?.sample_rate!==sampleRate)throw new Error('native open receipt/sample rate mismatch');
   const stage=this.renderer.retainedTargetPort();
   let presentation=opened.presentation;
   if(entityTargetBindings){
    const target_map=await entityTargetBindings({world:structuredClone(opened.source?.world),partition:stage.readPartitionSnapshot()});
    // Mapping is an asynchronous owner boundary. A release that happens while
    // it is pending has already closed `opened`; that old completion must not
    // recreate a projection or session in the released lifetime.
    if(epoch!==this.epoch||this.dead)return;
    presentation={units_per_metre:opened.presentation?.units_per_metre,target_map};
   }
   // S14's native purpose is Source qualification, not a selected-body sampler
   // admission. Ordinary Epi compose keeps its original physical target port.
   if(opened.qualification==='pending_source_bootstrap'){
    const binding=this.selectedSourceBinding;
    if(!binding?.current())throw Error('The actual selected Source binding is unavailable for its original opening.');
    if(entityTargetBindings)throw Error('A selected Source carrier cannot stand in for an admitted physical target map.');
    this.projection=new SelectedSourceReception(stage,opened,binding.capture(),binding.current);
   }else{
    if(selected)throw Error('The original selected opening did not issue its actual Source qualification purpose.');
    this.projection=new NativeProjection(stage,opened.receipt.field,presentation);
   }
   this.renderer.setNativeDomain(true);
   let session:InstrumentSession;
   const transport={request:async(request:any)=>{
    const serial=++this.exchangeSerial;this.exchangeReceipt=null;
    if(epoch!==this.epoch||this.opened!==opened||!this.current(session))throw new Error('native request belongs to a released lifetime');
    if(request.command?.operation==='performance-physical-edit'||request.command?.operation==='performance-acoustic-edit'){
     const acoustic=request.command.operation==='performance-acoustic-edit',binding=this.recordingBinding;
     if(!binding||!this.captureNativePulses||request.observed_request_id!==session.reading.last_request_id||!this.performancePreparing)throw Error('The current captured physical transaction owner is disconnected or reordered.');
     const cas=binding.capture();
     const result=await this.port.request(acoustic?{operation:'acoustic_scene_edit',lease:opened.lease,request:{schema:'oi.native-acoustic-scene-edit/v1',...cas,lease:opened.lease,declared_seed:'1',configuration:request.command.configuration}}:{operation:'physical_scene_edit',lease:opened.lease,request:{schema:'oi.native-physical-scene-edit/v1',...cas,lease:opened.lease,declared_seed:'1',edit:request.command.edit}});
     if(acoustic)this.lastNativeAcousticEdit=result;else this.lastNativePhysicalEdit=result;
     if(epoch!==this.epoch||this.opened!==opened||!this.current(session)||!session.reading.available)throw Error('Original physical reply returned after its native lifetime changed.');
     return acoustic?{acoustic_edit:result,acoustic_cas:cas}:{physical_edit:result,physical_cas:cas};
    }
    const sent=structuredClone({schema:request.schema,instance_ref:request.instance_ref,event_ref:request.event_ref,subject_ref:request.subject_ref,
     request_id:request.request_id,expected_generation:request.expected_generation,expected_samples_elapsed:request.expected_samples_elapsed,command:{operation:request.command?.operation}});
    let reply:any;
    const operation=request.command?.operation;
    const recorded=operation==='performance-scene-prepare'||operation==='performance-recording-begin'||operation==='performance-save-cut'||operation==='performance-continue-act'||operation==='performance-playback'||operation==='performance-edited-render'||operation==='performance-exchange'&&this.captureNativePulses;
    if(recorded){
     const binding=this.recordingBinding;if(!binding)throw Error('The actual native Scene recording producer is disconnected.');
     const cas=binding.capture();this.lastRecordingCas=cas;
     const command=operation==='performance-scene-prepare'?{operation:'prepare_scene',definition:request.command.definition}
      :operation==='performance-recording-begin'?{operation:'begin',basis:binding.basis,checkpoint_ref:request.command.checkpoint_ref}
      :operation==='performance-save-cut'?{operation:'save_cut',basis:binding.basis,layer:binding.layer,checkpoint_ref:request.command.checkpoint_ref}
      :operation==='performance-continue-act'?{operation:'continue_act',act_ref:request.command.act_ref,selection:request.command.selection,checkpoint_index:request.command.checkpoint_index,transaction_ref:request.command.transaction_ref}
      :operation==='performance-playback'?{operation:'playback',act_ref:request.command.act_ref,selection:request.command.selection,from_sample:request.command.from_sample,to_sample:request.command.to_sample,checkpoint_index:request.command.checkpoint_index,transaction_ref:request.command.transaction_ref}
      :operation==='performance-edited-render'?{operation:'edited_render',act_ref:request.command.act_ref,selection:request.command.selection,from_sample:request.command.from_sample,to_sample:request.command.to_sample,checkpoint_index:request.command.checkpoint_index,transaction_ref:request.command.transaction_ref}
      :{operation:'command',basis:binding.basis,layer:binding.layer,command:request.command.command};
     if(command.operation==='command'&&(command as any).command?.operation==='performance-transpose')throw Error('Transpose requires a captured native source transition.');
     const recordingRequest={operation:'native-performance-recording',lease:opened.lease,request:{...cas,...command,lease:opened.lease,request_id:request.request_id}};this.lastNativeRecordingRequest=structuredClone(recordingRequest);
     const result=await this.port.request(recordingRequest);
     this.lastNativeRecording=result;
     if(operation==='performance-edited-render'&&this.scoreRenderCustody){this.scoreRenderCustody.request=structuredClone(recordingRequest);this.scoreRenderCustody.result=result;}
     if(operation==='performance-playback'&&this.scorePlaybackCustody){this.scorePlaybackCustody.request=structuredClone(recordingRequest);this.scorePlaybackCustody.result=result;}
     if(operation==='performance-continue-act')this.lastNativeContinuation={act_ref:request.command.act_ref,selection:structuredClone(request.command.selection),checkpoint_index:request.command.checkpoint_index,transaction_ref:request.command.transaction_ref,result};
     const host=result?.native_reply?.result?.host_receipt??result?.native_reply?.host_receipt;
     if(host?.schema!=='ql.field-host-receipt/v1'||host.request_id!==request.request_id||host.last_request_id!==request.request_id)throw Error('The original recording pulse omitted its same outer HostReceipt.');
     reply={...host,recording:result};
    }else if(operation==='selected-source-retain'||operation==='selected-source-bootstrap'){
     const binding=this.selectedSourceBinding;if(!binding||!binding.current())throw Error('The actual selected native Document changed before its source operation.');
     const selection=binding.capture();let result:any;
     if(operation==='selected-source-retain'){
      result=await this.port.request({operation:'retain_selected_scene_source',lease:opened.lease,request:{selection,lease:opened.lease,actor:'human:expressions-app',expected_request_id:request.request_id,expected_generation:request.expected_generation,expected_samples_elapsed:request.expected_samples_elapsed}});
      const host=result?.native_result?.host_receipt;reply={...host,source_transaction:result};
     }else{
      const nativeRequest={...request,command:{operation:'procedure',request:{action:'source_bootstrap',input:request.command.intent}}};
      result=await this.port.request({operation:'procedural_conduct',lease:opened.lease,request:{lease:opened.lease,expression_ref:selection.expression_ref,document_revision:selection.document_revision,request:nativeRequest}});
      const host=result?.native_receipt;reply={...host,source_transaction:result};
     }
     this.lastSourceTransaction=result;
    }else if(request.command?.operation==='procedure'){
     const reader=this.proceduralContext;if(!reader)throw new Error('The current protected native Workspace Source context is not paired');
     const basis=await reader(structuredClone(request.command.request));
     if(epoch!==this.epoch||this.opened!==opened||!this.current(session))throw new Error('Native Source context belongs to a released lifetime');
     const input=nativeProceduralConductRequest(opened.lease,request,basis);
     const invocation=request.command.request.action==='source_bootstrap'?this.bootstrapInvocation:null;
     if(request.command.request.action==='source_bootstrap')sceneNeed(invocation&&sceneSame(invocation.command,request.command.request),'Source bootstrap requires its full original Workspace adoption route');
     const result=await this.port.request(input);if(invocation)invocation.reply=result;
     reply=nativeProceduralConductReceipt(result,input);
    }else reply=await this.port.request({operation:'exchange',lease:opened.lease,request});
    if(epoch!==this.epoch||this.opened!==opened||!this.current(session)||!session.reading.available)throw new Error('native reply belongs to a released or uncertain lifetime');
    const field=reply?.field,hasEvent=Object.prototype.hasOwnProperty.call(reply??{},'event'),hasInfluence=Object.prototype.hasOwnProperty.call(reply??{},'influence');
    const refusals:string[]=[];let influenceRefused=false;
    const copy=(value:any,kind:keyof typeof SCENE_METADATA_KEYS)=>{
     try{return copySceneMetadata(value,kind);}catch(error){refusals.push(String(error instanceof Error?error.message:error));if(kind==='influence')influenceRefused=true;return undefined;}
    };
    const event=hasEvent?copy(reply.event,'event'):undefined,influence=hasInfluence?copy(reply.influence,'influence'):undefined;
    const selectedField:any=field?{schema:field.schema,event_ref:field.event_ref,subject_ref:field.subject_ref,generation:field.generation,samples_elapsed:field.samples_elapsed,
     shape_ref:field.shape_ref,geometry_ref:field.geometry_ref,material_ref:field.material_ref,model_ref:field.model_ref,m2_identity:field.m2_identity,clock:field.clock,
     target_count:Array.isArray(field.targets)?field.targets.length:null,amplitude_count:Array.isArray(field.amplitudes_metres)?field.amplitudes_metres.length:null}:null;
    // Optional native field leaves are absent JSON members, never undefined data.
    if(selectedField)for(const key in selectedField)if(selectedField[key]===undefined)delete selectedField[key];
    const metadata=selectedField?copy(selectedField,'field'):null;
    const acknowledgedField=metadata??{schema:field?.schema,event_ref:field?.event_ref,subject_ref:field?.subject_ref,generation:field?.generation,samples_elapsed:field?.samples_elapsed};
    // No target/PCM/source-array copy. Original presence and refusal stay with
    // THIS slot. A metadata refusal is not an accepted empty body or rollback.
    this.exchangeReceipt={serial,epoch,session,opened,lease:opened.lease,request:sent,reply:{
     schema:reply?.schema,status:reply?.status,available:reply?.available,instance_ref:reply?.instance_ref,request_id:reply?.request_id,last_request_id:reply?.last_request_id,
     hasEvent,hasInfluence,event,influence,field:acknowledgedField,metadataRefusal:refusals.length?refusals.join('; '):null}};
    if(influenceRefused){
     // Let the unchanged adapter validate/acknowledge the exact native field.
     // Only the explicitly refused metadata is withheld from its clone/cache;
     // the shared receiver later fails on metadataRefusal and clears old body.
     const received={...reply};delete received.influence;return received;
    }
    return reply;
   },consumeNativeDefinitionCompletion:(completion:unknown,expected:unknown)=>{
     if(epoch!==this.epoch||this.opened!==opened||!this.current(session)||!this.port.consumeNativeDefinitionCompletion)throw Error('The original authenticated definition completion channel/lifetime is unavailable');
     return this.port.consumeNativeDefinitionCompletion(completion,expected);
   },consumeStageCompilationCompletion:(completion:unknown,expected:unknown)=>{
     if(epoch!==this.epoch||this.opened!==opened||!this.current(session)||!this.port.consumeStageCompilationCompletion)throw Error('The original authenticated Stage completion channel/lifetime is unavailable');
     return this.port.consumeStageCompilationCompletion(completion,expected);
    },close:()=>{if(this.nativeTakeRecorder.snapshot()?.status==='recording')void this.nativeTakeRecorder.fail('Original native acknowledgement was lost; same-owner close is pending. No native command is retried and the sound take is incomplete.').catch(error=>{this.nativeCaptureFailure={original:this.lastNativeRecording,reason:'Original take failure storage also refused: '+String(error)};this.changed();});this.performanceFailure='Native acknowledgement unknown; same-owner close pending.';this.status='unavailable';this.reason=this.performanceFailure;this.changed();void this.closeOwner(opened).then(()=>{if(this.opened===opened){this.reason='Native acknowledgement unknown; exact owned native lifetime closed.';this.changed();}}).catch(error=>{if(this.opened===opened){this.reason='Native acknowledgement and same-owner close unknown: '+String(error);this.changed();}});}};
   session=new InstrumentSession({...this.playback,context:this.stage(context),owner:this.renderer,initialReceipt:opened.receipt,
    transport,fieldBinding:this.projection,muted:true});this.session=session;
   this.recovery=this.renderer.onRetainedRecoveryRequired(state=>{this.contextLost=state==='lost';if(this.session)this.receiverFailure(this.session,`GPU context ${state}`,`GPU context ${state}; explicit same-state checkpoint recovery or disconnect required`);});
   if(this.projection instanceof SelectedSourceReception){
    if(!this.selectedSourceBinding||opened.qualification!=='pending_source_bootstrap'||opened.source_current!==true||!sceneSame(opened.selected_scene,this.selectedSourceBinding.capture()))throw Error('The native selected-Scene opening is not current at its original Document CAS.');
    this.session.hold('selected Scene source bootstrap pending');await context.suspend();this.status='held';this.reason='The selected native source is awaiting its exact retained authoring and fresh qualification.';this.changed();return;
   }
   const sources=await this.readSources(this.session);
   if(this.scene){await this.readInfluence(this.session);this.opening=eventFromSources(sources);}
   await this.session.recover('complete native sources admitted; rebase device only');
   if(epoch!==this.epoch||this.dead)return;
   // Reassert an existing admission hold without issuing a new controller hold:
   // the suspension token must keep ownership of its captured hold revision.
   if(this.openingHold){this.session.hold(this.openingHold);this.status='held';this.reason=this.openingHold;}
   else{
    // Rebase once more immediately before the pump so inspect/open cost cannot
    // consume the whole audio lead on a slow GPU/main-thread admission path.
    await this.session.recover('pre-pump device rebase after source admission');
    if(epoch!==this.epoch||this.dead)return;
    if(this.openingHold){this.session.hold(this.openingHold);this.status='held';this.reason=this.openingHold;}
    else{this.status='following';this.session.start();}
   }
   this.changed();
  }catch(error){
   // A completion belonging to an old epoch may not close a newer owner.
   if(epoch!==this.epoch||this.dead){if(context&&context.state!=='closed')await context.close();if(error instanceof NativeCloseError)throw error;return;}
   await this.releaseLifetime(false,false);const closeError=this.reading.lifetime.close_error;this.status='unavailable';this.reason=closeError?'native release acknowledgement unknown: '+closeError:String(error);this.changed();throw error;
  }finally{if(this.admitting===epoch)this.admitting=null;}
 }
 /** Called by the actual app frame. A hidden/paused app cannot leave audio running. */
 frame(delta:number,paused:boolean){
  if(this.session)this.pausePendingPresentation(this.session);
  if(this.performanceReading){
   try{this.requirePerformanceCurrent(true);}catch{return 0;}
   if(paused){
    if(this.hasPendingNativePlayback()&&!this.performanceHoldPending){this.performanceHoldPending=true;void this.stopNativeRetainedScore().catch(error=>{this.failPendingNativePlayback(error);this.performanceFailure=String(error);this.status='unavailable';this.reason=String(error);this.changed();}).finally(()=>{this.performanceHoldPending=false;});}
    else if(this.status==='following')this.hold('application paused or hidden');return 0;
   }
   // This is a bounded control read on the application's EXISTING animation
   // frame. The native audio callback alone advances P/audio time. Inspect
   // returns its actual snapshot; there is no browser sample clock or solver.
   if(!this.performanceSaveCut&&!this.performanceSaving&&!this.performancePolling&&!this.serialDepth&&!this.operating&&(this.hasCurrentPerformance()||this.hasPendingNativePlayback())&&performance.now()-this.lastPerformancePoll>=20){
    this.performancePolling=true;this.lastPerformancePoll=performance.now();
    void this.exchangePerformance({operation:'performance-inspect'}).catch(error=>{if(this.pendingPlaybackBoundary())this.failPendingNativePlayback(error);else this.holdPerformance(String(error));}).finally(()=>{this.performancePolling=false;});
   }
   return this.status==='following'?delta:0;
  }
  if(paused&&!this.suspension&&this.status==='opening'&&!this.openingHold)this.hold('application paused during native admission');
  if(paused&&!this.suspension&&this.session&&this.status==='following')this.hold('application paused or hidden');
  if(this.session){
   const reading=this.session.reading;
   if(!reading.available&&this.status!=='unavailable'){this.status='unavailable';this.reason=reading.reason??'native acknowledgement unavailable';this.pause('owner unavailable');this.changed();}
   else if(reading.held&&this.status==='following'){this.status='held';this.reason=reading.reason??'native/audio owner held';this.changed();}
   if(this.status==='following'){try{this.session.present();}catch(error){this.receiverFailure(this.session,error);}}
  }
  return this.status==='manual'?delta:this.status==='following'?delta:0;
 }
 hold(reason='manual hold'){
  if(this.performanceReading){this.holdRevision++;this.holdPerformance(reason);return;}
  this.holdRevision++;
  // During admission the hold is recorded, not applied: the owner is not yet
  // pumping, its source reads must complete, and admission reasserts the hold.
  if(this.admitting===this.epoch){this.openingHold=reason;return;}
  if(!this.session)return;
  // An uncertain exchange has already stopped its driver and audio. Preserve
  // that owner's refusal before a cleanup/finally hold can replace its reason
  // with a completed-operation label or suggest that Resume is available.
  const reading=this.session.reading;
  if(!reading.available){
   this.status='unavailable';this.reason=reading.reason??this.reason??'native acknowledgement unavailable';
   this.pause('owner unavailable');this.changed();return;
  }
  this.session.hold(reason);this.status='held';this.reason=reason;this.changed();
 }
 /** A temporary instrument hold owns only the state it actually suspended.
  * Other holds and native lifetimes can never be released by its token. */
 suspend(reason:string):symbol{
  if(!reason||reason.length>2048)throw new Error('invalid instrument suspension');
  const token=Symbol('native instrument suspension');
  if(this.suspension){this.suspension.tokens.add(token);return token;}
  const pending=this.restoring;
  const restore=this.status==='following'||(this.admitting===this.epoch&&!this.openingHold)
   ||!!(pending&&pending.epoch===this.epoch&&pending.revision===this.holdRevision);
  // A pre-existing manual/error hold keeps its reason and revision.
  if(restore)this.hold(reason);
  this.suspension={tokens:new Set([token]),epoch:this.epoch,revision:this.holdRevision,restore,reason};
  return token;
 }
 async releaseSuspension(token:symbol):Promise<void>{
  const suspension=this.suspension;
  if(!suspension?.tokens.delete(token)||suspension.tokens.size)return;
  this.suspension=null;
  if(!suspension.restore||suspension.epoch!==this.epoch||suspension.revision!==this.holdRevision||this.dead)return;
  if(this.admitting===this.epoch){this.openingHold=null;this.reason=null;return;}
  const restoring={epoch:suspension.epoch,revision:suspension.revision};this.restoring=restoring;
  try{await this.resumeAt(restoring.epoch,restoring.revision);}
  finally{if(this.restoring===restoring)this.restoring=null;}
 }
 private async idle(){const session=this.session;if(!session)throw new Error('native owner unavailable');
  const deadline=performance.now()+6500;while(session.reading.in_flight){if(performance.now()>deadline)throw new Error('native operation still in flight; not retried');await new Promise(r=>setTimeout(r,8));}
  return session;
 }
 /** Wait for the one serial owner to be between exchanges; never interrupt one. */
 private async waitIdle(session:InstrumentSession,ms:number){
  const deadline=performance.now()+ms;
  while(session.reading.in_flight){if(performance.now()>deadline||!this.current(session))return false;await new Promise(r=>setTimeout(r,4));}
  return this.current(session);
 }
 private serial<T>(action:()=>Promise<T>):Promise<T>{
  const epoch=this.epoch;this.serialDepth++;
  const result=this.pending.then(async()=>{if(epoch!==this.epoch||this.dead)throw new Error('native operation cancelled by lifetime change');return action();});
  const done=result.finally(()=>{this.serialDepth--;});
  this.pending=done.catch(()=>{});return done;
 }
 private current(session:InstrumentSession){return this.session===session&&!this.dead;}
 /** `config` is the actual current native Scene's retained source configuration.
  * Native PerformanceOwner revalidates the current M1/M2/M3, source recipe and
  * receiving tokens. A failed prepare is retained and never silently retried. */
 preparePerformance(config:unknown,map:PhysicalTargetMap,current:()=>boolean){return this.prepareMusical({operation:'performance-prepare',config},()=>map,current);}
 prepareCurrentPerformance(preparation:unknown,map:(reading:NativePerformanceReading)=>PhysicalTargetMap,current:()=>boolean){return this.prepareMusical({operation:'performance-prepare-current',preparation},map,current);}
 private prepareMusical(command:unknown,makeMap:(reading:NativePerformanceReading)=>PhysicalTargetMap,current:()=>boolean){return this.serial(async()=>{
  if(this.performanceReading||this.performancePreparing)throw Error('This retained work already has a musical preparation.');
  const session=this.session;if(!session||!this.opened||!this.projection||this.contextLost)throw Error('Open and admit the current native Scene before preparing its instrument.');
  if(!current()||!this.selectedSourceQualified||this.selectedSourceBinding?.current()!==true)throw Error('The genuine current selected-Document source is not qualified for this body.');
  this.performanceCurrent=current;this.performanceStale=false;
  this.performancePreparing=true;this.pause('native physical performance');session.hold('native callback output owns musical playback');
  let projection:PhysicalSnapshotProjection|null=null;
  try{
   await this.idle();await this.context?.suspend();
   if(!this.current(session))throw Error('The musical preparation belongs to a released lifetime.');
   const reply=await session.performance(command);
   if(!current())throw Error('The native preparation completed after its Document or selected body changed; hold the original owner.');
   if(!this.current(session))throw Error('The musical preparation completed after its native owner closed.');
   if(reply.performance.accepted!==true)throw Error(reply.performance.refusal?.reason??'Native musical preparation refused.');
   if((command as any)?.operation==='performance-prepare-current')this.currentOutputCalibration=readCurrentOutputCalibration(reply.performance.current_output_calibration);
   else this.currentOutputCalibration=null;
   const admitted=readPerformance(reply.performance.reading),map=makeMap(admitted),native=session.reading;
   if(map.instance_ref!==native.instance_ref||map.event_ref!==native.event_ref||map.subject_ref!==native.subject_ref)throw Error('The selected physical receiving belongs to a different native work.');
   projection=new PhysicalSnapshotProjection(this.renderer.retainedTargetPort(),map,null);
   this.physicalProjection=projection;projection=null;
   this.receivePerformance(reply.performance.reading,reply.performance.transport_transition??null);
   this.status='held';this.reason='Native musical output prepared; open its audio output to play.';this.changed();
   return this.performanceReading;
  }catch(error){projection?.dispose();if(this.current(session)){this.reason=String(error);this.status='held';this.changed();}throw error;}
  finally{this.performancePreparing=false;}
 });}
 /** Cold saved-work caller. The genuine selected-Scene opening remains
  * pending Source6; only this closed native Act readmission grants musical
  * continuation. It never changes selectedSourceQualified or begins anew. */
 continueNativeScenePerformance(binding:NativeSceneRecordingBinding,select:()=>Promise<RetainedPerformanceAct>,makeMap:(reading:NativePerformanceReading)=>PhysicalTargetMap,current:()=>boolean){return this.serial(async()=>{
  const session=this.session,opened=this.opened;
  if(this.performanceReading||this.performancePreparing||this.recordingBinding||!session||!opened||!this.projection||this.contextLost)throw Error('Open the actual selected saved Scene in a fresh native lifetime before continuing.');
  if(!current()||this.selectedSourceBinding?.current()!==true||opened.source_current!==true||!sceneSame(opened.selected_scene,this.selectedSourceBinding.capture()))throw Error('The saved native opening differs from the actual current whole Document/Scene.');
  this.performanceCurrent=current;this.performanceStale=false;this.performancePreparing=true;this.recordingBinding=binding;
  this.pause('saved native performance readmission');session.hold('saved native Act owns continuation');
  let projection:PhysicalSnapshotProjection|null=null;
  try{
   await this.idle();await this.context?.suspend();
   const selected=await select(),cas=binding.capture();
   if(!current()||!this.current(session)||selected.document.expression_ref!==cas.expression_ref||selected.document.revision!==cas.document_revision||selected.selection.scene_ref!==cas.scene_ref||selected.selection.expected_scene_revision!==cas.scene_revision)throw Error('The selected saved Act changed before its native continuation.');
   const actual=binding.document();if(!sameNativeContinuationJson(selected.document,actual))throw Error('The actual complete Document differs from its retained native Act edition.');
   const transaction_ref=`continuation:${crypto.randomUUID()}`;
   const reply=await session.performance({operation:'performance-continue-act',act_ref:selected.act_ref,selection:selected.selection,checkpoint_index:selected.checkpoint_index,transaction_ref});
   if(!current()||!this.current(session))throw Error('The original continuation completed after its selected work changed.');
   const restored=readNativeActContinuation(reply.recording,reply.performance,selected,transaction_ref);
   await this.acceptRecording(reply.recording);this.requirePerformanceCurrent();binding.basis=restored.basis;this.currentRetainedSource=restored.retainedSource;
   const map=makeMap(restored.reading),native=session.reading;
   if(map.instance_ref!==native.instance_ref||map.event_ref!==native.event_ref||map.subject_ref!==native.subject_ref)throw Error('The restored native physical receiving belongs to another current work.');
   projection=new PhysicalSnapshotProjection(this.renderer.retainedTargetPort(),map,null);
   projection.prepareAdmission(restored.reading,this.physicalReceivingTargets(),binding.physicalRest(restored.reading));
   this.requirePerformanceCurrent();projection.commitPreparedAdmission();this.physicalProjection=projection;projection=null;
   this.publishPerformance(restored.reading,restored.transition);
   this.captureNativePulses=true;this.recordingReady=true;this.status='held';this.reason='Saved native body and pending events restored; open its audio output to continue.';this.scoreChanged();this.changed();return this.performanceReading;
  }catch(error){
   projection?.dispose();let receivingFailure:unknown=null;
   try{if(this.physicalProjection){this.renderer.releaseRetainedField();this.physicalProjection.dispose();this.physicalProjection=null;}}catch(failure){receivingFailure=failure;}
   this.recordingReady=false;this.captureNativePulses=false;this.performanceFailure=String(error);this.status='unavailable';this.reason='Original saved continuation failed: '+String(error);this.changed();
   // The exact opened owner may contain a restored engine even when post-CAS
   // adoption or GPU receiving failed. Close it once; never reissue Continue.
   try{await this.closeOwner(opened);}catch(closeError){throw new AggregateError([error,...(receivingFailure?[receivingFailure]:[]),closeError],'Original native continuation, receiving cleanup or exact owned close failed.');}
   if(receivingFailure)throw new AggregateError([error,receivingFailure],'Original native continuation and receiving cleanup failed.');throw error;
  }finally{this.performancePreparing=false;}
 });}
 /** Full kind6 native source transaction, never a parameter/readback rebind.
  * The ordinary app authoring controls use this same retained serial owner. */
 private editNativePhysical(edit:AuthoredPhysicalEdit){return this.editNativeSource('physical',edit);}
 private editNativeSource(kind:'physical'|'acoustic',operand:AuthoredPhysicalEdit|AuthoredAcousticConfiguration){return this.serial(async()=>{
  this.requirePerformanceCurrent();const binding=this.recordingBinding,session=this.session,opened=this.opened;
  if(!binding||!session||!opened||!this.recordingReady||!this.captureNativePulses||this.performanceSaveCut||this.performancePreparing||this.contextLost)throw Error('The retained current physical edit owner is unavailable.');
  this.performancePreparing=true;this.changed();let replacement:PhysicalSnapshotProjection|null=null;
  try{
   session.hold('native current Form/material transaction');await this.idle();
   const stopped=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-stop'}});
   await this.acceptRecording(stopped.recording);this.receivePerformance(stopped.performance.reading,stopped.performance.transport_transition??null);
   if(this.performanceReading!.device.state==='running')throw Error('The original native output did not stop before its physical source edit.');
   this.requirePerformanceCurrent();const oldReading=this.performanceReading!,cas=binding.capture();
   const delivered:any=kind==='physical'?await session.physicalEdit(operand):await session.acousticEdit(operand),result=kind==='physical'?delivered.physical_edit:delivered.acoustic_edit;
   const originalCas=kind==='physical'?delivered.physical_cas:delivered.acoustic_cas,originalResult=kind==='physical'?this.lastNativePhysicalEdit:this.lastNativeAcousticEdit;
   if(!sceneSame(originalCas,cas)||result!==originalResult)throw Error('The original physical transaction lost its captured Document CAS.');
   // Retain observations drained by BOTH original physical/acoustic pulses.
   // These are existing native replies, never extra Inspect or source grants.
   await this.observeNativeCapture({native_reply:result.original_prepare_reply});
   await this.observeNativeCapture({native_reply:result.original_application_reply});
   if(result.accepted!==true)throw Error(result.reason??'The native physical edit refused; its original body/document custody remains.');
   await binding.acceptPhysical(result,cas);this.requirePerformanceCurrent();
   const document=binding.document();binding.basis=kind==='physical'?appliedPhysicalBasis(document,cas,result):appliedAcousticSource(document,cas,result).basis;this.currentSourceArtifact=structuredClone(result.original_application_reply.result.source_artifact);this.currentRetainedSource=null;this.playbackCurrentSource=null;
   const actual=await session.performance({operation:'performance-exchange',command:{operation:'performance-inspect'}});
   await this.acceptRecording(actual.recording);this.requirePerformanceCurrent();
   const reading=readPerformance(actual.performance.reading,oldReading),map=binding.receivingMap(reading),body=(document as any).scenes.find((row:any)=>row.scene_ref===cas.scene_ref).performance.bases[binding.basis].prepared_body;
   if(reading.scope.preparation_ref!==body.request.preparation_ref||reading.scope.state_ref!==body.request.state_ref||reading.scope.body_revision!==String(body.request.body_revision)||reading.physical.source_generation!==String(body.source_generation))throw Error('The actual callback reading differs from the committed native physical body.');
   if(kind==='acoustic'){appliedAcousticSource(document,cas,result,reading);const original=result.original_application_reply?.result?.native_pulse?.reading?.receiving_transport?.manifest,observed=(actual.recording as any)?.native_reply?.result?.native_pulse?.reading?.receiving_transport?.manifest;if(!original||!sceneSame(original,observed))throw Error('The captured native receiving differs from the original accepted source epoch.');}
   replacement=new PhysicalSnapshotProjection(this.renderer.retainedTargetPort(),map,null);
   replacement.prepareAdmission(reading,this.physicalReceivingTargets(),binding.physicalRest(reading));
   this.requirePerformanceCurrent();replacement.commitPreparedAdmission();
   const prior=this.physicalProjection;this.physicalProjection=replacement;replacement=null;
   prior?.dispose();this.publishPerformance(reading,actual.performance.transport_transition??null);this.scoreChanged();this.status='held';this.reason=kind==='physical'?'Physical body and its original performance history retained. Start output to continue.':'Situated receiving and its full original source history retained. Start output to continue.';this.changed();return result;
  }catch(error){
   replacement?.dispose();this.recordingReady=false;this.performanceFailure=String(error);this.status=session.reading.available?'held':'unavailable';
   this.reason=(kind==='physical'?'Original physical edit':'Original receiving edit')+' requires reconciliation: '+String(error);this.changed();this.scoreChanged();throw error;
  }finally{this.performancePreparing=false;if(this.performanceReading)for(const listener of this.performanceListeners)listener({schema:'ql.performance-management-update/v1',reading:this.performanceReading,transport_transition:null});this.changed();}
 });}
 private bindNativePhysicalDisplay(){
  this.requirePerformanceCurrent();const binding=this.recordingBinding,reading=this.performanceReading,projection=this.physicalProjection;
  if(!binding||!reading||!projection)throw Error('The native Scene/body/rest producer is disconnected.');
  projection.bindNativeRest(binding.physicalRest(reading));this.applyPhysicalReading(reading);
 }
 private physicalReceivingTargets(){
  const session=this.session;if(!session||!this.current(session)||!this.projection||this.performanceStale||this.performanceCurrent?.()!==true||this.contextLost)throw Error('The actual native/GPU/current Document receiving is unavailable.');
  const native=session.reading,retained=this.renderer.retainedTargetPort().readPartitionSnapshot();
  // Source carrier coordinates are diagnostic only. U consumes these authored
  // sampler arrays as its BASIS, then its real M3 map/reading supplies positions.
  let base:{target_a:unknown;target_b:unknown};
  if(this.projection instanceof SelectedSourceReception){
   const authored=this.projection.authoredSamplerBasis();
   if(authored.partition_signature!==retained.partition_signature)throw Error('The original authored sampler basis changed before native body receiving.');
   base=authored;
  }else base=this.projection.inspect();
  if(!(base.target_a instanceof Float32Array)||!(base.target_b instanceof Float32Array))throw Error('The retained authored/physical sampler basis is not complete Float32 buffers.');
  return{partition_signature:retained.partition_signature,instance_ref:native.instance_ref,event_ref:native.event_ref,subject_ref:native.subject_ref,target_a:base.target_a,target_b:base.target_b};
 }
 private applyPhysicalReading(next:NativePerformanceReading){
  if(!this.physicalProjection)throw Error('The actual native physical receiving is unavailable.');
  this.physicalProjection.apply(next,this.physicalReceivingTargets());
 }
 private receivePerformance(value:unknown,transition:NativeTransportAcknowledgement|null){
  const session=this.session;if(!session||!this.current(session)||!this.projection||!this.physicalProjection)throw Error('Native musical receiving is no longer current.');
  const custody=this.scorePlaybackCustody,pending=this.hasPendingNativePlayback();
  const next=readPerformance(value,pending?custody!.pending_reading??undefined:this.performanceReading??undefined,transition),native=session.reading;
  if(next.scope.instance_ref!==native.instance_ref||next.scope.event_ref!==native.event_ref||next.scope.subject_ref!==native.subject_ref)throw Error('The native musical reply belongs to another source owner.');
  if(pending){
   custody!.pending_result=this.lastNativeRecording;custody!.pending_reading=next;
   const returned=this.lastNativeRecording?.native_reply?.result,programme=custody!.result?.native_reply?.result?.native_programme_admission;
   if(readNativePlaybackStartPhase(returned,programme,next,this.playbackCurrentSource!==null)==='pending-first-callback'){
    this.retainPendingNativePlaybackSource(next,returned,programme,custody!.result.native_reply.result.original_plan);
    this.scoreChanged();this.changed();return; // no current P/GPU/publication
   }
  }
  if(!this.performanceStale&&this.performanceCurrent?.()===true){
   if(next.live_temporal){
    const custody=this.scorePlaybackCustody,returned=this.lastNativeRecording?.native_reply?.result;
    if(!custody?.result?.native_reply?.result?.native_programme_admission||custody.held)throw Error('The active native programme lost its original admission/current-source custody.');
    try{
     this.adoptNativePlaybackSource(next,returned,custody.result.native_reply.result.native_programme_admission,custody.result.native_reply.result.original_plan);
     if(custody.first_current_pending){const binding=this.recordingBinding!;custody.first_current={request:structuredClone(this.lastNativeRecordingRequest),result:this.lastNativeRecording,cas:binding.capture(),document:binding.document(),reading:next,transition};custody.first_current_pending=false;custody.reason=null;this.recordingReady=true;this.retainedScoreAdmission=null;}
    }
    catch(error){custody.held=true;custody.reason=String(error);this.recordingReady=false;
     const opened=this.opened;if(opened)void this.closeOwner(opened).catch(closeError=>{custody.reason+='; exact native close failed: '+String(closeError);this.changed();});
     throw error;
    }
   }
   this.applyPhysicalReading(next);
  }
  this.publishPerformance(next,transition);
 }
 /** Only already admitted native reading/receiving reaches this notification. */
 private publishPerformance(next:NativePerformanceReading,transition:NativeTransportAcknowledgement|null){
  this.performanceReading=next;
  this.status=!this.performanceStale&&next.available&&next.device.state==='running'?'following':'held';if(!this.performanceStale)this.reason=next.reason??next.device.error;
  const update:NativePerformanceUpdate={schema:'ql.performance-management-update/v1',reading:next,transport_transition:transition};
  for(const listener of this.performanceListeners)listener(update);
  this.scoreChanged();this.changed();
 }
 private exchangePerformance(command:NativePerformanceCommand){return this.serial(async()=>{
  const session=this.session;if(!session||!this.hasOwnedPerformance())throw Error('The retained musical owner is unavailable.');
  const protective=command.operation==='performance-hold'||command.operation==='performance-panic';
  const pendingInspect=this.hasPendingNativePlayback()&&command.operation==='performance-inspect';
  if(!protective){this.requirePerformanceCurrent(pendingInspect);if(this.performanceSaveCut)throw Error('The original stopped file save requires readback before further input or playback.');if(!this.recordingReady&&!pendingInspect)throw Error('Retain the actual native score and pre-play origin before starting output or input.');}
  if(command.operation==='performance-transpose'&&this.captureNativePulses)throw Error('Transpose is unavailable until its recorded native source transition is admitted.');
  if(this.contextLost&&command.operation!=='performance-hold'&&command.operation!=='performance-panic')throw Error('GPU receiving is unavailable; recover the same retained body before playing.');
  const reply=await session.performance({operation:'performance-exchange',command});if(reply.recording)await this.acceptRecording(reply.recording);
  if(!this.current(session))throw Error('The musical reply completed after the native lifetime changed.');
  if(!protective){try{this.requirePerformanceCurrent(pendingInspect);}catch(error){this.receivePerformance(reply.performance.reading,reply.performance.transport_transition??null);throw error;}}
  this.receivePerformance(reply.performance.reading,reply.performance.transport_transition??null);
  return reply.performance;
 });}
 private holdPerformance(reason:string){
  if(this.performanceHoldPending||!this.hasOwnedPerformance())return;
  this.performanceHoldPending=true;
  void this.exchangePerformance({operation:'performance-hold',reason}).catch(error=>{
   this.performanceFailure=`Native musical hold acknowledgement unavailable: ${String(error)}`;
   this.status='unavailable';this.reason=this.performanceFailure;this.changed();
  }).finally(()=>{this.performanceHoldPending=false;});
 }
 retainedPartition():ReturnType<PhysicalRetainedPort['readPartitionSnapshot']>{if(!this.session||!this.projection)throw Error('The native retained renderer is unavailable.');return this.renderer.retainedTargetPort().readPartitionSnapshot();}
 inspectPhysicalTargets(){return this.physicalProjection?.inspect()??null;}
 get musicalReading(){return this.performanceReading;}

 private finishCommand(session:InstrumentSession,following:boolean,revision:number,reason:string){
  if(!this.current(session))throw new Error('native operation belongs to a released lifetime');
  if(this.pausePendingPresentation(session))return;
  this.checkpoint=null;
  if(following&&revision===this.holdRevision&&!this.contextLost&&!this.suspension){this.status='following';this.reason=null;session.start();this.changed();}
  else{session.hold(this.reason??reason);this.status='held';this.reason??=reason;this.changed();}
 }
 private requirePhysicalField(){
  if(this.projection instanceof SelectedSourceReception)throw Error('The selected Source carrier has no selected-body FIELD target map. Prepare its actual native physical body before using physical controls.');
 }
 resume(){return this.resumeAt(this.epoch,this.holdRevision);}
 private resumeAt(epoch:number,revision:number){return this.serial(async()=>{
  const permitted=()=>epoch===this.epoch&&revision===this.holdRevision&&!this.suspension&&!this.dead;
  if(!permitted())return;
  const session=this.session;if(!session)throw new Error('native owner unavailable');
  if(!this.performanceReading)this.requirePhysicalField();
  try{
   this.requirePresentationSettled();
   if(this.contextLost)throw new Error('GPU context is unavailable');
   if(this.reason?.startsWith('GPU context'))throw new Error('restore a same-state GPU checkpoint before resuming, or disconnect');
   if(this.performanceReading){
    this.requirePerformanceCurrent();if(!this.recordingReady)throw Error('Retain the actual native score origin before starting output.');
    if(this.contextLost)throw Error('The retained GPU body is unavailable.');
    const reply=await session.performance({operation:'performance-exchange',command:{operation:'performance-device-start'}});if(reply.recording)await this.acceptRecording(reply.recording);
    if(!this.current(session))throw Error('Musical resume belongs to a released lifetime.');
    this.receivePerformance(reply.performance.reading,reply.performance.transport_transition??null);return;
   }
   await this.context?.resume();await this.idle();
   if(!this.current(session))throw new Error('native resume belongs to a released lifetime');
   if(!permitted())return;
   await session.recover('explicit native resume');
   this.finishCommand(session,true,revision,'resume interrupted by a newer hold');
  }catch(error){this.receiverFailure(session,error);throw error;}
 });}
 setAxis(axis:0|1,phase:NativeAxisPhase){const request=nativeAxisRequest(axis,phase);return this.operate({operation:'set-axis',...request});}
 operate(command:unknown){if(this.performanceReading)return Promise.reject(Error('Use current physical instrument controls; legacy field operations cannot replace this retained body.'));return this.serial(async()=>{
  this.requirePhysicalField();
  this.requirePresentationSettled();
  const following=this.status==='following';this.hold('native operation');const revision=this.holdRevision;
  const session=await this.idle();
  try{
   await session.recover('native operation admission');const result=await session.operate(command);
   this.invalidateCurrentReading('native operation acknowledged; complete reading awaits fresh Inspect');
   await this.readSources(session);if(this.scene)await this.readInfluence(session);
   await session.recover('native operation readback admitted; rebase device only');
   this.finishCommand(session,following,revision,'native operation applied while held; resume explicitly');return result;
  }catch(error){this.receiverFailure(session,error);throw error;}
 });}
 /** A refused determinant leaves the owner and its standing unchanged. */
 private refused(operation:string,error:unknown,session:InstrumentSession){
  if(!this.current(session)||!session.reading.available)return false;
  this.refusal={operation,reason:String(error instanceof Error?error.message:error),at:Date.now()};this.changed();return true;
 }
 /** A scene determinant event through the one serial owner. While following, the
  * re-read targets queue behind already scheduled sound (no hold, no rebase);
  * while held, the event commits and the owner stays held. */
 private determinant(operation:string,build:()=>any,needsEvent:boolean,cadence=false):Promise<void>{
  if(this.performanceReading)return Promise.reject(Error('A native source/body transition is required before changing this physical performance.'));
  try{this.requirePhysicalField();}catch(error){return Promise.reject(error);}
  const session=this.session;
  if(!session||!this.scene||this.influenceStale||!this.influenceReading)return Promise.reject(new Error('A complete current Scene influence must be admitted before determinant events'));
  try{this.requirePresentationSettled();}catch(error){return Promise.reject(error);}
  if(this.status==='following'&&!this.suspension){
   const live=async()=>{
    this.operating++;let scope:NativeExchangeScope|null=null,acknowledged=false;
    try{
     // A beat may wait for the pump's exchange to finish, never past its own
     // period: later beats are skipped meanwhile, never queued behind it.
     if(!(await this.waitIdle(session,cadence?Math.min(900,this.cadence?.period??250):5000)))throw new Error('native owner busy; the event was not sent');
     if(needsEvent&&this.sourcesStale){await this.readSources(session);if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy; the event was not sent');}
     if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the event was sent');
     this.timingStart=performance.now();
     // The event holds the one owner while sound waits: send it on a full
     // lookahead so its latency spends buffered sound, not an underrun.
     for(let block=0;block<8;block++){
      const before=session.reading.acknowledged?.samples_elapsed;
      await session.pump();
      if(session.reading.acknowledged?.samples_elapsed===before||this.status!=='following')break;
     }
     const command=build();
     const sent=performance.now();
     scope=this.exchangeScope(session);await session.operate(command);acknowledged=true;
     this.timing={fill_ms:sent-this.timingStart,operate_ms:performance.now()-sent};
     if(!this.current(session))return;
     // This event happened. Admit only THIS ACK's complete body, independently
     // of the old sources; otherwise await a genuine current read, never undo.
     this.acknowledgedSceneEvent();
     try{this.receiveCarriedInfluence(session,command.operation,scope);}
     catch(error){this.invalidateCurrentReading(error);this.pause('native event acknowledged; current reading unavailable');}
     this.changed();
    }catch(error){
     if(scope&&(acknowledged||this.eventWasAcknowledged(session,scope))){
      if(this.current(session)){this.acknowledgedSceneEvent();this.invalidateCurrentReading(error);if(!this.pausePendingPresentation(session))this.hold(`native event acknowledged; presentation/read unavailable: ${String(error)}`);}
      return; // Cadence counts the native commit; this is not a refused event.
     }
     if(this.pausePendingPresentation(session)){this.receiverFailure(session,error);throw error;}
     if(!(cadence&&TRANSIENT.test(String(error))))this.refused(operation,error,session);throw error;
    }
    finally{this.operating--;}
   };
   return cadence?live():this.serial(live);
  }
  return this.serial(async()=>{
   this.requirePresentationSettled();
   const following=this.status==='following',prior=this.reason;this.hold('native determinant event');const revision=this.holdRevision;
   const held=await this.idle();
   this.operating++;let scope:NativeExchangeScope|null=null,acknowledged=false;
   try{
    await held.recover('native determinant admission');
    if(needsEvent&&this.sourcesStale)await this.readSources(held);
    const command=build();scope=this.exchangeScope(held);await held.operate(command);acknowledged=true;
    if(!this.current(held))return;
    this.acknowledgedSceneEvent();
    try{this.receiveCarriedInfluence(held,command.operation,scope);}catch(error){this.invalidateCurrentReading(error);}
    // A genuine fresh Inspect may restore a missing carried reading. It must
    // qualify its own envelope and complete body at the acknowledged cursor.
    await this.readSources(held);await this.readInfluence(held);
    await held.recover('native determinant readback admitted; rebase device only');
    this.reason=following?null:prior;
    this.finishCommand(held,following,revision,'determinant applied while held; resume explicitly');
   }catch(error){
    if(scope&&(acknowledged||this.eventWasAcknowledged(held,scope))){
     if(this.current(held)){this.acknowledgedSceneEvent();this.invalidateCurrentReading(error);if(!this.pausePendingPresentation(held))this.hold(`native event acknowledged; presentation/read unavailable: ${String(error)}`);}
     return;
    }
    if(this.pausePendingPresentation(held)){this.receiverFailure(held,error);throw error;}
    if(this.refused(operation,error,held)){held.hold(prior??'determinant refused');this.status='held';this.reason=prior??'determinant refused';this.changed();}
    else this.receiverFailure(held,error);
    throw error;
   }finally{this.operating--;}
  });
 }
 /** M1's own advance on the owner (M1Engine::advance), then the whole event re-read. */
 m1Advance(ticks=1){
  if(!Number.isInteger(ticks)||ticks<1||ticks>1_000_000)return Promise.reject(new Error('M1 advance must be 1..1000000 ticks'));
  return this.determinant('M1 advance',()=>({operation:'m1-advance',ticks}),false);
 }
 /** Explicit material policy on the same Scene owner; never a strike or reset. */
 setDamping(perSecond:number){
  if(!Number.isFinite(perSecond)||perSecond<0||perSecond>1e6)return Promise.reject(new Error('Damping must be finite and in 0..1000000 per second'));
  return this.determinant('material damping',()=>({operation:'set-damping',per_second:perSecond}),false);
 }
 replaceEvent(event:unknown,strike:boolean){
  if(typeof strike!=='boolean')return Promise.reject(new Error('strike must be explicit'));
  return this.determinant('replace event',()=>({operation:'replace-event',event:structuredClone(event),strike}),false);
 }
 /** One determinant changed on the owner's current event. Strike follows the
  * owner's declared `strike_on_event` policy, as its own M1 advance does. */
 edit(edit:SceneEdit){
  const label=edit.kind==='lens'?'lens':edit.kind==='context-frame'?'Context Frame':edit.kind==='harmonic'?'harmonic basis':'transcription';
  try{if(this.event)editSceneEvent(this.event,edit);}catch(error){if(this.session)this.refusal={operation:label,reason:String(error instanceof Error?error.message:error),at:Date.now()};this.changed();return Promise.reject(error);}
  return this.determinant(label,()=>({operation:'replace-event',event:editSceneEvent(this.event,edit),strike:this.influenceReading?.material?.strike_on_event!==false}),true);
 }
 /** Re-excite the same voices from the declared strike amplitude. */
 strike(){return this.determinant('strike',()=>({operation:'replace-event',event:structuredClone(this.event),strike:true}),true);}
 /** The first admitted event, carried under the owner's next M1 revision so M1's
  * revision never runs backwards; M2/M3 generations are re-issued by the owner. */
 restoreOpening(){
  if(!this.opening)return Promise.reject(new Error('no opening event admitted'));
  return this.determinant('return to opening event',()=>{
   const event=structuredClone(this.opening),revision=this.influenceReading?.m1_revision??this.event?.m1?.revision;
   if(typeof revision!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(revision))throw new Error('current M1 revision unavailable');
   event.m1.revision=String(BigInt(revision)+1n);return{operation:'replace-event',event,strike:true};
  },true);
 }
 get currentEvent(){return this.event?structuredClone(this.event):null;}
 get openingEvent(){return this.opening?structuredClone(this.opening):null;}
 influence(){return this.serial(async()=>{
  this.requirePresentationSettled();
  const session=this.session;if(!session||!this.scene)throw new Error('influence belongs to a scene owner');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy');return this.readInfluence(session);}
  this.hold('native influence reading');const held=await this.idle();
  try{await held.recover('native influence reading');return await this.readInfluence(held);}
  finally{if(this.current(held)&&!this.pausePendingPresentation(held))this.hold('influence reading complete; resume explicitly');}
 });}
 /** Human-cadence source refresh after determinant events; never while an event
  * is in flight, never while held. */
 async refreshSources(){
  if(this.performanceReading)return;
  const session=this.session;
  // A complete source read is large (the whole coupled basis); while a cadence
  // plays it yields to the ticks and runs at most every 5 s.
  if(session&&this.scene&&this.influenceStale&&this.status==='following'&&!this.suspension&&!this.operating&&!this.serialDepth){
   this.operating++;
   try{if(await this.waitIdle(session,100)&&this.status==='following'){await this.readInfluence(session);this.changed();}}
   catch{this.pausePendingPresentation(session);}finally{this.operating--;}
  }
  if(!session||!this.scene||!this.sourcesStale||this.status!=='following'||this.suspension||this.operating||this.serialDepth||performance.now()-this.lastInspect<(this.cadence?5000:1500))return false;
  this.operating++;
  try{if(!(await this.waitIdle(session,100))||this.status!=='following')return false;await this.readSources(session);this.changed();return true;}
  catch{this.pausePendingPresentation(session);return false;}
  finally{this.operating--;}
 }
 /** Explicit cadence: serial m1-advance requests at a source-cited rate. A beat
  * is skipped while the owner is busy, suspended while held/hidden/unavailable,
  * and the cadence stops on release or refusal. */
 play(ticksPerSecond:number){
  this.requirePhysicalField();
  this.requirePresentationSettled();
  if(!this.scene||!this.session||this.influenceStale||!this.influenceReading)throw new Error('Admit the complete current Scene influence before playing');
  if(!(Number.isFinite(ticksPerSecond)&&ticksPerSecond>0&&ticksPerSecond<=12))throw new Error('cadence must be within (0, 12] ticks per second');
  this.pause('rate changed');
  const period=1000/ticksPerSecond;
  const cadence:Cadence={rate:ticksPerSecond,period,source:CADENCES.find(c=>c.ticks_per_second===ticksPerSecond)?.source??'explicit rate',
   timer:setInterval(()=>{void this.beat(cadence);},period),started:performance.now(),beats:0,issued:0,applied:0,skipped:0,suspended:0,inFlight:false};
  this.cadence=cadence;this.changed();
 }
 pause(reason='held'){
  const cadence=this.cadence;if(!cadence)return;
  // The same record: a beat already in flight still counts when it lands.
  clearInterval(cadence.timer);this.cadence=null;cadence.stopped=reason;cadence.stopped_at=performance.now();this.lastCadence=cadence;this.changed();
 }
 private async beat(cadence:Cadence){
  if(this.cadence!==cadence)return;
  cadence.beats++;
  if(!this.session||this.status!=='following'||this.suspension||this.dead){cadence.suspended++;return;}
  if(cadence.inFlight||this.operating||this.serialDepth){cadence.skipped++;return;}
  cadence.inFlight=true;
  try{
   cadence.issued++;
   const t0=performance.now();
   await this.determinant('M1 advance (cadence)',()=>({operation:'m1-advance',ticks:1}),false,true);
   cadence.lastEventMs=performance.now()-t0;cadence.maxEventMs=Math.max(cadence.maxEventMs??0,cadence.lastEventMs);
   cadence.applied++;if(this.cadence!==cadence)this.changed();
  }catch(error){
   cadence.issued--;
   if(TRANSIENT.test(String(error)))cadence.skipped++;
   else if(this.cadence===cadence)this.pause(`refused: ${String(error instanceof Error?error.message:error)}`);
  }finally{cadence.inFlight=false;}
 }
 inspectSources(){if(this.performanceReading)return Promise.reject(Error('Inspect the physical performance through its admitted native owner.'));return this.serial(async()=>{
  this.requirePresentationSettled();
  this.hold('native source inspection');const session=await this.idle();
  try{await session.recover('native source inspection');return await this.readSources(session);}
  finally{if(this.current(session)&&!this.pausePendingPresentation(session))this.hold('source inspection complete; resume explicitly');}
 });}
 editBasis(edit:NativeBasisEdit){if(this.performanceReading)return Promise.reject(Error('The retained physical performance requires its native source/body transition.'));return this.serial(async()=>{
  this.requirePhysicalField();
  this.requirePresentationSettled();
  const following=this.status==='following';this.hold('native basis edit');const revision=this.holdRevision;
  const session=await this.idle();
  try{
   await session.recover('native basis edit admission');await this.readSources(session);
   const basis=editNativeBasis(this.sources,edit);
   await session.recover('complete basis inspected; native edit admission');
   const result=await session.operate({operation:'replace',basis});
   this.invalidateCurrentReading('native basis replacement acknowledged; complete reading awaits fresh Inspect');await this.readSources(session);
   await session.recover('native basis readback admitted; rebase device only');
   this.finishCommand(session,following,revision,'native basis applied while held; resume explicitly');return result;
  }catch(error){this.receiverFailure(session,error);throw error;}
 });}
 setScale(scale:number){if(!this.projection)throw new Error('native presentation unavailable');this.projection.setScale(scale);this.changed();}
 followDomain(){this.setScale(this.opened?.presentation.units_per_metre);}
 setMuted(muted:boolean){if(!this.session)throw new Error('native audio unavailable');this.session.setMuted(muted);this.muted=muted;this.changed();}
 /** Presentation level only; the native PCM and its receiver gain are unchanged. */
 setLevel(value:number){
  if(!Number.isFinite(value)||value<PRESENTATION_LEVEL.min||value>PRESENTATION_LEVEL.max)throw new Error(`level must be within ${PRESENTATION_LEVEL.min}–${PRESENTATION_LEVEL.max}`);
  this.levelValue=value;const gain=this.level?.gain,context=this.context;
  if(gain&&context&&typeof gain.setTargetAtTime==='function')gain.setTargetAtTime(value,context.currentTime,.02);else if(gain)gain.value=value;
  this.changed();
 }
 saveCheckpoint(){if(this.performanceReading)return Promise.reject(Error('Use the native paired performance checkpoint.'));return this.serial(async()=>{
  this.requirePhysicalField();
  this.requirePresentationSettled();
  this.hold('checkpoint hold');const session=await this.idle();await session.recover('checkpoint current cursor');this.hold('checkpoint hold');
  if(!this.current(session))throw new Error('checkpoint belongs to a released lifetime');
  this.checkpoint=this.renderer.checkpointRetainedField(this.projection);this.changed();return {schema:this.checkpoint.schema,receipt:this.checkpoint.receipt,width:this.checkpoint.width,height:this.checkpoint.height};
 });}
 restoreCheckpoint(){return this.serial(async()=>{
  this.requirePhysicalField();
  this.requirePresentationSettled();
  if(!this.checkpoint||this.contextLost)throw new Error('same-live-state checkpoint or restored GPU unavailable');
  const session=await this.idle();if(!this.current(session))throw new Error('checkpoint belongs to a released lifetime');this.renderer.restoreRetainedField(this.projection,this.checkpoint);this.reason='checkpoint restored; resume explicitly';this.status='held';this.changed();
 });}
 inspectTargets(){return this.projection?.inspect()??null;}
 release(manual=true){return this.releaseLifetime(manual,true);}
 private async releaseLifetime(manual:boolean,settleAdmission:boolean){
  const unfinishedTake=this.nativeTakeRecorder.snapshot()?.status==='recording';
  const soundFailure=unfinishedTake?this.nativeTakeRecorder.fail('The original native owner was released before its take acknowledged Stop. Captured originals remain; no continuous WAVE or successful native stop is claimed.'):Promise.resolve();
  this.lastNativeCapture=null;this.lastCaptureCursor=null;
  this.sourceAuthorshipWindow=null;this.lastSourceAuthorship=null;this.selectedSourceQualified=false;this.selectedSourceBinding=null;this.selectedSourceAsset=null;this.lastSourceTransaction=null;this.lastRecordingCas=null;this.performanceSaveCut=null;this.performanceSaving=false;
  this.retainedScoreAdmission=null;this.nativeScoreTransportObservation=null;
  if(this.scorePlaybackCustody?.first_current_pending){this.scorePlaybackCustody.held=true;this.scorePlaybackCustody.reason='The original native owner was released before its first current source response.';}
  this.performanceReading=null;this.performanceFailure=null;this.performanceCurrent=null;this.performanceStale=false;this.recordingBinding=null;this.captureNativePulses=false;this.recordingReady=false;this.lastNativeRecording=null;this.lastNativeContinuation=null;this.currentOutputCalibration=null;this.lastNativeCalibration=null;this.observedCalibrationApplication=null;this.lastNativePhysicalEdit=null;this.lastNativeAcousticEdit=null;this.currentSourceArtifact=null;this.currentRetainedSource=null;this.playbackCurrentSource=null;
  this.pause('released');
  const epoch=++this.epoch;const session=this.session;this.lastNative=session?.reading??this.lastNative;
  this.session=null;session?.dispose();this.recovery?.();this.recovery=null;
  this.renderer.releaseRetainedField();this.renderer.setNativeDomain(false);this.physicalProjection?.dispose();this.physicalProjection=null;this.projection?.dispose();this.projection=null;
  const context=this.context;this.context=null;const opened=this.opened;this.opened=null;this.checkpoint=null;this.contextLost=false;
  this.sources=null;this.domain=null;this.openingHold=null;
  this.scene=false;this.ownerKind=null;this.exchangeReceipt=null;this.readingError=null;this.influenceReading=null;this.acting=null;this.event=null;this.opening=null;this.sourcesStale=false;this.influenceStale=false;this.level=null;
  this.admitting=null;this.suspension=null;this.restoring=null;
  if(manual){this.status='manual';this.lastNative=null;this.reason=null;this.refusal=null;this.lastCadence=null;this.changed();}
  const admission=settleAdmission?this.admission:null;
  const pending=this.pending;
  const close=async()=>{
   const results=await Promise.allSettled([context&&context.state!=='closed'?context.close():Promise.resolve(),this.closeOwner(opened),admission??Promise.resolve(),soundFailure]);
   await pending;
   while(this.operating)await new Promise(resolve=>setTimeout(resolve,8));
   const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');
   if((failure||this.closeFailure)&&epoch===this.epoch){this.reason=`native release acknowledgement unknown: ${String(failure?.reason??this.closeFailure?.message)}`;this.changed();}
  };
  const closing=close();this.closing=closing;
  try{await closing;}finally{if(this.closing===closing)this.closing=null;}
 }

 async dispose(){if(this.dead)return;this.dead=true;try{await this.release();}finally{this.scoreListeners.clear();this.performanceListeners.clear();this.port.dispose();}}

private proceduralContext:NativeConductContextReader|null=null;
private stageLibraryContext:(()=>KernelConversion|null)|null=null;
private stageLibraryClient:NativeStageLibraryClient|null=null;
private stageCompilationStanding:{session:InstrumentSession;epoch:number;status:NativeStatus;reason:string|null}|null=null;
private stageCompilationCallback:{session:InstrumentSession;epoch:number;settled:Promise<void>}|null=null;
private bootstrapInvocation:{command:NativeStageBootstrapCommand;reply:unknown|null}|null=null;
async abandonSelectedScene(request:NativeSelectedSceneRequest):Promise<unknown>{
  if(this.session||this.admitting!==null||this.closing)throw new Error('Close the current admitted instrument before abandoning an unresolved original opening');
  return this.port.request({operation:'abandon_selected_scene',request:structuredClone(request)});
 }
bindSelectedSceneSource(binding:NativeSelectedSourceBinding){
  const session=this.session,opened=this.opened,selection=binding.capture(),asset=this.selectedSourceAsset;
  if(!session||!opened||this.admitting!==null||this.closing||!binding.current()||opened.qualification!=='pending_source_bootstrap'||opened.source_current!==true)throw Error('The original selected Scene owner is unavailable for its current instrument binding');
  const original=sceneSame(opened.selected_scene,selection),observed=asset?.session===session&&asset.epoch===this.epoch&&asset.opened===opened&&sceneSame((asset.result as any)?.selected_scene,selection);
  if(!original&&!observed)throw Error('The selected instrument binding changed after its actual original opening/source observation; requalify through that native owner');
  this.selectedSourceBinding=binding;this.selectedSourceQualified=false;
 }
retainedSelectedSceneSource():unknown{
  const asset=this.selectedSourceAsset;
  return asset&&asset.session===this.session&&asset.epoch===this.epoch&&asset.opened===this.opened?structuredClone(asset.result):null;
 }
async retainSelectedSceneSource(selection:NativeSelectedSceneRequest,actor:string,capture:SelectedSceneSourceCapture,receive:(reply:unknown)=>Promise<void>,original?:{request:NativeSelectedSceneSourceRequest;context:NativeDocumentTransactionContext}):Promise<unknown>{
  return this.serial(async()=>{
   const session=this.session,opened=this.opened,epoch=this.epoch;
   if(!session||!opened?.lease||this.admitting!==null||this.closing)throw Error('The original source observation requires its same admitted Session and native opening');
   const uncertainRecovery=!!original&&!session.reading.available;
   if(!session.reading.available&&(!uncertainRecovery||!session.reading.pending_document_transaction||typeof session.recoverNativeDocumentTransaction!=='function'))throw Error('The actual original selected-source transaction is unavailable for this SAME Session; generic unknown writes cannot be recovered here');
   if(opened.selected_scene?.expression_ref!==selection.expression_ref||opened.selected_scene?.scene_ref!==selection.scene_ref)throw Error('The selected source request belongs to another admitted Scene/Expression');
   this.requirePresentationSettled();await this.betweenOperations(session);
   let raw:unknown,localFailure:unknown,receiving=true;
   const invoke=async(context:NativeDocumentTransactionContext,sealed?:import('./ql/instrument-session.mjs').NativeSelectedSceneSourceRequest)=>{
    if(!receiving||this.session!==session||epoch!==this.epoch)throw Error('Original source callback is no longer receiving in its native lifetime');
    const current=validateSelectedSourceContext(context);
    let request:NativeSelectedSceneSourceRequest,basis=current;
    if(original){
     request=structuredClone(original.request);basis=validateSelectedSourceContext(original.context);
     if(!sceneSame(request.selection,selection)||request.actor!==actor||request.lease!==opened.lease||!sceneSame(request,selectedSceneSourceRequest(selection,actor,opened.lease,basis))||['instance_ref','event_ref','subject_ref','expected_generation','expected_samples_elapsed'].some(key=>current[key as keyof NativeDocumentTransactionContext]!==basis[key as keyof NativeDocumentTransactionContext]))throw Error('Recovery differs from the complete original request/actual same Session source basis');
     if(current.next_request_id!==request.expected_request_id&&current.last_request_id!==request.expected_request_id)throw Error('Original source ordinal is no longer current in this same Session; no historic ACK was replayed');
     if(sealed&&(!sceneSame(current,basis)||!sceneSame(sealed,request)))throw Error('The private Session recovery differs from the full retained original native request/context');
    }else request=selectedSceneSourceRequest(selection,actor,opened.lease,current);
    try{await capture(request,basis);}catch(error){
     // Capture failed before this callback dispatched any native request.
     if(uncertainRecovery)throw error;
     localFailure=error;return {native_procedural_receipts:[],not_dispatched:true};
    }
    if(!receiving||this.session!==session||epoch!==this.epoch)throw Error('Original source callback closed before native dispatch; its captured intent remains retained');
    raw=await this.port.request({operation:original?'recover_selected_scene_source':'retain_selected_scene_source',request});
    if(!receiving||this.session!==session||epoch!==this.epoch)throw Error('Late original source reply cannot overwrite a newer recovered Working admission');
    await receive(raw); // Raw outcome checkpointed before any ACK/Document admission.
    if(!receiving||this.session!==session||epoch!==this.epoch)throw Error('Original source callback closed during receipt retention');
    if(original&&current.last_request_id===request.expected_request_id){
     const result=selectedSourceLookupResult(raw,request);
     return {native_procedural_receipts:[],original_result:result}; // Zero NEW receipts; historical evidence remains intact.
    }
    return selectedSourceOrderedResult(raw,request,basis);
   };
   try{
    if(uncertainRecovery)await session.recoverNativeDocumentTransaction(async(context,request)=>{
     return await invoke(context,request) as import('./ql/instrument-session.mjs').NativeSelectedSceneSourceRecoveryResult;
    });
    else await session.nativeDocumentTransaction(context=>invoke(context),original?undefined:{selection:structuredClone(selection),lease:opened.lease,actor});
    if(localFailure)throw localFailure;
    if(this.session!==session||epoch!==this.epoch)throw Error('Original source observation belongs to a released native lifetime');
    if(uncertainRecovery){this.status=session.reading.held?'held':'following';this.reason=session.reading.reason;this.changed();}
    // Original actual Source1 result and its already-accounted SAME Session
    // remain private. This is not a caller-imported Source/receipt grant.
    const result=raw as any;
    if(result?.schema==='oi.native-expression-selected-scene-source/v1'&&result.original_request?.expected_request_id===session.reading.last_request_id){
     this.lastSourceTransaction=raw;
     this.selectedSourceAsset={session,epoch,opened,request:structuredClone(result.original_request),result:raw};
    }
    return raw;
   }catch(error){this.pausePendingPresentation(session);if(!session.reading.available){this.status='unavailable';this.reason=String(error);this.pause('native source receipt standing unknown');this.changed();}throw error;}
   finally{receiving=false;} // Ignored timeout callbacks cannot dispatch/adopt later.
  });
 }
sourceBootstrapReason(basis:{expression_ref:string;scene_ref:string}):string|null{
  const session=this.session,opened=this.opened;
  if(!session||!opened?.lease||this.admitting!==null||this.closing||!session.reading.available||typeof session.procedure!=='function')return 'Open the actual selected Scene World through its native owner before Source bootstrap.';
  if(opened.qualification!=='pending_source_bootstrap'||opened.source_current!==true||!opened.selected_scene)return 'This native owner has no current selected-Scene opening; no procedural Source was inferred from a generic composition.';
  if(opened.selected_scene.expression_ref!==basis.expression_ref||opened.selected_scene.scene_ref!==basis.scene_ref)return 'The current native Scene differs from this admitted original opening; use its actual owner before Source bootstrap.';
  if(this.contextLost||session.reading.pending_presentation)return 'Resolve the current retained field reception before another Source request.';
  return null;
 }
private pausePendingPresentation(session:InstrumentSession):boolean{
  if(!this.current(session)||!session.reading.available)return false;
  const pending=session.reading.pending_presentation;if(!pending)return false;
  this.pause('retained presentation blocked');this.status='held';this.reason=pending.reason;this.changed();return true;
 }
private receiverFailure(session:InstrumentSession,error:unknown,reason=String(error)){
  if(this.current(session)&&!this.pausePendingPresentation(session))this.hold(reason);
 }
private requirePresentationSettled(){
  const session=this.session;
  if(session&&this.pausePendingPresentation(session))throw new Error('Resolve the original retained presentation before another operation; retry it or explicitly Hold/Close');
 }
retryPresentation(){return this.serial(async()=>{
  const session=this.session;
  if(!session||typeof session.retryPresentation!=='function')throw new Error('Retained presentation retry requires the paired native session owner');
  if(this.contextLost||this.suspension||this.status==='unavailable'||!session.reading.pending_presentation)throw new Error('Original retained presentation is unavailable for this current owner');
  if(!(await this.waitIdle(session,5000))||!session.reading.pending_presentation)throw new Error('Original retained presentation is no longer current or the owner is busy');
  this.pause('explicit retained presentation retry');
  try{
   const reading=session.retryPresentation();
   if(!this.current(session))throw new Error('Retained presentation retry belongs to a released lifetime');
   this.status='held';this.reason='Retained field binding returned; resident GPU/body/audio observations remain separate. Resume explicitly.';this.changed();return reading;
  }catch(error){
   if(this.current(session)){this.status='held';this.reason=session.reading.pending_presentation?.reason??String(error instanceof Error?error.message:error);this.changed();}
   throw error;
  }
 });}
private async betweenOperations(session:InstrumentSession){
  const deadline=performance.now()+5000;
  while(this.operating){
   if(!this.current(session)||performance.now()>deadline)throw new Error('native owner busy; Document/procedure operation was not sent');
   await new Promise(resolve=>setTimeout(resolve,4));
  }
  if(!this.current(session))throw new Error('native operation belongs to a released lifetime');
 }
setProceduralContext(reader:NativeConductContextReader|null){this.proceduralContext=reader;}
procedure(request:Record<string,unknown>):Promise<Record<string,unknown>>{
  if(request.action==='source_bootstrap')return Promise.reject(new Error('Use the full Source bootstrap intent and native Working adoption route'));
  const intent=structuredClone(request);
  return this.serial(async()=>{
   const session=this.session;
   if(!session||this.admitting!==null||this.closing||!session.reading.available||typeof session.procedure!=='function')throw new Error('The actual native procedural session is unavailable');
   try{
    this.requirePresentationSettled();
    await this.betweenOperations(session);
    const result=await session.procedure(intent);
    if(!this.current(session))throw new Error('native procedure reply belongs to a released lifetime');
    this.changed();return result;
   }catch(error){
    this.pausePendingPresentation(session);
    if(this.current(session)&&!session.reading.available){this.status='unavailable';this.reason=session.reading.reason??String(error);this.pause('native owner unavailable');this.changed();}
    throw error;
   }
  });
 }
sourceBootstrap(command:NativeStageBootstrapCommand):Promise<unknown>{
  const captured=structuredClone(command);
  if(captured?.schema!=='ql.procedural-conduct/v1'||captured.action!=='source_bootstrap'||captured.input?.schema!=='oi.expression-procedural-source-bootstrap-intent/v1'||
   Object.keys(captured.input).sort().join(',')!=='authorship,operation_ref,scene_ref,schema')return Promise.reject(new Error('Only the exact original Source authoring intent reaches native bootstrap'));
  validateStageSourceAuthorship(captured.input.authorship);
  return this.serial(async()=>{
   const session=this.session;if(!session||this.admitting!==null||this.closing||!session.reading.available||typeof session.procedure!=='function')throw new Error('The actual private Source bootstrap session is unavailable');
   const invocation={command:captured,reply:null as unknown|null};this.bootstrapInvocation=invocation;
   try{
    this.requirePresentationSettled();
    await this.betweenOperations(session);await session.procedure(captured as unknown as Record<string,unknown>);
    if(!this.current(session)||this.bootstrapInvocation!==invocation||!invocation.reply)throw new Error('Source ACK returned but its original native wrapper/lifetime is unavailable');
    this.changed();return invocation.reply;
   }catch(error){
    this.pausePendingPresentation(session);
    // A known native refusal consumed the SAME session ordinal. Its original
    // wrapper still reaches Working; an unknown/malformed ACK never does.
    const raw=invocation.reply as {native_receipt?:any}|null,ack=raw?.native_receipt,reading=session.reading;
    if(this.current(session)&&this.bootstrapInvocation===invocation&&reading.available&&ack?.schema==='ql.field-host-receipt/v1'&&ack.available===true&&['ok','refused'].includes(ack.status)&&
     ack.instance_ref===reading.instance_ref&&ack.request_id===reading.last_request_id&&ack.last_request_id===reading.last_request_id&&ack.field?.event_ref===reading.event_ref&&ack.field?.subject_ref===reading.subject_ref&&
     ack.field?.generation===reading.acknowledged.generation&&ack.field?.samples_elapsed===reading.acknowledged.samples_elapsed&&Array.isArray(ack.field.audio)&&ack.field.audio.length===0){this.changed();return invocation.reply;}
    if(this.current(session)&&!session.reading.available){this.status='unavailable';this.reason=session.reading.reason??String(error);this.pause('native Source owner unavailable');this.changed();}
    throw error;
   }finally{if(this.bootstrapInvocation===invocation)this.bootstrapInvocation=null;}
  });
 }
sourceBootstrapRetry(intent:StageSourceBootstrapIntent):Promise<unknown>{
  const captured=structuredClone(intent),opened=this.opened,session=this.session;
  if(!opened||!session||!session.reading.available)return Promise.reject(new Error('Re-admit the actual native owner before a guarded Source cache lookup; unknown standing is retained'));
  validateStageSourceAuthorship(captured.authorship);
  return this.nativeDocumentTransaction(async()=>{
   if(this.opened!==opened||!this.current(session))throw new Error('The actual Source cache owner/lease changed');
   return this.port.request({operation:'procedural_source_bootstrap_retry',request:{schema:'oi.expression-procedural-source-bootstrap-retry/v1',lease:opened.lease,expression_ref:captured.basis.expression_ref,document_revision:captured.basis.document_revision,intent:{schema:'oi.expression-procedural-source-bootstrap-intent/v1',scene_ref:captured.basis.scene_ref,operation_ref:captured.operation_ref,authorship:captured.authorship}}});
  });
 }
setStageLibraryContext(reader:(()=>KernelConversion|null)|null){this.stageLibraryContext=reader;this.stageLibraryClient?.invalidate();}
private stageLibraryWitness():NativeStageClientWitness|null{
  const session=this.session,view=this.stageLibraryContext?.();
  if(!session||!view||!session.reading.available||this.admitting!==null||this.closing||this.suspension||this.dead)return null;
  const scene=view.document.scenes.find(row=>row.scene_ref===view.document.selection?.scene_ref);
  if(!scene)return null;
  const procedural=(scene.presentation as {scene?:{procedural?:{source_basis?:unknown}}}).scene?.procedural;
  return {owner:session,epoch:this.epoch,ordinal:session.reading.last_request_id,expression_ref:view.document.expression_ref,document_revision:view.document.revision,scene_ref:scene.scene_ref,source_basis:structuredClone(procedural?.source_basis??null)};
 }
private stageClient():NativeStageLibraryClient{
  return this.stageLibraryClient??=new NativeStageLibraryClient({witness:()=>this.stageLibraryWitness(),request:(request,receive)=>{
   if(request.operation!=='procedural_stage_capability')return this.stageCompilationRequest(request,receive);
   return this.nativeDocumentTransaction(async()=>{
    const epoch=this.epoch,session=this.session,raw=await this.port.request(request);
    if(receive)await receive(raw);
    if(epoch!==this.epoch||session!==this.session||this.dead)throw Error('Native Stage reply belongs to a released lifetime; original reply remains retained');
    return raw;
   });
  }});
 }
private stageCompilationRequest(request:Extract<NativeStageLibraryRequest,{request:StageLibraryIntent}>,receive?:((raw:unknown)=>Promise<void>)):Promise<unknown>{
  const original=structuredClone(request);
  return this.serial(async()=>{
   if(this.admitting!==null||this.closing)throw Error('The original native lifetime must settle before Stage compilation');
   const session=this.session,epoch=this.epoch,retry=original.operation==='procedural_stage_library_retry';
   let receiving=true,retained=false;
   const current=()=>receiving&&epoch===this.epoch&&session===this.session&&!this.dead;
   const retain=async(raw:unknown)=>{
    if(retained)throw Error('The original Stage callback may retain its raw reply only once');
    retained=true;
    // This callback belongs to the captured original Working checkpoint. Keep
    // its diagnostic result even after Session timeout or lifetime release;
    // Working checks its own epoch after persisting that original record.
    if(receive)await receive(raw);
    if(!current())throw Error('Native Stage lifetime changed during raw receipt retention');
   };
   try{
    if(!session){if(this.status!=='manual')throw Error('The original native Stage owner is unavailable');const raw=await this.port.request(original);await retain(raw);return raw;}
    this.requirePresentationSettled();await this.betweenOperations(session);
    const pending=session.reading.pending_stage_compilation;
    if(pending){
     if(!retry||pending.operation_ref!==original.request.operation_ref||!sceneSame(pending.basis,original.request.basis)||typeof session.recoverNativeStageCompilation!=='function')throw Error('Only the SAME Session original Stage compilation may be looked up; no fresh compilation is permitted');
     // Session uncertainty can precede the Channel's actual callback deadline.
     // Wait for that SAME issued callback, without spending a recovery attempt
     // or overlapping the original request with a pure lookup.
     const issued=this.stageCompilationCallback;
     if(issued){
      if(issued.session!==session||issued.epoch!==epoch)throw Error('The original Stage callback belongs to another lifetime');
      await issued.settled;
      if(!current())throw Error('The original Stage lifetime changed while its callback settled');
     }
    }else if(!session.reading.available)throw Error('Generic unknown native standing cannot recover a Stage compilation');
    if(retry&&!pending){
     // No in-flight private compilation exists in this Session. The native
     // original lookup does not create custody, ACK, Source or fresh permission.
     const raw=await session.nativeDocumentTransaction(async()=>{const raw=await this.port.request(original);await retain(raw);return raw as NativeDocumentTransactionResult;});
     if(!current())throw Error('Original Stage lookup returned after its lifetime changed');this.changed();return raw;
    }
    if(!this.port.requestStageCompilation||!this.port.consumeStageCompilationCompletion||typeof session.nativeStageCompilationTransaction!=='function')throw Error('The actual authenticated Stage completion/Session recovery interface is unavailable');
    const invoke=async(_context:NativeDocumentTransactionContext,sealed:import('./ql/instrument-session.mjs').NativeStageCompilationIntent)=>{
     if(!current()||!sceneSame(sealed,original.request))throw Error('Stage dispatch differs from the full private original intent');
     let settled!:()=>void;
     const callback={session,epoch,settled:new Promise<void>(resolve=>{settled=resolve;})};
     this.stageCompilationCallback=callback;
     try{const delivery=await this.port.requestStageCompilation!(nativeStageLibraryRequest(original.request,retry));await retain(delivery.raw);return delivery.completion;}
     finally{settled();if(this.stageCompilationCallback===callback)this.stageCompilationCallback=null;}
    };
    if(!pending)this.stageCompilationStanding={session,epoch,status:this.status,reason:this.reason};
    const standing=this.stageCompilationStanding;
    if(pending&&(!standing||standing.session!==session||standing.epoch!==epoch))throw Error('The original controller compilation standing is unavailable; no new owner or source was substituted');
    const raw=pending?await session.recoverNativeStageCompilation(invoke):await session.nativeStageCompilationTransaction(invoke,original.request);
    if(!current())throw Error('Original Stage compilation belongs to a released lifetime');
    // Preserve actual Performance/controller standing separately from FIELD
    // held state. This pure lookup never stops or relabels a native device.
    if(standing&&this.stageCompilationStanding===standing){this.status=standing.status;this.reason=standing.reason;this.stageCompilationStanding=null;}this.changed();return raw;
   }catch(error){
    if(session&&this.current(session)){this.pausePendingPresentation(session);if(!session.reading.available){this.status='unavailable';this.reason=session.reading.reason??String(error);this.pause('original Stage compilation unknown; lookup the SAME Session');this.changed();}}
    throw error;
   }finally{receiving=false;}
  });
 }
nativePreparedDefinition:NativeDefinitionPort=(target,capture,receive,original)=>{
  validateNativeDefinitionTarget(target);
  const selected=structuredClone(target),prior=original?structuredClone(original):undefined;
  return this.serial(async()=>{
   const session=this.session,opened=this.opened,epoch=this.epoch,view=this.stageLibraryContext?.();
   if(!session||!opened?.lease||!view||this.admitting!==null||this.closing||this.suspension||this.dead||view.document.expression_ref!==selected.basis.expression_ref||view.document.revision!==selected.basis.document_revision||view.document.selection?.scene_ref!==selected.basis.scene_ref)throw Error('The original selected Source/Document/SAME Session is unavailable for internal definition admission');
   if(prior&&prior.original_request.lease!==opened.lease)throw Error('The retained definition belongs to another native lease; no new owner or request was substituted');
   let receiving=true,retained=false;
   const current=()=>receiving&&epoch===this.epoch&&session===this.session&&opened===this.opened&&!this.dead;
   const retain=async(raw:unknown)=>{
    if(retained)throw Error('The original definition callback may retain its full raw outcome only once');
    retained=true;await receive(raw,!!prior);
    if(!current())throw Error('The original definition lifetime changed after raw receipt retention');
   };
   try{
    const pending=session.reading.pending_native_definition;
    if(prior){
     const issued=this.stageCompilationCallback;
     if(issued){if(issued.session!==session||issued.epoch!==epoch)throw Error('The original callback belongs to another lifetime');await issued.settled;if(!current())throw Error('Definition lifetime changed while its original callback settled');}
     if(pending&&(!sceneSame(pending.context,prior.context)||!sceneSame(pending.original_request,prior.original_request)))throw Error('The SAME Session retains another original definition');
    }else{
     if(pending||!session.reading.available)throw Error('An original native outcome is unknown; do not dispatch another definition');
     this.requirePresentationSettled();await this.betweenOperations(session);
    }
    if(!this.port.requestNativeDefinition||!this.port.consumeNativeDefinitionCompletion||typeof session.nativeDefinitionTransaction!=='function'||typeof session.recoverNativeDefinitionTransaction!=='function')throw Error('The actual authenticated native definition delivery/recovery interface is unavailable');
    const invoke=async(context:NativeDocumentTransactionContext,sealed:NativeDefinitionRequest)=>{
     const actual=validateNativeDefinitionRequest(selected,context,sealed);
     if(prior&&(!sceneSame(context,prior.context)||!sceneSame(actual,prior.original_request)))throw Error('Definition lookup changed the complete original request/context');
     if(!current())throw Error('The definition callback belongs to a released lifetime');
     if(!prior)await capture(context,actual);
     if(!current())throw Error('The original definition changed before dispatch; its captured intent remains retained');
     let settle!:()=>void;const callback={session,epoch,settled:new Promise<void>(resolve=>{settle=resolve;})};this.stageCompilationCallback=callback;
     try{
      const delivery=await this.port.requestNativeDefinition!({operation:prior?'procedural_definition_retry':'procedural_conduct',request:actual});
      await retain(delivery.raw);return delivery.completion;
     }finally{settle();if(this.stageCompilationCallback===callback)this.stageCompilationCallback=null;}
    };
    if(!prior)this.stageCompilationStanding={session,epoch,status:this.status,reason:this.reason};
    const standing=this.stageCompilationStanding;
    const intent={lease:opened.lease,expression_ref:selected.basis.expression_ref,document_revision:selected.basis.document_revision,source_producer_ref:selected.source_producer_ref,request:selected.request};
    const raw=prior?await session.recoverNativeDefinitionTransaction(invoke,prior.context,prior.original_request):await session.nativeDefinitionTransaction(invoke,intent);
    if(!current())throw Error('The original native definition returned after its lifetime was released');
    if(standing&&standing.session===session&&standing.epoch===epoch&&this.stageCompilationStanding===standing){this.status=standing.status;this.reason=standing.reason;this.stageCompilationStanding=null;}this.changed();return raw;
   }catch(error){
    if(this.current(session)){this.pausePendingPresentation(session);if(!session.reading.available){this.status='unavailable';this.reason=session.reading.reason??String(error);this.pause('original native definition unknown; recover the SAME request');this.changed();}}
    throw error;
   }finally{receiving=false;}
  });
 };
nativeStageCapabilityRead(basis:StudioBasis):Promise<StageCapability>{return this.stageClient().refresh(structuredClone(basis));}
nativeStageCapability(name:StageCapabilityName,basis:StudioBasis):StageCapability{return this.stageClient().capability(name,basis);}
nativeStageLibraryRequest(intent:StageLibraryIntent,retry:boolean,receive:(raw:unknown)=>Promise<void>):Promise<unknown>{
  const captured=structuredClone(intent);return retry?this.stageClient().retry(captured,receive):this.stageClient().prepare(captured,receive);
 }
stageAuthorshipRead(request:NativeStageAuthorshipRequest):Promise<unknown>{
  // This exact native readonly aperture is already inside U's serial source
  // qualification. Re-entering the normal serial barrier would deadlock.
  if(this.sourceAuthorshipWindow&&request.operation==='source_authorship')return this.readSelectedSourceAuthorship(request);
  const original=structuredClone(request),epoch=this.epoch;
  return this.nativeDocumentTransaction(async()=>{
   const result=await this.port.request(original);
   if(epoch!==this.epoch||this.dead)throw new Error('Native authoring read returned to a released lifetime');
   return result;
  });
 }
nativeDocumentTransaction(action:()=>Promise<unknown>):Promise<unknown>{
  if(typeof action!=='function')return Promise.reject(new Error('native Document action unavailable'));
  return this.serial(async()=>{
   if(this.admitting!==null||this.closing)throw new Error('The native owner lifetime must settle before an Expression Edit');
   const session=this.session;
   if(!session){if(this.status!=='manual')throw new Error('The native owner standing is unavailable');return action();}
   if(!session.reading.available||typeof session.nativeDocumentTransaction!=='function')throw new Error('The actual native Edit receipt reconciliation is not paired');
   try{
    this.requirePresentationSettled();
    await this.betweenOperations(session);
    // Runtime validation belongs to the actual session. No absent receipt list
    // is converted to [] and no document/state error discards a consumed ACK.
    const result=await session.nativeDocumentTransaction(async()=>await action() as NativeDocumentTransactionResult);
    if(!this.current(session))throw new Error('native Document reply belongs to a released lifetime');
    this.changed();return result;
   }catch(error){
    this.pausePendingPresentation(session);
    if(this.current(session)&&!session.reading.available){this.status='unavailable';this.reason=session.reading.reason??String(error);this.pause('native owner unavailable');this.changed();}
    throw error;
   }
  });
 }
private selectedSourceAsset:{session:InstrumentSession;epoch:number;opened:any;request:NativeSelectedSceneSourceRequest;result:unknown}|null=null;
}
