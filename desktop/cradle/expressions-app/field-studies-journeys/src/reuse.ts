/** Reusable expressive material in the authoring app (contract
 * docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md §1, §3, §4).
 *
 * Pure logic, no DOM: role slots on Scene material (entities and text
 * layers), the `oi.expression-reuse/v1` block a "Save as reusable" writes
 * through the kernel's `reuse_set`, role-binding rows for selecting saved
 * material into an act, and the playback steps of an act's sequence. The
 * panel (actPanel.ts) and the kernel do all effects. */
import type {Journey,Scene} from './model';

export type ReuseKind='character'|'scene'|'expression'|'gesture';
export type RoleAccepts='agent'|'object'|'text'|'value';
export const REUSE_KINDS:readonly ReuseKind[]=['character','scene','expression','gesture'];
/** Contract §1 standard roles (participants repeat as `participants.N`). */
export const STANDARD_ROLES=['self','lead','participants.0','participants.1','participants.2','goal','artifact','sender','recipient','progressText','resultText','caption'] as const;
const NAME=/^[A-Za-z0-9_.-]{1,64}$/;
const AGENT_ROLES=/^(self|lead|sender|recipient|participants(\.\d+)?)$/;
/** Central register folder reusable material is saved in (kernel
 * `expression_material::MATERIAL_REGISTER`). */
export const MATERIAL_REGISTER='Work/O-I/desktop/cradle/material/expressive-material';

export interface ReuseRole {role:string;accepts:RoleAccepts;entity_ref?:string;text_id?:string}
export interface ReuseAssociations {workflow_keys:string[];task_types:string[];skill_set_refs:string[];skill_refs:string[];event_families:string[]}
export interface Reuse {schema:'oi.expression-reuse/v1';kind:ReuseKind;title:string;roles?:ReuseRole[];entry_scene_ref?:string;states?:Record<string,string>;gestures?:Record<string,{scene_ref:string;role?:string}>;playback?:string[];preview_state?:string;associations?:Partial<ReuseAssociations>;authored_by?:string}

export function validName(name:string):boolean{return NAME.test(name);}

/** Assign (or clear, with `null`) a role on the entity or text layer `id` of
 * one Scene. Returns which slot changed, or null when nothing carries `id`. */
export function setRole(scene:Scene,id:string,role:string|null):'entity'|'text'|null{
 if(role!==null&&!validName(role))throw new Error(`"${role}" is not a role name (letters, digits, . - _).`);
 const entity=scene.entities.find(e=>e.id===id);
 if(entity){if(role===null)delete entity.role;else entity.role=role;return 'entity';}
 const layer=scene.text.find(t=>t.id===id);
 if(layer){if(role===null)delete layer.role;else layer.role=role;return 'text';}
 return null;
}

/** What a role accepts, from where it lives and its name. */
export function roleAccepts(role:string,slot:'entity'|'text'):RoleAccepts{
 if(slot==='text')return 'text';
 return AGENT_ROLES.test(role)?'agent':'object';
}

export interface RoleSlot {role:string;sceneId:string;slot:'entity'|'text';id:string;accepts:RoleAccepts}
/** Every role placeholder of a journey, in scene order. */
export function roleSlots(journey:Journey):RoleSlot[]{
 const rows:RoleSlot[]=[];
 for(const s of journey.scenes){
  for(const e of s.entities)if(e.role)rows.push({role:e.role,sceneId:s.id,slot:'entity',id:e.id,accepts:roleAccepts(e.role,'entity')});
  for(const t of s.text)if(t.role)rows.push({role:t.role,sceneId:s.id,slot:'text',id:t.id,accepts:'text'});
 }
 return rows;
}

export interface ReuseForm {
 kind:ReuseKind;title:string;
 /** State name → journey scene id. */
 states:Record<string,string>;
 /** Gesture name → journey scene id and the role that performs it. */
 gestures:Record<string,{sceneId:string;role?:string}>;
 entrySceneId?:string;
 /** Journey scene ids in playback order. */
 playback:string[];
 previewState?:string;
 associations:ReuseAssociations;
 authoredBy?:string;
}
/** How journey ids map onto the committed native document. */
export interface NativeIds {scene:(sceneId:string)=>string|undefined;entity:(sceneId:string,entityId:string)=>string|undefined}

