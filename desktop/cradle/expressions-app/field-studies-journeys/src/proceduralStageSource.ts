/** The actual native Source/Library read models used by the normal Stage.
 * These are owner reads and typed human intents, never a second source graph,
 * registry, interpreter, document store, body clock or consumer receipt. */
import {clone} from './model';
import {PROCEDURAL_SCHEMA,retention,validateAddress,addressKey,addressCovers,type StageAddress,type SourceBasis} from './proceduralRetention';
import {sameNative,type Scope,type ProceduralRequest} from './proceduralProtocol';
import {studioBasis,scopeContains,type StudioSnapshot} from './proceduralStudio';
import {validateSourceReply,type ProcedureSourceReply} from './proceduralSources';
import type {KernelDisclosedAction} from './kernelDocumentBridge';
import {controlCapabilities} from './proceduralControls';
import {studioControlContext} from './proceduralStudio';
import {WORLD_SCALE} from './nativeParameters';

export interface FullNativeSubject {subject_ref:string;native_owner:string;presentation_role:'being'|'thing';sources:SourceBasis[];readings:SourceBasis[];actions:KernelDisclosedAction[];}
export interface StageTargetReading {occurrence_ref:string;address:StageAddress;subject:FullNativeSubject;revision:number;tags:Array<{value:string;origin:'native_source'|'authored'|'generated';scope_ref:string;basis:{source_ref:string;revision:string}}> ;properties:Record<string,unknown>;}
export interface NativeSceneSource {native_owner:'oi.expression';expression_ref:string;scene_ref:string;document_revision:number;source_basis:{source_ref:string;revision:string};material_fingerprint:string;presentation:{schema:'oi.journey-scene/v1';scene:Record<string,unknown>;saved?:unknown};principal:FullNativeSubject;contributors:FullNativeSubject[];locus_ref:string;locus_revision:string;}
export interface StageSourceReading {schema:typeof PROCEDURAL_SCHEMA;expression_ref:string;document_revision:number;current_readings:StageTargetReading[];scene_sources:NativeSceneSource[];}
export type NativeLibraryRecipe='scene_material'|'sequence_material'|'force_parameters'|'atlas_passage';
export interface NativeLibraryDescriptor {recipe:NativeLibraryRecipe;label:string;native_operations:string[];required_source?:string;properties?:string[];parameters?:Array<{key:string;minimum:number;maximum:number}>;domain_owner?:string;}
export interface StageLibrary {schema:'ql.procedural-library/v1';native_owner:'ql-mef';source:string;recipes:NativeLibraryDescriptor[];editable:string[];dependencies:string[];standing:string;compiler:ProcedureSourceReply['source'];registry_revision:string;source_revision:string;}
export interface ProcedureAuthorship {procedure_ref:string;revision:string;composition:Record<string,unknown>;trigger:{kind:string;mode:'edge'|'level'};selector:Record<string,unknown>;conditions:unknown[];recipe_parameters:Record<string,unknown>;membership_mode:'frozen'|'sustained';membership_change_policy:'admit_and_record'|'retain_existing'|'reject_change';timing:{owner_ref:string;domain:string;epoch_ref:string;requested_cursor:number;time_mapping_ref:string|null};budgets:{max_evaluations:number;max_operations:number;max_expansion_depth:number;max_active_instances:number;max_queue:number};seed:string;removal_policy:'retire_unedited_detach_edited'|'conflict_on_edited';failure_policy:'stop_affected_and_checkpoint'|'hold_last_admitted_and_report';continuation_policy:'continue'|'hold'|'checkpoint_and_release';}
export type LibraryChoice={recipe:'scene_material';outputs:Array<{output_slot:string;scene_ref:string}>}|{recipe:'sequence_material';outputs:Array<{output_slot:string;scene_ref:string}>;holds:Array<{entity_ref:string;step_ref:string|null;seconds:number}>}|{recipe:'force_parameters';writes:Array<{output_slot:string;parameter:string;value:{value_source:'constant';value:number}|{value_source:'native_property';property:string}}> }|{recipe:'atlas_passage';changes:Record<string,unknown>[]};
export interface StageLibraryIntent {basis:{expression_ref:string;document_revision:number;scene_ref:string};operation_ref:string;source:NativeSceneSource;profile:SourceBasis;authored:ProcedureAuthorship;choice:LibraryChoice;scope:Scope;action:'prepare'|'regenerate';}

