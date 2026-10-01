import * as THREE from 'three';
import {RetainedFieldBinding} from './ql/retained-field.mjs';
export interface NativeTargetMap {
 readonly schema:'oi.native-target-map/v1';readonly policy:'sparse-replace';readonly partition_signature:string;
 readonly partitions:ReadonlyArray<Readonly<{entity_ref:string;
  target_a:Readonly<{sample_identities:ReadonlyArray<number>}>;
  target_b:Readonly<{sample_identities:ReadonlyArray<number>}>}>>;
}
export type NativeProjectionPresentation=
 |Readonly<{units_per_metre:number;slots_a:ReadonlyArray<number>;slots_b:ReadonlyArray<number>;target_map?:never}>
 |Readonly<{units_per_metre:number;target_map:NativeTargetMap;slots_a?:never;slots_b?:never}>;
/** Explicit presentation transform; the admitted native frames stay in metres.
 * No position/state is integrated here. Density remains the authored fourth channel.
 */
export class NativeProjection {
 readonly native:RetainedFieldBinding;
 private a:THREE.DataTexture|null=null; private b:THREE.DataTexture|null=null;
 private inputA:any;private inputB:any;private centre:any;
 private port:any; private _scale:number; private dead=false;
 private frame:any;
 private authoredA:Float32Array;private authoredB:Float32Array;
 private maskA:Uint8Array;private maskB:Uint8Array;
 constructor(port:any,receipt:any,presentation:NativeProjectionPresentation){
  this.port=port;this._scale=this.checkScale(presentation?.units_per_metre);
  this.frame=receipt;
  this.checkPositions(receipt);
  const correspondence=this.correspondence(port,receipt,presentation);
  this.authoredA=correspondence.authoredA;this.authoredB=correspondence.authoredB;
  this.maskA=correspondence.maskA;this.maskB=correspondence.maskB;
  const proxy={texWidth:port.texWidth,texHeight:port.texHeight,particleCount:port.particleCount,
   get currentPosTarget(){return port.currentPosTarget;},get currentVelTarget(){return port.currentVelTarget;},
   get nextPosTarget(){return port.nextPosTarget;},get nextVelTarget(){return port.nextVelTarget;},
   setTargetTextures:(a:any,b:any,centre:any)=>{this.inputA=a;this.inputB=b;this.centre=centre;this.sync();}
  };
  try{this.native=new RetainedFieldBinding(proxy,{initialFrame:receipt,targetA:port.targetA,targetB:port.targetB,
   slotsA:correspondence.slotsA,slotsB:correspondence.slotsB});}
  catch(error){this.a?.dispose();this.b?.dispose();throw error;}
 }
 private correspondence(port:any,frame:any,presentation:NativeProjectionPresentation){
  const size=port.texWidth*port.texHeight;
  const textureData=(texture:any,label:string)=>{
   const data=texture?.image?.data;
   if(!(data instanceof Float32Array)||data.length!==size*4||!data.every(Number.isFinite))throw new Error(`invalid authored ${label} target texture`);
   return data.slice();
  };
  const legacy=Array.isArray(presentation?.slots_a)||Array.isArray(presentation?.slots_b);
  const sparse=presentation?.target_map!==undefined;
  if(legacy&&sparse)throw new Error('presentation must supply either complete slots or a sparse target map');
  if(!sparse){
   if(!Array.isArray(presentation?.slots_a)||!Array.isArray(presentation?.slots_b))throw new Error('complete supplied sample correspondence required');
   return{slotsA:presentation.slots_a,slotsB:presentation.slots_b,
    maskA:new Uint8Array(size).fill(1),maskB:new Uint8Array(size).fill(1),
    authoredA:textureData(port.targetA,'A'),authoredB:textureData(port.targetB,'B')};
  }
  if(typeof port.readPartitionSnapshot!=='function')throw new Error('sparse target admission requires an authored partition snapshot');
  const snapshot=port.readPartitionSnapshot(),map=presentation.target_map;
  if(!map||map.schema!=='oi.native-target-map/v1'||map.policy!=='sparse-replace'||
     Object.keys(map).sort().join(',')!=='partition_signature,partitions,policy,schema'||
     typeof map.partition_signature!=='string'||!Array.isArray(map.partitions)||map.partitions.length===0)throw new Error('unsupported sparse native target map');
  if(!snapshot||snapshot.schema!=='oi.retained-partition-snapshot/v1'||snapshot.partition_signature!==map.partition_signature||
     snapshot.slot_count!==size||snapshot.particle_count!==port.particleCount||!Number.isSafeInteger(snapshot.connection_start)||
     snapshot.connection_start<0||snapshot.connection_start>size||!Array.isArray(snapshot.partitions))throw new Error('sparse native target map does not match the retained partition snapshot');
  const authoredA=snapshot.authored_target_a,authoredB=snapshot.authored_target_b;
  if(!(authoredA instanceof Float32Array)||!(authoredB instanceof Float32Array)||authoredA.length!==size*4||authoredB.length!==size*4||
     !authoredA.every(Number.isFinite)||!authoredB.every(Number.isFinite))throw new Error('invalid retained authored target snapshot');
  const targets=new Map<number,number>();
  for(let index=0;index<frame.targets.length;index++){
   const identity=frame.targets[index]?.identity;
   if(!Number.isSafeInteger(identity)||identity<0||targets.has(identity))throw new Error('native target identities must be unique stable integers');
   targets.set(identity,index);
  }
  const partitions=new Map<string,{start:number;end:number}>();let cursor=0;
  for(const partition of snapshot.partitions){
   if(!partition||Object.keys(partition).sort().join(',')!=='end,entity_ref,start'||typeof partition.entity_ref!=='string'||
      partitions.has(partition.entity_ref)||!Number.isSafeInteger(partition.start)||!Number.isSafeInteger(partition.end)||
      partition.start!==cursor||partition.end<=partition.start||partition.end>snapshot.connection_start)throw new Error('invalid retained entity partition');
   partitions.set(partition.entity_ref,{start:partition.start,end:partition.end});cursor=partition.end;
  }
  if(cursor!==snapshot.connection_start)throw new Error('retained entity partitions must exactly cover the particle domain');
  const slotsA=new Array(size).fill(0),slotsB=new Array(size).fill(0),maskA=new Uint8Array(size),maskB=new Uint8Array(size),seen=new Set<string>();
  const indices=(value:any,length:number)=>{
   if(!value||Object.keys(value).join(',')!=='sample_identities'||!Array.isArray(value.sample_identities)||value.sample_identities.length!==targets.size||length<targets.size)throw new Error('sparse target samples must cover the complete native target domain');
   const unique=new Set<number>();const resolved=value.sample_identities.map((identity:any)=>{
    if(!Number.isSafeInteger(identity)||unique.has(identity)||!targets.has(identity))throw new Error('unknown or duplicate native sample identity');
    unique.add(identity);return targets.get(identity)!;
   });
   if(unique.size!==targets.size)return [];
   return Array.from({length},(_,offset)=>resolved[Math.floor(offset*resolved.length/length)]);
  };
  for(const entry of map.partitions){
   if(!entry||Object.keys(entry).sort().join(',')!=='entity_ref,target_a,target_b'||typeof entry.entity_ref!=='string'||seen.has(entry.entity_ref))throw new Error('duplicate or invalid sparse entity target');
   seen.add(entry.entity_ref);const partition=partitions.get(entry.entity_ref);if(!partition)throw new Error('sparse target names an unknown retained entity partition');
   const length=partition.end-partition.start,a=indices(entry.target_a,length),b=indices(entry.target_b,length);
   for(let offset=0;offset<length;offset++){const slot=partition.start+offset;slotsA[slot]=a[offset];slotsB[slot]=b[offset];maskA[slot]=maskB[slot]=1;}
  }
  return{slotsA,slotsB,maskA,maskB,authoredA:authoredA.slice(),authoredB:authoredB.slice()};
 }
 private checkScale(value:number){if(!Number.isFinite(value)||value<=0||value>1e6)throw new Error('presentation units/metre must be in (0, 1000000]');return value;}
 private checkPositions(frame:any,scale=this._scale){
  if(!Array.isArray(frame?.targets))throw new Error('native targets unavailable');
  for(const target of frame.targets){if(!Array.isArray(target.position)||target.position.length!==3||target.position.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)||!Number.isFinite(Math.fround(v*scale))))throw new Error('native target cannot be represented at this presentation scale');}
 }
 get scale(){return this._scale;}
 setScale(scale:number){this.checkScale(scale);this.checkPositions(this.frame,scale);this._scale=scale;this.sync();}
 validate(frame:any){if(this.dead)throw new Error('native projection disposed');this.checkPositions(frame);return this.native.validate(frame);}
 apply(frame:any){this.validate(frame);const changed=this.native.apply(frame);this.frame=frame;if(changed)this.sync();return changed;}
 private sync(){
  if(!this.inputA||!this.inputB)return;
  const fill=(source:any,texture:THREE.DataTexture|null,authored:Float32Array,mask:Uint8Array)=>{
   if(!texture){texture=new THREE.DataTexture(source.image.data.slice(),source.image.width,source.image.height,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;}
   const data=texture.image.data as unknown as Float32Array,input=source.image.data as Float32Array;
   for(let i=0,slot=0;i<input.length;i+=4,slot++){
    if(mask[slot]){data[i]=input[i]*this._scale;data[i+1]=input[i+1]*this._scale;data[i+2]=input[i+2]*this._scale;}
    else{data[i]=authored[i];data[i+1]=authored[i+1];data[i+2]=authored[i+2];}
    data[i+3]=authored[i+3];
   }
   texture.needsUpdate=true;return texture;
  };
  // Negative acceptance only: admitted frames stop short of the GPU-bound
  // textures. Nothing in the application sets this; a cut consumer must fail.
  if((globalThis as any).__OI_TEST_DISCONNECT_NATIVE_TARGETS__===true&&this.a&&this.b)return;
  this.a=fill(this.inputA,this.a,this.authoredA,this.maskA);this.b=fill(this.inputB,this.b,this.authoredB,this.maskB);this.port.setTargetTextures(this.a,this.b,this.centre);
 }
 checkpoint(renderer:any){return this.native.checkpoint(renderer);}
 restore(renderer:any,checkpoint:any){this.native.restore(renderer,checkpoint);this.sync();}
 inspect(){return{native:this.native.lastReceipt,presentation_units_per_metre:this._scale,target_a:this.a?.image.data,target_b:this.b?.image.data,admitted_a:this.inputA?.image.data};}
 dispose(){if(this.dead)return;this.dead=true;this.native.dispose();this.a?.dispose();this.b?.dispose();}
}