/** Split a comma/newline list into trimmed, unique, bounded entries. */
export function parseList(text:string):string[]{
 return [...new Set(text.split(/[,\n]/).map(v=>v.trim()).filter(Boolean))].slice(0,64);
}

/** Build the `oi.expression-reuse/v1` block (contract §1) naming committed
 * native refs. Throws a legible error for every refusal the kernel would
 * make, before anything is written. */
export function buildReuse(journey:Journey,form:ReuseForm,ids:NativeIds):Reuse{
 const title=form.title.trim();
 if(!title||title.length>256)throw new Error('Give the reusable material a title (up to 256 characters).');
 const scene=(id:string)=>{const r=ids.scene(id);if(!r)throw new Error('Save the Expression natively before making it reusable: a Scene has no native ref yet.');return r;};
 const roles:ReuseRole[]=[];const seen=new Set<string>();
 for(const slot of roleSlots(journey)){
  if(seen.has(slot.role))continue;seen.add(slot.role);
  if(slot.slot==='text'){roles.push({role:slot.role,accepts:'text',text_id:slot.id});continue;}
  const entity_ref=ids.entity(slot.sceneId,slot.id);
  if(!entity_ref)throw new Error(`The ${slot.role} object has no native ref yet; save the Expression natively first.`);
  roles.push({role:slot.role,accepts:slot.accepts,entity_ref});
 }
 const states:Record<string,string>={};
 for(const [name,sceneId] of Object.entries(form.states)){
  if(!validName(name))throw new Error(`"${name}" is not a state name.`);
  states[name]=scene(sceneId);
 }
 const gestures:Record<string,{scene_ref:string;role?:string}>={};
 for(const [name,g] of Object.entries(form.gestures)){
  if(!validName(name))throw new Error(`"${name}" is not a gesture name.`);
  if(g.role!==undefined&&!validName(g.role))throw new Error(`"${g.role}" is not a role name.`);
  gestures[name]={scene_ref:scene(g.sceneId),...(g.role?{role:g.role}:{})};
 }
 if(form.kind==='character'&&!Object.keys(states).length)throw new Error('A character names at least one state Scene.');
 if(form.kind==='character'&&!roles.some(r=>r.role==='self'))throw new Error('A character has a body: give one object the role "self".');
 if(form.previewState!==undefined&&form.previewState!==''&&!(form.previewState in states))throw new Error('The preview state must be one of the named states.');
 const associations:Partial<ReuseAssociations>={};
 for(const [key,list] of Object.entries(form.associations) as [keyof ReuseAssociations,string[]][])if(list.length)associations[key]=list.slice(0,64);
 const reuse:Reuse={schema:'oi.expression-reuse/v1',kind:form.kind,title};
 if(roles.length)reuse.roles=roles;
 if(form.entrySceneId)reuse.entry_scene_ref=scene(form.entrySceneId);
 if(Object.keys(states).length)reuse.states=states;
 if(Object.keys(gestures).length)reuse.gestures=gestures;
 if(form.playback.length)reuse.playback=form.playback.map(scene);
 if(form.previewState)reuse.preview_state=form.previewState;
 if(Object.keys(associations).length)reuse.associations=associations;
 if(form.authoredBy)reuse.authored_by=form.authoredBy;
 return reuse;
}

/** Re-address a reuse block built against one Expression onto its fork
 * (the kernel's fork rule: only this Expression's local refs move). */
export function remapReuse(reuse:Reuse,from:string,to:string):Reuse{
 const map=(r:string)=>r.startsWith(from+':')?to+r.slice(from.length):r;
 const out:Reuse=JSON.parse(JSON.stringify(reuse));
 out.roles=out.roles?.map(r=>r.entity_ref?{...r,entity_ref:map(r.entity_ref)}:r);
 if(out.entry_scene_ref)out.entry_scene_ref=map(out.entry_scene_ref);
 if(out.states)out.states=Object.fromEntries(Object.entries(out.states).map(([k,v])=>[k,map(v)]));
 if(out.gestures)out.gestures=Object.fromEntries(Object.entries(out.gestures).map(([k,g])=>[k,{...g,scene_ref:map(g.scene_ref)}]));
 if(out.playback)out.playback=out.playback.map(map);
 if(!out.roles)delete out.roles;
 return out;
}
/** A fresh Expression ref for a reusable copy of a title. */
export function materialExpressionRef(title:string,unique:string):string{
 const slug=(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'material').slice(0,60);
 return `expression:material-${slug}-${unique.replace(/[^a-zA-Z0-9]/g,'').slice(0,12)}`;
}