const need=(condition:unknown,message:string):void=>{if(!condition)throw Error(message);};
const integer=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0;
const bounded=(value:unknown)=>typeof value==='string'&&!!value&&value.length<=4096&&!/[\u0000-\u001f\u007f]/.test(value);
function source(value:SourceBasis){need(value&&bounded(value.ref)&&bounded(value.revision)&&['available','unavailable','withheld','stale'].includes(value.availability),'The full native Source reading is malformed');}
function nativeBindings(snapshot:StudioSnapshot){return snapshot.view.document.scenes.flatMap(scene=>scene.presentation?.scene?retention(scene.presentation.scene).bindings:[]);}
function exactNativeBinding(snapshot:StudioSnapshot,address:StageAddress){const whole={...address,property:null},rows=nativeBindings(snapshot).filter(binding=>addressKey(resolvedSourceReadAddresses(snapshot,{kind:'addresses',addresses:[binding.address]})[0])===addressKey(whole));need(rows.every(row=>sameNative(row,rows[0])),'Conflicting current native manifestation bindings');return rows[0];}
export function validateFullNativeSubject(value:unknown):FullNativeSubject {
 const s=value as FullNativeSubject;need(s&&bounded(s.subject_ref)&&bounded(s.native_owner)&&['being','thing'].includes(s.presentation_role)&&Array.isArray(s.sources)&&Array.isArray(s.readings)&&s.sources.length+s.readings.length<=256&&Array.isArray(s.actions)&&s.actions.length<=256,'The native subject lacks its full owner, role, sources, readings or actions');
 for(const row of [...s.sources,...s.readings]){source(row);need(row.availability==='available','The current native subject has an unavailable, stale or withheld Source');}
 for(const action of s.actions)need(bounded(action.action_ref)&&bounded(action.target_ref)&&bounded(action.authority_requirement),'The native subject action is unqualified');return clone(s);
}
export function stageSourceRequest(snapshot:StudioSnapshot,scope:Scope,profile:SourceBasis|null=null,property_keys:string[]=[]):Extract<ProceduralRequest,{operation:'read_source'}> {
 const basis=studioBasis(snapshot);if(profile){source(profile);need(profile.availability==='available','Select an available exact source profile');}
 need(property_keys.length<=2048&&new Set(property_keys).size===property_keys.length&&property_keys.every(bounded),'Choose a bounded distinct native property request');
 if(scope.kind==='addresses')for(const address of scope.addresses){validateAddress(address);need(address.expression_ref===basis.expression_ref,'The source target belongs to another Expression');if(address.component==='layer')need(Object.hasOwn(address,'parent_ref'),'Keep the source layer’s original base or state parent');}
 return {operation:'read_source',expression_ref:basis.expression_ref,expected_revision:basis.document_revision,scope:clone(scope),property_keys:clone(property_keys),scene_profile:clone(profile)};
}
/** Exact current Document comparison, independent of the transported source's
 * claimed hash. The native owner keeps the actual typed fingerprint opaque. */
