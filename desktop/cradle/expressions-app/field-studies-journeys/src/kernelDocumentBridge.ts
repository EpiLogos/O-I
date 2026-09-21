/** Native Expression -> bounded working view of the SAME document.
 *
 * Native identities and the complete document stay above the engine's ten
 * formation/eight pin budget. A page is disclosure, not another Scene or a
 * new Expression. Source bindings, relations, bodies and unsupported fields
 * remain inspectable through `bindings` and `document`; neither is inferred
 * from glyph text or layout. This adapter performs no I/O or publication.
 */
import {Journey,Scene,Entity,blankScene,entity,clone,validateJourney} from './model.js';
import {WORLD_SCALE} from './nativeParameters.js';
import {mapSceneOccurrences,assertMaterialOccurrences} from './sceneCorrespondence.js';
import {MAX_FORMATIONS,MAX_PINS} from '../../src/engine/fieldModel.js';

export interface KernelParameter {value:string|number;automation?:{min:number;max:number;rate_hz:number;waveform:string}|null}
export interface KernelSubject {subject_ref:string;native_owner:string;[key:string]:unknown}
export interface KernelEntity {entity_ref:string;title:string;subject?:KernelSubject|null;parameters:Record<string,KernelParameter>;[key:string]:unknown}
export interface KernelScene {presentation?:{schema:'oi.journey-scene/v1';scene:Scene}|null;scene_ref:string;title:string;entity_refs:string[];body?:{carrier?:string;[key:string]:unknown}|null;triggers?:unknown[];[key:string]:unknown}
export interface KernelRelation {binding_ref:string;relation:{ref:string;revision:string;[key:string]:unknown};from_entity_ref:string;to_entity_ref:string;[key:string]:unknown}
export interface KernelExpressionDocument {presentation?:{schema:'oi.journey-properties/v1';description:string;loop:boolean;shared?:Journey['shared']}|null;schema:string;expression_ref:string;revision:number;title:string;scenes:KernelScene[];entities:Record<string,KernelEntity>;relations?:Record<string,KernelRelation>;selection?:{scene_ref:string;entity_ref:string|null;relation_ref?:string|null};representations?:unknown[];refinements?:unknown[];collections?:string[];profiles?:unknown[];[key:string]:unknown}
export interface OccurrenceBinding {expression_ref:string;scene_ref:string;entity_ref:string;view_entity_id:string;subject:KernelSubject|null}
export interface SceneBinding {scene_ref:string;member_refs:string[];loaded_refs:string[];page:number;page_count:number;hidden_refs:string[];focused_relation:string|null;occurrences:OccurrenceBinding[];relations:KernelRelation[];body:KernelScene['body'];triggers:unknown[]}
export interface KernelConversion {journey:Journey;notes:string[];startSceneId:string|null;document:KernelExpressionDocument;bindings:Record<string,SceneBinding>;entity_ids:Record<string,string>}
export interface ViewOptions {pages?:Record<string,number>;focusRelation?:string|null;identity?:{expression?:string;scenes?:Record<string,string>;entities?:Record<string,string>}}
export type ViewChange={change:'parameter_set';entity_ref:string;parameter:string;value:string|number};

const MAPPED_KEYS=new Set(['x','y','z','scale','share','glyph','shape','kind','width','height','rotation','ascii','image','yantra','frequency','force_mode','force_strength','force_spin','force_radius']);
const text=(p:KernelParameter|undefined,fallback='')=>typeof p?.value==='string'?p.value:fallback;
const number=(p:KernelParameter|undefined,fallback:number)=>typeof p?.value==='number'&&Number.isFinite(p.value)?p.value:fallback;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function safe(value:unknown,depth=0):void{
 if(depth>40)throw new Error('Native document exceeds the nesting budget');
 if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Non-finite native value');
 if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){
  if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe native document key');
  safe(v,depth+1);
 }
}
/** View IDs are reversible through explicit bindings, never native IDs.
 * The hash is only a compact label. Any collision is refused, not merged. */
