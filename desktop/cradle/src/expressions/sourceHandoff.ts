/** Source navigation is resolved from the exact native Scene. Hosted Timeline
 * records are navigation context, never a second semantic source or store. */
import type {KernelTransportStatus,KnowledgeAddress,CentralLocation} from '../kernel/types';
import {inspectWikiScene,resolveWikiSceneSource} from '../techne/wikiReadingProvider';
import {resolveFileLocation,readFileBytes} from '../files/client';
import {CONSTRUCTION,PARTICIPATION} from '../knowledge/construction';
export interface HostedSourceTarget {address?:KnowledgeAddress;location?:CentralLocation;title:string;project?:string;returnTo:{place:{ref:string;title:string};passageId:string}}
const object=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const reference=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=2048&&!/[\u0000-\u001f]/.test(value);
export async function resolveHostedSource(transport:KernelTransportStatus,value:unknown):Promise<HostedSourceTarget>{
 const detail=object(value),subject=object(detail?.subject),context=object(detail?.context),node=object(context?.node),field=object(context?.relationField);
 if(!reference(detail?.ref)||!reference(subject?.ref)||!reference(subject?.sceneRef)||!Number.isSafeInteger(subject?.revision))throw Error('Open a source from a current native Scene.');
 const requested=detail.ref;
 if(node&&node.graphNodeId!==requested||field&&field.subjectGraphNodeId!==requested)throw Error('The Timeline selection changed; open its current source again.');
 const request={expression_ref:subject.ref,revision:subject.revision,scene_ref:subject.sceneRef};
 const {document,scene}=await inspectWikiScene(transport,request);
 const members=scene.entity_refs.flatMap(ref=>document.entities[ref]?.subject?[document.entities[ref]]:[]);
 const memberRefs=new Set(members.map(entity=>entity.subject!.subject_ref));
 const sceneRefs=new Set(scene.entity_refs),relations=Object.values(document.relations).filter(row=>sceneRefs.has(row.from_entity_ref)&&sceneRefs.has(row.to_entity_ref)&&row.native_owner!=='oi'&&row.relation.availability==='available');
 const relationRefs=new Set(relations.map(row=>row.relation.ref));
 // ReadingRefs are only candidates here. A whole is admitted below only after
 // the fresh register proves its native frame identity, revision and membership.
 const wholeCandidates=new Set(members.flatMap(entity=>entity.subject!.readings.map(row=>row.ref)));
 const owns=(ref:string)=>memberRefs.has(ref)||relationRefs.has(ref);
 const candidate=(ref:string)=>owns(ref)||wholeCandidates.has(ref);
 const coordinates=Array.isArray(node?.sourceCoordinates)?node.sourceCoordinates.filter(reference):[];
 const choices=[...new Set((candidate(requested)?[requested]:coordinates.filter(candidate)))];
 if(choices.length!==1)throw Error('This Timeline item has no single source in the current native Scene.');
 const ref=choices[0],entity=members.find(row=>row.subject!.subject_ref===ref),relation=relations.find(row=>row.relation.ref===ref);
 // Consume only bounded identity context. Titles, dates and relation metadata
 // shown by the destination are read afresh through its native owner.
 if(field){
  if(!Array.isArray(field.relationships)||field.relationships.length>256||!Array.isArray(field.contextualNodes)||field.contextualNodes.length>256)throw Error('The Timeline context exceeds its native reading boundary.');
  const aliases=new Map<string,string>([[requested,ref]]);
  for(const item of field.contextualNodes){const row=object(item);if(!reference(row?.graphNodeId))throw Error('A Timeline neighbour has no source identity.');const candidates=owns(row.graphNodeId)?[row.graphNodeId]:Array.isArray(row.sourceCoordinates)?row.sourceCoordinates.filter(reference).filter(owns):[];if(new Set(candidates).size===1)aliases.set(row.graphNodeId,candidates[0]);}
  for(const item of field.relationships){const row=object(item);if(!reference(row?.sourceGraphNodeId)||!reference(row?.targetGraphNodeId))throw Error('A Timeline relationship has no source endpoints.');const from=aliases.get(row.sourceGraphNodeId)??(owns(row.sourceGraphNodeId)?row.sourceGraphNodeId:undefined),to=aliases.get(row.targetGraphNodeId)??(owns(row.targetGraphNodeId)?row.targetGraphNodeId:undefined);if(!from||!to)throw Error('A Timeline relationship leaves this native Scene; refresh the source reading.');}
 }
 const returnTo={place:{ref:document.expression_ref,title:scene.title},passageId:scene.scene_ref};
 if(entity?.subject?.native_owner==='central'){
  const basis=entity.subject.readings.filter(row=>row.ref===ref&&row.availability==='available');
  if(!basis.length||new Set(basis.map(row=>row.revision)).size!==1)throw Error('This file occurrence has no unambiguous native source revision.');
  const location=await resolveFileLocation(transport,ref);
  const reading=await readFileBytes(transport,location);
  if(reading.location.ref!==ref||reading.revision!==basis[0].revision)throw Error('The file source changed; refresh its Scene binding before opening it.');
  await inspectWikiScene(transport,request);
  return {location:reading.location,title:entity.title,returnTo};
 }
 const wholeMember=!entity&&!relation?members.find(row=>row.subject!.readings.some(reading=>reading.ref===ref)):undefined;
 const {register,current}=await resolveWikiSceneSource(transport,entity||wholeMember?{...request,subject_ref:(entity??wholeMember)!.subject!.subject_ref}:request);
 if(wholeMember){
  const raw:unknown=JSON.parse(current.file.content),container=object(raw);
  const rows=Array.isArray(raw)?raw:Array.isArray(container?.objects)?container.objects:[];
  const frames=rows.map(object).filter(row=>row?.object==='frame'&&row.ref===ref);
  if(frames.length!==1||!Number.isSafeInteger(frames[0]?.revision)||Number(frames[0]?.revision)<1)throw Error('This item has no exact native whole in its source register.');
  const frame=frames[0]!,constellations=Array.isArray(frame.constellations)?frame.constellations.map(object):[];
  const declared=new Set(constellations.flatMap(row=>[row?.anchor_ref,...(Array.isArray(row?.members)?row.members.map(member=>object(member)?.ref):[])].filter(reference)));
  const bound=members.filter(row=>row.subject!.readings.some(reading=>reading.ref===ref));
  if(!bound.length||bound.some(row=>!declared.has(row.subject!.subject_ref)||row.subject!.readings.filter(reading=>reading.ref===ref).some(reading=>reading.availability!=='available'||reading.revision!==String(frame.revision))))throw Error('The whole or its Scene membership changed; refresh the source binding before opening it.');
  // The source can change during a read, but a later Expression edit cannot
  // redirect this acknowledged navigation to a different Scene.
  await inspectWikiScene(transport,request);
  const title=object(frame[CONSTRUCTION])?.title??frame.title;
  return {address:{kind:'wiki',value:ref},title:typeof title==='string'?title:'Whole',project:register.project,returnTo};
 }

 if(relation&&!current.relations.some(row=>row.ref===relation.relation.ref&&String(row.revision)===relation.relation.revision))throw Error('The source relation changed; refresh its Scene binding before opening it.');
 const sources=current.frames.flatMap(frame=>frame.constellations[0].members).filter(member=>member.ref===ref).flatMap(member=>member[PARTICIPATION].sources);
 const kind:KnowledgeAddress['kind']=relation||!sources.some(source=>source.source_ref===ref)?'wiki':'source';
 return {address:{kind,value:ref},title:entity?.title??current.relations.find(row=>row.ref===ref)?.relation??'Source',project:register.project,returnTo};
}