export function validateNativeSceneSource(raw:unknown,snapshot:StudioSnapshot,profile:SourceBasis):NativeSceneSource {
 source(profile);need(profile.availability==='available','The actual source profile is unavailable');
 const s=raw as NativeSceneSource,basis=studioBasis(snapshot),scene=snapshot.view.document.scenes.find(row=>row.scene_ref===s?.scene_ref);
 need(s?.native_owner==='oi.expression'&&s.expression_ref===basis.expression_ref&&s.document_revision===basis.document_revision&&!!scene&&sameNative(s.source_basis,{source_ref:profile.ref,revision:profile.revision})&&/^[a-f0-9]{64}$/.test(s.material_fingerprint),'The native Scene source belongs to another Document/profile');
 const actual=clone(scene!.presentation) as Record<string,unknown>|null;if(!actual)throw Error('The actual native Scene has no authored Presentation');
 const material=actual.scene as Record<string,unknown>;delete material.procedural;
 need(s.presentation?.schema==='oi.journey-scene/v1'&&s.presentation.scene?.id===s.scene_ref&&!Object.hasOwn(s.presentation.scene,'procedural')&&sameNative(actual,s.presentation),'The source no longer matches the whole actual native Scene material');
 const address:StageAddress={expression_ref:basis.expression_ref,scene_ref:s.scene_ref,entity_ref:null,component:'scene',constituent_ref:null,property:null};
 const binding=exactNativeBinding(snapshot,address);
 need(binding&&sameNative(binding.principal,s.principal)&&sameNative(binding.contributors,s.contributors)&&binding.locus.ref===s.locus_ref&&binding.locus.revision===s.locus_revision,'The source principal, contributors or locus differ from the actual native binding');
 validateFullNativeSubject(s.principal);need(Array.isArray(s.contributors)&&s.contributors.length<=64,'The native source contributors are unbounded');s.contributors.forEach(validateFullNativeSubject);return clone(s);
}
export function validateStageSourceReading(raw:unknown,snapshot:StudioSnapshot,request:Extract<ProceduralRequest,{operation:'read_source'}>):StageSourceReading {
 const r=raw as StageSourceReading,basis=studioBasis(snapshot);need(r&&!(raw as {state?:unknown}).state&&r.schema===PROCEDURAL_SCHEMA&&r.expression_ref===request.expression_ref&&r.expression_ref===basis.expression_ref&&r.document_revision===request.expected_revision&&r.document_revision===basis.document_revision&&Array.isArray(r.current_readings)&&r.current_readings.length<=2048&&Array.isArray(r.scene_sources)&&r.scene_sources.length<=64,'The current native Source reply has a stale or foreign Document basis');
 const expected=resolvedSourceReadAddresses(snapshot,request.scope),seen=new Set<string>();need(expected.length===r.current_readings.length,'The native Source reply dropped or widened resolved scope rows');for(const row of r.current_readings){validateAddress(row.address);const doc=snapshot.view.document,nativeEntity=row.address.entity_ref?doc.entities[row.address.entity_ref]:undefined,nativeScene=row.address.scene_ref?doc.scenes.find(scene=>scene.scene_ref===row.address.scene_ref):undefined,revision=nativeEntity?.revision??nativeScene?.revision??doc.revision;need(expected.some(address=>addressKey(address)===addressKey(row.address))&&bounded(row.occurrence_ref)&&integer(row.revision)&&row.revision===revision&&!seen.has(addressKey(row.address)),'The native Source reply widened/duplicated its original scope or changed target revision');seen.add(addressKey(row.address));if(!row.address.property&&['expression','scene','entity'].includes(row.address.component))need(row.occurrence_ref===(row.address.entity_ref??row.address.scene_ref??row.address.expression_ref),'The native Source occurrence identity differs from its actual target');validateFullNativeSubject(row.subject);if(row.address.entity_ref)need(sameNative(nativeEntity?.subject,row.subject),'The native constituent Source subject changed');else{const binding=exactNativeBinding(snapshot,row.address);need(binding&&sameNative(binding.principal,row.subject),'The whole native Source principal differs from its exact binding');}need(Array.isArray(row.tags)&&row.tags.length<=256&&row.properties&&typeof row.properties==='object'&&!Array.isArray(row.properties)&&Object.keys(row.properties).length===request.property_keys.length&&request.property_keys.every(key=>Object.hasOwn(row.properties,key)),'The native Source property or tag request changed');for(const tag of row.tags)need(bounded(tag.value)&&['native_source','authored','generated'].includes(tag.origin)&&tag.scope_ref===row.address.scene_ref&&tag.basis?.source_ref===row.address.scene_ref&&tag.basis?.revision===String(nativeScene?.revision),'The native Source tag lost its actual Scene origin/scope/revision');const actualTags=nativeBindings(snapshot).filter(binding=>binding.address.scene_ref===row.address.scene_ref&&addressCovers(resolvedSourceReadAddresses(snapshot,{kind:'addresses',addresses:[binding.address]})[0],row.address)).flatMap(binding=>binding.tags.map(tag=>({value:tag.tag,origin:tag.origin==='native'?'native_source':tag.origin,scope_ref:row.address.scene_ref,basis:{source_ref:row.address.scene_ref,revision:String(nativeScene?.revision)}})));const distinctTags=[...new Map(actualTags.map(tag=>[JSON.stringify(tag),tag])).values()];need(row.tags.length===distinctTags.length&&row.tags.every(tag=>distinctTags.some(actual=>sameNative(tag,actual))),'The native Source tags changed actual binding values or origin');if(request.property_keys.includes('native_atlas_state'))need(sameNative(row.properties.native_atlas_state,{schema:'ql.native-atlas-state/v1',expression_ref:doc.expression_ref,focus:doc.selection,scene_order:doc.scenes.map(scene=>scene.scene_ref)}),'The native Atlas operand differs from actual Selection/order');for(const key of request.property_keys.filter(key=>['force_strength','force_spin','force_radius'].includes(key)))need(nativeEntity&&sameNative(row.properties[key],nativeEntity.parameters[key]?.value),'The native force operand differs from its actual Parameter units/value');}
 if(!request.scene_profile)need(r.scene_sources.length===0,'An unrequested source profile was substituted');else for(const scene of r.scene_sources){validateNativeSceneSource(scene,snapshot,request.scene_profile);need(r.current_readings.some(row=>row.address.component==='scene'&&row.address.scene_ref===scene.scene_ref),'The native Scene Source is outside the exact resolved source reading');}
 return clone(r);
}