function idFor(raw:string,kind:string,ids:Map<string,string>,preferred?:string):string{
 const key=kind+'\0'+raw;
 if(preferred!==undefined&&!/^[a-zA-Z0-9_.:-]{1,160}$/.test(preferred))throw new Error('Invalid retained occurrence identity');
 let id=preferred??raw;
 if(preferred===undefined&&!/^[a-zA-Z0-9_.:-]{1,150}$/.test(id)){
  let a=2166136261,b=0x9e3779b9;
  for(const ch of key){const code=ch.codePointAt(0)!;a=Math.imul(a^code,16777619);b=Math.imul(b^code,2246822519);}
  id=`native-${kind}-${(a>>>0).toString(16)}-${(b>>>0).toString(16)}`;
 }
 if(ids.has(id)&&ids.get(id)!==key){
  const candidate=`${kind}:${id}`;
  if(candidate.length>160||(ids.has(candidate)&&ids.get(candidate)!==key))throw new Error('Native view ID collision; no identity was merged');
  id=candidate;
 }
 ids.set(id,key);return id;
}
function convertEntity(input:KernelEntity,id:string,notes:string[]):Entity{
 const p=input.parameters??{},glyph=text(p.glyph,'O');
 const out=entity(input.title.slice(0,160),glyph.slice(0,120),{x:number(p.x,0)/WORLD_SCALE,y:number(p.y,0)/WORLD_SCALE,z:number(p.z,0)/WORLD_SCALE});
 out.id=id;
 out.kind=text(p.kind,'formation') as Entity['kind'];
 const shape=text(p.shape,'glyph');out.shape=(shape==='glyph'?'text':shape) as Entity['shape'];
 out.scale=number(p.scale,1);out.share=number(p.share,1);
 out.size={x:number(p.width,out.size.x*WORLD_SCALE)/WORLD_SCALE,y:number(p.height,out.size.y*WORLD_SCALE)/WORLD_SCALE};
 out.rotation=number(p.rotation,0)*180/Math.PI;
 out.force={kind:text(p.force_mode,'none') as Entity['force']['kind'],strength:number(p.force_strength,0),spin:number(p.force_spin,0),radius:number(p.force_radius,180)/WORLD_SCALE};
 if(p.yantra)out.yantraId=text(p.yantra);
 if(p.frequency)out.templateFrequency=number(p.frequency,220);
 if(text(p.image))out.source={kind:'image',image:{dataUrl:text(p.image),mode:'luminance',threshold:.5,invert:false,scale:1}};
 else if(text(p.ascii)||glyph.length>120)out.source={kind:'ascii',ascii:{text:text(p.ascii,glyph)}};
 out.sequence.steps=[{id:idFor(input.entity_ref,'held-state',new Map()),text:out.text,shape:out.shape,hold:3,transition:1,position:null,source:clone(out.source),yantraId:out.yantraId,templateFrequency:out.templateFrequency}];
 for(const [key,parameter] of Object.entries(p)){
  if(!MAPPED_KEYS.has(key))notes.push(`${input.entity_ref}: ${key} retained natively; no material control is bound here`);
  if(parameter.automation)notes.push(`${input.entity_ref}: ${key} automation retained; this view does not replace its native clock`);
 }
 return out;
}
/** The whole native material, before any renderer budget is applied. */
export function nativeSceneMaterial(doc:KernelExpressionDocument,s:KernelScene):Scene{
 if(s.presentation){
  if(s.presentation.schema!=='oi.journey-scene/v1')throw new Error('Unsupported native Scene material; its bytes were not discarded');
  const material=clone(s.presentation.scene);
  assertMaterialOccurrences(material,s.scene_ref,s.entity_refs);
  if(material.name!==s.title)throw new Error('Native Scene name and material title disagree');
  return material;
 }
 const material=blankScene(s.title.slice(0,160));material.id=s.scene_ref;
 material.entities=s.entity_refs.map(ref=>convertEntity(doc.entities[ref],ref,[]));
 if(material.entities.some(e=>e.position.z!==0))material.view.mode='3d';
 return material;
}
function pagesFor(refs:string[],entities:Map<string,Entity>):string[][]{
 const pages:string[][]=[[]];let formations=0,pins=0;
 for(const ref of refs){
  const pin=entities.get(ref)!.kind==='pin';
  if(pin?pins>=MAX_PINS:formations>=MAX_FORMATIONS){pages.push([]);formations=0;pins=0;}
  pages[pages.length-1].push(ref);if(pin)pins++;else formations++;
 }
 return pages;
}
function focusWindow(refs:string[],relation:KernelRelation,entities:Map<string,Entity>):string[]{
 const selected=[...new Set([relation.from_entity_ref,relation.to_entity_ref])];
 let pins=selected.filter(ref=>entities.get(ref)!.kind==='pin').length,formations=selected.length-pins;
 for(const ref of refs){if(selected.includes(ref))continue;const pin=entities.get(ref)!.kind==='pin';if(pin?pins>=MAX_PINS:formations>=MAX_FORMATIONS)continue;selected.push(ref);if(pin)pins++;else formations++;}
 return selected;
}
export function kernelDocumentToJourney(raw:unknown,options:ViewOptions={}):KernelConversion{
 safe(raw);
 const doc=clone(raw) as KernelExpressionDocument;
 if(!doc||doc.schema!=='oi.expression/v1'||typeof doc.expression_ref!=='string'||!Number.isSafeInteger(doc.revision)||doc.revision<1||typeof doc.title!=='string'||!doc.entities||Array.isArray(doc.entities)||!Array.isArray(doc.scenes)||!doc.scenes.length||doc.scenes.length>64)throw new Error('The kernel document is not a bounded oi.expression/v1 expression');
 if(Object.keys(doc.entities).length>256||Object.keys(doc.relations??{}).length>256)throw new Error('Native Expression exceeds its binding budget');
 const notes:string[]=[],ids=new Map<string,string>(),converted=new Map<string,Entity>();
 const bindings:Record<string,SceneBinding>={};
 for(const [ref,input] of Object.entries(doc.entities)){
  if(!input||input.entity_ref!==ref||typeof input.title!=='string')throw new Error('Native entity identity disagrees with its binding');
  converted.set(ref,convertEntity(input,idFor(ref,'entity',ids,options.identity?.entities?.[ref]),notes));
 }
 for(const [ref,r] of Object.entries(doc.relations??{})){
  if(!r||r.binding_ref!==ref||!r.relation||typeof r.relation.ref!=='string'||typeof r.relation.revision!=='string'||!converted.has(r.from_entity_ref)||!converted.has(r.to_entity_ref))throw new Error(`Native relation ${ref} has absent or ambiguous endpoints`);
 }
 const sceneRefs=new Set<string>();
 const scenes:Scene[]=doc.scenes.map(s=>{
  if(!s||typeof s.scene_ref!=='string'||sceneRefs.has(s.scene_ref)||typeof s.title!=='string'||!Array.isArray(s.entity_refs)||new Set(s.entity_refs).size!==s.entity_refs.length||s.entity_refs.some(ref=>!converted.has(ref)))throw new Error('Native scene has duplicate identities or unresolved members; no placeholders were invented');
  sceneRefs.add(s.scene_ref);
  const material=nativeSceneMaterial(doc,s);
  const materialEntities=new Map(material.entities.map(e=>[e.id,e]));
  const visibleRefs=material.entities.map(e=>e.id);
  const pages=pagesFor(visibleRefs,materialEntities);
  const preferred=doc.selection?.scene_ref===s.scene_ref?doc.selection.entity_ref:null;
  const explicit=options.pages?.[s.scene_ref];
  let page=explicit??(preferred?Math.max(0,pages.findIndex(refs=>refs.includes(preferred))):0);
  if(!Number.isInteger(page)||page<0||page>=pages.length)throw new Error(`Invalid disclosure page for ${s.scene_ref}`);
  const relations=Object.values(doc.relations??{}).filter(r=>s.entity_refs.includes(r.from_entity_ref)&&s.entity_refs.includes(r.to_entity_ref));
  const focusRef=options.focusRelation===undefined?(doc.selection?.scene_ref===s.scene_ref?doc.selection.relation_ref:null):options.focusRelation;
  const focused=explicit===undefined?relations.find(r=>r.binding_ref===focusRef && materialEntities.has(r.from_entity_ref) && materialEntities.has(r.to_entity_ref)):undefined;
  const loaded=focused?focusWindow(visibleRefs,focused,materialEntities):pages[page];
  const occurrenceIds=new Map([...converted].map(([ref,e])=>[ref,e.id]));
  const scene=mapSceneOccurrences(material,idFor(s.scene_ref,'scene',ids,options.identity?.scenes?.[s.scene_ref]),occurrenceIds,new Set(loaded));
  bindings[scene.id]={scene_ref:s.scene_ref,member_refs:[...s.entity_refs],loaded_refs:[...loaded],page,page_count:pages.length,hidden_refs:s.entity_refs.filter(ref=>!materialEntities.has(ref)),focused_relation:focused?.binding_ref??null,occurrences:loaded.map(ref=>({expression_ref:doc.expression_ref,scene_ref:s.scene_ref,entity_ref:ref,view_entity_id:converted.get(ref)!.id,subject:clone(doc.entities[ref].subject??null)})),relations:clone(relations),body:clone(s.body),triggers:clone(s.triggers??[])};
  if(loaded.length<s.entity_refs.length)notes.push(`${s.scene_ref}: ${loaded.length}/${s.entity_refs.length} members loaded; ${pages.length} disclosure pages preserve the whole`);
  return scene;
 });
 if(doc.presentation && doc.presentation.schema!=='oi.journey-properties/v1')throw new Error('Unsupported native Expression presentation');
 const journey:Journey={schema:'oi.journey',version:1,id:idFor(doc.expression_ref,'expression',ids,options.identity?.expression),name:doc.title.slice(0,160),description:doc.presentation?.description??'',loop:doc.presentation?.loop??true,scenes,updatedAt:new Date().toISOString(),...(doc.presentation?.shared?{shared:clone(doc.presentation.shared)}:{})};
 if(journey.shared)journey.shared.toolbelt=journey.shared.toolbelt.map(entry=>entry.entityId?{...entry,entityId:converted.get(entry.entityId)?.id??entry.entityId}:entry);
 return{journey:validateJourney(journey),document:doc,notes,bindings,entity_ids:Object.fromEntries([...converted].map(([ref,e])=>[ref,e.id])),startSceneId:scenes.find(s=>bindings[s.id].scene_ref===doc.selection?.scene_ref)?.id??scenes[0].id};
}
/** Only changed, loaded material returns. Hidden members and native relations,
 * bodies, metadata and source bindings are never treated as deleted. Human or
 * Agent construction operations use their own native Actions, not this diff. */
