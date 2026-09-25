/** Bounded operations over existing native occurrences. Source subjects and
 * relations remain with their owners; this creates one presentation occurrence. */
import {clone} from './model.js';
import {kernelDocumentToJourney,nativeSceneMaterial,type KernelSubject,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {sameSceneData} from './sceneCorrespondence.js';
export interface DuplicateOccurrenceIntent {operation:'duplicate';scene_ref:string;entity_ref:string;new_entity_ref:string}
export interface InsertSourceIntent {operation:'insert-source';scene_ref:string;new_entity_ref:string;title:string;binding:KernelSubject}
export type OccurrenceIntent=DuplicateOccurrenceIntent|InsertSourceIntent;
export interface SourceOccurrenceChoice {expression_ref:string;revision:number;scene_ref:string;title:string;binding:KernelSubject}
export interface OccurrenceEdit {operation:'edit';expression_ref:string;expected_revision:number;actor:string;changes:Record<string,unknown>[]}
export function prepareOccurrenceEdit(view:KernelConversion,intent:OccurrenceIntent):{request:OccurrenceEdit;expected:KernelExpressionDocument} {
 const before=view.document,scene=before.scenes.find(row=>row.scene_ref===intent.scene_ref);
 const entity=intent.operation==='duplicate'?before.entities[intent.entity_ref]:{entity_ref:intent.new_entity_ref,title:intent.title,subject:intent.binding,parameters:{glyph:{value:'●',automation:null},shape:{value:'disc',automation:null}}};
 const fields=intent.operation==='duplicate'?['operation','scene_ref','entity_ref','new_entity_ref']:['operation','scene_ref','new_entity_ref','title','binding'];
 if(!['duplicate','insert-source'].includes(intent.operation)||Object.keys(intent).some(key=>!fields.includes(key)))throw Error('Unsupported native occurrence intent');
 if(!scene||!entity?.subject||(intent.operation==='duplicate'&&!scene.entity_refs.includes(intent.entity_ref)))throw Error('Choose a source-bound occurrence in this native Scene');
 if(intent.operation==='insert-source'){
  const b=intent.binding;
  if(typeof intent.title!=='string'||!intent.title.trim()||intent.title.length>160||!b||typeof b.subject_ref!=='string'||!b.subject_ref.trim()||b.subject_ref.startsWith('expression:')||typeof b.native_owner!=='string'||!b.native_owner.trim()||!['being','thing'].includes(String(b.presentation_role))||Object.keys(b).some(key=>!['subject_ref','native_owner','presentation_role','sources','readings','actions'].includes(key)))throw Error('The selected source has no exact native subject binding');
  for(const key of ['sources','readings','actions'])if(!Array.isArray(b[key])||(b[key] as unknown[]).length>256)throw Error('The selected source binding exceeds its native budget');
  if(!(b.readings as {ref:string;revision:string;availability:string}[]).some(row=>row.ref===b.subject_ref&&typeof row.revision==='string'&&row.revision.length>0&&row.availability==='available'))throw Error('Read the exact selected source before inserting it');
 }
 const prefix=before.expression_ref+':entity:occurrence-';
 if(typeof intent.new_entity_ref!=='string'||!intent.new_entity_ref.startsWith(prefix)||!/^[a-zA-Z0-9-]{1,80}$/.test(intent.new_entity_ref.slice(prefix.length))||before.entities[intent.new_entity_ref])throw Error('A duplicate needs a fresh native occurrence identity');
 if(!Object.hasOwn(entity.parameters,'glyph'))throw Error('This imported occurrence has no native glyph parameter; its exact parameters cannot be duplicated by the current owner grammar');
 if(Object.keys(before.entities).length>=256)throw Error('This native Expression has reached its occurrence limit');
 const changes:Record<string,unknown>[]=[{change:'entity_add',scene_ref:scene.scene_ref,entity_ref:intent.new_entity_ref,title:entity.title},{change:'subject_bind',entity_ref:intent.new_entity_ref,binding:clone(entity.subject)}];
 for(const [parameter,value] of Object.entries(entity.parameters)){
  changes.push({change:'parameter_set',entity_ref:intent.new_entity_ref,parameter,value:clone(value.value)});
  if(value.automation)changes.push({change:'parameter_automate',entity_ref:intent.new_entity_ref,parameter,automation:clone(value.automation)});
 }
 const expected=clone(before),target=expected.scenes.find(row=>row.scene_ref===scene.scene_ref)!;
 expected.revision++;
 expected.entities[intent.new_entity_ref]={...clone(entity),entity_ref:intent.new_entity_ref,revision:expected.revision};
 target.entity_refs.push(intent.new_entity_ref);target.revision=expected.revision;
 if(scene.presentation){
  const presentation=clone(scene.presentation),material=presentation.scene;
  const original=intent.operation==='duplicate'?material.entities.find(row=>row.id===intent.entity_ref):nativeSceneMaterial(expected,{...target,presentation:null}).entities.find(row=>row.id===intent.new_entity_ref);
  if(!original)throw Error('This source occurrence is hidden in the current Scene; reveal it before duplicating');
  if(original.locked)throw Error('Unlock this occurrence before duplicating it');
  const duplicate=clone(original);duplicate.id=intent.new_entity_ref;
  if(duplicate.native)duplicate.native={...duplicate.native,id:intent.new_entity_ref};
  material.entities.push(duplicate);
  if(intent.operation==='duplicate'&&material.research?.cards[intent.entity_ref])material.research.cards[intent.new_entity_ref]=clone(material.research.cards[intent.entity_ref]);
  // Retain independent Scene controllers, annotations, source relationships,
  // and the saved baseline. Only the current occurrence's material is copied.
  target.presentation=presentation;
  changes.push({change:'scene_material_set',scene_ref:scene.scene_ref,presentation});
 }
 expected.selection={scene_ref:scene.scene_ref,entity_ref:intent.new_entity_ref};
 changes.push({change:'focus',scene_ref:scene.scene_ref,entity_ref:intent.new_entity_ref});
 if(changes.length>256)throw Error('This occurrence exceeds the native atomic edit budget');
 kernelDocumentToJourney(expected); // checks identity/material/page admission
 return {request:{operation:'edit',expression_ref:before.expression_ref,expected_revision:before.revision,actor:'human:expressions-app',changes},expected};
}
export function occurrenceReply(view:KernelConversion,intent:OccurrenceIntent,document:KernelExpressionDocument):KernelConversion {
 const {expected}=prepareOccurrenceEdit(view,intent);
 if(!sameSceneData(document,expected))throw Error('Native occurrence result differs from the captured duplicate; preserve and inspect before retrying');
 // Preserve existing view identities. Let native selection choose the new
 // occurrence's disclosure page, including when the previous page was full.
 return kernelDocumentToJourney(document,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids}});
}