/** Admission crosscheck against the actual native Document resolver. It does
 * not choose memberships, produce graphs or expand the caller's scope. */
export function resolvedSourceReadAddresses(snapshot:StudioSnapshot,scope:Scope):StageAddress[] {
 const doc=snapshot.view.document,result=new Map<string,StageAddress>(),address=(scene_ref:string|null,entity_ref:string|null,component:StageAddress['component']):StageAddress=>({expression_ref:doc.expression_ref,scene_ref,entity_ref,component,constituent_ref:null,property:null});
 const canonical=(value:StageAddress):StageAddress=>{const next=clone(value);validateAddress(next);if(next.component==='layer'&&!Object.hasOwn(next,'parent_ref')){const binding=Object.entries(snapshot.view.bindings).find(([,scene])=>scene.scene_ref===next.scene_ref),occurrence=binding?.[1].occurrences.find(row=>row.entity_ref===next.entity_ref),scene=binding?doc.scenes.find(row=>row.scene_ref===binding[1].scene_ref)?.presentation?.scene:undefined,entity=scene?.entities.find(row=>row.id===occurrence?.view_entity_id),parents=[...((entity?.layers??[]).some(layer=>layer.id===next.constituent_ref)?[null]:[]),...(entity?.sequence.steps??[]).filter(step=>step.layers?.some(layer=>layer.id===next.constituent_ref)).map(step=>step.id)];need(parents.length===1,'The legacy Source layer has an ambiguous or missing actual parent');next.parent_ref=parents[0];}return next;};
 const add=(value:StageAddress)=>{const next=canonical(value);result.set(addressKey(next),next);};
 if(scope.kind==='expression')add(address(null,null,'expression'));
 else if(scope.kind==='addresses')scope.addresses.forEach(add);
 else if(scope.kind==='scenes')for(const ref of scope.scene_refs){need(doc.scenes.some(scene=>scene.scene_ref===ref),'The original Source Scene scope is absent');add(address(ref,null,'scene'));}
 else for(const scene of doc.scenes){const bindings=retention(scene.presentation?.scene??snapshot.journey.scenes.find(row=>snapshot.view.bindings[row.id]?.scene_ref===scene.scene_ref)!).bindings;
  if(scope.kind==='subject'){if(scene.body?.subject_ref===scope.subject_ref)add(address(scene.scene_ref,null,'scene'));for(const ref of scene.entity_refs)if(doc.entities[ref]?.subject?.subject_ref===scope.subject_ref)add(address(scene.scene_ref,ref,'entity'));for(const binding of bindings)if(binding.principal.subject_ref===scope.subject_ref||binding.contributors.some(row=>row.subject_ref===scope.subject_ref))add(binding.address);}
  if(scope.kind==='locus')for(const binding of bindings)if(binding.locus.ref===scope.source_ref&&binding.locus.revision===scope.source_revision)add(binding.address);
  if(scope.kind==='tag'&&scope.scene_refs.includes(scene.scene_ref))for(const binding of bindings)if(binding.tags.some(tag=>tag.tag===scope.tag&&tag.origin===scope.origin))add(binding.address);
 }
 need(result.size<=2048,'The native Source resolved scope exceeds its budget');return [...result.values()];
}
/** Rust source_occurrence_ref hashes serde Address in declared field order.
 * Use real WebCrypto, not a UI-issued identity or approximate JS hash. */
