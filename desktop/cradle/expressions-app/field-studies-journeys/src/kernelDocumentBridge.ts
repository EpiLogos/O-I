import {generatedWikiAppearance, wikiDisplayName} from '../../../../../packages/oi-design-system/expressions-engine/oi/wikiPresentation.mjs';
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

// ——— ES1A/ES1B (O:I #352): scene-body native carriers and declarative scene
// triggers, mirrored field-for-field from the kernel's own Rust contract
// (expression_carrier.rs, expression_trigger.rs). These are typed reads, not
// an opaque `unknown` passthrough: an unrecognised shape is a refusal, never
// a silently dropped field. ———
export type CarrierKind='engine_composition'|'text_source'|'glyph_form'|'image_media'|'file_thing'|'knowledge_whole'|'html_surface'|'agent_surface'|'expression_ref';
const CARRIER_KINDS=new Set<CarrierKind>(['engine_composition','text_source','glyph_form','image_media','file_thing','knowledge_whole','html_surface','agent_surface','expression_ref']);
export type BodyPresentation='live'|'inline'|'preview'|'degraded';
const BODY_PRESENTATIONS=new Set<BodyPresentation>(['live','inline','preview','degraded']);
export type BodyCapability={state:'renderable'}|{state:'degrades_to_thing';reason:string}|{state:'unavailable';reason:string};
export interface KernelReadingRef {ref:string;revision:string;availability:'available'|'unavailable'|'withheld'|'stale'}
export interface KernelDisclosedAction {action_ref:string;target_ref:string;authority_requirement:string}
export interface KernelTextSpan {start:number;end:number}
export interface KernelRecursionBound {host_expression_ref:string;max_depth:number}
export interface KernelSceneBody {
 carrier:CarrierKind;subject_ref:string;native_owner:string;reading:KernelReadingRef;
 provenance:KernelReadingRef[];actions:KernelDisclosedAction[];
 presentation:BodyPresentation;capability:BodyCapability;
 span:KernelTextSpan|null;recursion:KernelRecursionBound|null;
}
export type TriggerOccasion='scene_enter'|'scene_leave'|'activate'|'select'|'sequence_transition';
const TRIGGER_OCCASIONS=new Set<TriggerOccasion>(['scene_enter','scene_leave','activate','select','sequence_transition']);
export type PortalPlacement='preview'|'overlay'|'beside'|'full'|'detached'|'re_dock';
const PORTAL_PLACEMENTS=new Set<PortalPlacement>(['preview','overlay','beside','full','detached','re_dock']);
export type TriggerTarget=
 |{kind:'expression_operation';operation:string;expression_ref:string}
 |{kind:'portal';placement:PortalPlacement;subject_ref:string;scene_ref?:string|null}
 |{kind:'native_action';action_ref:string;target_ref:string;authority_requirement:string}
 |{kind:'navigate';scene_ref?:string|null;entity_ref?:string|null};
export interface KernelSceneTrigger {trigger_ref:string;occasion:TriggerOccasion;target:TriggerTarget}

function isReadingRef(v:unknown):v is KernelReadingRef{
 const r=v as KernelReadingRef;
 return !!r&&typeof r==='object'&&typeof r.ref==='string'&&typeof r.revision==='string'&&['available','unavailable','withheld','stale'].includes(r.availability);
}
function isDisclosedAction(v:unknown):v is KernelDisclosedAction{
 const a=v as KernelDisclosedAction;
 return !!a&&typeof a==='object'&&typeof a.action_ref==='string'&&typeof a.target_ref==='string'&&typeof a.authority_requirement==='string';
}
/** Validate one native Scene body against the kernel's exact shape. Absent
 * (null/undefined) means the live engine composition, the current default;
 * anything present but malformed is a refusal, never a silent drop. */
