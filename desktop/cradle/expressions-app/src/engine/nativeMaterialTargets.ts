import type {AuthoredMaterialSnapshot} from './authoredMaterialSampling';
import {authoredSourceKey} from './authoredSourceCoordinates';
import {evaluateNativeBodyMaterial,type PhysicalNodeSnapshot,type PreparedNativeBodyMaterial} from './materialFold';

/** Existing retained-partition data. These fields locate local targets; they
 * do not admit a native owner, Source, physical body or callback. */
export interface NativeMaterialPartition {
 readonly schema:'oi.retained-partition-snapshot/v1';
 readonly partition_signature:string;readonly slot_count:number;
 readonly particle_count:number;readonly connection_start:number;
 readonly partitions:readonly {entity_ref:string;start:number;end:number}[];
}
export interface NativeMaterialTargetBasis {
 readonly entity_view_id:string;readonly partition_signature:string;
 readonly start:number;readonly end:number;readonly slot_count:number;
 readonly plane:AuthoredMaterialSnapshot['plane'];
 readonly allocation_generation:number;readonly bake_generation:number;
 readonly layout_signature:string;readonly sampling_signature:string;
 readonly range_keys_a:readonly string[];readonly range_keys_b:readonly string[];
}
const need=(ok:unknown,reason:string):void=>{if(!ok)throw Error(reason);};
const basisFields=['entity_view_id','partition_signature','start','end','slot_count','plane','allocation_generation','bake_generation','layout_signature','sampling_signature'] as const;

/** A cheap sampler/partition invalidation operand, never a native grant.
 * Capture from the original completed sampler, not from carrier body nodes. */
export function nativeMaterialTargetBasis(snapshot:AuthoredMaterialSnapshot,partition:NativeMaterialPartition):NativeMaterialTargetBasis {
 need(snapshot?.schema==='oi.authored-material-snapshot/v1'&&snapshot.standing==='authored_material_basis_only'&&snapshot.coordinate_domain==='engine_effective_material_ranges','Original retained authored sampler basis required');
 need(partition?.schema==='oi.retained-partition-snapshot/v1'&&partition.partition_signature.length>0&&Number.isSafeInteger(partition.slot_count)&&partition.slot_count>0&&Number.isSafeInteger(partition.connection_start)&&partition.connection_start>=0&&partition.connection_start<=partition.slot_count&&Number.isSafeInteger(partition.particle_count)&&partition.particle_count>=0&&partition.particle_count<=partition.slot_count,'Original retained partition required');
 // Preserve the actual retained port's complete particle topology law.
 // Selected-row equality cannot fence an overlapping foreign partition.
 need(Array.isArray(partition.partitions),'Complete original retained partition topology required');
 let cursor=0;const entityRefs=new Set<string>();
 for(const row of partition.partitions){
  need(typeof row?.entity_ref==='string'&&row.entity_ref.length>0&&!row.entity_ref.includes('\0')&&Number.isSafeInteger(row.start)&&Number.isSafeInteger(row.end)&&row.start===cursor&&row.end>row.start&&row.end<=partition.connection_start&&!entityRefs.has(row.entity_ref),'Original retained partition topology is invalid');
  cursor=row.end;entityRefs.add(row.entity_ref);
 }
 need(cursor===partition.connection_start,'Original retained partitions must cover the particle domain exactly');
 const matches=partition.partitions.filter(row=>row.entity_ref===snapshot.entity_view_id);
 need(matches.length===1&&matches[0].start===snapshot.start&&matches[0].end===snapshot.end&&Number.isSafeInteger(snapshot.start)&&Number.isSafeInteger(snapshot.end)&&snapshot.start>=0&&snapshot.end>snapshot.start&&snapshot.end<=partition.connection_start,'Exact full entity sampler partition required');
 need(['vertical','horizontal'].includes(snapshot.plane)&&Number.isSafeInteger(snapshot.allocation_generation)&&snapshot.allocation_generation>0&&Number.isSafeInteger(snapshot.bake_generation)&&snapshot.bake_generation>0&&snapshot.layout_signature.length>0&&snapshot.sampling_signature.length>0,'Original sampler generation and local plane required');
 const keys=(ranges:AuthoredMaterialSnapshot['ranges_a'])=>{
  need(Array.isArray(ranges),'Complete original material ranges required');
  let end=snapshot.start;const result:string[]=[];
  for(const range of ranges){
   need(range.start===end&&Number.isSafeInteger(range.end)&&range.end>=range.start&&range.end<=snapshot.end&&range.source_coordinate?.entity_ref===snapshot.entity_view_id,'Original full containing material coordinate required');
   const coordinate=range.source_coordinate!;
   if(coordinate.component==='layer')need(coordinate.constituent_ref===range.layer_ref&&coordinate.parent_ref===range.parent_ref,'Retained layer parent coordinate differs from its sampler');
   result.push(JSON.stringify([authoredSourceKey(coordinate),range.start,range.end]));end=range.end;
  }
  need(end===snapshot.end,'Material ranges do not cover the selected sampler partition');
  return Object.freeze(result);
 };
 return Object.freeze({entity_view_id:snapshot.entity_view_id,partition_signature:partition.partition_signature,start:snapshot.start,end:snapshot.end,slot_count:partition.slot_count,plane:snapshot.plane,allocation_generation:snapshot.allocation_generation,bake_generation:snapshot.bake_generation,layout_signature:snapshot.layout_signature,sampling_signature:snapshot.sampling_signature,range_keys_a:keys(snapshot.ranges_a),range_keys_b:keys(snapshot.ranges_b)});
}
function sameBasis(a:NativeMaterialTargetBasis,b:NativeMaterialTargetBasis){
 return basisFields.every(key=>a[key]===b[key])&&JSON.stringify(a.range_keys_a)===JSON.stringify(b.range_keys_a)&&JSON.stringify(a.range_keys_b)===JSON.stringify(b.range_keys_b);
}
export interface PreparedNativeMaterialTargets {readonly basis:NativeMaterialTargetBasis}
interface TargetData {
 a:PreparedNativeBodyMaterial;b:PreparedNativeBodyMaterial;
 local_a:Float32Array;local_b:Float32Array;density_a:Float32Array;density_b:Float32Array;
}
const candidates=new WeakMap<PreparedNativeMaterialTargets,TargetData>();

