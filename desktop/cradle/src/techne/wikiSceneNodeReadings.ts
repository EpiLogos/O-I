/** Transient metadata from the current native Wiki, never a Scene mutation. */
import type {ExpressionDocument,Scene} from '../expression/types';
import type {WikiRegister} from '../knowledge/construction';
export function wikiSceneNodeReadings({document,scene,current}:{document:ExpressionDocument;scene:Scene;current:WikiRegister}) {
 const parsed:unknown=JSON.parse(current.file.content);
 const rows:unknown[]=Array.isArray(parsed)?parsed:parsed&&typeof parsed==='object'&&Array.isArray((parsed as {objects?:unknown}).objects)?(parsed as {objects:unknown[]}).objects:[];
 const basis=`wiki:${current.file.location.path}`;
 const node_readings=scene.entity_refs.flatMap(entity_ref=>{
  const subject=document.entities[entity_ref]?.subject;
  if(!subject)return [];
  const matches=rows.filter((value):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(value as {ref?:unknown}).ref===subject.subject_ref);
  if(matches.length!==1)throw Error('A Scene source has no unique current native Wiki object; node tags are unavailable.');
  const node=matches[0];
  if(node.object!=='node'&&node.object!=='space')throw Error('This Scene source does not disclose native node or space tags.');
  const subject_revision=String(node.revision);
  if(typeof node.revision!=='number'||!Number.isSafeInteger(node.revision)||Number(node.revision)<1||!subject.readings.some(row=>row.ref===subject.subject_ref&&row.revision===subject_revision&&row.availability==='available'))throw Error('A Scene source node revision changed; refresh its composition before reading tags.');
  if(!subject.readings.some(row=>row.ref===basis&&row.revision===current.file.revision&&row.availability==='available'))throw Error('A Scene member has no exact current Wiki register binding; node tags are incomplete.');
  // Same tags extension semantics as AIKit wiki_graph::string_values: a
  // string or the string members of an array, sorted and deduplicated.
  const tags=[...new Set(typeof node.tags==='string'?[node.tags]:Array.isArray(node.tags)?node.tags.filter((value):value is string=>typeof value==='string'):[])].sort();
  return [{entity_ref,subject_ref:subject.subject_ref,native_owner:subject.native_owner,subject_revision,tags}];
 });
 return {schema:'oi.scene-node-readings/v1',expression_ref:document.expression_ref,revision:document.revision,scene_ref:scene.scene_ref,register:{source_ref:current.source_ref,reading_ref:basis,revision:current.file.revision},node_readings};
}
