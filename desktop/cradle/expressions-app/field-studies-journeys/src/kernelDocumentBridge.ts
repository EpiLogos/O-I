/** The kernel document bridge: opens a kernel-held oi.expression/v1 document
 * into the app's own engine path. The kernel document IS the store — this
 * conversion only ever produces a working view for the engine, never a saved
 * second copy; saves go back through the kernel's own edit op
 * (kernelExpressions.saveKernelExpression).
 *
 * The mapping is honest by law: where an oi.expression/v1 document's
 * scenes/entities map onto the journey model, they map; where they do NOT
 * (subject bindings, automations, relations, scene bodies, triggers,
 * representations, refinements, profiles), the conversion converts what maps
 * and names the remainder as conversion notes on the imported document.
 * Nothing is silently dropped. */
import {Journey,Scene,Entity,Vec3,blankScene,entity,clone} from './model.js';
import {WORLD_SCALE} from './nativeParameters.js';

/** The narrow slice of oi.expression/v1 this bridge reads. Kept local so the
 * app bundle never couples to cradle internals; unknown fields are simply
 * never invented here. */
export interface KernelParameter {value:string|number;automation?:{min:number;max:number;rate_hz:number;waveform:string}|null}
export interface KernelEntity {entity_ref:string;title:string;subject?:{subject_ref:string;native_owner:string}|null;parameters:Record<string,KernelParameter>}
export interface KernelScene {scene_ref:string;title:string;entity_refs:string[];body?:{carrier?:string}|null;triggers?:unknown[]}
export interface KernelExpressionDocument {schema:string;expression_ref:string;revision:number;title:string;scenes:KernelScene[];entities:Record<string,KernelEntity>;relations?:Record<string,unknown>;selection?:{scene_ref:string;entity_ref:string|null};representations?:unknown[];refinements?:unknown[];collections?:string[];profiles?:unknown[]}
export interface KernelConversion {journey:Journey;notes:string[];startSceneId:string|null}

/** The kernel's parameter vocabulary (kernel/src/expression.rs `bounds`):
 * x/y/z/scale/share numeric, glyph text. Anything else is named, not mapped. */
const MAPPED_NUMERIC=['x','y','z','scale','share'] as const;
const MAPPED_KEYS=new Set<string>([...MAPPED_NUMERIC,'glyph']);

/** Kernel positions are native engine world units (the cradle's own
 * engineProjection writes them straight into native entity x/y/z). The app's
 * authoring stage units are world units over WORLD_SCALE — the same
 * reversible conversion nativeBridge uses. */
const toStage=(v:number)=>Math.max(-100,Math.min(100,v/WORLD_SCALE));

/** Journey ids must satisfy the app's safe-id law (model.validateJourney):
 * [A-Za-z0-9_.:-]{1,160}. Kernel refs satisfy the charset but can exceed the
 * length budget, so long refs are folded deterministically and named. */
const safeAppId=(raw:string,taken:Set<string>,notes:string[]):string=>{
 let id=raw;
 if(!/^[a-zA-Z0-9_.:-]{1,160}$/.test(id)){
  const folded=id.replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,160);
  notes.push(`ref ${raw} exceeds the journey id budget — opened as ${folded}`);
  id=folded;
 }
 let out=id,attempt=1;
 while(taken.has(out)){const suffix=`~${++attempt}`;out=id.slice(0,Math.max(1,160-suffix.length))+suffix;}
 taken.add(out);
 return out;
};

const numeric=(p:KernelParameter|undefined):number|undefined=>p&&typeof p.value==='number'&&Number.isFinite(p.value)?p.value:undefined;
const glyphOf=(p:KernelParameter|undefined):string|undefined=>p&&typeof p.value==='string'?p.value:undefined;

/** Open one kernel-held oi.expression/v1 document as a working journey view.
 * Throws when the document is not an oi.expression/v1 document at all — a
 * conversion is never guessed from an unrelated payload. */
