import * as THREE from 'three';
import {PHYSICAL_DISPLAY_POLICY,type NativePhysicalRest,type NativePhysicalDisplayState} from './physicalDisplay.js';
import {counter,assertAdmittedPerformanceReading,type NativePerformanceReading} from './protocol.js';
export interface PhysicalTargetMap {
 readonly schema:'oi.native-physical-target-map/v1';
 readonly partition_signature:string;readonly entity_ref:string;
 readonly instance_ref:string;readonly event_ref:string;readonly subject_ref:string;
 readonly preparation_ref:string;readonly state_ref:string;readonly body_revision:string;
 readonly native_node_ids:readonly string[];
 /** Existing authored presentation transform, column-major; never a physical
  * receiver or a second body integration. Metres enter once at this boundary. */
 readonly metre_to_presentation:readonly number[];
 readonly target_a_node_ids:readonly string[];readonly target_b_node_ids:readonly string[];
}
export interface PhysicalRetainedPort {
 texWidth:number;texHeight:number;particleCount:number;
 readPartitionSnapshot():{schema:'oi.retained-partition-snapshot/v1';partition_signature:string;
  slot_count:number;particle_count:number;connection_start:number;
  partitions:{entity_ref:string;start:number;end:number}[];
  authored_target_a:Float32Array;authored_target_b:Float32Array};
 setTargetTextures(a:THREE.DataTexture,b:THREE.DataTexture,centre:unknown):void;
}
export interface CurrentRetainedTargets {
 partition_signature:string;instance_ref:string;event_ref:string;subject_ref:string;
 target_a:Float32Array;target_b:Float32Array;
}
/** A source-qualified sparse receiving on the existing renderer/partition.
 * Every replaced XYZ comes from the one callback snapshot. Authored density
 * and all cosmic/personal/branch/connection slots remain with their owners. */
