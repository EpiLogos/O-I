import {nativeAxisRequest,type NativeAxisPhase} from './axis';
import {SCENE_MATERIAL_STANDING,type NativeSceneMaterial} from './material';
import {projectNativeSources,editNativeBasis,NativeDomainReading,NativeBasisEdit} from './domain';
import {InstrumentSession} from './ql/instrument-session.mjs';
import {NativeProjection,type NativeTargetMap} from './projection';
import type {NativePort} from './channel';
import {applyPhysicalFormPose} from '../physicalFormActuator';
import {nativeActuatorStanding} from '../nativeActuatorStanding';
import {isScene,SCENE_PROVIDER,SCENE_INFLUENCE,eventFromSources,readScene,editSceneEvent,sceneCausalTrace,type SceneActing,type SceneEdit} from './scene';
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
export type QuietWorldCommand=
 |Readonly<{operation:'set-axis';axis:0|1;phase:NativeAxisPhase}>
 |Readonly<{operation:'set-damping';per_second:number}>
 |Readonly<{operation:'m1-advance';ticks:number}>;
export interface QuietWorldControlReceipt {
 readonly schema:'oi.quiet-world-control-receipt/v1';readonly lease:string;
 readonly command:QuietWorldCommand;readonly request_id:string;
 readonly source:unknown;readonly field:unknown;readonly influence:any;
 readonly closed:{schema:'oi.native-expression-closed/v1';lease:string;closed:true};
 readonly standing:'native determinant acknowledged and owner closed; GPU/audio reception not claimed';
}
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
class QuietWorldBasisChanged extends Error{}
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
/** The QL driver schedules PCM/targets; the app remains the sole GPU stage.
 * The controller owns admission/lifetime only, never native math or a second clock.
 * Determinant events (M1 advance, a changed event) go to the same serial owner;
 * the cadence is a request rate, never a local oscillator or tick model.
 */
