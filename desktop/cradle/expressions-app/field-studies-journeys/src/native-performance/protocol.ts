import {readLiveTemporalProgress,type NativeLiveTemporalProgress} from './temporalCapture.js';
/** Native management projection. These packets are emitted by the retained
 * QL owner, reached through NativeFieldController's serial exchange. Browser
 * state holds copied readings and input lifetimes, never audio time or tuning. */
export type Counter = string;
export interface PerformanceScope {
 instance_ref:string; event_ref:string; subject_ref:string;
 m1_revision:Counter; m2_generation:Counter; body_revision:Counter;
 preparation_ref:string; state_ref:string;
}
export interface NativeKey {
 row:number; column:number; register_octave:number; key:number;
 pitch_class:number; label:string; available:boolean; hertz:number|null; coordinate:string|null;
 face:0|1|null; source_degree:number|null; reason:string|null;
 reduction_policy:string; source_collection:string; source_receipt:string;
 ratio:{numerator:Counter;denominator:Counter}|null;
}
export interface NativeParameter {
 target_ref:string; action_ref:string; native_owner:string; label:string;
 group:'excitation'|'material'|'boundary'|'modulation'|'receiving'|'mixer';
 scope:'note'|'instrument'|'body'|'context'|'presentation';
 unit:string; minimum:number; maximum:number; baseline:number; effective:number;
 smoothing_samples:Counter; route_ref:string|null;
 sample_rate?:Counter;
 capabilities:('set'|'undo'|'clear'|'learn')[]; unavailable_reason:string|null;
}
export interface NativeDevice {
 id:number; uid:string; name:string; default_output:boolean; alive:boolean;
 output_channels:number; nominal_rate:number; buffer_frames:number;
}
export interface NativeDeviceReading {
 state:'closed'|'prepared'|'running'|'recovering'|'lost'|'failed';
 backend:string; device_id:number|null; client_rate:number; hardware_rate:number;
 buffer_frames:number; reported_output_latency_ms:number;
 sample_rate_conversion:boolean; error:string|null;
 start_epoch:Counter; start_callback_baseline:Counter;
 callbacks:Counter; callback_failures:Counter; underruns:Counter|null; overload_notifications:Counter;
 capture_drops:Counter; timestamp_discontinuities:Counter;
 physical_latency_measurement:'unexecuted'|'measured';
}
export interface NativePhysicalReading {
 sample_rate?:number;
 preparation_ref:string; state_ref:string; body_revision:Counter; eigenbasis_identity?:string;
 samples_elapsed:Counter; source_generation:Counter; node_ids:Counter[];
 positions_metres:[number,number,number][]; pickup_linear:number; energy_joules:number;
}
export interface NativePerformanceReading {
 schema:'ql.performance-management/v1'; session_ref:string; scope:PerformanceScope;
 live_temporal?:NativeLiveTemporalProgress;
 instrument_parameter_ramps?:NativeInstrumentParameterRamp[];
 transport_epoch:Counter;
 body_source:{kind:'sourceForm'|'referenceMetric';recipe_ref:string|null;validated_m3_generation:Counter|null};
 samples_elapsed:Counter; accepted_sequence:Counter; available:boolean; reason:string|null;
 capabilities:string[]; keys:NativeKey[]; transpose:number;
 parameters:NativeParameter[]; devices:NativeDevice[]; device:NativeDeviceReading;
 physical:NativePhysicalReading; active_voices:number; active_touches:number;
 sustain:boolean; peak_linear:number; rms_linear:number; clipping_samples:Counter;
 excitation:{policy_ref:string;standing:string;audio_octet_hz:number[];nodal_quartet:{position:0|5;face:0|1;m:number;n:number}[]};
}
/** Enum order comes from the same Engine's fixed native parameter table. */
export const nativeInstrumentRampTargets=Object.freeze(['force-newtons','attack-seconds','release-seconds','cutoff-hertz','master-linear','body-linear','monitor-linear'].map(name=>'ql:performance/parameter/'+name));
export interface NativeInstrumentParameterRamp {start_value:number;target_value:number;start_sample:Counter;duration_samples:Counter;remaining_samples:Counter}
export interface NativeCurrentOutputCalibration {schema:'ql.native-current-output-calibration-declaration/v1';required:boolean;operation:'calibrate-current'|null;timing:'after-original-recording-birth-before-first-native-input';standing:string}
export type NativePerformanceCommand =
 | {operation:'calibrate-current'}
 | {operation:'performance-inspect'}
 | {operation:'performance-gesture';phase:'press';input_ref:string;row:number;column:number;velocity:number}
 | {operation:'performance-gesture';phase:'release';input_ref:string}
 | {operation:'performance-gesture';phase:'expression';input_ref:string;pressure:number}
 | {operation:'performance-sustain';down:boolean}
 | {operation:'performance-panic';reason:string}
 | {operation:'performance-hold';reason:string}
 | {operation:'performance-transpose';semitones:number}
 | {operation:'performance-parameter';target_ref:string;action:'set';value:number}
 | {operation:'performance-parameter';target_ref:string;action:'undo'|'clear'|'learn'}
 | {operation:'performance-device-enumerate'}
 | {operation:'performance-device-open';device_id:number;sample_rate:48000;buffer_frames:128|256}
 | {operation:'performance-device-start'|'performance-device-stop'|'performance-device-recover'|'performance-device-close'};