/** Join already prepared native material to the exact original retained A/B
 * samples. Native admission independently supplies each actual body/recipe.
 * This function neither publishes textures nor changes native currentness. */
export function prepareNativeMaterialTargets(snapshot:AuthoredMaterialSnapshot,partition:NativeMaterialPartition,a:PreparedNativeBodyMaterial,b:PreparedNativeBodyMaterial,observed:PhysicalNodeSnapshot,sampleCursor:string|number):PreparedNativeMaterialTargets {
 const basis=nativeMaterialTargetBasis(snapshot,partition),count=basis.end-basis.start;
 const validate=(prepared:PreparedNativeBodyMaterial,original:Float32Array)=>{
  need(original instanceof Float32Array&&original.length===count*4&&original.every(Number.isFinite)&&prepared.material.sampleCount===count,'Native material must cover every original retained sampler slot');
  // Use the already retained native material cohort, not another full export
  // of both typed sampler lists. Its original retained samples/body were
  // compared by the existing prepareNativeBodyMaterial numeric owner.
  const samples=prepared.native.samples,scale=prepared.material.stageUnitsPerMaterialUnit;
  need(samples.length===count,'Native material must cover every original retained sampler slot');
  samples.forEach(({sample},i)=>{
   const at=i*4,xyz=basis.plane==='horizontal'?[original[at],-original[at+2],original[at+1]]:[original[at],original[at+1],original[at+2]];
   need(sample.id===prepared.material.sampleIds[i]&&sample.rest_material.every((value,axis)=>Math.abs(value-xyz[axis]/scale)<=1e-6)&&Math.fround(sample.density)===original[at+3],'Native material input differs from the original sampler depth/density');
  });
  return Float32Array.from(samples.map(({sample})=>sample.density));
 };
 const density_a=validate(a,snapshot.target_a),density_b=validate(b,snapshot.target_b);
 // Existing evaluator validates actual per-point native weights, body/source,
 // sole cursor and the complete surface before writing these private arrays.
 const local_a=evaluateNativeBodyMaterial(a,observed,sampleCursor),local_b=evaluateNativeBodyMaterial(b,observed,sampleCursor);
 need(local_a.every(Number.isFinite)&&local_b.every(Number.isFinite),'Actual local material targets exceed the renderer representation');
 const prepared=Object.freeze({basis});candidates.set(prepared,{a,b,local_a,local_b,density_a,density_b});return prepared;
}
function overlaps(a:Float32Array,b:Float32Array){return a.buffer===b.buffer&&a.byteOffset<b.byteOffset+b.byteLength&&b.byteOffset<a.byteOffset+a.byteLength;}

/** Fill ONLY the selected entity in U's private candidate arrays, after both
 * actual native material lanes validate. U still owns currentness, candidate
 * commit/swap/dispose, magnification and its sole admitted callback.
 * The renderer applies Entity placement once; no placement is performed here. */
export function writeNativeMaterialTargets(prepared:PreparedNativeMaterialTargets,observed:PhysicalNodeSnapshot,sampleCursor:string|number,currentBasis:NativeMaterialTargetBasis,target_a:Float32Array,target_b:Float32Array):void {
 const data=candidates.get(prepared);need(data,'Native material target candidate was not prepared');
 const d=data!,basis=prepared.basis;
 need(sameBasis(basis,currentBasis),'Retained sampler or full material coordinate changed before native receiving');
 need(target_a instanceof Float32Array&&target_b instanceof Float32Array&&target_a.length===basis.slot_count*4&&target_b.length===target_a.length&&!overlaps(target_a,target_b)&&target_a.every(Number.isFinite)&&target_b.every(Number.isFinite),'Separate complete retained candidate arrays required');
 const count=basis.end-basis.start;
 for(let i=0;i<count;i++){
  const at=(basis.start+i)*4+3;
  need(target_a[at]===d.density_a[i]&&target_b[at]===d.density_b[i],'Current retained coverage differs from original material samples');
 }
 evaluateNativeBodyMaterial(d.a,observed,sampleCursor,d.local_a);
 evaluateNativeBodyMaterial(d.b,observed,sampleCursor,d.local_b);
 need(d.local_a.every(Number.isFinite)&&d.local_b.every(Number.isFinite),'Actual local material targets exceed the renderer representation');
 // No caller target changes until both full surfaces and densities pass.
 for(const [target,local] of [[target_a,d.local_a],[target_b,d.local_b]] as const)for(let i=0;i<count;i++){
  const from=i*4,to=(basis.start+i)*4;
  target[to]=local[from];
  target[to+1]=basis.plane==='horizontal'?local[from+2]:local[from+1];
  target[to+2]=basis.plane==='horizontal'?-local[from+1]:local[from+2];
  // Alpha is the unchanged retained source coverage, not a physical radius.
  target[to+3]=local[from+3];
 }
}
