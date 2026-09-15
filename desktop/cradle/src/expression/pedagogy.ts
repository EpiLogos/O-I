import type {Change,ReadingRef,SubjectBinding} from "./types";
import {agentBeingBinding,availableAgentPresentation,type AgentPresentationReading} from "./agentPresentation";
import {personalPageSubjectBinding,type PersonalPageRoleReading} from "./personalRoles";

export type PedagogicalSubject=
 | {kind:"binding";binding:SubjectBinding}
 | {kind:"personal_page";page:PersonalPageRoleReading;native_owner:string}
 | {kind:"agent";reading:AgentPresentationReading};
export interface PedagogicalEntity {entity_ref:string;title:string;text?:string;subject:PedagogicalSubject;x:number;y:number}
export interface PedagogicalScene {scene_ref:string;title:string;existing:boolean;entities:PedagogicalEntity[]}
export interface PedagogicalMotion {entity_ref:string;parameter:"x"|"y";intent:string;from:number;to:number;duration_seconds:number;waveform:"sine"|"triangle"|"square"|"saw"}
export interface PedagogicalSequence {summary:string;scenes:PedagogicalScene[];motions:PedagogicalMotion[];method_refs:ReadingRef[];evidence_refs:ReadingRef[]}
export interface CompiledPedagogy {changes:Change[];agentPresentation:ReturnType<typeof availableAgentPresentation>[]}

function binding(subject:PedagogicalSubject,agentPresentation:CompiledPedagogy["agentPresentation"]):SubjectBinding{
 if(subject.kind==="binding")return subject.binding;
 if(subject.kind==="personal_page")return personalPageSubjectBinding(subject.page,subject.native_owner);
 agentPresentation.push(availableAgentPresentation(subject.reading));
 return agentBeingBinding(subject.reading);
}

/** Compile structured pedagogy into the ordinary Expression grammar. Native
 * subjects keep their disclosed identity; the accepted engine owns motion. */
export function compilePedagogy(sequence:PedagogicalSequence):CompiledPedagogy {
 if(!sequence.summary.trim()||sequence.scenes.length===0||sequence.method_refs.length===0||sequence.evidence_refs.length===0)throw new Error("Pedagogy requires scenes, a method and evidence");
 const changes:Change[]=[];const identities=new Map<string,string>();const agentPresentation:CompiledPedagogy["agentPresentation"]=[];
 for(const [index,scene] of sequence.scenes.entries()){
  if(!scene.scene_ref.trim()||!scene.title.trim())throw new Error("Every scene needs its exact ref and title");
  if(index===0&&!scene.existing)throw new Error("The opening scene must name the current existing scene");
  if(index>0&&scene.existing)throw new Error("Only the opening scene may already exist");
  if(index>0)changes.push({change:"scene_create",scene_ref:scene.scene_ref,title:scene.title});
  const refs:string[]=[];
  for(const entity of scene.entities){
   if(!entity.entity_ref.trim()||!entity.title.trim())throw new Error("Every object needs an exact Expression ref and title");
   refs.push(entity.entity_ref);const resolved=binding(entity.subject,agentPresentation);const identity=`${resolved.native_owner}\n${resolved.subject_ref}\n${resolved.presentation_role}`;
   const prior=identities.get(entity.entity_ref);
   if(prior&&prior!==identity)throw new Error(`${entity.entity_ref} changed native identity between scenes`);
   if(!prior){identities.set(entity.entity_ref,identity);changes.push({change:"entity_add",scene_ref:scene.scene_ref,entity_ref:entity.entity_ref,title:entity.title},{change:"subject_bind",entity_ref:entity.entity_ref,binding:resolved},{change:"parameter_set",entity_ref:entity.entity_ref,parameter:"glyph",value:entity.text??entity.title},{change:"parameter_set",entity_ref:entity.entity_ref,parameter:"x",value:entity.x},{change:"parameter_set",entity_ref:entity.entity_ref,parameter:"y",value:entity.y});}
  }
  if(index>0)changes.push({change:"scene_compose",scene_ref:scene.scene_ref,entity_refs:refs});
 }
 for(const motion of sequence.motions){
  if(!motion.intent.trim()||!identities.has(motion.entity_ref))throw new Error("Every motion needs an intent and a source-bearing object in this sequence");
  if(!Number.isFinite(motion.duration_seconds)||motion.duration_seconds<=0)throw new Error("Motion duration must be positive");
  changes.push({change:"parameter_set",entity_ref:motion.entity_ref,parameter:motion.parameter,value:motion.from},{change:"parameter_automate",entity_ref:motion.entity_ref,parameter:motion.parameter,automation:{min:Math.min(motion.from,motion.to),max:Math.max(motion.from,motion.to),rate_hz:1/motion.duration_seconds,waveform:motion.waveform}});
 }
 return {changes,agentPresentation};
}