export interface NativePerformanceReply {
 schema:'ql.performance-management-reply/v1'; operation:NativePerformanceCommand['operation'];
 accepted:boolean; refusal:{code:string;reason:string}|null; reading:NativePerformanceReading;
 transport_transition:NativeTransportAcknowledgement|null;
 admission:null|{sequence:Counter;sample:Counter;input_ref:string|null;touch_ref:string|null;
  clock:'native-output'|'stopped';mapping_uncertainty_samples:number};
}
export interface NativeTransportAcknowledgement {
 previous_epoch:Counter;epoch:Counter;previous_cursor:Counter;previous_sequence:Counter;
 target_sample:Counter;accepted_sequence:Counter;transaction_ref:string;checkpoint_ref:string;
}
export interface NativePerformanceUpdate {
 schema:'ql.performance-management-update/v1'; reading:unknown;
 transport_transition:NativeTransportAcknowledgement|null;
}
/** The existing serial owner supplies this seam. It owns the lease, outer
 * request ID/source CAS and AUHAL timestamp; the client creates none of them. */
export interface NativeOutputCalibrationState {declaration:NativeCurrentOutputCalibration;stage:'queued'|'applied'|'not-required';admission_sequence:Counter|null;effective_force_newtons:number|null}
/** Historical acknowledgement of this controller's actual original Start.
 * This local observer seam is not a native wire command or current-source grant. */
export interface NativePerformanceTransportObservation {lease:string;request_id:Counter;reading:NativePerformanceReading;transport_transition:NativeTransportAcknowledgement|null}
export interface NativePerformanceExchange {
 /** Preserve the exact original transport boundary while currentness is pending. */
 transportObservation?():NativePerformanceTransportObservation|null;
 /** Actual original native declaration, queue and observed callback application. */
 outputCalibration?():NativeOutputCalibrationState|null;
 readonly current:boolean;
 /** Existing controller capture contract may restrict an otherwise native capability. */
 supports(operation:NativePerformanceCommand['operation']):boolean;
 exchange(command:NativePerformanceCommand):Promise<unknown>;
 /** Copied actual callback/control readbacks on the existing native pulse. */
 subscribe(listener:(update:NativePerformanceUpdate)=>void):()=>void;
 /** Existing native owner holds/panics on a rejected source/readback. */
 holdPerformance(reason:string):void;
}
const admittedReadings=new WeakSet<object>();
/** Native readbacks are bounded pure JSON. Clone BEFORE validation, rejecting
 * accessors/prototypes/cycles/non-JSON values; freeze every validated descendant
 * before branding. The admitted object can never be changed after validation. */
