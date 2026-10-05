import type {AuthoredSourceCoordinate} from './authoredSourceCoordinates';
/** The real sampler's local authored basis. No FIELD, Source, body or clock grant. */
import type {Composition, Entity, Shape} from './fieldModel';
import type {GlyphVolumeConfig} from './types';
import {drawVolumeZ,mulberry32} from './glyphVolume';

export const MAX_AUTHORED_MATERIAL_SAMPLES=1048576;
export const MAX_AUTHORED_MATERIAL_METADATA_BYTES=8*1024*1024;

export interface AuthoredCandidate {
 x:number;y:number;z?:number;density:number;hz?:number;cw?:number;
}
export interface AuthoredMaterialRange {
  source_coordinate?:AuthoredSourceCoordinate;
 readonly start:number;readonly end:number;
 readonly link_ref:string;readonly layer_ref:string|null;
 /** Null is an entity base layer; a state layer names its containing link. */
 readonly parent_ref:string|null;
 readonly shape:Shape;readonly source:Entity['authoringSource']|null;
 readonly layer_z:number;readonly layer_scale:number;readonly sampling_layer_scale:number;
 readonly sampling_scale:number;
 readonly geometry_projection:string|null;
}
export interface AuthoredMaterialSnapshot {
 readonly schema:'oi.authored-material-snapshot/v1';
 readonly standing:'authored_material_basis_only';
 readonly coordinate_domain:'engine_effective_material_ranges';
 readonly entity_view_id:string;
 readonly allocation_generation:number;readonly bake_generation:number;
 readonly layout_signature:string;readonly sampling_signature:string;
 readonly plane:Composition['plane'];readonly volume:GlyphVolumeConfig;
 readonly start:number;readonly end:number;
 readonly target_a:Float32Array;readonly target_b:Float32Array;
 readonly ranges_a:readonly AuthoredMaterialRange[];readonly ranges_b:readonly AuthoredMaterialRange[];
}

/** Extracted unchanged from EntityRuntime.writeCandidates. Placement/sequence
 * remain the existing uniforms; this writes only already selected local samples. */
export function writeAuthoredCandidates(
 target:Float32Array,noiseData:Float32Array,start:number,end:number,
 cands:readonly AuthoredCandidate[],scale:number,plane:Composition['plane'],
 jitterPx:number,channel:0|2,depthOffset:number,volume:GlyphVolumeConfig
):void {
 const n=cands.length;
 if(!n){target.fill(0,start*4,end*4);for(let i=start;i<end;i++){noiseData[i*4+channel]=0;noiseData[i*4+channel+1]=0;}return;}
 const volumeOn=volume.enabled&&volume.depth>0;
 const rand=volumeOn?mulberry32((start+1)*2654435761+(channel+1)*40503+n):null;
 const jitter=mulberry32((start+1)*40503+(channel+1)*2654435761+n);
 for(let i=start;i<end;i++){
  const c=cands[Math.floor(((i-start)*0.6180339887498949%1)*n)];
  const jx=(jitter()-0.5)*jitterPx,jy=(jitter()-0.5)*jitterPx;
  noiseData[i*4+channel]=jx;noiseData[i*4+channel+1]=jy;
  const lx=c.x*scale,ly=c.y*scale;
  let lz=(c.z??0)*scale;
  if(volumeOn&&rand&&c.hz!==undefined)lz=drawVolumeZ(Math.max(0,c.hz)*scale,c.cw??0,volume,rand).z;
  lz+=depthOffset;
  const o=i*4;
  if(plane==='horizontal'){target[o]=lx;target[o+1]=lz;target[o+2]=-ly;}
  else{target[o]=lx;target[o+1]=ly;target[o+2]=lz;}
  target[o+3]=c.density;
 }
}

/** Capture the original texture bytes after the completed actual bake. The
 * native current Document/recipe owner separately qualifies source correspondence. */
export function snapshotAuthoredMaterial(input:Omit<AuthoredMaterialSnapshot,'schema'|'standing'|'coordinate_domain'>):AuthoredMaterialSnapshot{
 const {start,end,target_a:a,target_b:b}=input;
 if(!input.entity_view_id||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||
  !Number.isSafeInteger(input.allocation_generation)||input.allocation_generation<=0||!Number.isSafeInteger(input.bake_generation)||input.bake_generation<=0||
  end-start>MAX_AUTHORED_MATERIAL_SAMPLES||!(a instanceof Float32Array)||!(b instanceof Float32Array)||a.length!==(end-start)*4||b.length!==a.length||
  !a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('The actual retained material allocation is unavailable.');
 for(const lane of [input.ranges_a,input.ranges_b]){
  let cursor=start;
  for(const r of lane){
   if(!Number.isSafeInteger(r.start)||!Number.isSafeInteger(r.end)||r.start!==cursor||r.end<r.start||r.end>end||
    !r.link_ref||r.layer_ref!==null&&!r.layer_ref||r.parent_ref!==null&&r.parent_ref!==r.link_ref||
    ![r.layer_z,r.layer_scale,r.sampling_layer_scale,r.sampling_scale].every(Number.isFinite))throw Error('The actual material layer/sequence correspondence is incomplete.');
   cursor=r.end;
  }
  if(cursor!==end)throw Error('The actual material ranges do not cover the retained partition.');
 }
 for(const lane of [a,b])for(let i=3;i<lane.length;i+=4)if(lane[i]<0||lane[i]>1)throw Error('Authored material coverage must be within0–1.');
 // Preflight metadata before any new body/range copy. Images are already
 // authored source data; this read cannot silently retain unbounded duplicates.
 let bytes=0,nodes=0;const seen=new Set<object>();
 const count=(value:unknown,depth:number):void=>{
  if(++nodes>32768||depth>24)throw Error('The material metadata exceeds its retained bound.');
  if(typeof value==='string')bytes+=value.length*2;
  else if(value&&typeof value==='object'){
   if(seen.has(value))return;seen.add(value);
   for(const [key,item]of Object.entries(value)){bytes+=key.length*2+16;count(item,depth+1);}
  }else bytes+=8;
  if(bytes>MAX_AUTHORED_MATERIAL_METADATA_BYTES)throw Error('The material metadata exceeds its retained byte budget.');
 };
 count({ranges_a:input.ranges_a,ranges_b:input.ranges_b,volume:input.volume,sampling_signature:input.sampling_signature,layout_signature:input.layout_signature},0);
 // Slice only the selected view: structuredClone on a subarray would copy
 // its entire shared backing allocation, including unrelated partitions.
 // One graph preserves the same A/B source sharing charged by preflight.
 const metadata=structuredClone({ranges_a:input.ranges_a,ranges_b:input.ranges_b,volume:input.volume});
 const copied={...input,target_a:a.slice(),target_b:b.slice(),...metadata};
 Object.freeze(copied.ranges_a);Object.freeze(copied.ranges_b);
 return Object.freeze({schema:'oi.authored-material-snapshot/v1',standing:'authored_material_basis_only',coordinate_domain:'engine_effective_material_ranges',...copied});
}