export async function validateStageOccurrenceIdentities(reading:StageSourceReading):Promise<void> {
 for(const row of reading.current_readings){const a=row.address;if(!a.property&&['expression','scene','entity'].includes(a.component))continue;
  const wire={expression_ref:a.expression_ref,scene_ref:a.scene_ref,entity_ref:a.entity_ref,component:a.component,constituent_ref:a.constituent_ref,...(Object.hasOwn(a,'parent_ref')?{parent_ref:a.parent_ref}:{}),property:a.property};const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(wire))),hex=[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join('');need(row.occurrence_ref===`${a.expression_ref}:target:${hex}`,'The native constituent occurrence hash differs from its exact address/parent');
 }
}
export function projectStageLibrary(raw:unknown):StageLibrary {
 const reply=validateSourceReply(raw,'discover'),result=reply.native_result.result as {library?:StageLibrary},library=result?.library;
 need(library?.schema==='ql.procedural-library/v1'&&library.native_owner==='ql-mef'&&bounded(library.source)&&Array.isArray(library.recipes)&&library.recipes.length>0&&library.recipes.length<=64&&Array.isArray(library.editable)&&Array.isArray(library.dependencies)&&bounded(library.standing)&&bounded(reply.native_result.registry_revision)&&bounded(reply.native_result.source_revision),'The running native compiler has no qualified procedural library');
 const seen=new Set<string>();for(const recipe of library!.recipes){need(['scene_material','sequence_material','force_parameters','atlas_passage'].includes(recipe.recipe)&&!seen.has(recipe.recipe)&&bounded(recipe.label)&&Array.isArray(recipe.native_operations)&&recipe.native_operations.every(bounded),'The native library descriptor is unsupported or duplicate');seen.add(recipe.recipe);for(const p of recipe.parameters??[])need(bounded(p.key)&&Number.isFinite(p.minimum)&&Number.isFinite(p.maximum)&&p.minimum<=p.maximum,'The native recipe property domain is malformed');}
 return clone({...library!,compiler:reply.source,registry_revision:reply.native_result.registry_revision!,source_revision:reply.native_result.source_revision!});
}
const AUTHORSHIP_KEYS=['procedure_ref','revision','composition','trigger','selector','conditions','recipe_parameters','membership_mode','membership_change_policy','timing','budgets','seed','removal_policy','failure_policy','continuation_policy'] as const;
/** Preserve full native C′, timing and policies; no defaults or invented
 * graph/context/epoch/seed are filled into a missing authored definition. */