export function validateSceneBody(value:unknown):KernelSceneBody|null{
 if(value===null||value===undefined)return null;
 const b=value as Record<string,unknown>;
 if(typeof b!=='object')throw new Error('Native scene body is not an object');
 if(typeof b.carrier!=='string'||!CARRIER_KINDS.has(b.carrier as CarrierKind))throw new Error(`Native scene body names an unrecognised carrier: ${String(b.carrier)}`);
 if(typeof b.subject_ref!=='string'||!b.subject_ref)throw new Error('Native scene body is missing its subject_ref');
 if(typeof b.native_owner!=='string'||!b.native_owner)throw new Error('Native scene body is missing its native_owner');
 if(!isReadingRef(b.reading))throw new Error('Native scene body is missing a valid reading');
 const provenance=b.provenance===undefined?[]:b.provenance;
 if(!Array.isArray(provenance)||!provenance.every(isReadingRef))throw new Error('Native scene body provenance is malformed');
 const actions=b.actions===undefined?[]:b.actions;
 if(!Array.isArray(actions)||!actions.every(isDisclosedAction))throw new Error('Native scene body actions are malformed');
 if(typeof b.presentation!=='string'||!BODY_PRESENTATIONS.has(b.presentation as BodyPresentation))throw new Error(`Native scene body names an unrecognised presentation: ${String(b.presentation)}`);
 const capability=b.capability as BodyCapability;
 if(!capability||typeof capability!=='object'||!['renderable','degrades_to_thing','unavailable'].includes(capability.state)||(capability.state!=='renderable'&&typeof (capability as {reason?:unknown}).reason!=='string'))throw new Error('Native scene body capability is malformed');
 let span:KernelTextSpan|null=null;
 if(b.span!==undefined&&b.span!==null){
  const s=b.span as KernelTextSpan;
  if(typeof s.start!=='number'||typeof s.end!=='number')throw new Error('Native scene body span is malformed');
  span=s;
 }
 let recursion:KernelRecursionBound|null=null;
 if(b.recursion!==undefined&&b.recursion!==null){
  const r=b.recursion as KernelRecursionBound;
  if(typeof r.host_expression_ref!=='string'||typeof r.max_depth!=='number')throw new Error('Native scene body recursion bound is malformed');
  recursion=r;
 }
 return {carrier:b.carrier as CarrierKind,subject_ref:b.subject_ref,native_owner:b.native_owner,reading:b.reading as KernelReadingRef,provenance:provenance as KernelReadingRef[],actions:actions as KernelDisclosedAction[],presentation:b.presentation as BodyPresentation,capability,span,recursion};
}
function isTriggerTarget(v:unknown):v is TriggerTarget{
 const t=v as {kind?:unknown};
 if(!t||typeof t!=='object')return false;
 if(t.kind==='expression_operation'){const o=t as {operation?:unknown;expression_ref?:unknown};return typeof o.operation==='string'&&typeof o.expression_ref==='string';}
 if(t.kind==='portal'){const o=t as {placement?:unknown;subject_ref?:unknown;scene_ref?:unknown};return typeof o.placement==='string'&&PORTAL_PLACEMENTS.has(o.placement as PortalPlacement)&&typeof o.subject_ref==='string'&&(o.scene_ref===undefined||o.scene_ref===null||typeof o.scene_ref==='string');}
 if(t.kind==='native_action'){const o=t as {action_ref?:unknown;target_ref?:unknown;authority_requirement?:unknown};return typeof o.action_ref==='string'&&typeof o.target_ref==='string'&&typeof o.authority_requirement==='string';}
 if(t.kind==='navigate'){const o=t as {scene_ref?:unknown;entity_ref?:unknown};return (o.scene_ref===undefined||o.scene_ref===null||typeof o.scene_ref==='string')&&(o.entity_ref===undefined||o.entity_ref===null||typeof o.entity_ref==='string');}
 return false;
}
/** Validate one native Scene's triggers. Absent/empty means no declared
 * triggers; a malformed trigger is refused, never silently dropped. */
export function validateSceneTriggers(value:unknown):KernelSceneTrigger[]{
 if(value===undefined||value===null)return [];
 if(!Array.isArray(value))throw new Error('Native scene triggers are not a list');
 return value.map(raw=>{
  const t=raw as Record<string,unknown>;
  if(!t||typeof t!=='object'||typeof t.trigger_ref!=='string'||!t.trigger_ref)throw new Error('Native scene trigger is missing its trigger_ref');
  if(typeof t.occasion!=='string'||!TRIGGER_OCCASIONS.has(t.occasion as TriggerOccasion))throw new Error(`Native scene trigger names an unrecognised occasion: ${String(t.occasion)}`);
  if(!isTriggerTarget(t.target))throw new Error(`Native scene trigger ${t.trigger_ref} names a malformed target`);
  return {trigger_ref:t.trigger_ref,occasion:t.occasion as TriggerOccasion,target:t.target as TriggerTarget};
 });
}