export function kernelViewToChanges(view:KernelConversion,edited:Journey):ViewChange[]{
 validateJourney(edited);
 if(edited.id!==view.journey.id||edited.scenes.length!==view.journey.scenes.length)throw new Error('The working view no longer addresses this native Expression');
 const changes:ViewChange[]=[],values=new Map<string,string|number>();
 for(const scene of edited.scenes){
  const baseline=view.journey.scenes.find(s=>s.id===scene.id),binding=view.bindings[scene.id];
  if(!baseline||!binding||!same(scene.entities.map(e=>e.id),baseline.entities.map(e=>e.id)))throw new Error('Use native membership/Scene operations to change the construction; hide is not delete');
  for(const e of scene.entities){
   const before=baseline.entities.find(candidate=>candidate.id===e.id)!;
   const occurrence=binding.occurrences.find(o=>o.view_entity_id===e.id)!;
   const scalar=(parameter:string,old:string|number,next:string|number)=>{
    if(same(old,next))return;
    if(view.document.entities[occurrence.entity_ref].parameters[parameter]?.automation)throw new Error(`Release or edit native automation before changing ${parameter}`);
    const key=occurrence.entity_ref+'\0'+parameter;
    if(values.has(key)&&!same(values.get(key),next))throw new Error('Different occurrences proposed conflicting edits to one native entity');
    if(!values.has(key)){values.set(key,next);changes.push({change:'parameter_set',entity_ref:occurrence.entity_ref,parameter,value:next});}
   };
   for(const axis of ['x','y','z'] as const)scalar(axis,before.position[axis]*WORLD_SCALE,e.position[axis]*WORLD_SCALE);
   scalar('scale',before.scale??1,e.scale??1);scalar('share',before.share,e.share);
   scalar('width',before.size.x*WORLD_SCALE,e.size.x*WORLD_SCALE);scalar('height',before.size.y*WORLD_SCALE,e.size.y*WORLD_SCALE);
   scalar('rotation',before.rotation*Math.PI/180,e.rotation*Math.PI/180);
   scalar('glyph',before.text,e.text);scalar('shape',before.shape==='text'?'glyph':before.shape,e.shape==='text'?'glyph':e.shape);scalar('kind',before.kind,e.kind);
   scalar('force_mode',before.force.kind,e.force.kind);scalar('force_strength',before.force.strength,e.force.strength);scalar('force_spin',before.force.spin,e.force.spin);scalar('force_radius',before.force.radius*WORLD_SCALE,e.force.radius*WORLD_SCALE);
   if(!same(e.source,before.source)){
    scalar('image',before.source?.kind==='image'?before.source.image.dataUrl??'':'',e.source?.kind==='image'?e.source.image.dataUrl??'':'');
    scalar('ascii',before.source?.kind==='ascii'?before.source.ascii.text:'',e.source?.kind==='ascii'?e.source.ascii.text:'');
   }
  }
 }
 return changes;
}