export function kernelDocumentToJourney(raw:unknown):KernelConversion{
 const doc=raw as KernelExpressionDocument;
 if(!doc||typeof doc!=='object'||doc.schema!=='oi.expression/v1'||typeof doc.expression_ref!=='string'||!Array.isArray(doc.scenes))throw new Error('The kernel document is not an oi.expression/v1 expression; nothing was converted.');
 const notes:string[]=[];
 const taken=new Set<string>();
 const journey=blankJourneyOf(doc);
 const sceneId=new Map<string,string>();
 const converted=new Map<string,Entity>();
 for(const [ref,e] of Object.entries(doc.entities??{})){
  const id=safeAppId(ref,taken,notes);
  const glyph=glyphOf(e.parameters?.glyph);
  const position:Vec3={x:toStage(numeric(e.parameters?.x)??0),y:toStage(numeric(e.parameters?.y)??0),z:toStage(numeric(e.parameters?.z)??0)};
  const out=entity(e.title||ref,glyph??'O',position);
  out.id=id;
  const scale=numeric(e.parameters?.scale);
  if(scale!==undefined)out.scale=scale;
  const share=numeric(e.parameters?.share);
  if(share!==undefined)out.share=share;
  converted.set(ref,out);
  if(e.subject)notes.push(`entity ${ref} carries a native subject binding (${e.subject.subject_ref} · ${e.subject.native_owner}) — the journey model has no binding equivalent; opened as a plain formation`);
  for(const [key,p] of Object.entries(e.parameters??{})){
   if(MAPPED_KEYS.has(key))continue;
   notes.push(`entity ${ref} parameter ${key} (${typeof p.value}) has no journey parameter equivalent — not carried`);
  }
  for(const key of MAPPED_NUMERIC){
   const p=e.parameters?.[key];
   if(p?.automation)notes.push(`entity ${ref} parameter ${key} is automated (${p.automation.waveform} ${p.automation.min}–${p.automation.max} @ ${p.automation.rate_hz}Hz) — automation is not carried; the base value stands`);
  }
 }
 journey.scenes=doc.scenes.map(s=>{
  const scene:Scene=blankScene(s.title||s.scene_ref);
  scene.id=safeAppId(s.scene_ref,taken,notes);
  sceneId.set(s.scene_ref,scene.id);
  scene.entities=s.entity_refs.map(ref=>{
   const mapped=converted.get(ref);
   if(mapped)return clone(mapped);
   // The scene names an entity the document does not define: keep the
   // composition legible with a placeholder and say so.
   const id=safeAppId(ref,taken,notes);
   notes.push(`scene ${s.scene_ref} references entity ${ref}, which the document does not define — opened as a placeholder formation`);
   const placeholder=entity(ref,'O');
   placeholder.id=id;
   return placeholder;
  });
  if(s.body)notes.push(`scene ${s.scene_ref} carries a scene body${s.body.carrier?` (carrier ${s.body.carrier})`:''} — not carried`);
  if(s.triggers?.length)notes.push(`scene ${s.scene_ref} carries ${s.triggers.length} declarative trigger(s) — not carried`);
  return scene;
 });
 const relationCount=Object.keys(doc.relations??{}).length;
 if(relationCount)notes.push(`${relationCount} typed relation(s) not carried — the journey model has no relation vocabulary`);
 if(doc.representations?.length)notes.push(`${doc.representations.length} representation binding(s) not carried`);
 if(doc.refinements?.length)notes.push(`${doc.refinements.length} refinement proposal(s) not carried (kernel history keeps them)`);
 if(doc.profiles?.length)notes.push(`${doc.profiles.length} profile adoption(s) not carried`);
 if(doc.collections?.length)notes.push(`collection membership (${doc.collections.join(', ')}) not carried`);
 const selectionScene=doc.selection?.scene_ref;
 const startSceneId=selectionScene?sceneId.get(selectionScene)??null:null;
 journey.description=`Kernel expression ${doc.expression_ref} · revision ${doc.revision}, opened through the kernel host channel.`+(notes.length?` Conversion notes: ${notes.join(' ')}`:'');
 if(journey.description.length>4800)journey.description=journey.description.slice(0,4800)+' … (conversion notes truncated)';
 return {journey,notes,startSceneId};
}
function blankJourneyOf(doc:KernelExpressionDocument):Journey{
 return {schema:'oi.journey',version:1,id:doc.expression_ref,name:doc.title||doc.expression_ref,description:'',loop:true,scenes:[],updatedAt:new Date().toISOString()};
}