/** Filename in the register for a title. */
export function materialFileName(title:string):string{
 return (title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'material')+'.expression.json';
}

// --- binding rows for selecting saved material into an act --------------

export interface BindingInput {role:string;accepts:RoleAccepts;character_ref?:string;state?:string;label?:string;glyph?:string;text?:string;value?:number}
export interface ActBinding {kind:'agent'|'object'|'text'|'value';character_ref?:string;state?:string;label?:string;glyph?:string;text?:string;value?:number}
/** Turn filled binding rows into act bindings and captions. Empty rows stay
 * unbound — the material's authored placeholder performs. */
export function actBindings(rows:BindingInput[]):{bindings:Record<string,ActBinding>;captions:Record<string,string>}{
 const bindings:Record<string,ActBinding>={},captions:Record<string,string>={};
 for(const row of rows){
  if(!validName(row.role))throw new Error(`"${row.role}" is not a role name.`);
  if(row.accepts==='text'){if(row.text?.trim())captions[row.role]=row.text.trim();continue;}
  if(row.accepts==='value'){if(row.value!==undefined&&Number.isFinite(row.value))bindings[row.role]={kind:'value',value:row.value};continue;}
  const b:ActBinding={kind:row.accepts};
  if(row.character_ref?.trim())b.character_ref=row.character_ref.trim();
  if(row.state?.trim()){if(!validName(row.state.trim()))throw new Error(`"${row.state}" is not a state name.`);b.state=row.state.trim();}
  if(row.label?.trim())b.label=row.label.trim();
  if(row.glyph?.trim())b.glyph=row.glyph.trim();
  if(Object.keys(b).length>1)bindings[row.role]=b;
 }
 return {bindings,captions};
}

// --- playback over an act's sequence ---------------------------------------

export interface PassageLike {index:number;kind:string;scene_ref?:string;state?:string;role?:string;gesture?:string;text?:string;value?:number;operation?:string;native_ref?:string;summary?:string;mode?:string;transition?:{duration?:number;easing?:string}}
export interface PlaybackStep {position:number;kind:string;label:string;seconds:number;easing?:string;performs:boolean}
const PERFORMS=new Set(['scene','state','gesture','text','return']);
/** The timeline of an act: one step per passage, labelled, with the
 * passage's own transition duration (default 1.5 s). Operate/continue
 * passages are timeline points without a presentation change. */
export function actTimeline(sequence:PassageLike[],defaultSeconds=1.5):PlaybackStep[]{
 return sequence.map(p=>{
  const tail=(r?:string)=>r?r.split(':').pop()!:'';
  const label=p.kind==='gesture'?`${p.role??'object'} · ${p.gesture}`
   :p.kind==='state'&&p.role?`${p.role} · ${p.state}`
   :p.kind==='text'?`${p.role} · ${p.text??p.value}`
   :p.kind==='operate'?`${p.operation} · ${tail(p.native_ref)}`
   :p.kind==='continue'?`→ ${p.mode}`
   :p.kind==='return'?`return${p.text?` · ${p.text}`:''}`
   :p.state??tail(p.scene_ref)??p.kind;
  const d=p.transition?.duration;
  return {position:p.index,kind:p.kind,label,seconds:typeof d==='number'&&Number.isFinite(d)&&d>=0?d:defaultSeconds,...(p.transition?.easing?{easing:p.transition.easing}:{}),performs:PERFORMS.has(p.kind)};
 });
}
/** The next performing step after `position` (null at the end). */
export function nextStep(steps:PlaybackStep[],position:number):PlaybackStep|null{
 return steps.find(s=>s.position>position&&s.performs)??null;
}