export interface KernelScene {presentation?:{schema:'oi.journey-scene/v1';scene:Scene;saved?:Scene|null}|null;scene_ref:string;title:string;entity_refs:string[];body?:Record<string,unknown>|null;triggers?:unknown[];[key:string]:unknown}
export interface KernelRelation {binding_ref:string;relation:{ref:string;revision:string;[key:string]:unknown};from_entity_ref:string;to_entity_ref:string;[key:string]:unknown}
export interface KernelExpressionDocument {presentation?:{schema:'oi.journey-properties/v1';description:string;loop:boolean;shared?:Journey['shared']}|null;schema:string;expression_ref:string;revision:number;title:string;scenes:KernelScene[];entities:Record<string,KernelEntity>;relations?:Record<string,KernelRelation>;selection?:{scene_ref:string;entity_ref:string|null;relation_ref?:string|null};representations?:unknown[];refinements?:unknown[];collections?:string[];profiles?:unknown[];[key:string]:unknown}
export interface OccurrenceBinding {expression_ref:string;scene_ref:string;entity_ref:string;view_entity_id:string;subject:KernelSubject|null}
export interface SceneBinding {scene_ref:string;member_refs:string[];loaded_refs:string[];page:number;page_count:number;hidden_refs:string[];focused_relation:string|null;occurrences:OccurrenceBinding[];relations:KernelRelation[];body:KernelSceneBody|null;triggers:KernelSceneTrigger[]}
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
function convertEntity(input:KernelEntity,id:string,notes:string[],document?:KernelExpressionDocument):Entity{
 const p=input.parameters??{},glyph=text(p.glyph,'O'),appearance=generatedWikiAppearance(document,input);
 const out=entity((appearance?.title??input.title).slice(0,160),glyph.slice(0,120),{x:number(p.x,0)/WORLD_SCALE,y:number(p.y,0)/WORLD_SCALE,z:number(p.z,0)/WORLD_SCALE});
 out.id=id;
 out.kind=text(p.kind,'formation') as Entity['kind'];
 const shape=appearance?.shape??text(p.shape,'glyph');out.shape=(shape==='glyph'?'text':shape) as Entity['shape'];
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
 const generated=s.entity_refs.some(ref=>generatedWikiAppearance(doc,doc.entities[ref]));
 const material=blankScene((generated?wikiDisplayName(s.title):s.title).slice(0,160));material.id=s.scene_ref;
 material.entities=s.entity_refs.map(ref=>convertEntity(doc.entities[ref],ref,[],doc));
 if(material.entities.some(e=>e.position.z!==0))material.view.mode='3d';
 return material;
}
function pagesFor(refs:string[],entities:Map<string,Entity>,saved:Map<string,Entity>=new Map()):string[][]{
 const pages:string[][]=[[]];let formations=0,pins=0;
 for(const ref of refs){
  const kinds=[entities.get(ref)?.kind,saved.get(ref)?.kind];
  const pin=Number(kinds.includes('pin')),formation=Number(kinds.includes('formation'));
  if(pins+pin>MAX_PINS||formations+formation>MAX_FORMATIONS){pages.push([]);formations=0;pins=0;}
  pages[pages.length-1].push(ref);pins+=pin;formations+=formation;
 }
 return pages;
}
function focusWindow(refs:string[],relation:KernelRelation,entities:Map<string,Entity>,saved:Map<string,Entity>=new Map()):string[]{
 const selected=[...new Set([relation.from_entity_ref,relation.to_entity_ref])];
 const cost=(ref:string)=>[entities.get(ref)?.kind,saved.get(ref)?.kind];
 let pins=selected.filter(ref=>cost(ref).includes('pin')).length,formations=selected.filter(ref=>cost(ref).includes('formation')).length;
 for(const ref of refs){if(selected.includes(ref))continue;const pin=Number(cost(ref).includes('pin')),formation=Number(cost(ref).includes('formation'));if(pins+pin>MAX_PINS||formations+formation>MAX_FORMATIONS)continue;selected.push(ref);pins+=pin;formations+=formation;}
 return selected;
}
export function kernelDocumentToJourney(raw:unknown,options:ViewOptions={}):KernelConversion{
 safe(raw);
 const doc=clone(raw) as KernelExpressionDocument;
 if(!doc||doc.schema!=='oi.expression/v1'||typeof doc.expression_ref!=='string'||!Number.isSafeInteger(doc.revision)||doc.revision<1||typeof doc.title!=='string'||!doc.entities||Array.isArray(doc.entities)||!Array.isArray(doc.scenes)||!doc.scenes.length||doc.scenes.length>64)throw new Error('The kernel document is not a bounded oi.expression/v1 expression');
 // Semantic cardinality matches the kernel document bound (2048); the resident
 // renderer window is the per-Scene page, not this check.
 if(Object.keys(doc.entities).length>2048||Object.keys(doc.relations??{}).length>2048)throw new Error('Native Expression exceeds its binding budget');
 const notes:string[]=[],ids=new Map<string,string>(),converted=new Map<string,Entity>();
 const bindings:Record<string,SceneBinding>={};
 for(const [ref,input] of Object.entries(doc.entities)){
  if(!input||input.entity_ref!==ref||typeof input.title!=='string')throw new Error('Native entity identity disagrees with its binding');
  converted.set(ref,convertEntity(input,idFor(ref,'entity',ids,options.identity?.entities?.[ref]),notes,doc));
 }
 for(const [ref,r] of Object.entries(doc.relations??{})){
  if(!r||r.binding_ref!==ref||!r.relation||typeof r.relation.ref!=='string'||typeof r.relation.revision!=='string'||!converted.has(r.from_entity_ref)||!converted.has(r.to_entity_ref))throw new Error(`Native relation ${ref} has absent or ambiguous endpoints`);
 }
 const sceneRefs=new Set<string>(),savedScenes:Record<string,Scene>={};
 const scenes:Scene[]=doc.scenes.map(s=>{
  if(!s||typeof s.scene_ref!=='string'||sceneRefs.has(s.scene_ref)||typeof s.title!=='string'||!Array.isArray(s.entity_refs)||new Set(s.entity_refs).size!==s.entity_refs.length||s.entity_refs.some(ref=>!converted.has(ref)))throw new Error('Native scene has duplicate identities or unresolved members; no placeholders were invented');
  sceneRefs.add(s.scene_ref);
  const material=nativeSceneMaterial(doc,s);
  const materialEntities=new Map(material.entities.map(e=>[e.id,e]));
  const saved=s.presentation?s.presentation.saved:material;
  if(saved)assertMaterialOccurrences(saved,s.scene_ref,s.entity_refs);
  const savedEntities=new Map((saved?.entities??[]).map(e=>[e.id,e]));
  const visibleRefs=[...new Set([...material.entities,...(saved?.entities??[])].map(e=>e.id))];
  const pages=pagesFor(visibleRefs,materialEntities,savedEntities);
  const preferred=doc.selection?.scene_ref===s.scene_ref?doc.selection.entity_ref:null;
  const explicit=options.pages?.[s.scene_ref];
  let page=explicit??(preferred?Math.max(0,pages.findIndex(refs=>refs.includes(preferred))):0);
  if(!Number.isInteger(page)||page<0||page>=pages.length)throw new Error(`Invalid disclosure page for ${s.scene_ref}`);
  const relations=Object.values(doc.relations??{}).filter(r=>s.entity_refs.includes(r.from_entity_ref)&&s.entity_refs.includes(r.to_entity_ref));
  const focusRef=options.focusRelation===undefined?(doc.selection?.scene_ref===s.scene_ref?doc.selection.relation_ref:null):options.focusRelation;
  const focused=explicit===undefined?relations.find(r=>r.binding_ref===focusRef && materialEntities.has(r.from_entity_ref) && materialEntities.has(r.to_entity_ref)):undefined;
  const loaded=focused?focusWindow(visibleRefs,focused,materialEntities,savedEntities):pages[page];
  const occurrenceIds=new Map([...converted].map(([ref,e])=>[ref,e.id]));
  const scene=mapSceneOccurrences(material,idFor(s.scene_ref,'scene',ids,options.identity?.scenes?.[s.scene_ref]),occurrenceIds,new Set(loaded));
  if(saved)savedScenes[scene.id]=mapSceneOccurrences(saved,scene.id,occurrenceIds,new Set(loaded));
  bindings[scene.id]={scene_ref:s.scene_ref,member_refs:[...s.entity_refs],loaded_refs:[...loaded],page,page_count:pages.length,hidden_refs:s.entity_refs.filter(ref=>!materialEntities.has(ref)),focused_relation:focused?.binding_ref??null,occurrences:loaded.filter(ref=>materialEntities.has(ref)).map(ref=>({expression_ref:doc.expression_ref,scene_ref:s.scene_ref,entity_ref:ref,view_entity_id:converted.get(ref)!.id,subject:clone(doc.entities[ref].subject??null)})),relations:clone(relations),body:validateSceneBody(clone(s.body??null)),triggers:validateSceneTriggers(clone(s.triggers??[]))};
  if(loaded.length<s.entity_refs.length)notes.push(`${s.scene_ref}: ${loaded.length}/${s.entity_refs.length} members loaded; ${pages.length} disclosure pages preserve the whole`);
  return scene;
 });
 if(doc.presentation && doc.presentation.schema!=='oi.journey-properties/v1')throw new Error('Unsupported native Expression presentation');
 const journey:Journey={schema:'oi.journey',version:1,id:idFor(doc.expression_ref,'expression',ids,options.identity?.expression),name:doc.title.slice(0,160),description:doc.presentation?.description??'',loop:doc.presentation?.loop??true,scenes,savedScenes,updatedAt:new Date().toISOString(),...(doc.presentation?.shared?{shared:clone(doc.presentation.shared)}:{})};
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