export function retainedProcedureAuthorship(definition:unknown):ProcedureAuthorship {
 const d=definition as Record<string,unknown>;need(d?.schema==='ql.procedural-composition/v1'&&AUTHORSHIP_KEYS.every(key=>Object.hasOwn(d,key)),'Choose a full source-owned procedure definition');
 const authored=Object.fromEntries(AUTHORSHIP_KEYS.map(key=>[key,clone(d[key])])) as unknown as ProcedureAuthorship;need(authored.recipe_parameters&&typeof authored.recipe_parameters==='object'&&!Array.isArray(authored.recipe_parameters),'The retained recipe parameters are unavailable');delete authored.recipe_parameters.native_program;delete authored.recipe_parameters.source_material_fingerprint;
 validateProcedureAuthorship(authored);return authored;
}
export function validateProcedureAuthorship(a:ProcedureAuthorship):void {
 need(a&&bounded(a.procedure_ref)&&bounded(a.revision)&&bounded(a.seed)&&a.composition&&typeof a.composition==='object'&&['CPF','CT','CP','CF','CFP','CS','direction','actor','interpretation','whole','resolvePath','contextResolution','sources'].every(key=>Object.hasOwn(a.composition,key))&&Array.isArray(a.composition.sources)&&a.composition.sources.length<=256&&a.composition.sources.every(bounded),'The authored procedure lacks its full native C′ source or explicit identity/seed');
 need(a.trigger&&['state_changed','musical_gesture','physical_gesture','source_changed','scene_entered','scene_left','sequence_transition','explicit'].includes(a.trigger.kind)&&['edge','level'].includes(a.trigger.mode)&&a.selector&&['all','occurrences','subject','tag'].includes(String(a.selector.selector))&&Array.isArray(a.conditions)&&a.conditions.length<=64&&a.recipe_parameters&&Object.keys(a.recipe_parameters).length<=256&&!Object.hasOwn(a.recipe_parameters,'native_program'),'The native trigger, selector, conditions or editable recipe parameters are incomplete');
 if(a.selector.selector==='occurrences')need(Array.isArray(a.selector.refs)&&a.selector.refs.length>0&&a.selector.refs.length<=2048&&a.selector.refs.every(bounded)&&new Set(a.selector.refs).size===a.selector.refs.length,'Retain exact distinct native occurrence identities');
 if(a.selector.selector==='subject')need(bounded(a.selector.subject_ref),'Retain the exact native principal subject');
 if(a.selector.selector==='tag')need(bounded(a.selector.value)&&['native_source','authored','generated'].includes(String(a.selector.origin))&&bounded(a.selector.scope_ref),'Retain the tag’s actual origin and scope');
 need(['frozen','sustained'].includes(a.membership_mode)&&['admit_and_record','retain_existing','reject_change'].includes(a.membership_change_policy)&&['retire_unedited_detach_edited','conflict_on_edited'].includes(a.removal_policy)&&['stop_affected_and_checkpoint','hold_last_admitted_and_report'].includes(a.failure_policy)&&['continue','hold','checkpoint_and_release'].includes(a.continuation_policy),'Choose the explicit native membership, removal, failure and continuation policies');
 need(a.timing&&[a.timing.owner_ref,a.timing.domain,a.timing.epoch_ref].every(bounded)&&Number.isSafeInteger(a.timing.requested_cursor)&&a.timing.requested_cursor>=0&&(a.timing.time_mapping_ref===null||bounded(a.timing.time_mapping_ref)),'The actual native timing binding is unavailable');
 for(const [key,max]of [['max_evaluations',4096],['max_operations',4096],['max_expansion_depth',64],['max_active_instances',2048],['max_queue',4096]] as const)need(a.budgets&&integer(a.budgets[key])&&a.budgets[key]<=max,'Enter every bounded native rule budget');
}

