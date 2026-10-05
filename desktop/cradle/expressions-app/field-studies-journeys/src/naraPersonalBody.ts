/** Bind retained centre occurrences to the saved reading's exact native anatomy.
 * Preparation is read-only. The caller submits every change in one Expression CAS.
 */
import type {Change,ExpressionDocument,SubjectBinding,Relation,ReadingRef} from '../../../src/expression/types';
import {readEpiWorldRecord} from './epiWorldProduction';
import {bindPersonalParticipation} from './epiWorldMaterial';
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
 /** Actual selected saved identity; no private profile or current body. */
 personal_basis?:{person_ref:string;nara_ref:string;input_revision:string;identity_source:{source_ref:string;revision:string}};
}
const object=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const same=(left:unknown,right:unknown)=>JSON.stringify(left,sorted)===JSON.stringify(right,sorted);
function sorted(_key:string,value:unknown):unknown{return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value;}


/** Reconstruct only the ordinary producer's declared supplements to the actual
 * coordinate reply. This is binding conservation, not a personal-current read
 * or a new admission. Unknown sources, readings, actions or identities refuse.
 */
function epiParticipantBinding(input:PersonalBodyInput,entity_ref:string,coordinate:SubjectBinding):SubjectBinding|null {
 const {document,scene_ref,personal_basis:basis}=input;
 if(!basis)return null;
 const records=document.scenes.flatMap(scene=>{
  const value=object(scene.presentation?.scene).epiWorld;
  return value===undefined?[]:[value];
 });
 if(records.length!==1)return null;
 const record=readEpiWorldRecord(document);if(!record)return null;
 const world=record.world,receiving=record.receiving,personal=receiving.personal;
 const selected=document.scenes.find(scene=>scene.scene_ref===scene_ref);
 const available=(value:ReadingRef|undefined|null)=>!!value&&typeof value.ref==='string'&&!!value.ref&&typeof value.revision==='string'&&!!value.revision&&value.availability==='available';
 if(!personal||!selected||
    scene_ref!==`${document.expression_ref}:scene:personal`||document.selection.scene_ref!==scene_ref||
    world.instance_ref!==document.expression_ref||receiving.expression_ref!==document.expression_ref||personal.instance_ref!==document.expression_ref||
    !basis.person_ref||!basis.nara_ref||!basis.input_revision||!basis.identity_source.source_ref||!basis.identity_source.revision||
    record.person_ref!==basis.person_ref||record.nara_ref!==basis.nara_ref||record.identity_input_revision!==basis.input_revision||!same(record.identity_source,basis.identity_source)||
    world.subject_ref!==basis.person_ref||receiving.subject_ref!==basis.person_ref||
    !world.event_ref||world.event_ref!==world.snapshot_ref||world.sky?.snapshot_ref!==world.snapshot_ref||receiving.event_ref!==world.event_ref||receiving.snapshot_ref!==world.snapshot_ref||
    !same(personal.person,{ref:basis.person_ref,revision:basis.input_revision,availability:'available'})||
    !same(personal.identity,{ref:basis.identity_source.source_ref,revision:basis.identity_source.revision,availability:'available'})||
    !available(personal.person)||!available(personal.identity)||
    (personal.current!==null&&!available(personal.current))||personal.standing!==(personal.current?'qualified-native-current':'awaiting-native-current')||
    record.native_source?.schema!=='oi.native-expression-composed-source/v1'||typeof record.native_source.request_sha256!=='string'||!record.native_source.request_sha256||
    !same(record.native_source.world_ref,{ref:`ql:scene-world:${document.expression_ref}`,revision:record.native_source.request_sha256,availability:'available'})||
    !world.scene?.sources?.registry_revision)return null;
 const canonicalCentres=CHAKRA_DEFINITIONS.map(definition=>`ql:m-coordinate:bimba:M2-5-0/1-${definition.order+1}`);
 if(!Array.isArray(personal.centre_entity_refs)||personal.centre_entity_refs.length!==7||new Set(personal.centre_entity_refs).size!==7||
    CHAKRA_DEFINITIONS.some(definition=>{
     const ref=personal.centre_entity_refs[definition.order],template=input.template_bindings.filter(value=>value.chakraId===definition.id);
     return template.length!==1||template[0].entity_ref!==ref||!selected.entity_refs.includes(ref)||document.entities[ref]?.subject?.subject_ref!==canonicalCentres[definition.order];
    }))return null;
 const allowed=[...canonicalCentres,'ql:m-coordinate:bimba:M2-5-0/1-0','ql:m-coordinate:bimba:M4.4.4.4',...Array.from({length:6},(_,index)=>`ql:m-coordinate:bimba:M4.${index}`)];
 const participants=personal.participant_entity_refs;
 if(personal.canonical_locus!=='ql:m-coordinate:bimba:M4.4.4.4'||!selected.entity_refs.includes(personal.locus_entity_ref)||document.entities[personal.locus_entity_ref]?.subject?.subject_ref!==personal.canonical_locus||
    !Array.isArray(participants)||participants.length!==allowed.length||new Set(participants).size!==participants.length||!participants.includes(entity_ref)||
    participants.some(ref=>document.entities[ref]?.subject?.native_owner!=='ql-mef'||!allowed.includes(document.entities[ref]?.subject?.subject_ref??''))||
    new Set(participants.map(ref=>document.entities[ref]?.subject?.subject_ref)).size!==allowed.length)return null;
 const binding=structuredClone(coordinate);
 const stamp:ReadingRef={ref:coordinate.subject_ref,revision:world.scene.sources.registry_revision,availability:'available'};
 if(!binding.sources.some(value=>same(value,stamp)))binding.sources.push(stamp);
 binding.readings.push(structuredClone(record.native_source.world_ref));
 return bindPersonalParticipation(binding,null,{person:personal.person,identity:personal.identity,instance_ref:document.expression_ref,nara_ref:record.nara_ref,event_ref:world.event_ref,snapshot_ref:world.snapshot_ref,...(personal.current?{current:personal.current}:{})},personal.current);
}

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
 const bind=(entity_ref:string,binding:SubjectBinding,coordinate:SubjectBinding=binding):SubjectBinding=>{
  const entity=document.entities[entity_ref];
  if(!entity||!scene.entity_refs.includes(entity_ref))throw Error('A retained centre is no longer in the selected native scene.');
  if(!entity.subject){changes.push({change:'subject_bind',entity_ref,binding});return binding;}
  if(same(entity.subject,binding))return entity.subject;
  const expected=epiParticipantBinding(input,entity_ref,coordinate);
  // Earth has one explicit source-reading addition in the original operation.
  // It supplements an exact participant without discarding its existing layers.
  const earthAddition=!same(binding,coordinate)&&same(binding,{...coordinate,readings:[...coordinate.readings,coordinate.sources[0]]});
  const supplemented=expected&&earthAddition?{...expected,readings:[...expected.readings,coordinate.sources[0]]}:expected;
  if(!expected||!(same(entity.subject,expected)||earthAddition&&same(entity.subject,supplemented)))throw Error('A centre already has a different native identity; its binding was preserved.');
  if(earthAddition&&!entity.subject.readings.some(value=>same(value,coordinate.sources[0]))){
   const retained={...entity.subject,readings:[...entity.subject.readings,structuredClone(coordinate.sources[0])]};
   changes.push({change:'subject_bind',entity_ref,binding:retained});return retained;
  }
  return entity.subject;
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
  const subject_binding=bind(entity_ref,reading.subject_binding);resolved.push(reading);
  centres.push({ordinal:definition.order,entity_ref,source_ref:zone.source_ref,subject_binding});
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
  let subject={...reading.subject_binding,readings:[...reading.subject_binding.readings,reading.subject_binding.sources[0]]};
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
   }else subject=bind(earthRef,subject,reading.subject_binding);
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