function cloneBoundedJson(value:unknown):unknown {
 let nodes=0,characters=0;const ancestors=new Set<object>();
 function copy(v:unknown,depth:number):unknown {
  if(++nodes>32768||depth>24)throw Error('Native reading exceeds the JSON admission bound.');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string'){characters+=v.length;if(characters>4*1024*1024)throw Error('Native reading text exceeds the admission bound.');return v;}
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Native JSON number is not finite.');return v;}
  if(typeof v!=='object'||!v)throw Error('Native reading contains a non-JSON value.');
  if(ancestors.has(v))throw Error('Native reading contains a cycle.');
  const prototype=Object.getPrototypeOf(v);if(prototype!==(Array.isArray(v)?Array.prototype:Object.prototype)&&prototype!==null)throw Error('Native reading has a non-JSON prototype.');
  ancestors.add(v);let out:unknown;
  if(Array.isArray(v)){if(v.length>512)throw Error('Native reading array exceeds its bound.');const next:unknown[]=[];for(let i=0;i<v.length;i++){const descriptor=Object.getOwnPropertyDescriptor(v,String(i));if(!descriptor||!('value'in descriptor))throw Error('Native array contains a hole/accessor.');next.push(copy(descriptor.value,depth+1));}if(Reflect.ownKeys(v).some(key=>key!=='length'&&!(typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<v.length)))throw Error('Native array contains non-JSON properties.');out=next;}
  else{const next:Record<string,unknown>={};for(const key of Reflect.ownKeys(v)){if(typeof key!=='string')throw Error('Native reading contains symbol properties.');characters+=key.length;if(key.length>2048||characters>4*1024*1024)throw Error('Native reading key/text exceeds its admission bound.');const descriptor=Object.getOwnPropertyDescriptor(v,key);if(!descriptor||!descriptor.enumerable||!('value'in descriptor))throw Error('Native reading contains an accessor/non-JSON property.');Object.defineProperty(next,key,{value:copy(descriptor.value,depth+1),enumerable:true,writable:true,configurable:true});}out=next;}
  ancestors.delete(v);return out;
 }
 return copy(value,0);
}
function freezeJson<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))freezeJson(child);Object.freeze(value);}return value;}
/** Called by the installed actual-native proof owner on the REAL parsed
 * reading. This rejects mutation without substituting any native response. */
