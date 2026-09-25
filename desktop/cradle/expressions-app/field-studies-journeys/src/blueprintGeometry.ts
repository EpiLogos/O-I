/** Presentation constraints over the exact pinned QL owner reading. */
import owner from '../../../kernel/src/expression_blueprint_sixfold.json' with {type:'json'};
import type {PointCloudConfig} from '../../src/engine/types';
export const BLUEPRINT_READING_DIGEST='sha256:4d148c4155b5a16ff6bcafedf024bae3b3f60206a965b70a4fe69b58a1660139';
export const BLUEPRINT_SHAPE=owner.shape_ref;
export interface BlueprintTransform {translation:[number,number,number];rotation:[number,number,number];scale:number}
export interface SceneBlueprint {schema:'oi.scene-blueprint/v1';shape_ref:string;reading_digest:string;frame:{ref:string;revision:string;availability:'available'};members:{entity_ref:string;subject_ref:string;role_ref:string;position:number}[];transform:BlueprintTransform}
export function validateBlueprint(value:SceneBlueprint):void {
 const fail=()=>{throw Error('The Scene blueprint does not match its exact native sixfold presentation');};
 if(!value||value.schema!=='oi.scene-blueprint/v1'||value.shape_ref!==BLUEPRINT_SHAPE||value.reading_digest!==BLUEPRINT_READING_DIGEST||value.frame?.availability!=='available'||!value.frame.ref||!value.frame.revision||!Array.isArray(value.members)||value.members.length>6)fail();
 const t=value.transform;
 if(!t||!Array.isArray(t.translation)||t.translation.length!==3||!t.translation.every(v=>Number.isFinite(v)&&Math.abs(v)<=1600)||!Array.isArray(t.rotation)||t.rotation.length!==3||!t.rotation.every(v=>Number.isFinite(v)&&Math.abs(v)<=1000)||!Number.isFinite(t.scale)||t.scale<.01||t.scale>1600)fail();
 const ids=new Set<string>(),roles=new Set<string>(),positions=new Set<number>();
 for(const m of value.members){if(!m.entity_ref||!m.subject_ref||!m.role_ref||!Number.isInteger(m.position)||m.position<0||m.position>5||ids.has(m.entity_ref)||roles.has(m.role_ref)||positions.has(m.position))fail();ids.add(m.entity_ref);roles.add(m.role_ref);positions.add(m.position);}
}
export function blueprintPosition(binding:SceneBlueprint,position:number):[number,number,number]{
 const site=owner.sites.find(s=>s.address.coordinate.position===position);if(!site)throw Error('This role has no supplied QL position');
 let [x,y,z]=site.xyz;const [rx,ry,rz]=binding.transform.rotation;
 [y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];
 [x,z]=[x*Math.cos(ry)+z*Math.sin(ry),-x*Math.sin(ry)+z*Math.cos(ry)];
 [x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];
 return [x,y,z].map((v,i)=>v*binding.transform.scale+binding.transform.translation[i]) as [number,number,number];
}
export function blueprintMember(scene:{composition:{blueprint?:SceneBlueprint}},id:string):boolean{return !!scene.composition.blueprint?.members.some(m=>m.entity_ref===id);}
/** Enforce actual engine anchors after retained native configuration merges. */
export function applyBlueprintAnchors(scene:{composition:{blueprint?:SceneBlueprint}},config:PointCloudConfig):PointCloudConfig{
 const binding=scene.composition.blueprint;if(!binding)return config;validateBlueprint(binding);
 const result={...config,entities:config.entities?.map(entity=>({...entity}))};
 for(const member of binding.members){
  const entity=result.entities?.find(e=>e.id===member.entity_ref);if(!entity)continue;
  if(entity.sequence.links.some(step=>step.x!==undefined||step.y!==undefined||step.z!==undefined))throw Error('Release the blueprint before running positional sequence steps');
  const index=result.entities!.indexOf(entity);
  if(config.automations?.some(lane=>lane.enabled&&['x','y','z'].some(axis=>lane.path.endsWith(`.${axis}`))&&[String(index),member.entity_ref].some(key=>lane.path.startsWith(`entities.${key}.`))))throw Error('Release the blueprint before automating individual positions');
  const [x,y,z]=blueprintPosition(binding,member.position);entity.x=x;entity.y=y;entity.z=z;
 }
 return result;
}
