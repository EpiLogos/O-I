/** Bind retained centre occurrences to the saved reading's exact native anatomy.
 * Preparation is read-only. The caller submits every change in one Expression CAS.
 */
import type {Change,ExpressionDocument,SubjectBinding,Relation} from '../../../src/expression/types';
import {prepareOccurrenceEdit} from './nativeOccurrence';
import {kernelDocumentToJourney} from './kernelDocumentBridge';
import {CHAKRA_DEFINITIONS,type ChakraId} from '../../src/engine/semantics/chakraSemantics';
import {validateCoordinateExpression,type CoordinateRequest,type CoordinateExpressionResult} from '../../../src/nara/coordinateExpression';

type SourceRelation=CoordinateExpressionResult['binding']['source_relations'][number];
export interface PersonalCentreBinding {ordinal:number;entity_ref:string;source_ref:string;subject_binding:SubjectBinding}
export interface PersonalBodyPreparation {
 changes:Change[];centres:PersonalCentreBinding[];source_relations:SourceRelation[];
 earth:{source_ref:string;binding:SubjectBinding;relations:SourceRelation[];standing:string}|null;
}
export interface PersonalBodyInput {
 document:ExpressionDocument;scene_ref:string;centre_evidence:readonly unknown[];
 template_bindings:readonly {entity_ref:string;chakraId:ChakraId}[];
 earth_entity_ref?:string;create_earth?:{entity_ref:string};
}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const same=(left:unknown,right:unknown)=>JSON.stringify(left,sorted)===JSON.stringify(right,sorted);
function sorted(_key:string,value:unknown):unknown{return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value;}

