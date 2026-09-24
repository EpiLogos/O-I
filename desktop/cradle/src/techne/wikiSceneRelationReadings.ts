/** Transient source semantics for exact native relation bindings. The source
 * Wiki keeps direction; this adapter never adds it to an Expression or Scene. */
import type {ExpressionDocument,Scene} from '../expression/types';
import {CONSTRUCTION,PARTICIPATION,RELATION,type NativeRelation,type WikiRegister} from '../knowledge/construction';
import {knowledgeEntityRef} from '../knowledge/expressionProjection';
export interface WikiSceneRelationReading {
 binding_ref:string;relation_ref:string;relation_revision:string;
 direction:'directed'|'undirected'|'bidirectional';
 from_participation_ref:string;to_participation_ref:string;frame_ref:string;
}
export async function wikiSceneRelationReadings({document,scene,current}:{document:ExpressionDocument;scene:Scene;current:WikiRegister}):Promise<WikiSceneRelationReading[]> {
 if(!document.scenes.some(row=>row.scene_ref===scene.scene_ref))throw Error('The source reading names another Scene');
 const refs=new Set(scene.entity_refs),result:WikiSceneRelationReading[]=[];
 const basis={ref:`wiki:${current.file.location.path}`,revision:current.file.revision};
 for(const binding of Object.values(document.relations)){
  if(!refs.has(binding.from_entity_ref)||!refs.has(binding.to_entity_ref)||binding.native_owner==='oi')continue;
  const source=current.relations.find(row=>row.ref===binding.relation.ref);
  if(!source)continue; // No source assertion is unknown, never a guessed arrow.
  if(binding.relation.availability!=='available'||String(source.revision)!==binding.relation.revision)throw Error('The source relation changed; refresh its native composition before showing direction.');
  const meta=source[RELATION],direction=meta.direction;
  if(!['directed','undirected','bidirectional'].includes(direction)||meta.standing==='retracted')throw Error('The source relation has no current supported direction.');
  const frameRef=(source as NativeRelation & {origin_ref?:string}).origin_ref;
  const frame=current.frames.find(row=>row.ref===frameRef);
  if(!frame||!frame[CONSTRUCTION])throw Error('The relation has no exact native constellation owner.');
  const from=frame.constellations[0].members.find(row=>row[PARTICIPATION].participation_ref===meta.from_participation_ref);
  const to=frame.constellations[0].members.find(row=>row[PARTICIPATION].participation_ref===meta.to_participation_ref);
  if(!from||!to||from.ref!==source.from_ref||to.ref!==source.to_ref)throw Error('The source relation participation endpoints no longer agree.');
  for(const [member,entityRef] of [[from,binding.from_entity_ref],[to,binding.to_entity_ref]] as const){
   if(await knowledgeEntityRef(document.expression_ref,member[PARTICIPATION].participation_ref)!==entityRef)throw Error('The relation addresses another occurrence of this source.');
   const subject=document.entities[entityRef]?.subject;
   if(!subject||subject.subject_ref!==member.ref||!subject.readings.some(row=>row.ref===frame.ref&&row.revision===String(frame.revision)&&row.availability==='available')||!subject.readings.some(row=>row.ref===basis.ref&&row.revision===basis.revision&&row.availability==='available'))throw Error('The relation occurrence has stale or absent source bindings.');
  }
  result.push({binding_ref:binding.binding_ref,relation_ref:source.ref,relation_revision:String(source.revision),direction:direction as WikiSceneRelationReading['direction'],from_participation_ref:meta.from_participation_ref,to_participation_ref:meta.to_participation_ref,frame_ref:frame.ref});
 }
 return result;
}

/** Existing bound source edges for instrument context. These are read from
 * their current Wiki owner, independent of an incomplete search index. */
export function wikiSceneSourceRelations({document,scene,current}:{document:ExpressionDocument;scene:Scene;current:WikiRegister}) {
 const raw:unknown=JSON.parse(current.file.content);
 const rows:unknown[]=Array.isArray(raw)?raw:raw&&typeof raw==='object'&&Array.isArray((raw as {objects?:unknown}).objects)?(raw as {objects:unknown[]}).objects:[];
 const members=new Set(scene.entity_refs),basis=`wiki:${current.file.location.path}`;
 const relation_readings=Object.values(document.relations).filter(binding=>binding.native_owner!=='oi'&&members.has(binding.from_entity_ref)&&members.has(binding.to_entity_ref)).map(binding=>{
  const matches=rows.filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object'&&!Array.isArray(row)&&(row as {ref?:unknown}).ref===binding.relation.ref);
  if(matches.length!==1)throw Error('A bound Scene relation is unavailable in its exact native Wiki source.');
  const source=matches[0],from=document.entities[binding.from_entity_ref]?.subject,to=document.entities[binding.to_entity_ref]?.subject;
  if(source.object!=='edge'||typeof source.relation!=='string'||!source.relation||binding.relation.availability!=='available'||binding.relation.revision!==String(source.revision)||!from||!to||source.from_ref!==from.subject_ref||source.to_ref!==to.subject_ref)throw Error('A bound native relation or its endpoints changed; refresh this Scene before reading its relations.');
  if([from,to].some(subject=>!subject.readings.some(row=>row.ref===basis&&row.revision===current.file.revision&&row.availability==='available')))throw Error('A relation endpoint has no current native register binding.');
  return {binding_ref:binding.binding_ref,relation_ref:binding.relation.ref,relation_revision:binding.relation.revision,native_owner:binding.native_owner,from_entity_ref:binding.from_entity_ref,to_entity_ref:binding.to_entity_ref,from_subject_ref:from.subject_ref,to_subject_ref:to.subject_ref,relation:source.relation};
 });
 return {schema:'oi.scene-source-relations/v1',expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref,register:{source_ref:current.source_ref,reading_ref:basis,revision:current.file.revision},relation_readings};
}