export class PhysicalSnapshotProjection {
 private a:THREE.DataTexture;private b:THREE.DataTexture;
 private dead=false;private last:NativePerformanceReading|null=null;
 private preparedAdmission=false;
 private rest:Readonly<NativePhysicalRest>|null=null;private magnification=1;private nativeMaximum:number|null=null;
 private start:number;private end:number;private nativeIDs:Set<string>;
 constructor(private port:PhysicalRetainedPort,private map:PhysicalTargetMap,
             private centre:unknown){
  const copied=structuredClone(map);
  Object.freeze(copied.native_node_ids);Object.freeze(copied.metre_to_presentation);Object.freeze(copied.target_a_node_ids);Object.freeze(copied.target_b_node_ids);this.map=Object.freeze(copied);
  if(map.schema!=='oi.native-physical-target-map/v1'||!map.entity_ref||!map.partition_signature)throw Error('A native physical receiving map is required.');
  const s=port.readPartitionSnapshot(),size=port.texWidth*port.texHeight;
  if(s.schema!=='oi.retained-partition-snapshot/v1'||s.partition_signature!==map.partition_signature||s.slot_count!==size||s.particle_count!==port.particleCount||!Number.isSafeInteger(s.connection_start)||s.connection_start<0||s.connection_start>size)throw Error('Native physical receiving differs from the retained partition.');
  if(!(s.authored_target_a instanceof Float32Array)||!(s.authored_target_b instanceof Float32Array)||s.authored_target_a.length!==size*4||s.authored_target_b.length!==size*4||!s.authored_target_a.every(Number.isFinite)||!s.authored_target_b.every(Number.isFinite))throw Error('The retained authored target arrays are invalid.');
  const selected=s.partitions.filter(p=>p.entity_ref===map.entity_ref);
  if(selected.length!==1)throw Error('Select one existing retained body partition.');
  const p=selected[0];if(!Number.isSafeInteger(p.start)||!Number.isSafeInteger(p.end)||p.start<0||p.end<=p.start||p.end>s.connection_start)throw Error('The selected retained body partition is invalid.');
  this.start=p.start;this.end=p.end;this.nativeIDs=new Set(map.native_node_ids);
  if(!this.nativeIDs.size||this.nativeIDs.size>32||this.nativeIDs.size!==map.native_node_ids.length)throw Error('Native physical node identities are invalid.');
  for(const id of this.nativeIDs)counter(id);counter(map.body_revision);
  if(map.target_a_node_ids.length!==p.end-p.start||map.target_b_node_ids.length!==p.end-p.start||map.target_a_node_ids.some(id=>!this.nativeIDs.has(id))||map.target_b_node_ids.some(id=>!this.nativeIDs.has(id)))throw Error('Every retained body slot must name a qualified native node.');
  for(const lane of [map.target_a_node_ids,map.target_b_node_ids])if(new Set(lane).size!==this.nativeIDs.size)throw Error('The retained physical receiving omits a native node.');
  const m=map.metre_to_presentation;if(m.length!==16||m.some(v=>!Number.isFinite(v)||Math.abs(v)>1e9)||m[3]!==0||m[7]!==0||m[11]!==0||m[15]!==1)throw Error('A finite authored affine presentation transform is required.');
  const det=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);if(!Number.isFinite(det)||det===0)throw Error('The authored scene transform collapses the native physical body.');
  this.a=new THREE.DataTexture(s.authored_target_a.slice(),port.texWidth,port.texHeight,THREE.RGBAFormat,THREE.FloatType);
  this.b=new THREE.DataTexture(s.authored_target_b.slice(),port.texWidth,port.texHeight,THREE.RGBAFormat,THREE.FloatType);
  this.a.minFilter=this.a.magFilter=this.b.minFilter=this.b.magFilter=THREE.NearestFilter;
 }
 bindNativeRest(rest:NativePhysicalRest,reading:NativePerformanceReading|null=this.last){
  if(this.dead||this.rest)throw Error('The exact native display rest basis is already bound or disposed.');
  if(!reading)throw Error('The exact native display rest requires its actual callback reading.');
  assertAdmittedPerformanceReading(reading);
  for(const key of ['instance_ref','event_ref','subject_ref','preparation_ref','state_ref','body_revision'] as const)if(reading.scope[key]!==this.map[key])throw Error('Display rest callback belongs to another native body.');
  for(const key of ['instance_ref','event_ref','subject_ref','preparation_ref','state_ref','body_revision'] as const)if(rest[key]!==this.map[key])throw Error('Display rest belongs to another native body.');
  if(rest.source_generation!==reading.physical.source_generation||rest.node_ids.length!==this.nativeIDs.size||rest.node_ids.some(id=>!this.nativeIDs.has(id))||new Set(rest.node_ids).size!==this.nativeIDs.size||rest.rest_metres.length!==rest.node_ids.length||rest.rest_metres.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('The actual complete native display rest basis differs from its callback owner.');
  const copy=structuredClone(rest);for(const position of copy.rest_metres)Object.freeze(position);Object.freeze(copy.rest_metres);Object.freeze(copy.node_ids);this.rest=Object.freeze(copy);this.magnification=PHYSICAL_DISPLAY_POLICY.initial;
 }
 /** A new body validates its actual callback, rest and complete receiving in
  * private candidate textures. Nothing reaches the resident GPU here. */
 prepareAdmission(reading:NativePerformanceReading,current:CurrentRetainedTargets,rest:NativePhysicalRest){
  if(this.last||this.rest||this.preparedAdmission)throw Error('Physical replacement admission requires a fresh candidate.');
  if((globalThis as {__OI_TEST_REFUSE_NATIVE_PHYSICAL_REST__?:boolean}).__OI_TEST_REFUSE_NATIVE_PHYSICAL_REST__===true)throw Error('Actual physical rest receiving is disconnected.');
  this.bindNativeRest(rest,reading);this.apply(reading,current,false);this.preparedAdmission=true;
 }
 commitPreparedAdmission(){
  if(this.dead||!this.preparedAdmission||!this.last||!this.rest)throw Error('The complete physical replacement has not been admitted.');
  if((globalThis as {__OI_TEST_DISCONNECT_NATIVE_TARGETS__?:boolean}).__OI_TEST_DISCONNECT_NATIVE_TARGETS__===true)throw Error('Actual native GPU receiving is disconnected.');
  this.port.setTargetTextures(this.a,this.b,this.centre);this.preparedAdmission=false;
 }
 displayState():NativePhysicalDisplayState{return{...PHYSICAL_DISPLAY_POLICY,magnification:this.magnification,rest_available:!!this.rest,native_max_displacement_metres:this.nativeMaximum,samples_elapsed:this.last?.samples_elapsed??null};}
 setMagnification(value:number){if(this.dead||!this.rest||!Number.isFinite(value)||value<PHYSICAL_DISPLAY_POLICY.minimum||value>PHYSICAL_DISPLAY_POLICY.maximum)throw Error('Display magnification needs the current native rest basis and a value within1–100000.');this.magnification=value;}
 apply(reading:NativePerformanceReading,current:CurrentRetainedTargets,publish=true){
  if(this.dead)throw Error('The retained physical receiving was disposed.');
  assertAdmittedPerformanceReading(reading);
  const scope=reading.scope,p=reading.physical;
  for(const key of ['instance_ref','event_ref','subject_ref','preparation_ref','state_ref','body_revision'] as const)if(scope[key]!==this.map[key])throw Error('The physical snapshot requires fresh native body/receiving admission.');
  if(p.samples_elapsed!==reading.samples_elapsed||p.body_revision!==scope.body_revision||p.node_ids.length!==this.nativeIDs.size||p.node_ids.some(id=>!this.nativeIDs.has(id)))throw Error('The audio/visible cursor or node correspondence is disconnected.');
  if(this.last&&reading.transport_epoch===this.last.transport_epoch&&BigInt(reading.samples_elapsed)<BigInt(this.last.samples_elapsed))throw Error('The physical receiving cursor regressed within a native transport epoch.');
  if(current.partition_signature!==this.map.partition_signature||current.instance_ref!==scope.instance_ref||current.event_ref!==scope.event_ref||current.subject_ref!==scope.subject_ref||!(current.target_a instanceof Float32Array)||!(current.target_b instanceof Float32Array)||current.target_a.length!==this.port.texWidth*this.port.texHeight*4||current.target_b.length!==current.target_a.length||!current.target_a.every(Number.isFinite)||!current.target_b.every(Number.isFinite))throw Error('The current retained composite targets are unavailable or belong to a different work.');
  const nodes=new Map(p.node_ids.map((id,i)=>[id,p.positions_metres[i]])),m=this.map.metre_to_presentation,rest=this.rest?new Map(this.rest.node_ids.map((id,i)=>[id,this.rest!.rest_metres[i]])):null;
  if(this.rest&&this.rest.source_generation!==p.source_generation)throw Error('Display magnification needs fresh native source-form rest admission.');
  let maximum=0;
  // Validate the complete candidate before touching either resident texture.
  const candidate=new Map([...nodes].map(([id,xyz])=>{if(!xyz||xyz.length!==3||xyz.some(v=>!Number.isFinite(v)))throw Error('The native body snapshot is incomplete.');const origin=rest?.get(id);if(rest&&!origin)throw Error('A callback node lost its exact native rest position.');const display=origin?xyz.map((value,axis)=>origin[axis]+this.magnification*(value-origin[axis])):xyz;if(origin)maximum=Math.max(maximum,Math.hypot(...xyz.map((value,axis)=>value-origin[axis])));const [x,y,z]=display;const out=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]].map(Math.fround);if(out.some(v=>!Number.isFinite(v)))throw Error('The physical snapshot exceeds the retained renderer format.');return[id,out] as const;}));
  // Existing acceptance fault boundary: actual native state continues, but
  // GPU receiving is cut. The ordinary gate must reject this disconnection.
  if(publish&&(globalThis as {__OI_TEST_DISCONNECT_NATIVE_TARGETS__?:boolean}).__OI_TEST_DISCONNECT_NATIVE_TARGETS__===true&&this.last){this.last=reading;return;}
  for(const [texture,lane,base] of [[this.a,this.map.target_a_node_ids,current.target_a],[this.b,this.map.target_b_node_ids,current.target_b]] as const){const data=texture.image.data as Float32Array;data.set(base);for(let i=0;i<lane.length;i++){const positions=candidate.get(lane[i])!;const at=(this.start+i)*4;data[at]=positions[0];data[at+1]=positions[1];data[at+2]=positions[2];}texture.needsUpdate=true;}
  if(publish)this.port.setTargetTextures(this.a,this.b,this.centre);this.last=reading;this.nativeMaximum=this.rest?maximum:null;
 }
 inspect(){return{display:this.displayState(),native_rest:this.rest?structuredClone(this.rest):null,target_map:structuredClone(this.map),scope:this.last?.scope??null,transport_epoch:this.last?.transport_epoch??null,samples_elapsed:this.last?.samples_elapsed??null,partition:{start:this.start,end:this.end,entity_ref:this.map.entity_ref},native_node_ids:[...this.nativeIDs],target_a:this.a.image.data,target_b:this.b.image.data};}
 dispose(){if(this.dead)return;this.dead=true;this.a.dispose();this.b.dispose();this.last=null;this.rest=null;}
}
