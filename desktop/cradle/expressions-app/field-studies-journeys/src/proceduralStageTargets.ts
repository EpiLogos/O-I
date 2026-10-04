/** Address navigation over actual loaded KernelConversion material. It does
 * not select/relabel a native subject, infer a locus, or change host focus. */
import {studioBasis,type StudioSnapshot} from './proceduralStudio';
import {addressKey,validateAddress,type StageAddress} from './proceduralRetention';
export interface StageConstituent {address:StageAddress;label:string;}
export function stageConstituents(snapshot:StudioSnapshot):StageConstituent[]{
 const expression_ref=studioBasis(snapshot).expression_ref,rows:StageConstituent[]=[],seen=new Set<string>();
 const add=(address:StageAddress,label:string)=>{address=validateAddress(address);const key=addressKey(address);if(seen.has(key))throw Error('An actual loaded constituent address is ambiguous');seen.add(key);rows.push({address,label});};
 add({expression_ref,scene_ref:null,entity_ref:null,component:'expression',constituent_ref:null,property:null},'Whole Expression');
 for(const native of snapshot.view.document.scenes){
  const entries=Object.entries(snapshot.view.bindings).filter(([,binding])=>binding.scene_ref===native.scene_ref);
  if(entries.length!==1)throw Error('The native Scene has no unique current view binding');
  const [viewId,binding]=entries[0],scene=snapshot.journey.scenes.find(scene=>scene.id===viewId);if(!scene)throw Error('The current native Scene view is unavailable');
  const base={expression_ref,scene_ref:native.scene_ref,entity_ref:null,constituent_ref:null,property:null};
  add({...base,component:'scene'},`${scene.name} · Scene`);add({...base,component:'field'},`${scene.name} · field`);
  for(const entity of scene.entities){
   const occurrences=binding.occurrences.filter(o=>o.view_entity_id===entity.id);
   if(occurrences.length!==1||!binding.loaded_refs.includes(occurrences[0].entity_ref)||!native.entity_refs.includes(occurrences[0].entity_ref)||!snapshot.view.document.entities[occurrences[0].entity_ref])throw Error('The visible constituent has no exact loaded native Entity occurrence');
   const root={...base,entity_ref:occurrences[0].entity_ref};
   const entityName=`${scene.name} · ${entity.name}`;
   add({...root,component:'entity'},`${entityName} · ${entity.kind==='pin'?'force occurrence':'formation'}`);
   add({...root,component:'force'},`${entityName} · force`);add({...root,component:'sequence'},`${entityName} · movement / sequence`);
   for(const layer of entity.layers??[])add({...root,component:'layer',constituent_ref:layer.id,parent_ref:null},`${entityName} · base layer ${layer.text||layer.id}`);
   for(const step of entity.sequence.steps){add({...root,component:'sequence_link',constituent_ref:step.id},`${entityName} · state ${step.name||step.text||step.id}`);for(const layer of step.layers??[])add({...root,component:'layer',constituent_ref:layer.id,parent_ref:step.id},`${entityName} · state ${step.id} · layer ${layer.text||layer.id}`);}
  }
 }
 return rows;
}
/** Missing choices remain selected as an explicit unavailable coordinate.
 * They never redirect to the first similarly named constituent on a pulse. */
export function constituentOptions(rows:readonly StageConstituent[],selected:string):Array<[string,string]>{const choices=rows.map(row=>[addressKey(row.address),row.label] as [string,string]);if(selected&&!choices.some(([key])=>key===selected))choices.push([selected,'Original native constituent is unavailable; selection retained']);return choices;}