export class NativeFieldController {
 private session:InstrumentSession|null=null;private projection:NativeProjection|null=null;
 private quietPending=false;
 private lastQuiet:Readonly<{schema:'oi.quiet-world-control-reading/v1';operation:QuietWorldCommand['operation'];lease:string;instance_ref:string;event_ref:string;subject_ref:string;request_id:string;generation:string;samples_elapsed:string;closed:true;standing:QuietWorldControlReceipt['standing']}>|null=null;
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
 private async readSources(session:InstrumentSession){
  const scope=this.exchangeScope(session);
  try{
   const sources=await session.inspect(),reply=this.takeAcknowledgedExchange(session,'inspect',scope),reading=session.reading;
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
  const clock=this.projection?.inspect().native?.clock??null;
  const trace=this.scene&&this.influenceReading
   ?{...sceneCausalTrace(this.influenceReading,this.acting,{following,muted:this.muted,targetsConnected:!!this.projection,clock}),
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
  quiet_control:this.lastQuiet,
  lifetime:{admission_pending:!!this.admission||this.quietPending,close_pending:!!this.closing,operation_pending:this.serialDepth+this.operating,close_error:this.closeFailure?.message??null,last_close:this.lastClose},
  playback_policy:{...this.playback,owner:'QL InstrumentSession / explicit application buffering; no sample-rate change'},
  renderer_requirements:this.renderer.retainedTopology?.()??null,
  presentation_mode:!this.projection?'manual':this.projection.scale===this.opened.presentation.units_per_metre?'domain-follow':'manual-presentation-override',
  presentation_units_per_metre:this.projection?.scale??null,
  presentation_level:{value:this.levelValue,...PRESENTATION_LEVEL},
  native:this.session?.reading??this.lastNative,muted:this.muted,
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
 /** A policy/phase edit from another Scene has no authority to travel,
  * reopen its private body, or borrow its particles as the cosmic torus.
  * Use the SAME native constructor/host operations quietly, then close that
  * exact owner before returning its receipt to the existing native CAS.
  * This accepts native state only; ordinary cosmic entry proves receiving. */
 operateWorldQuiet(options:{world:NativeWorldInput;skySnapshot:NativeSkySnapshot;snapshotPurpose:'retained-occasion'},submitted:QuietWorldCommand,isCurrent:()=>boolean):Promise<QuietWorldControlReceipt>{
  if(this.quietPending)return Promise.reject(new Error('The current quiet world operation is still being acknowledged.'));
  const command:QuietWorldCommand=submitted.operation==='set-axis'
   ?{operation:'set-axis',...nativeAxisRequest(submitted.axis,submitted.phase)}
   :submitted.operation==='m1-advance'?(()=>{if(!Number.isInteger(submitted.ticks)||submitted.ticks<1||submitted.ticks>1e6)throw Error('M1 ticks must be within 1–1000000');return{operation:'m1-advance' as const,ticks:submitted.ticks};})()
   :(()=>{if(submitted.operation!=='set-damping'||!Number.isFinite(submitted.per_second)||submitted.per_second<0||submitted.per_second>1e6)throw Error('Damping must be finite and in 0..1000000 per second');return{operation:'set-damping' as const,per_second:submitted.per_second};})();
  this.quietPending=true;this.lastQuiet=null;this.changed();
  return this.serial(async()=>{
   const epoch=this.epoch;
   const requireCurrent=()=>{if(this.dead||this.epoch!==epoch||this.status!=='manual'||this.session||this.opened||this.projection||this.admission||this.closing||this.suspension||this.closeFailure||!isCurrent())throw new QuietWorldBasisChanged('The world, selected Scene or native lifetime changed before its quiet control completed. No continuation was adopted.');};
   requireCurrent();
   const topology=this.renderer.retainedTopology?.();
   if(!topology)throw Error('The actual production field must be live before a quiet world control.');
   let opened:any=null,result:Omit<QuietWorldControlReceipt,'closed'>|null=null;
   let cursorField:any=null,sequence=0n,knownRefusal=false;
   const reading=(field:any)=>({instance_ref:options.world.instance_ref,event_ref:options.skySnapshot.snapshot_ref,subject_ref:options.world.subject_ref,acknowledged:{generation:field?.generation,samples_elapsed:field?.samples_elapsed}});
   // Complete native bodies are checked in place, not cloned into a private
   // identity, renderer, or metadata store. No numerical quantity is solved.
   const field=(value:any,previous?:any,shapeMayChange=false)=>{
    const r=reading(value);
    sceneNeed(sceneObject(value)&&value.schema==='ql.continuous-field/v1'&&value.event_ref===r.event_ref&&value.subject_ref===r.subject_ref&&value.sample_rate===SCENE_SAMPLE_RATE&&value.presentation_units_per_metre===1&&sceneU64(value.generation)&&sceneU64(value.samples_elapsed),'quiet owner field/identity/cursor unavailable');
    for(const key of ['registry_revision','geometry_ref','material_ref','model_ref','shape_ref','standing'])sceneNeed(sceneText(value[key]),'quiet field source omitted '+key);
    sceneNeed(Array.isArray(value.audio)&&value.audio.length===0,'quiet operation produced an unrequested audio interval');
    sceneNeed(Array.isArray(value.amplitudes_metres)&&value.amplitudes_metres.length===9&&value.amplitudes_metres.every((z:any)=>Array.isArray(z)&&z.length===2&&z.every((v:any)=>Number.isFinite(v)&&Math.abs(v)<=3e38)),'quiet field omitted its complete nine amplitudes');
    sceneNeed(Array.isArray(value.targets)&&value.targets.length>=16&&value.targets.length<=Math.floor(262144/9),'quiet field has an unsupported target domain');
    for(let i=0;i<value.targets.length;i++){
     const target=value.targets[i];
     sceneNeed(sceneObject(target)&&Number.isSafeInteger(target.identity)&&target.identity>=0&&(i===0||target.identity>value.targets[i-1].identity)&&sceneText(target.constituent)&&Array.isArray(target.position)&&target.position.length===3&&target.position.every((v:any)=>Number.isFinite(v)&&Math.abs(v)<=3e38),'quiet field target identity/source/position unavailable');
     if(previous)sceneNeed(target.identity===previous.targets[i]?.identity&&target.constituent===previous.targets[i]?.constituent,'quiet field changed sample identity or constituent');
    }
    if(previous){
     sceneNeed(value.targets.length===previous.targets.length,'quiet field changed topology');
     for(const key of ['event_ref','subject_ref','registry_revision','geometry_ref','material_ref','model_ref',...(shapeMayChange?[]:['shape_ref']),'sample_rate','presentation_units_per_metre','standing'])sceneNeed(sceneSame(value[key],previous[key]),'quiet field changed '+key);
    }
    return value;
   };
   const exchange=async(cmd:any)=>{
    requireCurrent();sceneNeed(sequence+1n<(1n<<64n),'quiet native request sequence exhausted');
    const request={schema:'ql.field-host-request/v1',instance_ref:options.world.instance_ref,event_ref:options.skySnapshot.snapshot_ref,subject_ref:options.world.subject_ref,request_id:(sequence+1n).toString(),expected_generation:cursorField.generation,expected_samples_elapsed:cursorField.samples_elapsed,command:cmd};
    const reply=await this.port.request({operation:'exchange',lease:opened.lease,request});
    sceneNeed(reply?.schema==='ql.field-host-receipt/v1'&&reply.instance_ref===request.instance_ref&&reply.request_id===request.request_id&&reply.last_request_id===request.request_id&&reply.available===true&&(reply.status==='ok'||reply.status==='refused'),'quiet acknowledgement differs from this exact request');
    const next=field(reply.field,cursorField,cmd.operation==='m1-advance');sequence++;
    if(reply.status==='refused'){
     sceneNeed(sceneSame(next,cursorField),'refused quiet operation changed the complete native field');knownRefusal=true;
     throw Error(sceneText(reply.error)?reply.error:'The native quiet operation was refused.');
    }
    const changing=cmd.operation==='set-axis'||cmd.operation==='set-damping'||cmd.operation==='m1-advance';
    const delta=BigInt(next.generation)-BigInt(cursorField.generation);
    sceneNeed((cmd.operation==='m1-advance'?(delta===2n||delta===3n):delta===(changing?1n:0n))&&next.samples_elapsed===cursorField.samples_elapsed,'quiet native operation changed an unrequested clock/interval');
    if(!changing)sceneNeed(sceneSame(next,cursorField),'quiet Inspect/influence changed the complete native field');
    cursorField=next;return reply;
   };
   const inspect=async()=>{
    const reply=await exchange({operation:'inspect'}),r=reading(cursorField);
    const domain=projectNativeSources(reply.sources,{event_ref:r.event_ref,subject_ref:r.subject_ref,generation:r.acknowledged.generation});
    sceneNeed(isScene(reply.sources),'quiet Inspect did not return the complete Scene sources');
    const influence=qualifySceneInfluence(copySceneMetadata(reply.influence,'influence'),cursorField,r,domain,reply.sources);
    const event=copySceneMetadata(reply.event,'event');if(!Object.prototype.hasOwnProperty.call(event,'sky_frequency_bindings'))event.sky_frequency_bindings=[];
    sceneNeed(sceneSame(event,eventFromSources(reply.sources)),'quiet Inspect event differs from its actual complete sources');
    readScene(reply.sources,influence,opened.source);return influence;
   };
   try{
    opened=await this.port.request({operation:'compose',request:this.composeRequest(topology,options)});
    sceneNeed(opened?.schema==='oi.native-expression-open/v1'&&sceneText(opened.lease),'quiet compose omitted its exact owned lease');
    requireCurrent();
    sceneNeed(opened.receipt?.schema==='ql.field-host-receipt/v1'&&opened.receipt.status==='ready'&&opened.receipt.available===true&&opened.receipt.instance_ref===options.world.instance_ref&&sceneU64(opened.receipt.last_request_id),'quiet compose did not acknowledge this instance');
    sceneNeed(opened.source?.schema==='oi.native-expression-composed-source/v1'&&opened.source.world?.schema==='ql.scene-world/v1'&&opened.source.world.instance_ref===options.world.instance_ref&&opened.source.world.subject_ref===options.world.subject_ref&&opened.source.world.event_ref===options.skySnapshot.snapshot_ref&&opened.source.world.snapshot_ref===options.skySnapshot.snapshot_ref,'quiet constructor returned another person or occasion');
    cursorField=field(opened.receipt.field);sequence=BigInt(opened.receipt.last_request_id);
    const beforeField=cursorField,beforeInfluence=await inspect();
    const acknowledgement=await exchange(command),commandId=acknowledgement.request_id;
    qualifySceneInfluence(copySceneMetadata(acknowledgement.influence,'influence'),cursorField,reading(cursorField));
    const inspected=await inspect();
    // M1 replaces the modes, optionally their actual shape, then advances the
    // inscription axis (scene_field::m1_advance). Exact native receipts must
    // account for every one of those admitted worker generations.
    const increase=command.operation==='m1-advance'?2n+(!sceneSame(beforeInfluence.shape_ref,inspected.shape_ref)||!sceneSame(beforeInfluence.voices,inspected.voices)?1n:0n):1n;
    sceneNeed(BigInt(cursorField.generation)===BigInt(beforeField.generation)+increase,'quiet native generation does not account for this exact determinant');
    const fresh=await exchange({operation:'influence'});
    const influence=qualifySceneInfluence(copySceneMetadata(fresh.influence,'influence'),cursorField,reading(cursorField));
    sceneNeed(sceneSame(influence,inspected),'quiet influence differs from its fresh actual Inspect');
    requireCurrent();
    result={schema:'oi.quiet-world-control-receipt/v1',lease:opened.lease,command,request_id:commandId,source:opened.source,field:cursorField,influence,standing:'native determinant acknowledged and owner closed; GPU/audio reception not claimed'};
   }catch(error){
    // A known refusal is still a refused operation. An unknown reply cannot
    // be retried or displayed as an accepted current reading.
    if(this.epoch===epoch&&!this.dead){this.refusal={operation:'quiet '+command.operation,reason:String(error instanceof Error?error.message:error),at:Date.now()};if(!knownRefusal&&!(error instanceof QuietWorldBasisChanged)){this.status='unavailable';this.reason=this.refusal.reason;}this.changed();}
    throw error;
   }finally{
    // A superseded UI basis may still receive its native open late. Close only
    // the exact returned owned lease; never another manager lifetime.
    if(opened){try{await this.closeOwner(opened);sceneNeed(opened.closed===true&&this.lastClose?.lease===opened.lease,'quiet owner close acknowledgement unavailable');}catch(error){if(this.epoch===epoch&&!this.dead){this.status='unavailable';this.reason='native quiet release acknowledgement unknown: '+String(error);this.changed();}throw error;}}
   }
   if(!result||!this.lastClose)throw Error('The quiet native operation has no complete closed receipt.');
   this.lastQuiet={schema:'oi.quiet-world-control-reading/v1',operation:command.operation,lease:result.lease,instance_ref:options.world.instance_ref,event_ref:options.skySnapshot.snapshot_ref,subject_ref:options.world.subject_ref,request_id:result.request_id,generation:cursorField.generation,samples_elapsed:cursorField.samples_elapsed,closed:true,standing:result.standing};this.changed();
   return{...result,closed:{...this.lastClose}};
  }).finally(()=>{this.quietPending=false;this.changed();});
 }
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
 private admit(sampleRate:number,open:()=>Promise<any>,entityTargetBindings?:EntityTargetBindings){
  if(this.admission)return Promise.reject(new Error('the previous native admission has not settled'));
  const admission=this.admitOwner(sampleRate,open,entityTargetBindings);this.admission=admission;
  return admission.finally(()=>{if(this.admission===admission)this.admission=null;});
 }
 private async admitOwner(sampleRate:number,open:()=>Promise<any>,entityTargetBindings?:EntityTargetBindings){
  if(this.closeFailure)throw new Error('native release acknowledgement unknown: '+this.closeFailure.message);
  if(this.dead||this.status==='opening'||this.session||this.closing||this.suspension||this.quietPending)throw new Error('release the current native owner and instrument suspension before opening another');
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
   this.projection=new NativeProjection(stage,opened.receipt.field,presentation);
   this.renderer.setNativeDomain(true);
   let session:InstrumentSession;
   const transport={request:async(request:any)=>{
    const serial=++this.exchangeSerial;this.exchangeReceipt=null;
    if(epoch!==this.epoch||this.opened!==opened||!this.current(session))throw new Error('native request belongs to a released lifetime');
    const sent=structuredClone({schema:request.schema,instance_ref:request.instance_ref,event_ref:request.event_ref,subject_ref:request.subject_ref,
     request_id:request.request_id,expected_generation:request.expected_generation,expected_samples_elapsed:request.expected_samples_elapsed,command:{operation:request.command?.operation}});
    const reply=await this.port.request({operation:'exchange',lease:opened.lease,request});
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
   },close:()=>{void this.closeOwner(opened).catch(()=>{});}};
   session=new InstrumentSession({...this.playback,context:this.stage(context),owner:this.renderer,initialReceipt:opened.receipt,
    transport,fieldBinding:this.projection,muted:true});this.session=session;
   this.recovery=this.renderer.onRetainedRecoveryRequired(state=>{this.contextLost=state==='lost';this.hold(`GPU context ${state}; explicit same-state checkpoint recovery or disconnect required`);});
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
  if(paused&&!this.suspension&&this.status==='opening'&&!this.openingHold)this.hold('application paused during native admission');
  if(paused&&!this.suspension&&this.session&&this.status==='following')this.hold('application paused or hidden');
  if(this.session){
   const reading=this.session.reading;
   if(!reading.available&&this.status!=='unavailable'){this.status='unavailable';this.reason=reading.reason??'native acknowledgement unavailable';this.pause('owner unavailable');this.changed();}
   else if(reading.held&&this.status==='following'){this.status='held';this.reason=reading.reason??'native/audio owner held';this.changed();}
   if(this.status==='following'){try{this.session.present();}catch(error){this.hold(String(error));}}
  }
  return this.status==='manual'?delta:this.status==='following'?delta:0;
 }
 hold(reason='manual hold'){
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
 private finishCommand(session:InstrumentSession,following:boolean,revision:number,reason:string){
  if(!this.current(session))throw new Error('native operation belongs to a released lifetime');
  this.checkpoint=null;
  if(following&&revision===this.holdRevision&&!this.contextLost&&!this.suspension){this.status='following';this.reason=null;session.start();this.changed();}
  else{session.hold(this.reason??reason);this.status='held';this.reason??=reason;this.changed();}
 }
 resume(){return this.resumeAt(this.epoch,this.holdRevision);}
 private resumeAt(epoch:number,revision:number){return this.serial(async()=>{
  const permitted=()=>epoch===this.epoch&&revision===this.holdRevision&&!this.suspension&&!this.dead;
  if(!permitted())return;
  const session=this.session;if(!session)throw new Error('native owner unavailable');
  try{
   if(this.contextLost)throw new Error('GPU context is unavailable');
   if(this.reason?.startsWith('GPU context'))throw new Error('restore a same-state GPU checkpoint before resuming, or disconnect');
   await this.context?.resume();await this.idle();
   if(!this.current(session))throw new Error('native resume belongs to a released lifetime');
   if(!permitted())return;
   await session.recover('explicit native resume');
   this.finishCommand(session,true,revision,'resume interrupted by a newer hold');
  }catch(error){if(this.current(session))this.hold(String(error));throw error;}
 });}
 setAxis(axis:0|1,phase:NativeAxisPhase){const request=nativeAxisRequest(axis,phase);return this.operate({operation:'set-axis',...request});}
 operate(command:unknown){return this.serial(async()=>{
  const following=this.status==='following';this.hold('native operation');const revision=this.holdRevision;
  const session=await this.idle();
  try{
   await session.recover('native operation admission');const result=await session.operate(command);
   this.invalidateCurrentReading('native operation acknowledged; complete reading awaits fresh Inspect');
   await this.readSources(session);if(this.scene)await this.readInfluence(session);
   await session.recover('native operation readback admitted; rebase device only');
   this.finishCommand(session,following,revision,'native operation applied while held; resume explicitly');return result;
  }catch(error){if(this.current(session))this.hold(String(error));throw error;}
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
  const session=this.session;
  if(!session||!this.scene||this.influenceStale||!this.influenceReading)return Promise.reject(new Error('A complete current Scene influence must be admitted before determinant events'));
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
      if(this.current(session)){this.acknowledgedSceneEvent();this.invalidateCurrentReading(error);this.hold(`native event acknowledged; presentation/read unavailable: ${String(error)}`);}
      return; // Cadence counts the native commit; this is not a refused event.
     }
     if(!(cadence&&TRANSIENT.test(String(error))))this.refused(operation,error,session);throw error;
    }
    finally{this.operating--;}
   };
   return cadence?live():this.serial(live);
  }
  return this.serial(async()=>{
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
     if(this.current(held)){this.acknowledgedSceneEvent();this.invalidateCurrentReading(error);this.hold(`native event acknowledged; presentation/read unavailable: ${String(error)}`);}
     return;
    }
    if(this.refused(operation,error,held)){held.hold(prior??'determinant refused');this.status='held';this.reason=prior??'determinant refused';this.changed();}
    else if(this.current(held))this.hold(String(error));
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
  const session=this.session;if(!session||!this.scene)throw new Error('influence belongs to a scene owner');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy');return this.readInfluence(session);}
  this.hold('native influence reading');const held=await this.idle();
  try{await held.recover('native influence reading');return await this.readInfluence(held);}
  finally{if(this.current(held))this.hold('influence reading complete; resume explicitly');}
 });}
 /** Human-cadence source refresh after determinant events; never while an event
  * is in flight, never while held. */
 async refreshSources(){
  const session=this.session;
  // A complete source read is large (the whole coupled basis); while a cadence
  // plays it yields to the ticks and runs at most every 5 s.
  if(session&&this.scene&&this.influenceStale&&this.status==='following'&&!this.suspension&&!this.operating&&!this.serialDepth){
   this.operating++;
   try{if(await this.waitIdle(session,100)&&this.status==='following'){await this.readInfluence(session);this.changed();}}
   catch{}finally{this.operating--;}
  }
  if(!session||!this.scene||!this.sourcesStale||this.status!=='following'||this.suspension||this.operating||this.serialDepth||performance.now()-this.lastInspect<(this.cadence?5000:1500))return false;
  this.operating++;
  try{if(!(await this.waitIdle(session,100))||this.status!=='following')return false;await this.readSources(session);this.changed();return true;}
  catch{return false;}
  finally{this.operating--;}
 }
 /** Explicit cadence: serial m1-advance requests at a source-cited rate. A beat
  * is skipped while the owner is busy, suspended while held/hidden/unavailable,
  * and the cadence stops on release or refusal. */
 play(ticksPerSecond:number){
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
 inspectSources(){return this.serial(async()=>{
  this.hold('native source inspection');const session=await this.idle();
  try{await session.recover('native source inspection');return await this.readSources(session);}
  finally{if(this.current(session))this.hold('source inspection complete; resume explicitly');}
 });}
 editBasis(edit:NativeBasisEdit){return this.serial(async()=>{
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
  }catch(error){if(this.current(session))this.hold(String(error));throw error;}
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
 saveCheckpoint(){return this.serial(async()=>{
  this.hold('checkpoint hold');const session=await this.idle();await session.recover('checkpoint current cursor');this.hold('checkpoint hold');
  if(!this.current(session))throw new Error('checkpoint belongs to a released lifetime');
  this.checkpoint=this.renderer.checkpointRetainedField(this.projection);this.changed();return {schema:this.checkpoint.schema,receipt:this.checkpoint.receipt,width:this.checkpoint.width,height:this.checkpoint.height};
 });}
 restoreCheckpoint(){return this.serial(async()=>{
  if(!this.checkpoint||this.contextLost)throw new Error('same-live-state checkpoint or restored GPU unavailable');
  const session=await this.idle();if(!this.current(session))throw new Error('checkpoint belongs to a released lifetime');this.renderer.restoreRetainedField(this.projection,this.checkpoint);this.reason='checkpoint restored; resume explicitly';this.status='held';this.changed();
 });}
 inspectTargets(){return this.projection?.inspect()??null;}
 release(manual=true){return this.releaseLifetime(manual,true);}
 private async releaseLifetime(manual:boolean,settleAdmission:boolean){
  this.pause('released');
  const epoch=++this.epoch;const session=this.session;this.lastNative=session?.reading??this.lastNative;
  this.session=null;session?.dispose();this.recovery?.();this.recovery=null;
  this.renderer.releaseRetainedField();this.renderer.setNativeDomain(false);this.projection?.dispose();this.projection=null;
  const context=this.context;this.context=null;const opened=this.opened;this.opened=null;this.checkpoint=null;this.contextLost=false;
  this.sources=null;this.domain=null;this.openingHold=null;
  this.scene=false;this.ownerKind=null;this.exchangeReceipt=null;this.readingError=null;this.influenceReading=null;this.acting=null;this.event=null;this.opening=null;this.sourcesStale=false;this.influenceStale=false;this.level=null;
  this.admitting=null;this.suspension=null;this.restoring=null;
  if(manual){this.status='manual';this.lastNative=null;this.reason=null;this.refusal=null;this.lastCadence=null;this.changed();}
  const admission=settleAdmission?this.admission:null;
  const pending=this.pending;
  const close=async()=>{
   const results=await Promise.allSettled([context&&context.state!=='closed'?context.close():Promise.resolve(),this.closeOwner(opened),admission??Promise.resolve()]);
   await pending;
   while(this.operating)await new Promise(resolve=>setTimeout(resolve,8));
   const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');
   if((failure||this.closeFailure)&&epoch===this.epoch){this.reason=`native release acknowledgement unknown: ${String(failure?.reason??this.closeFailure?.message)}`;this.changed();}
  };
  const closing=close();this.closing=closing;
  try{await closing;}finally{if(this.closing===closing)this.closing=null;}
 }

 async dispose(){if(this.dead)return;this.dead=true;await this.release();this.port.dispose();}
}