export function inspectAdmittedReadingImmutability(reading:NativePerformanceReading){
 assertAdmittedPerformanceReading(reading);const original={sample:reading.samples_elapsed,event:reading.scope.event_ref,position:reading.physical.positions_metres[0]?.[0]};
 const attempts={cursor:Reflect.set(reading,'samples_elapsed','0'),source:Reflect.set(reading.scope,'event_ref','wrong:mutated-source'),positions:reading.physical.positions_metres.length?Reflect.set(reading.physical.positions_metres[0],0,12345):false};
 if(Object.values(attempts).some(Boolean)||reading.samples_elapsed!==original.sample||reading.scope.event_ref!==original.event||reading.physical.positions_metres[0]?.[0]!==original.position)throw Error('An admitted native reading remained mutable.');
 return{owner:'actual-admitted-native-reading',session_ref:reading.session_ref,transport_epoch:reading.transport_epoch,samples_elapsed:reading.samples_elapsed,scope:reading.scope,attempts,deeply_frozen:Object.isFrozen(reading)&&Object.isFrozen(reading.scope)&&Object.isFrozen(reading.physical.positions_metres)&&reading.physical.positions_metres.every(Object.isFrozen)};
}
/** Same-realm parser admission; a clone/foreign epoch must pass the native owner parser again. */
export function assertAdmittedPerformanceReading(reading:NativePerformanceReading):void {if(!admittedReadings.has(reading))throw Error('The physical renderer requires an epoch-acknowledged native owner reading.');}
type RecordValue = Record<string,unknown>;
function object(v:unknown,label:string):RecordValue {
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error(`Native ${label} is missing.`);
 return v as RecordValue;
}
function text(v:unknown,label:string,max=2048):asserts v is string {
 if(typeof v!=='string'||!v||v.length>max||v.includes('\0'))throw Error(`Native ${label} is invalid.`);
}
export function counter(v:unknown):asserts v is Counter {
 if(typeof v!=='string'||!/^(0|[1-9][0-9]*)$/.test(v)||v.length>20||BigInt(v)>18446744073709551615n)throw Error('Native counter is not canonical u64.');
}
function number(v:unknown,min:number,max:number,label:string):asserts v is number {
 if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Native ${label} is invalid.`);
}
function integer(v:unknown,min:number,max:number,label:string):asserts v is number {
 number(v,min,max,label);if(!Number.isInteger(v))throw Error(`Native ${label} is not an integer.`);
}
function list(v:unknown,max:number,label:string):asserts v is unknown[] {
 if(!Array.isArray(v)||v.length>max)throw Error(`Native ${label} exceeds its bound.`);
}
function boolean(v:unknown,label:string):asserts v is boolean {if(typeof v!=='boolean')throw Error(`Native ${label} is invalid.`);}
function nullableText(v:unknown,label:string) {if(v!==null)text(v,label);}
/** Validate copied native state. No browser interpolation, timer or source
 * parameter is authored here. Full source/effective bit equality is checked
 * by the native checkpoint owner; descriptor baseline is not its source. */
function validateInstrumentRamps(v:RecordValue,p:RecordValue):void {
 if(!Object.hasOwn(v,'instrument_parameter_ramps'))return;
 const rows=v.instrument_parameter_ramps;list(rows,7,'instrument parameter ramps');
 if(rows.length!==7)throw Error('The native instrument ramp table must contain all seven enum-ordered rows.');
 integer(p.sample_rate,1,768000,'native ramp sample rate');
 const cursor=BigInt(v.samples_elapsed as string),maximum=18446744073709551615n,rate=BigInt(p.sample_rate);
 const keys=['start_value','target_value','start_sample','duration_samples','remaining_samples'];
 for(let index=0;index<rows.length;index++){
  const row=object(rows[index],'instrument ramp');
  if(Object.keys(row).length!==keys.length||keys.some(key=>!Object.hasOwn(row,key)))throw Error('A native instrument ramp differs from its exact five-field contract.');
  const parameter=(v.parameters as RecordValue[]).find(value=>value.target_ref===nativeInstrumentRampTargets[index]);
  if(!parameter||parameter.scope!=='instrument'||parameter.native_owner!=='ql.performance.Engine'||parameter.action_ref!=='ql:native-performance/parameter')throw Error('A native ramp is detached from its actual Engine parameter.');
  counter(parameter.sample_rate);if(BigInt(parameter.sample_rate)!==rate)throw Error('The native ramp parameter and physical body have different sample rates.');
  number(row.start_value,-1e15,1e15,'ramp start');number(row.target_value,-1e15,1e15,'ramp target');
  for(const key of keys.slice(2))counter(row[key]);
  const start=BigInt(row.start_sample as string),duration=BigInt(row.duration_samples as string),remaining=BigInt(row.remaining_samples as string);
  if(duration===0n){
   if(start!==0n||remaining!==0n||!Object.is(row.start_value,0)||!Object.is(row.target_value,0))throw Error('An inactive native ramp contains nonzero or signed-zero state.');
   continue;
  }
  number(row.start_value,parameter.minimum as number,parameter.maximum as number,'active ramp start');number(row.target_value,parameter.minimum as number,parameter.maximum as number,'active ramp target');
  if(duration>rate*900n||remaining>duration||start>cursor||start>maximum-duration)throw Error('The native ramp duration/date exceeds its actual owner bounds.');
  if(remaining>0n?start+duration-remaining!==cursor:cursor<start+duration)throw Error('The native ramp remaining count differs from the copied callback cursor.');
  const effective=parameter.effective as number;
  if(remaining===0n){if(!Object.is(effective,row.target_value))throw Error('A completed native ramp differs from its actual effective value.');}
  else if(effective<Math.min(row.start_value as number,row.target_value as number)||effective>Math.max(row.start_value as number,row.target_value as number))throw Error('The native effective value lies outside its active ramp.');
  // Do not emulate native floating-point interpolation or treat a baseline
  // policy as current source. Those exact bits remain in native CP custody.
 }
}
export function readTransportAcknowledgement(value:unknown):NativeTransportAcknowledgement|null {
 if(value===null||value===undefined)return null;
 const v=object(value,'transport acknowledgement'),keys=['previous_epoch','epoch','previous_cursor','previous_sequence','target_sample','accepted_sequence','transaction_ref','checkpoint_ref'];
 if(Object.keys(v).length!==keys.length||keys.some(key=>!Object.prototype.hasOwnProperty.call(v,key)))throw Error('Native transport acknowledgement differs from its exact eight-field contract.');
 for(const key of keys.slice(0,6))counter(v[key]);
 for(const key of keys.slice(6))text(v[key],key,255);
 if(v.previous_epoch==='0'||BigInt(v.epoch as string)<=BigInt(v.previous_epoch as string))throw Error('Native restore omitted its strictly newer actual epoch.');
 return freezeJson(structuredClone(v)) as unknown as NativeTransportAcknowledgement;
}
const transport=readTransportAcknowledgement;
export function readPerformance(value:unknown,previous?:NativePerformanceReading,transition?:NativeTransportAcknowledgement|null):NativePerformanceReading {
 const candidate=cloneBoundedJson(value);const v=object(candidate,'performance reading'),s=object(v.scope,'performance scope');
 if(v.schema!=='ql.performance-management/v1')throw Error('The retained native owner has no qualified performance management service.');
 text(v.session_ref,'session',128);for(const key of ['instance_ref','event_ref','subject_ref','preparation_ref','state_ref'])text(s[key],key);
 for(const key of ['m1_revision','m2_generation','body_revision'])counter(s[key]);
 counter(v.transport_epoch);counter(v.samples_elapsed);counter(v.accepted_sequence);boolean(v.available,'availability');nullableText(v.reason,'reason');
 const bodySource=object(v.body_source,'body source standing');if(!['sourceForm','referenceMetric'].includes(String(bodySource.kind)))throw Error('Native body source standing is invalid.');nullableText(bodySource.recipe_ref,'source-form recipe');if(bodySource.validated_m3_generation!==null)counter(bodySource.validated_m3_generation);if(bodySource.kind==='sourceForm'&&(!bodySource.recipe_ref||bodySource.validated_m3_generation===null))throw Error('Source-form standing requires regenerated current native M3 and its exact recipe.');if(bodySource.kind==='referenceMetric'&&(bodySource.recipe_ref!==null||bodySource.validated_m3_generation!==null))throw Error('Reference metric preparation cannot claim source-form regeneration.');
 list(v.capabilities,64,'capabilities');for(const c of v.capabilities)text(c,'capability',128);
 if(new Set(v.capabilities).size!==v.capabilities.length)throw Error('Native capabilities contain duplicates.');
 integer(v.transpose,0,11,'transpose');list(v.keys,192,'keyboard');const cells=new Set<string>();
 for(const key of v.keys){const k=object(key,'key');integer(k.row,0,5,'row');integer(k.column,0,31,'column');integer(k.register_octave,-16,16,'register');integer(k.key,0,11,'canonical key');integer(k.pitch_class,0,11,'pitch class');boolean(k.available,'key availability');text(k.label,'pitch label',128);for(const ref of ['reduction_policy','source_collection','source_receipt'])text(k[ref],ref);nullableText(k.reason,'source key reason');if(k.source_degree!==null)integer(k.source_degree,0,65535,'source degree');if(k.available){integer(k.face,0,1,'face');text(k.coordinate,'key coordinate');number(k.hertz,0.001,24000,'key frequency');if(k.reason!==null)throw Error('Available native key also reports unavailability.');}else{if(!k.reason||k.hertz!==null||k.ratio!==null||k.coordinate!==null||k.face!==null||Object.prototype.hasOwnProperty.call(k,'native_target'))throw Error('Unavailable source key contains a playable/fabricated target.');}const cell=`${k.row}:${k.column}`;if(cells.has(cell))throw Error('Native keyboard cells overlap.');cells.add(cell);if(k.ratio!==null){const r=object(k.ratio,'ratio');counter(r.numerator);counter(r.denominator);if(r.numerator==='0'||r.denominator==='0')throw Error('Native exact ratio is zero.');}}
 list(v.parameters,128,'parameters');const targets=new Set<unknown>();
 for(const parameter of v.parameters){const p=object(parameter,'parameter');for(const k of ['target_ref','action_ref','native_owner','label','unit'])text(p[k],k);if(targets.has(p.target_ref))throw Error('Native parameter target is duplicated.');targets.add(p.target_ref);if(!['excitation','material','boundary','modulation','receiving','mixer'].includes(String(p.group))||!['note','instrument','body','context','presentation'].includes(String(p.scope)))throw Error('Native parameter scope/group is invalid.');number(p.minimum,-1e15,1e15,'minimum');number(p.maximum,p.minimum,1e15,'maximum');number(p.baseline,p.minimum,p.maximum,'baseline');number(p.effective,p.minimum,p.maximum,'effective');counter(p.smoothing_samples);nullableText(p.route_ref,'route');nullableText(p.unavailable_reason,'parameter refusal');list(p.capabilities,4,'parameter capabilities');for(const c of p.capabilities)if(!['set','undo','clear','learn'].includes(String(c)))throw Error('Native parameter action is unsupported.');}
 list(v.devices,64,'devices');for(const item of v.devices){const d=object(item,'device');integer(d.id,1,4294967295,'device id');text(d.uid,'device uid');text(d.name,'device name');boolean(d.default_output,'default output');boolean(d.alive,'device alive');integer(d.output_channels,0,128,'channels');number(d.nominal_rate,0,768000,'nominal rate');integer(d.buffer_frames,0,65536,'device buffer');}
 const d=object(v.device,'device reading');if(!['closed','prepared','running','recovering','lost','failed'].includes(String(d.state)))throw Error('Native device lifecycle is invalid.');text(d.backend,'backend');if(d.device_id!==null)integer(d.device_id,1,4294967295,'selected device');number(d.client_rate,0,768000,'client rate');number(d.hardware_rate,0,768000,'hardware rate');integer(d.buffer_frames,0,65536,'buffer');number(d.reported_output_latency_ms,0,10000,'reported latency');boolean(d.sample_rate_conversion,'rate conversion');nullableText(d.error,'device error');for(const k of ['start_epoch','start_callback_baseline','callbacks','callback_failures','overload_notifications','capture_drops','timestamp_discontinuities'])counter(d[k]);if(d.underruns!==null)counter(d.underruns);if(!['unexecuted','measured'].includes(String(d.physical_latency_measurement)))throw Error('Native physical latency standing is absent.');
 const p=object(v.physical,'physical snapshot');if(Object.hasOwn(p,'eigenbasis_identity'))text(p.eigenbasis_identity,'physical eigenbasis');for(const k of ['preparation_ref','state_ref'])if(p[k]!==s[k])throw Error('Native physical snapshot differs from its performance owner.');for(const k of ['body_revision','source_generation','samples_elapsed'])counter(p[k]);if(bodySource.kind==='sourceForm'&&bodySource.validated_m3_generation!==p.source_generation)throw Error('Source-form validation differs from the actual physical M3 generation.');if(p.body_revision!==s.body_revision||p.samples_elapsed!==v.samples_elapsed)throw Error('Native audio and visible cursors differ.');list(p.node_ids,32,'body node IDs');list(p.positions_metres,32,'visible positions');if(p.node_ids.length!==p.positions_metres.length||new Set(p.node_ids).size!==p.node_ids.length)throw Error('Native physical node correspondence is invalid.');for(const n of p.node_ids)counter(n);for(const xyz of p.positions_metres){list(xyz,3,'position');if(xyz.length!==3)throw Error('Native position is not Vec3.');for(const n of xyz)number(n,-1e9,1e9,'metre position');}number(p.pickup_linear,-1e6,1e6,'pickup');number(p.energy_joules,0,1e15,'energy');
 validateInstrumentRamps(v,p);
 integer(v.active_voices,0,24,'voices');integer(v.active_touches,0,96,'touches');boolean(v.sustain,'sustain');number(v.peak_linear,0,1,'peak');number(v.rms_linear,0,1,'RMS');counter(v.clipping_samples);
 const e=object(v.excitation,'excitation');text(e.policy_ref,'excitation policy');text(e.standing,'excitation standing');list(e.audio_octet_hz,8,'audio octet');list(e.nodal_quartet,4,'nodal quartet');if(e.audio_octet_hz.length!==8||e.nodal_quartet.length!==4)throw Error('Native 8 audio / 4 boundary roles are incomplete.');for(const hz of e.audio_octet_hz)number(hz,0.001,1e9,'octet frequency');for(const boundary of e.nodal_quartet){const b=object(boundary,'boundary');if(b.position!==0&&b.position!==5)throw Error('Native boundary is not at a source pole.');integer(b.face,0,1,'boundary face');integer(b.m,1,12,'boundary m');integer(b.n,1,12,'boundary n');}
 if(v.keys.length){const addresses=new Map<string,{count:number;key:unknown;available:unknown;coordinate:unknown;face:unknown;hertz:unknown;ratio:unknown;degree:unknown;policy:unknown;collection:unknown;receipt:unknown;reason:unknown}>(),rows=new Set<number>();for(const key of v.keys){const k=key as unknown as NativeKey;rows.add(k.row);const id=`${k.key}:${k.register_octave}`,old=addresses.get(id);if(old){if(old.available!==k.available||old.coordinate!==k.coordinate||old.face!==k.face||old.hertz!==k.hertz||JSON.stringify(old.ratio)!==JSON.stringify(k.ratio)||old.degree!==k.source_degree||old.policy!==k.reduction_policy||old.collection!==k.source_collection||old.receipt!==k.source_receipt||old.reason!==k.reason)throw Error('Repeated physical addresses differ in native source availability/tuning.');old.count++;}else addresses.set(id,{count:1,key:k.key,available:k.available,coordinate:k.coordinate,face:k.face,hertz:k.hertz,ratio:k.ratio,degree:k.source_degree,policy:k.reduction_policy,collection:k.source_collection,receipt:k.source_receipt,reason:k.reason});}if(rows.size!==6||[...addresses.values()].some(p=>p.count!==3))throw Error('Native Jankó catalog omits six rows or three touchpoints per address.');}

 if(previous){if(s.instance_ref!==previous.scope.instance_ref||s.event_ref!==previous.scope.event_ref||s.subject_ref!==previous.scope.subject_ref)throw Error('Native performance reply belongs to a different retained work.');const ack=transport(transition);if(v.transport_epoch===previous.transport_epoch){if(v.session_ref!==previous.session_ref||ack)throw Error('Native lifetime/transport acknowledgement differs within one epoch.');if(BigInt(v.samples_elapsed)<BigInt(previous.samples_elapsed)||BigInt(v.accepted_sequence)<BigInt(previous.accepted_sequence))throw Error('Native performance acknowledgement regressed.');}else{if(!ack||v.session_ref!==previous.session_ref||BigInt(v.transport_epoch)<=BigInt(previous.transport_epoch)||ack.previous_epoch!==previous.transport_epoch||ack.epoch!==v.transport_epoch||ack.target_sample!==v.samples_elapsed||ack.accepted_sequence!==v.accepted_sequence||BigInt(ack.previous_cursor)<BigInt(previous.samples_elapsed)||BigInt(ack.previous_sequence)<BigInt(previous.accepted_sequence))throw Error('Native transport epoch changed without the exact actual restore acknowledgement.');}}
 const initialAck=transport(transition);if(initialAck&&(initialAck.epoch!==v.transport_epoch||initialAck.target_sample!==v.samples_elapsed||initialAck.accepted_sequence!==v.accepted_sequence))throw Error('Native restored reading differs from its original transport acknowledgement.');
 if(Object.hasOwn(v,'live_temporal'))readLiveTemporalProgress(v.live_temporal,v.samples_elapsed as string);
 const admitted=freezeJson(candidate) as NativePerformanceReading;admittedReadings.add(admitted);return admitted;
}
export function readReply(value:unknown,command:NativePerformanceCommand,previous?:NativePerformanceReading):NativePerformanceReply {
 const v=object(value,'performance reply');if(v.schema!=='ql.performance-management-reply/v1'||v.operation!==command.operation)throw Error('Native performance reply does not acknowledge this operation.');boolean(v.accepted,'acceptance');
 if(v.accepted&&v.refusal!==null)throw Error('Native acceptance also contains a refusal.');
 if(!v.accepted){const r=object(v.refusal,'refusal');text(r.code,'refusal code');text(r.reason,'refusal reason');}
 const transition=transport(v.transport_transition),reading=readPerformance(v.reading,previous,transition);
 if(v.admission!==null){const a=object(v.admission,'admission');counter(a.sequence);counter(a.sample);nullableText(a.input_ref,'input reference');nullableText(a.touch_ref,'touch reference');if(!['native-output','stopped'].includes(String(a.clock)))throw Error('Native admission clock is invalid.');number(a.mapping_uncertainty_samples,0,24000,'mapping uncertainty');if(BigInt(a.sequence)>BigInt(reading.accepted_sequence))throw Error('Native admission exceeds its acknowledged sequence.');}
 return {...structuredClone(value) as NativePerformanceReply,reading,transport_transition:transition};
}

/** Original native-held fresh preparation declaration. It declares a required
 * operation, never a performed input or an effective control value. */
export function readCurrentOutputCalibration(value:unknown):NativeCurrentOutputCalibration {
 const v=object(cloneBoundedJson(value),'native output calibration declaration'),keys=['schema','required','operation','timing','standing'];
 if(Object.keys(v).length!==keys.length||keys.some(key=>!Object.hasOwn(v,key))||v.schema!=='ql.native-current-output-calibration-declaration/v1'||typeof v.required!=='boolean'||v.operation!==(v.required?'calibrate-current':null)||v.timing!=='after-original-recording-birth-before-first-native-input')throw Error('The original native output calibration declaration is missing or malformed.');
 text(v.standing,'calibration standing');return freezeJson(v) as unknown as NativeCurrentOutputCalibration;
}