export async function preparePersonalBodyBindings(
 readCoordinate:(request:CoordinateRequest)=>Promise<CoordinateExpressionResult>,input:PersonalBodyInput,
):Promise<PersonalBodyPreparation>{
 const {document,scene_ref,template_bindings,centre_evidence}=input;
 const scene=document.scenes.find(value=>value.scene_ref===scene_ref);
 if(!scene||document.selection.scene_ref!==scene_ref)throw Error('Select the retained seven-centre scene before binding your body.');
 if(template_bindings.length!==7||centre_evidence.length!==7||new Set(template_bindings.map(value=>value.entity_ref)).size!==7)throw Error('Exactly seven distinct retained centres and seven saved native body readings are required.');
 const material=object(scene.presentation?.scene),occurrences=Array.isArray(material.entities)?material.entities.map(object):[];
 if(input.earth_entity_ref&&input.create_earth)throw Error('Choose an existing Earth occurrence or create one, not both.');
 const changes:Change[]=[],centres:PersonalCentreBinding[]=[],source_relations:SourceRelation[]=[];
 const resolved:CoordinateExpressionResult[]=[];
 const bind=(entity_ref:string,binding:SubjectBinding)=>{
  const entity=document.entities[entity_ref];
  if(!entity||!scene.entity_refs.includes(entity_ref))throw Error('A retained centre is no longer in the selected native scene.');
  if(entity.subject&&!same(entity.subject,binding))throw Error('A centre already has a different native identity; its binding was preserved.');
  if(!entity.subject)changes.push({change:'subject_bind',entity_ref,binding});
 };
 for(const definition of CHAKRA_DEFINITIONS){
  const candidates=template_bindings.filter(value=>value.chakraId===definition.id);
  if(candidates.length!==1)throw Error('The retained template must contain each canonical chakra ID exactly once.');
  const {entity_ref}=candidates[0];
  const retained=occurrences.filter(value=>value.id===entity_ref&&object(value.native).chakraId===definition.id);
  if(retained.length!==1)throw Error('The native occurrence does not retain the declared template chakra ID.');
 }
 for(const definition of CHAKRA_DEFINITIONS){
  const {entity_ref}=template_bindings.find(value=>value.chakraId===definition.id)!;
  const readings=centre_evidence.map(object).filter(value=>value.ordinal===definition.order);
  if(readings.length!==1)throw Error('The saved reading must contain each native centre ordinal exactly once.');
  const evidence=readings[0],body=object(evidence.body),zone=object(body.body_zone);
  if(body.ordinal!==definition.order||evidence.native_m2_chakra_id!==definition.order+1||typeof zone.source_ref!=='string')throw Error('The saved centre has no exact native body source.');
  const reading=validateCoordinateExpression(await readCoordinate({coordinate_ref:zone.source_ref,face:'bimba'}));
  const basis=reading.binding;
  if(resolved.length&&basis.rooted_world.registry_revision!==resolved[0].binding.rooted_world.registry_revision)throw Error('The native registry changed while resolving the seven centres.');
  if(basis.coordinate_ref!==zone.source_ref||basis.rooted_world.registry_revision!==zone.registry_revision)throw Error('The saved body source changed. Refresh the native identity reading before binding.');
  const source=basis.property_sources.find(value=>value.record.record_index===zone.record_index&&value.record.payload_sha256===zone.payload_sha256&&value.file.path===zone.path&&value.file.git_blob===zone.git_blob&&value.source_repository===zone.repository&&value.source_revision===zone.revision);
  if(!source)throw Error('The saved anatomical property is absent from the current native coordinate source.');
  bind(entity_ref,reading.subject_binding);resolved.push(reading);
  centres.push({ordinal:definition.order,entity_ref,source_ref:zone.source_ref,subject_binding:reading.subject_binding});
 }
 const root=centres.find(value=>value.ordinal===0)!;
 const grounding=resolved[0].binding.source_relations.filter(relation=>relation.to_ref===root.source_ref&&relation.from_ref!==null&&['GROUNDS_CHAKRAL_PATHWAY','FEEDS_EARTH_ELEMENT'].includes(relation.source_kind));
 const earthRefs=[...new Set(grounding.map(relation=>relation.from_ref!))];
 let earth:PersonalBodyPreparation['earth']=null;
 let earthEntityRef=input.earth_entity_ref??input.create_earth?.entity_ref;
 if(earthRefs.length===1){
  const reading=validateCoordinateExpression(await readCoordinate({coordinate_ref:earthRefs[0],face:'bimba'}));
  if(reading.binding.rooted_world.registry_revision!==resolved[0].binding.rooted_world.registry_revision)throw Error('The native Earth and centre readings use different registry revisions.');
  const relations=grounding.filter(relation=>reading.binding.source_relations.some(value=>same(value,relation)));
  if(relations.length!==grounding.length)throw Error('The native Earth grounding relations disagree with the root-centre reading.');
  const subject={...reading.subject_binding,readings:[...reading.subject_binding.readings,reading.subject_binding.sources[0]]};
  const existingEarth=input.create_earth?scene.entity_refs.filter(ref=>document.entities[ref]?.subject?.subject_ref===subject.subject_ref&&document.entities[ref]?.subject?.native_owner===subject.native_owner):[];
  if(existingEarth.length>1)throw Error('More than one Earth occurrence is bound in this scene; select the intended anchor explicitly.');
  if(existingEarth.length===1)earthEntityRef=existingEarth[0];
  const earthRef=earthEntityRef;
  if(earthRef){
   if(centres.some(centre=>centre.entity_ref===earthRef))throw Error('Earth must remain a separate occurrence from the seven centres.');
   if(input.create_earth&&!existingEarth.length){
    const title=reading.binding.labels.join(' · ');
    if(!title)throw Error('The native Earth source has no disclosed title.');
    const insertion=prepareOccurrenceEdit(kernelDocumentToJourney(document),{operation:'insert-source',scene_ref,new_entity_ref:earthRef,title,binding:subject});
    changes.push(...insertion.request.changes.filter(change=>change.change!=='focus') as Change[]);
   }else bind(earthRef,subject);
  }
  earth={source_ref:earthRefs[0],binding:subject,relations,standing:earthRef?'Separate Earth occurrence and exact source grounding relations prepared; presentation is authored, with no numerical grounding law applied.':'Source grounding relations resolved; no separate Earth occurrence was supplied, so none were applied.'};
 }else if(input.earth_entity_ref||input.create_earth)throw Error('The native root source does not disclose one unambiguous Earth grounding anchor.');
 const endpoints=new Map(centres.map(centre=>[centre.source_ref,{entity_ref:centre.entity_ref,subject:centre.subject_binding}]));
 if(earth&&earthEntityRef)endpoints.set(earth.source_ref,{entity_ref:earthEntityRef,subject:earth.binding});
 const rows=[...resolved.flatMap(reading=>reading.binding.source_relations),...(earth?.relations??[])];
 const distinct=new Map<string,SourceRelation>();
 for(const relation of rows){
  if(!relation.from_ref||!relation.to_ref||!endpoints.has(relation.from_ref)||!endpoints.has(relation.to_ref))continue;
  if(!['ASCENDS_TO','GROUNDS_CHAKRAL_PATHWAY','FEEDS_EARTH_ELEMENT'].includes(relation.source_kind))continue;
  const prior=distinct.get(relation.relation_ref);
  if(prior&&!same(prior,relation))throw Error('Native centre relation readings disagree.');
  distinct.set(relation.relation_ref,relation);
 }
 for(const relation of [...distinct.values()].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!/^[0-9a-f]{16}$/.test(relation.id))throw Error('The native relation has no exact stable registry ID.');
  const from=endpoints.get(relation.from_ref!)!,to=endpoints.get(relation.to_ref!)!;
  const binding:Relation={binding_ref:`${document.expression_ref}:relation:body-${relation.id}`,native_owner:'ql-mef',relation:{ref:relation.relation_ref,revision:resolved[0].binding.rooted_world.registry_revision,availability:'available'},from_entity_ref:from.entity_ref,to_entity_ref:to.entity_ref,provenance:[from.subject.sources[0],to.subject.sources[0]]};
  const prior=document.relations[binding.binding_ref];
  if(prior&&!same(prior,binding))throw Error('An existing relation conflicts with this native body binding; it was preserved.');
  if(!prior)changes.push({change:'relation_bind',binding});
  source_relations.push(relation);
 }
 if(changes.length>256)throw Error('The complete body binding exceeds the native atomic edit budget.');
 return {changes,centres,earth,source_relations};
}
