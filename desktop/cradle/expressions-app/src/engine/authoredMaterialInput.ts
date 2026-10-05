import type {AuthoredMaterialSnapshot} from './authoredMaterialSampling';
import {authoredSourceKey,type AuthoredSourceCoordinate} from './authoredSourceCoordinates';
import {MAX_MATERIAL_SAMPLES,retainMaterialSamples,type RetainedMaterial,type RetainMaterialInput} from './materialFold';

/** These are existing material compiler operands supplied by their owner.
 * They remain authored input here, never Source/body/clock or GPU admission. */
export type AuthoredMaterialInputOperands=Omit<RetainMaterialInput,'targetData'|'sampleCount'|'layerZ'|'samplingSignature'>;

/** Select one exact retained range, without sampling, normalizing its extent,
 * applying Entity placement, or treating coverage alpha as a physical radius.
 * Existing horizontal sampler XYZ is unprojected to its local XY/depth chart;
 * layer_z is already in that target and must not be added a second time. */
export function retainAuthoredMaterialRange(snapshot:AuthoredMaterialSnapshot,lane:'a'|'b',coordinate:AuthoredSourceCoordinate,operands:AuthoredMaterialInputOperands):RetainedMaterial {
  const key=authoredSourceKey(coordinate);
  if(snapshot?.schema!=='oi.authored-material-snapshot/v1'||snapshot.standing!=='authored_material_basis_only'||snapshot.coordinate_domain!=='engine_effective_material_ranges'||coordinate.entity_ref!==snapshot.entity_view_id||!['a','b'].includes(lane)||!['vertical','horizontal'].includes(snapshot.plane))throw Error('Exact authored material basis and lane required');
  const ranges=lane==='a'?snapshot.ranges_a:snapshot.ranges_b,target=lane==='a'?snapshot.target_a:snapshot.target_b;
  if(!Array.isArray(ranges))throw Error('The exact retained material range set is unavailable');
  const matches=ranges.filter(range=>range.source_coordinate&&authoredSourceKey(range.source_coordinate)===key);
  if(matches.length!==1)throw Error('Authored material coordinate is missing or ambiguous in this retained lane');
  const range=matches[0],count=range.end-range.start,offset=range.start-snapshot.start;
  if(coordinate.component==='layer'&&(range.layer_ref!==coordinate.constituent_ref||range.parent_ref!==coordinate.parent_ref))throw Error('Retained layer coordinate disagrees with its containing material range');
  if(!Number.isSafeInteger(range.start)||!Number.isSafeInteger(range.end)||!Number.isSafeInteger(count)||count<=0||count>MAX_MATERIAL_SAMPLES||!Number.isSafeInteger(offset)||offset<0||range.end>snapshot.end||!(target instanceof Float32Array)||target.length!==(snapshot.end-snapshot.start)*4)throw Error('The exact retained material range is unavailable');
  const canonical=new Float32Array(count*4);
  for(let i=0;i<count;i++) {
    const at=(offset+i)*4,to=i*4;
    canonical[to]=target[at];
    canonical[to+1]=snapshot.plane==='horizontal'?-target[at+2]:target[at+1];
    canonical[to+2]=snapshot.plane==='horizontal'?target[at+1]:target[at+2];
    canonical[to+3]=target[at+3];
  }
  return retainMaterialSamples({...operands,samplingSignature:snapshot.sampling_signature,targetData:canonical,sampleCount:count,layerZ:0});
}
