/** Procedural authorship lives in the SAME native Scene presentation. These
 * codecs do not persist a second document or a scene-side runtime clock. */
import {clone,type Scene,type AutomationLane} from './model';
import type {PropertyTrack} from './propertyTracks';
import {validateOperation,type Operation} from './proceduralProtocol';
export const PROCEDURAL_SCHEMA='oi.expression-procedural/v1' as const;
export type Component='expression'|'scene'|'field'|'entity'|'layer'|'force'|'sequence'|'sequence_link'|'property'|'driver';
export interface StageAddress {expression_ref:string;scene_ref:string|null;entity_ref:string|null;component:Component;constituent_ref:string|null;parent_ref?:string|null;property:string|null}
export interface SourceBasis {ref:string;revision:string;availability:'available'|'unavailable'|'withheld'|'stale'}
export interface ManifestationBinding {address:StageAddress;principal:{subject_ref:string;native_owner:string;sources:SourceBasis[]};contributors:Array<{subject_ref:string;native_owner:string;sources:SourceBasis[]}>;locus:SourceBasis;tags:Array<{tag:string;origin:'native'|'authored'|'generated'}>}
export interface ControlRetention {address:StageAddress;target:string;authored_base:unknown;dormant_lanes:AutomationLane[];dormant_tracks:PropertyTrack[];takeover:{value:unknown;lifetime:'gesture'|'persistent';actor:string;operation_ref:string}|null;source_basis:SourceBasis[];dormant_overrides?:Array<{contribution_ref:string;overrides:Array<{address:StageAddress;value:unknown;actor:string}>;takeover_overrides:Array<{address:StageAddress;value:unknown;actor:string}>}>}
export interface ContributionRetention {contribution_ref:string;procedure_ref:string;output_slot:string;subject_refs:string[];occurrence_ref:string;recipe_revision:string;owned_addresses:StageAddress[];generated_basis:unknown;authored_overrides:Array<{address:StageAddress;value:unknown;actor:string}>;status:'active'|'retired'|'detached'}
export type RecordedOperation=Operation;
export interface ProcedureRetention {procedure_ref:string;revision:string;source_basis:SourceBasis[];seed:{algorithm:string;version:string;value:string};definition:unknown;resolved_targets:StageAddress[];/** Native rule-event ordinal; fractional simulation/sequence positions use named time_mappings. */cursor:number;state:'running'|'held'|'interrupted'|'retired';membership_events:unknown[]}
export interface ProceduralRetention {schema:typeof PROCEDURAL_SCHEMA;bindings:ManifestationBinding[];procedures:ProcedureRetention[];contributions:ContributionRetention[];controls:ControlRetention[];operations:RecordedOperation[];scene_flow:Array<{from_scene_ref:string;to_scene_ref:string;policy:'continue'|'hold'|'checkpoint_release';cursor:number}>;time_mappings:Array<{owner:string;instance_ref:string;domain:string;cursor:number;rate:number;origin:number}>;source_basis:SourceBasis[];checkpoint?:{owner:string;instance_ref:string;revision:string;source_basis:SourceBasis[];cursor:number;state_ref:string}}
export type ProceduralScene=Scene&{procedural?:ProceduralRetention};
const budgets={bindings:2048,procedures:64,contributions:2048,controls:2048,operations:256,scene_flow:64,time_mappings:64,source_basis:256};
const components=new Set<Component>(['expression','scene','field','entity','layer','force','sequence','sequence_link','property','driver']);
export function validateAddress(raw:unknown):StageAddress {
 const a=raw as StageAddress;
 if(!a||typeof a!=='object'||typeof a.expression_ref!=='string'||!a.expression_ref.startsWith('expression:')||!components.has(a.component))throw new Error('Invalid native procedural address');
 for(const key of ['scene_ref','entity_ref','constituent_ref','property'] as const)if(a[key]!==null&&(typeof a[key]!=='string'||!a[key]||a[key]!.length>512||/[\u0000-\u001f]/.test(a[key]!)))throw new Error('Invalid constituent identity');
 if(a.parent_ref!==undefined&&(a.component!=='layer'||a.parent_ref!==null&&(typeof a.parent_ref!=='string'||!a.parent_ref||a.parent_ref.length>512||/[\u0000-\u001f]/.test(a.parent_ref))))throw new Error('Invalid containing layer state');
 if(a.scene_ref!==null&&!a.scene_ref.startsWith(a.expression_ref+':scene:')||a.entity_ref!==null&&!a.entity_ref.startsWith(a.expression_ref+':entity:'))throw new Error('Address belongs to another Expression');
 if(a.property?.split('.').some(k=>['__proto__','prototype','constructor'].includes(k)||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)))throw new Error('Unsafe procedural property');
 if(a.component==='expression'&&(a.scene_ref!==null||a.entity_ref!==null||a.constituent_ref!==null))throw new Error('Expression address has constituent refs');
 if(a.component!=='expression'&&a.scene_ref===null)throw new Error('Constituent needs a Scene');
 if(['scene','field'].includes(a.component)&&(a.entity_ref!==null||a.constituent_ref!==null))throw new Error('Scene address has unrelated constituent refs');
 if(!['expression','scene','field','property','driver'].includes(a.component)&&a.entity_ref===null)throw new Error('Constituent needs an entity occurrence');
 if(['layer','sequence_link','driver'].includes(a.component)?a.constituent_ref===null:a.constituent_ref!==null)throw new Error('Invalid stable constituent ref');
 return clone(a);
}
export const addressKey=(a:StageAddress)=>JSON.stringify([a.expression_ref,a.scene_ref,a.entity_ref,a.component,a.constituent_ref,a.parent_ref===undefined?[]:[a.parent_ref],a.property]);
/** Broad ownership contains constituents only when no partial property was
 * declared. A property selection never inherits its whole's write authority. */