export interface StageForceParameter {target:string;address:StageAddress;parameter:string;label:string;units:string;factor:number;minimum:number;maximum:number;base:number;}
/** UI values use the actual authored registry units. Only the library intent
 * boundary converts to the existing native ParameterSet units. */
export function stageForceParameters(snapshot:StudioSnapshot,descriptor:NativeLibraryDescriptor,scope:Scope):StageForceParameter[] {
 if(descriptor.recipe!=='force_parameters')return [];
 const scene=snapshot.journey.scenes.find(row=>row.id===snapshot.sceneId);if(!scene)throw Error('The current native authoring Scene is unavailable');
 return controlCapabilities(scene,studioControlContext(snapshot)).flatMap(row=>{
  if(row.address.component!=='force'||!scopeContains(scope,row.address,snapshot))return [];
  const parameter=`force_${row.address.property}`,native=descriptor.parameters?.find(p=>p.key===parameter);if(!native)return [];
  const minimum=Math.max(row.min,native.minimum/row.native_factor),maximum=Math.min(row.max,native.maximum/row.native_factor);
  if(!Number.isFinite(row.native_factor)||row.native_factor<=0||minimum>maximum)throw Error('The native recipe and actual parameter registry domains disagree');
  return [{target:row.target,address:clone(row.address),parameter,label:row.target,units:row.native_factor===WORLD_SCALE?'stage units':row.units,factor:row.native_factor,minimum,maximum,base:row.base}];
 });
}
export function stageForceChoice(snapshot:StudioSnapshot,descriptor:NativeLibraryDescriptor,scope:Scope,target:string,value:number,output_slot:string):LibraryChoice {
 const actual=stageForceParameters(snapshot,descriptor,scope).find(row=>row.target===target);
 need(actual&&Number.isFinite(value)&&value>=actual.minimum&&value<=actual.maximum&&bounded(output_slot),'The actual force target/value/output slot is outside its current native scope or registry domain');
 return {recipe:'force_parameters',writes:[{output_slot,parameter:actual!.parameter,value:{value_source:'constant',value:value*actual!.factor}}]};
}
/** A native scene/whole inspection row is not a force occurrence. Native
 * ParameterSet changes one continuing Entity in all its Scene manifestations;
 * preserve every actual location within the caller's original authority. */
export function stageForceCommandTarget(snapshot:StudioSnapshot,descriptor:NativeLibraryDescriptor,scope:Scope,target:string):{scope:Scope;property_keys:string[]} {
 const actual=stageForceParameters(snapshot,descriptor,scope).find(row=>row.target===target);need(actual?.address.entity_ref,'The actual force property is not admitted in this original scope');
 const locations=snapshot.view.document.scenes.filter(scene=>scene.entity_refs.includes(actual!.address.entity_ref!)).map(scene=>validateAddress({...actual!.address,scene_ref:scene.scene_ref}));need(locations.length>0&&locations.every(address=>scopeContains(scope,address,snapshot)),'This native Entity also manifests outside the original force scope; inspect the whole Expression or all its manifestations before changing the shared Parameter');
 return {scope:{kind:'addresses',addresses:locations},property_keys:[actual!.parameter]};
}
/** Flow commands use the actual whole Expression operand. A constituent
 * inspection never acquires whole-field authority by choosing a recipe. */
export function stageAtlasCommandTarget(snapshot:StudioSnapshot,scope:Scope):{scope:Scope;selector:Record<string,unknown>} {
 const address:StageAddress={expression_ref:snapshot.view.document.expression_ref,scene_ref:null,entity_ref:null,component:'expression',constituent_ref:null,property:null};need(scopeContains(scope,address,snapshot),'Inspect the whole Expression scope before changing its native scene flow');return {scope:{kind:'addresses',addresses:[address]},selector:{selector:'occurrences',refs:[address.expression_ref]}};
}
