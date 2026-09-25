/** Explicit blueprint proposal from the current native constellation owner. */
import type {KernelTransportStatus} from '../kernel/types';
import {resolveWikiSceneSource,inspectWikiScene,type WikiSceneReadingRequest} from '../techne/wikiReadingProvider';
import {CONSTRUCTION,PARTICIPATION} from './construction';
import {knowledgeEntityRef} from './expressionProjection';
import {BLUEPRINT_READING_DIGEST,BLUEPRINT_SHAPE,validateBlueprint,type SceneBlueprint} from '../../expressions-app/field-studies-journeys/src/blueprintGeometry';

export async function readSceneBlueprint(transport:KernelTransportStatus,input:WikiSceneReadingRequest):Promise<WikiSceneReadingRequest&{binding:SceneBlueprint}>{
 const {request,document,scene,current}=await resolveWikiSceneSource(transport,input);
 const proposals:SceneBlueprint[]=[];
 for(const frame of current.frames){
  const form=frame[CONSTRUCTION].frame;
  if(form?.shape_ref!==BLUEPRINT_SHAPE)continue;
  const binding:SceneBlueprint={schema:'oi.scene-blueprint/v1',shape_ref:BLUEPRINT_SHAPE,reading_digest:BLUEPRINT_READING_DIGEST,
   frame:{ref:frame.ref,revision:String(frame.revision),availability:'available'},members:[],transform:{translation:[0,0,0],rotation:[0,0,0],scale:110}};
  for(const member of frame.constellations[0].members){
   const part=member[PARTICIPATION],entityRef=await knowledgeEntityRef(document.expression_ref,part.participation_ref);
   if(!scene.entity_refs.includes(entityRef)||!part.role_ref)continue;
   const subject=document.entities[entityRef]?.subject,role=form.roles.find(r=>r.role_ref===part.role_ref);
   const presentation=role?.address.presentation as {schema?:string;shape_ref?:string;reading_digest?:string;address?:{kind?:string;coordinate?:{position?:number;face?:string}}}|undefined;
   if(!subject||subject.subject_ref!==member.ref||!subject.readings.some(r=>r.ref===frame.ref&&r.revision===String(frame.revision)&&r.availability==='available'))throw Error('The constellation role basis changed; refresh its live composition before applying a blueprint');
   if(!role||presentation?.schema!=='ql.shape-presentation/v1'||presentation.shape_ref!==BLUEPRINT_SHAPE||presentation.reading_digest!==BLUEPRINT_READING_DIGEST||presentation.address?.kind!=='position'||presentation.address.coordinate?.face!=='direct'||presentation.address.coordinate.position!==role.address.position)throw Error('Choose the current owner-supplied sixfold form in the constellation editor before applying its blueprint');
   binding.members.push({entity_ref:entityRef,subject_ref:subject.subject_ref,role_ref:part.role_ref,position:presentation.address.coordinate.position!});
  }
  if(binding.members.length){validateBlueprint(binding);proposals.push(binding);}
 }
 if(proposals.length!==1)throw Error(proposals.length?'This Scene contains several sixfold frames; open one constellation before applying its blueprint':'Assign native roles in a sixfold constellation and open its live composition before applying a blueprint');
 await inspectWikiScene(transport,input);
 return {...request,binding:proposals[0]};
}