export function addressCovers(owner:StageAddress,target:StageAddress):boolean {
 if(owner.expression_ref!==target.expression_ref)return false;
 if(owner.component==='expression'&&owner.property===null)return true;
 if(owner.scene_ref!==target.scene_ref)return false;
 if(owner.component==='scene'&&owner.property===null)return true;
 if(owner.entity_ref!==target.entity_ref)return false;
 if(owner.component==='entity'&&owner.property===null)return true;
 if(owner.component==='sequence'&&owner.property===null&&(target.component==='sequence_link'||target.component==='layer'&&target.parent_ref!=null))return true;
 if(owner.component==='sequence_link'&&owner.property===null&&target.component==='layer'&&target.parent_ref===owner.constituent_ref)return true;
 return owner.component===target.component&&owner.constituent_ref===target.constituent_ref&&owner.parent_ref===target.parent_ref&&(owner.property===null||target.property===owner.property||target.property?.startsWith(owner.property+'.')===true);
}
function source(s:SourceBasis){if(!s||!s.ref||!s.revision||!['available','unavailable','withheld','stale'].includes(s.availability))throw new Error('Unqualified procedural source');}
function safe(v:unknown,depth=0):void{if(depth>40)throw new Error('Procedural nesting budget exceeded');if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Non-finite procedural value');if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Unsafe procedural data');safe(x,depth+1);}}
export function emptyRetention():ProceduralRetention {return {schema:PROCEDURAL_SCHEMA,bindings:[],procedures:[],contributions:[],controls:[],operations:[],scene_flow:[],time_mappings:[],source_basis:[]};}
export function validateRetention(raw:unknown):ProceduralRetention {
 const r=raw as ProceduralRetention;safe(raw);
 if(!r||r.schema!==PROCEDURAL_SCHEMA||new TextEncoder().encode(JSON.stringify(r)).length>1048576)throw new Error('Unsupported or unbounded procedural record');
 if(Object.keys(r).some(k=>k!=='schema'&&k!=='checkpoint'&&!(k in budgets)))throw new Error('Unknown procedural retention field');
 for(const [key,bound] of Object.entries(budgets)){const rows=r[key as keyof typeof budgets];if(!Array.isArray(rows)||rows.length>bound)throw new Error(`Invalid ${key} budget`);}
 r.source_basis.forEach(source);
 const unique=(rows:unknown[],key:string)=>{const ids=new Set<string>();for(const raw of rows){const id=(raw as Record<string,unknown>)[key];if(typeof id!=='string'||!id||ids.has(id))throw new Error(`Duplicate or absent ${key}`);ids.add(id);}};
 unique(r.procedures,'procedure_ref');unique(r.contributions,'contribution_ref');unique(r.operations.map(o=>o.envelope),'operation_ref');
 const controls=new Set<string>();for(const c of r.controls){validateAddress(c.address);const id=addressKey(c.address);if(controls.has(id))throw new Error('Conflicting retained control');controls.add(id);c.source_basis.forEach(source);if(!Array.isArray(c.dormant_lanes)||!Array.isArray(c.dormant_tracks)||!c.target)throw new Error('Lost dormant driver');}
 for(const b of r.bindings){validateAddress(b.address);source(b.locus);if(!b.principal?.subject_ref||!b.principal.native_owner||!Array.isArray(b.contributors)||!Array.isArray(b.tags))throw new Error('Invalid manifestation binding');b.principal.sources.forEach(source);b.contributors.forEach(c=>{if(!c.subject_ref||!c.native_owner)throw new Error('Invalid contributor');c.sources.forEach(source);});}
 for(const p of r.procedures){if(!p.revision||!p.seed?.algorithm||!p.seed.version||typeof p.seed.value!=='string'||!Number.isSafeInteger(p.cursor)||p.cursor<0||!Object.hasOwn(p,'definition')||p.definition===null||!Array.isArray(p.membership_events)||!Array.isArray(p.resolved_targets)||!['running','held','interrupted','retired'].includes(p.state))throw new Error('Unreplayable procedure definition or position');p.source_basis.forEach(source);p.resolved_targets.forEach(validateAddress);}
 for(const c of r.contributions){if(!c.procedure_ref||!c.recipe_revision||!c.occurrence_ref||!['active','retired','detached'].includes(c.status)||!Object.hasOwn(c,'generated_basis')||c.generated_basis===null)throw new Error('Invalid contribution generated basis');c.owned_addresses.forEach(validateAddress);c.authored_overrides.forEach(o=>validateAddress(o.address));}
 const mappings=new Set<string>();for(const m of r.time_mappings){const key=JSON.stringify([m.owner,m.instance_ref,m.domain]);if(!m.owner||!m.instance_ref||!m.domain||mappings.has(key)||!Number.isFinite(m.cursor)||m.cursor<0||!Number.isFinite(m.rate)||m.rate<=0||!Number.isFinite(m.origin))throw new Error('Invalid or duplicate time mapping owner, domain or position');mappings.add(key);}
 for(const f of r.scene_flow){if(!f.from_scene_ref?.includes(':scene:')||!f.to_scene_ref?.includes(':scene:')||f.from_scene_ref.split(':scene:')[0]!==f.to_scene_ref.split(':scene:')[0]||!['continue','hold','checkpoint_release'].includes(f.policy)||!Number.isSafeInteger(f.cursor)||f.cursor<0)throw new Error('Invalid scene flow continuity policy or position');}
 r.operations.forEach(validateOperation);
 return clone(r);
}
export function retention(scene:Readonly<Scene>):ProceduralRetention {const value=(scene as ProceduralScene).procedural;return value?validateRetention(value):emptyRetention();}
export function withRetention(scene:Readonly<Scene>,value:ProceduralRetention):ProceduralScene {return {...clone(scene),procedural:validateRetention(value)};}
export type RestorationMode='configuration'|'replay'|'checkpoint';
export function restorationPlan(scene:Readonly<Scene>,mode:RestorationMode,currentSources:SourceBasis[],compatibleCheckpoint?:{owner:string;instance_ref:string;revision:string}):{mode:RestorationMode;retained:ProceduralRetention;source_drift:SourceBasis[];operations:RecordedOperation[]} {
 const r=retention(scene),source_drift=r.source_basis.filter(old=>!currentSources.some(now=>now.ref===old.ref&&now.revision===old.revision&&now.availability==='available'));
 if(mode==='checkpoint'&&(!r.checkpoint||!compatibleCheckpoint||['owner','instance_ref','revision'].some(k=>r.checkpoint![k as keyof typeof compatibleCheckpoint]!==compatibleCheckpoint[k as keyof typeof compatibleCheckpoint])||source_drift.length||!Number.isSafeInteger(r.checkpoint.cursor)||r.checkpoint.cursor<0||!r.checkpoint.state_ref||!r.checkpoint.source_basis.length||r.checkpoint.source_basis.some(old=>old.availability!=='available'||!currentSources.some(now=>now.ref===old.ref&&now.revision===old.revision&&now.availability==='available'))))throw new Error('Checkpoint incompatible; choose configuration open or recorded replay explicitly');
 if(mode==='replay'&&r.operations.some(o=>['prepared','scheduled','applying'].includes(o.status)))throw new Error('Inspect uncertain operations at their owners before replay');
 return {mode,retained:r,source_drift,operations:mode==='replay'?r.operations.filter(o=>o.status==='applied'):[]};
}
