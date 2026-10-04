/** Procedural authorship over the existing Studio and native Workspace.
 * This view owns DOM and uncommitted form text only. The Workspace owns CAS,
 * recovery and adoption; native scene/body/audio owners alone report effects. */
import {clone,blankScene,type Journey,type Scene} from './model';
import {automationTarget,NATIVE_BINDINGS} from './nativeParameters';
import {isShared,effectiveScene,globalPath,writeShared} from './sharedSettings';
import {resolvedAutomation} from './automationLinks';
import {prepareCompositionEdit} from './kernelComposition';
import type {KernelConversion} from './kernelDocumentBridge';
import {controlCapabilities,takeOver,releaseControl,setAuthoredBase,recordControl,type PropertyCapability,type ControlContext} from './proceduralControls';
import {retention,withRetention,addressKey,addressCovers,validateAddress,type StageAddress,type SourceBasis,type ManifestationBinding,type RestorationMode,type ContributionRetention} from './proceduralRetention';
import {ProceduralClient,proceduralChanges,validateEnvelope,validateOperation,sameNative,observationBasisCurrent,type Scope,type Participant,type Envelope,type Operation,type StateReading,type Observation,type ProceduralOwner} from './proceduralProtocol';

export interface StudioBasis {expression_ref:string;document_revision:number;scene_ref:string}
export interface StudioSnapshot {view:KernelConversion;journey:Readonly<Journey>;sceneId:string;selected:readonly string[];/** Existing DocumentStore revision, so native pulses update values without rebuilding forms. */draft_revision?:number;/** Current qualified native source readings, never inferred from a saved recipe. */currentSources?:readonly SourceBasis[];/** Actual admitted host instances and their CURRENT generations. Missing reception is disclosed as unobserved. */currentConsumers?:readonly Participant[];}
export type StudioChangeIntent=
 |{kind:'control';basis:StudioBasis;operation_ref:string;address:StageAddress;target:string;mode:'set_base'|'takeover'|'release'|'record';value?:number;lifetime?:'gesture'|'persistent';record?:{time_seconds:number;track_ref:string}}
 |{kind:'shared_control';basis:StudioBasis;operation_ref:string;address:StageAddress;target:string;value:number}
 |{kind:'detach';basis:StudioBasis;operation_ref:string;contribution_ref:string}
 |{kind:'insert_scene';basis:StudioBasis;operation_ref:string;name:string}
 |{kind:'reorder_scenes';basis:StudioBasis;operation_ref:string;scene_refs:string[]}
 |{kind:'transition';basis:StudioBasis;operation_ref:string;to_scene_ref:string;policy:'continue'|'hold'|'checkpoint_release';cursor:number};
export interface ProcedureParameter {name:string;label:string;type:'number'|'text'|'boolean';units?:string;minimum?:number;maximum?:number;}
/** Descriptors come from an admitted native recipe; the UI invents no recipe,
 * scripts, source relations, epochs or default performance checkpoint. */
export interface NativeProcedureTemplate {procedure_ref:string;revision:string;title:string;source_basis:SourceBasis[];trigger:{kind:string;mode:'edge'|'level'};selector:unknown;membership_mode:'frozen'|'sustained';seed:string;recipe_parameters:Record<string,unknown>;parameters:ProcedureParameter[];actions:readonly ('prepare'|'regenerate'|'hold'|'interrupt'|'resume')[];reason?:string;}
export interface ProcedureAuthoringIntent {basis:StudioBasis;operation_ref:string;procedure_ref:string;expected_recipe_revision:string;action:'prepare'|'regenerate';scope:Scope;trigger:{kind:string;mode:'edge'|'level'};membership_mode:'frozen'|'sustained';seed:string;recipe_parameters:Record<string,unknown>;}
export interface ProcedurePreview {operation:Operation;procedure_ref:string;recipe_revision:string;changes:Array<{kind:string;label:string;address?:StageAddress}>;}
export interface ProcedureActionIntent {basis:StudioBasis;procedure_ref:string;expected_recipe_revision:string;action:'hold'|'interrupt'|'resume';/** Last acknowledged native event position; host revalidates before applying. */observed_cursor:number;}
export interface RestorationReceipt {mode:RestorationMode;state:'applied'|'pending'|'refused';reason?:string;operation_ref?:string;}
export interface ProceduralStudioHost {
 snapshot():StudioSnapshot|null;
 owner:ProceduralOwner;
 /** Executes INSIDE the existing Workspace serial/flushDraft/adoption route.
  * Check this intent's original basis, flush only its own admitted local draft,
  * then buildStudioEnvelope on that new basis and perform native preparation. */
 prepare(intent:StudioChangeIntent):Promise<Operation>;
 /** Optional until actual QL typed producer is joined; absence is disclosed. */
 procedureTemplates?():readonly NativeProcedureTemplate[];
 prepareProcedure?(intent:ProcedureAuthoringIntent):Promise<ProcedurePreview>;
 procedureAction?(intent:ProcedureActionIntent):Promise<Operation>;
 restore?(mode:RestorationMode,basis:StudioBasis):Promise<RestorationReceipt>;
 openSource(source:SourceBasis):void;
 save():Promise<void>;
 history?(direction:'undo'|'redo'):Promise<void>;
 /** Existing scene/property-take owner's time mapping, in Scene seconds. */
 recordPosition?():{scene_ref:string;time_seconds:number}|null;
 /** Route a qualified constituent into the actual existing source/state
  * editor. This callback uses that editor's native target/adoption path. */
 editComponent?(address:StageAddress):Promise<void>|void;
 /** Same host event/pulse subscription. No view-owned polling clock. */
 subscribe?(listener:()=>void):()=>void;
 report?(message:string):void;
}
export type StudioScopeKind='expression'|'scene'|'selection'|'component'|'subject'|'locus';

export function studioBasis(snapshot:StudioSnapshot):StudioBasis {
 const binding=snapshot.view.bindings[snapshot.sceneId];
 if(!binding||snapshot.journey.id!==snapshot.view.journey.id)throw Error('This Studio has no current native Scene basis');
 return {expression_ref:snapshot.view.document.expression_ref,document_revision:snapshot.view.document.revision,scene_ref:binding.scene_ref};
}
export function studioControlContext(snapshot:StudioSnapshot):ControlContext {
 const basis=studioBasis(snapshot),binding=snapshot.view.bindings[snapshot.sceneId];
 return {expression_ref:basis.expression_ref,scene_ref:basis.scene_ref,occurrences:Object.fromEntries(binding.occurrences.map(o=>[o.view_entity_id,o.entity_ref]))};
}
export type SharedControlCapability=Omit<PropertyCapability,'operations'>&{operations:readonly ['set_base']};
/** Actual existing shared override keys and actual scalar registry domains.
 * A dotted key is ONE shared-settings key, matching the native logical address;
 * it is not traversed as nested JavaScript data or relabelled as Scene state. */
export function sharedControlCapabilities(snapshot:StudioSnapshot):SharedControlCapability[] {
 const expression_ref=studioBasis(snapshot).expression_ref,shared=snapshot.journey.shared;
 if(!shared)return [];
 return (['values','pointer'] as const).flatMap(bucket=>Object.entries(shared[bucket]).flatMap(([bind,base])=>{
  const property=NATIVE_BINDINGS.find(p=>p.bind===bind);
  if(!globalPath(bind)||!property||typeof base!=='number'||!Number.isFinite(base))return [];
  return [{address:validateAddress({expression_ref,scene_ref:null,entity_ref:null,component:'expression',constituent_ref:null,property:`shared.${bucket}.${bind}`}),target:`shared:${bucket}:${bind}`,type:'scalar' as const,units:property.unit??'dimensionless',owner:'expressions' as const,min:property.hardMin,max:property.hardMax,native_factor:property.factor,base,rate_class:'frame' as const,operations:['set_base'] as const}];
 }));
}
export function selectedAddresses(snapshot:StudioSnapshot):StageAddress[] {
 const basis=studioBasis(snapshot),binding=snapshot.view.bindings[snapshot.sceneId];
 return snapshot.selected.map(id=>{
  const occurrence=binding.occurrences.find(o=>o.view_entity_id===id);
  if(!occurrence)throw Error('The selected occurrence is not admitted in the current native Scene');
  return validateAddress({expression_ref:basis.expression_ref,scene_ref:basis.scene_ref,entity_ref:occurrence.entity_ref,component:'entity',constituent_ref:null,property:null});
 });
}
export function componentAddresses(snapshot:StudioSnapshot):Array<{address:StageAddress;label:string}> {
 const scene=snapshot.journey.scenes.find(s=>s.id===snapshot.sceneId);
 if(!scene)throw Error('Current authoring Scene is unavailable');
 const basis=studioBasis(snapshot),result:Array<{address:StageAddress;label:string}>=[];
 result.push({address:validateAddress({expression_ref:basis.expression_ref,scene_ref:basis.scene_ref,entity_ref:null,component:'field',constituent_ref:null,property:null}),label:'Shared scene field'});
 for(const selected of selectedAddresses(snapshot)){
  const occurrence=snapshot.view.bindings[snapshot.sceneId].occurrences.find(o=>o.entity_ref===selected.entity_ref)!;
  const entity=scene.entities.find(e=>e.id===occurrence.view_entity_id);
  if(!entity)throw Error('Selected material is unavailable');
  const add=(component:StageAddress['component'],label:string,constituent_ref:string|null=null,parent_ref?:string|null)=>result.push({address:validateAddress({...selected,component,constituent_ref,...(component==='layer'?{parent_ref}:{} )}),label:`${entity.name} · ${label}`});
  add('entity',entity.kind==='pin'?'Force occurrence':'Formation');add('force','Force');add('sequence','Sequence');
  for(const layer of entity.layers??[])add('layer',`Layer ${layer.text||layer.id}`,layer.id,null);
  for(const link of entity.sequence.steps){add('sequence_link',`State ${link.name||link.text||link.id}`,link.id);for(const layer of link.layers??[])add('layer',`State ${link.name||link.text||link.id} · layer ${layer.text||layer.id}`,layer.id,link.id);}
 }
 return result;
}
export interface ComponentInspection {title:string;facts:string[];editor:{sceneId:string;view_entity_id:string;state_ref:string|null;layer_ref:string|null}|null;reason?:string;}
/** Native IDs resolve to existing draft material. Array positions are only a
 * receiving editor detail, never persisted as procedural addresses. */
export function inspectComponentMaterial(snapshot:StudioSnapshot,address:StageAddress):ComponentInspection {
 validateAddress(address);
 const entry=Object.entries(snapshot.view.bindings).find(([,b])=>b.scene_ref===address.scene_ref),scene=entry?snapshot.journey.scenes.find(s=>s.id===entry[0]):undefined;
 if(!entry||!scene)throw Error('The constituent belongs to an unavailable native Scene');
 if(!address.entity_ref)return {title:scene.name,facts:[`${scene.entities.length} authored occurrences`,`Duration · ${scene.duration} seconds`,`Transition · ${scene.transition} seconds`],editor:null};
 const occurrence=entry[1].occurrences.find(o=>o.entity_ref===address.entity_ref),entity=occurrence?scene.entities.find(e=>e.id===occurrence.view_entity_id):undefined;
 if(!entity||!occurrence)throw Error('The constituent is absent from the actual native occurrence binding');
 const editor={sceneId:scene.id,view_entity_id:entity.id,state_ref:null as string|null,layer_ref:null as string|null};
 if(address.component==='layer'){
  const locations=[...(entity.layers??[]).map(layer=>({layer,state:null})),...entity.sequence.steps.flatMap(state=>(state.layers??[]).map(layer=>({layer,state})))].filter(row=>row.layer.id===address.constituent_ref);
  const matches=Object.prototype.hasOwnProperty.call(address,'parent_ref')?locations.filter(row=>(row.state?.id??null)===address.parent_ref):locations;
  if(!matches.length)throw Error('The selected native layer is unavailable at its exact parent');
  if(matches.length!==1)throw Error('This layer has ambiguous base/state locations; choose its exact parent');
  const {layer,state}=matches[0];
  const facts=[`Authored glyph · ${layer.text}`,`Authored depth · ${layer.z} stage units`,`Source · ${layer.source?.kind??'glyph'}`];
  if(layer.scale!==undefined)facts.push(`Authored scale · ${layer.scale}`);
  if(layer.source?.kind==='image'&&layer.source.image.name)facts.push(`Image · ${layer.source.image.name}`);
  if(layer.source?.kind==='ascii')facts.push(`ASCII drawing · ${layer.source.ascii.text}`);
  return {title:`${entity.name} · layer ${layer.id}`,facts,editor:state?{...editor,state_ref:state.id,layer_ref:layer.id}:null,...(!state?{reason:'The existing layer editor does not address this base layer. Its native basis and inspected material remain intact.'}:{})};
 }
 if(address.component==='sequence_link'){
  const step=entity.sequence.steps.find(s=>s.id===address.constituent_ref);if(!step)throw Error('The selected native sequence state is unavailable');
  return {title:`${entity.name} · ${step.name??step.text??step.id}`,facts:[`Authored glyph · ${step.text}`,`Shape · ${step.shape}`,`Authored hold · ${step.hold} seconds`,`Authored transition · ${step.transition} seconds`,`Source · ${step.source?.kind??'glyph'}`,`${step.layers?.length??0} retained state layers`],editor:{...editor,state_ref:step.id}};
 }
 return {title:entity.name,facts:[`Kind · ${entity.kind}`,`Source · ${entity.source?.kind??entity.shape}`,`Authored glyph · ${entity.text}`,`Force · ${entity.force.kind}`,`${entity.layers?.length??0} base layers · ${entity.sequence.steps.length} sequence states`,`Sequence · ${entity.sequence.enabled?'running':entity.sequence.manual?'manual':'held'} · ${entity.sequence.clock}`],editor};
}
/** Only source-qualified retained bindings are used for subject/locus scopes.
 * Native entity subjects supplement disclosure but cannot fabricate a locus. */
export function scopeBinding(snapshot:StudioSnapshot,address:StageAddress):ManifestationBinding|undefined {
 return snapshot.journey.scenes.flatMap(scene=>retention(scene).bindings).find(b=>addressKey(b.address)===addressKey(address))
  ??snapshot.journey.scenes.flatMap(scene=>retention(scene).bindings).find(b=>addressCovers(b.address,address));
}
export function resolveStudioScope(snapshot:StudioSnapshot,kind:StudioScopeKind,component?:StageAddress):Scope {
 const basis=studioBasis(snapshot);
 if(kind==='expression')return {kind:'expression'};
 if(kind==='scene')return {kind:'scenes',scene_refs:[basis.scene_ref]};
 const selected=selectedAddresses(snapshot);
 if(kind==='selection'){if(!selected.length)throw Error('Select an occurrence to inspect its native targets');return {kind:'addresses',addresses:selected};}
 if(kind==='component'){
  if(!component||!componentAddresses(snapshot).some(row=>addressKey(row.address)===addressKey(component)))throw Error('Choose an admitted native component');
  return {kind:'addresses',addresses:[validateAddress(component)]};
 }
 const address=component??selected[0];
 if(!address)throw Error('Select a source-bound occurrence first');
 const binding=scopeBinding(snapshot,address);
 if(kind==='subject'){
  const subject=binding?.principal.subject_ref??snapshot.view.document.entities[address.entity_ref??'']?.subject?.subject_ref;
  if(!subject)throw Error('This occurrence has no native principal subject');
  return {kind:'subject',subject_ref:subject};
 }
 if(!binding?.locus?.ref||!binding.locus.revision)throw Error('This occurrence has no source-qualified locus');
 return {kind:'locus',source_ref:binding.locus.ref,source_revision:binding.locus.revision};
}
export function scopeContains(scope:Scope,address:StageAddress,snapshot:StudioSnapshot):boolean {
 if(scope.kind==='expression')return address.expression_ref===snapshot.view.document.expression_ref;
 if(scope.kind==='scenes')return !!address.scene_ref&&scope.scene_refs.includes(address.scene_ref);
 if(scope.kind==='addresses')return scope.addresses.some(a=>addressCovers(a,address));
 const binding=scopeBinding(snapshot,address);
 if(scope.kind==='subject')return binding?.principal.subject_ref===scope.subject_ref||binding?.contributors.some(c=>c.subject_ref===scope.subject_ref)===true||snapshot.view.document.entities[address.entity_ref??'']?.subject?.subject_ref===scope.subject_ref;
 if(scope.kind==='locus')return binding?.locus.ref===scope.source_ref&&binding.locus.revision===scope.source_revision;
 return !!address.scene_ref&&scope.scene_refs.includes(address.scene_ref)&&binding?.tags.some(t=>t.tag===scope.tag&&t.origin===scope.origin)===true;
}

/** Real existing scene-material edit producer. It has no transport, storage,
 * runtime owner, observation constructor or silent stale-basis rebase. */
export function buildStudioEnvelope(snapshot:StudioSnapshot,intent:StudioChangeIntent,participants:Participant[]=[],actor='human:expressions-app'):Envelope {
 const basis=studioBasis(snapshot);
 if(!sameNative(basis,intent.basis))throw Error('The native Scene or revision changed; retain this edit and reconcile its original target');
 const journey=clone(snapshot.journey);let index=journey.scenes.findIndex(s=>s.id===snapshot.sceneId);
 if(index<0)throw Error('Current authored Scene disappeared');
 let scope:Scope={kind:'scenes',scene_refs:[basis.scene_ref]},focus:string|undefined;
 if(intent.kind==='shared_control'){
  const capability=sharedControlCapabilities(snapshot).find(c=>c.target===intent.target&&addressKey(c.address)===addressKey(intent.address));
  if(!capability||!Number.isFinite(intent.value)||intent.value<capability.min||intent.value>capability.max)throw Error('The shared property is unavailable or outside its actual native scalar domain');
  const [,bucket,...parts]=intent.target.split(':'),bind=parts.join(':');
  // writeShared owns the existing override route. Its Scene policy selects
  // the bucket without changing any actual Scene's receiving policy.
  const route={...journey.scenes[index],pointerScope:bucket==='pointer'?'global' as const:'local' as const};
  if(!writeShared(journey,route,bind,intent.value)||journey.shared?.[bucket as 'values'|'pointer'][bind]!==intent.value)throw Error('The existing shared-settings owner did not write the exact requested bucket');
  scope={kind:'addresses',addresses:[intent.address]};
 }else if(intent.kind==='control'){
  const sceneId=Object.entries(snapshot.view.bindings).find(([,binding])=>binding.scene_ref===intent.address.scene_ref)?.[0];
  index=journey.scenes.findIndex(s=>s.id===sceneId);if(index<0)throw Error('Captured property Scene is unavailable');
  const context=studioControlContext({...snapshot,sceneId:sceneId!}),capability=controlCapabilities(journey.scenes[index],context).find(c=>c.target===intent.target&&addressKey(c.address)===addressKey(intent.address));
  if(!capability)throw Error('This property no longer addresses the captured native target');
  const target=automationTarget(journey.scenes[index],intent.target)!;
  if(intent.mode==='takeover'&&!target.entityId&&isShared(journey,journey.scenes[index],target.bind))throw Error('The Expression override owns this value; address its native whole-field target before takeover');
  if(intent.mode==='release')journey.scenes[index]=releaseControl(journey.scenes[index],intent.address);
  else{
   if(typeof intent.value!=='number'||!Number.isFinite(intent.value))throw Error('Enter a finite property value');
   if(intent.mode==='set_base')journey.scenes[index]=setAuthoredBase(journey.scenes[index],intent.target,intent.value);
   else if(intent.mode==='takeover'){
    if(!intent.lifetime)throw Error('Choose the manual intervention lifetime');
    journey.scenes[index]=takeOver(journey.scenes[index],{context,target:intent.target,value:intent.value,actor,operation_ref:intent.operation_ref,lifetime:intent.lifetime});
   }else{
    if(!intent.record)throw Error('Recording needs an admitted owner position and track identity');
    journey.scenes[index]=recordControl(journey.scenes[index],{target:intent.target,value:intent.value,time:intent.record.time_seconds,track_ref:intent.record.track_ref});
   }
  }
  scope={kind:'addresses',addresses:[intent.address]};
 }else if(intent.kind==='detach'){
  const r=retention(journey.scenes[index]),c=r.contributions.find(c=>c.contribution_ref===intent.contribution_ref);
  if(!c||c.status!=='active')throw Error('The generated contribution is absent or already detached');
  c.status='detached';journey.scenes[index]=withRetention(journey.scenes[index],r);
 }else if(intent.kind==='insert_scene'){
  const name=intent.name.trim();if(!name||name.length>160||journey.scenes.length>=64)throw Error('Name the new scene within the admitted 64-scene budget');
  journey.scenes.splice(index+1,0,blankScene(name));scope={kind:'expression'};
 }else if(intent.kind==='reorder_scenes'){
  const refs=Object.values(snapshot.view.bindings).map(b=>b.scene_ref);
  if(intent.scene_refs.length!==journey.scenes.length||new Set(intent.scene_refs).size!==refs.length||refs.some(ref=>!intent.scene_refs.includes(ref)))throw Error('Scene reorder must retain every existing native Scene exactly once');
  journey.scenes.sort((a,b)=>intent.scene_refs.indexOf(snapshot.view.bindings[a.id].scene_ref)-intent.scene_refs.indexOf(snapshot.view.bindings[b.id].scene_ref));scope={kind:'expression'};
 }else{
  const destination=Object.entries(snapshot.view.bindings).find(([,binding])=>binding.scene_ref===intent.to_scene_ref);
  if(!destination||destination[1].scene_ref===basis.scene_ref||!Number.isSafeInteger(intent.cursor)||intent.cursor<0)throw Error('Choose another admitted Scene and its native continuation position');
  const r=retention(journey.scenes[index]);r.scene_flow.push({from_scene_ref:basis.scene_ref,to_scene_ref:intent.to_scene_ref,policy:intent.policy,cursor:intent.cursor});
  journey.scenes[index]=withRetention(journey.scenes[index],r);focus=destination[0];scope={kind:'expression'};
 }
 const edit=prepareCompositionEdit(snapshot.view,journey,focus?{sceneId:focus,entityId:null,actor}:{actor});
 if(!edit.changes.length)throw Error('The proposed native edit has no changed material');
 const sources=retention(journey.scenes[index]).source_basis;
 return validateEnvelope({operation_ref:intent.operation_ref,expression_ref:basis.expression_ref,expected_revision:basis.document_revision,actor,scope,sources:clone(sources),changes:proceduralChanges(edit.changes as unknown as Record<string,unknown>[]),participants:clone(participants),timing:{kind:'immediate'},cause_ref:null});
}

export interface PropertyReading {capability:PropertyCapability|SharedControlCapability;label:string;base:unknown;active:string[];takeover:boolean;shared:boolean;effective:{value:unknown;observation:Observation}|null;}
/** Read the exact retained source material without filling missing values
 * from registry defaults or present-day material. The generated basis is an
 * authored/procedural comparison, never an observation of resident state. */
export function generatedPropertyBasis(snapshot:StudioSnapshot,contribution:ContributionRetention,address:StageAddress):unknown {
 if(!address.property||!contribution.owned_addresses.some(a=>addressCovers(a,address)))return undefined;
 const basis=contribution.generated_basis as {schema?:unknown;scene?:Scene}|null;
 if(basis?.schema!=='oi.journey-scene/v1'||!basis.scene)return undefined;
 const sceneEntry=Object.entries(snapshot.view.bindings).find(([,b])=>b.scene_ref===address.scene_ref);
 if(!sceneEntry||![address.scene_ref,sceneEntry[0]].includes(basis.scene.id))return undefined;
 let root:unknown=basis.scene,parts=address.property.split('.');
 if(address.entity_ref){
  const binding=Object.values(snapshot.view.bindings).find(b=>b.scene_ref===address.scene_ref),occurrence=binding?.occurrences.find(o=>o.entity_ref===address.entity_ref);
  root=Array.isArray(basis.scene.entities)?basis.scene.entities.find(e=>e.id===address.entity_ref||!!occurrence&&e.id===occurrence.view_entity_id):undefined;
  if(address.component==='force')parts.unshift('force');else if(address.component==='sequence')parts.unshift('sequence');
 }else if(address.component==='field')parts.unshift('field');
 for(const part of parts){if(!root||typeof root!=='object'||!Object.hasOwn(root,part))return undefined;root=(root as Record<string,unknown>)[part];}
 return clone(root);
}
/** An authored value is never used as an effective-value fallback. The scalar
 * readback must name the exact native address on the current document basis. */
export function effectiveProperty(reading:StateReading|null,address:StageAddress,revision:number,currentConsumers:readonly Participant[]=[]):PropertyReading['effective'] {
 if(!reading||reading.document_revision!==revision||!currentConsumers.length)return null;
 for(const observation of reading.effective_observations){
  if(!observationBasisCurrent(reading,observation)||!observation.owner||!observation.instance_ref||!observation.operation_ref||!Number.isSafeInteger(observation.generation)||observation.generation<1||!Number.isSafeInteger(observation.cursor)||observation.cursor<0||!observation.targets.some(a=>addressCovers(a,address)))continue;
  if(!currentConsumers.some(p=>p.owner===observation.owner&&p.instance_ref===observation.instance_ref&&p.required_generation===observation.generation&&p.targets.some(a=>addressCovers(a,address))))continue;
  const values=(observation.effective as {values?:Array<{address:StageAddress;value:unknown}>}|null)?.values;
  if(!Array.isArray(values))continue;
  const value=values.find(row=>{try{return row&&addressKey(validateAddress(row.address))===addressKey(address);}catch{return false;}});
  if(value&&typeof value.value==='number'&&Number.isFinite(value.value))return {value:value.value,observation};
 }
 return null;
}
export function propertyReadings(snapshot:StudioSnapshot,scope:Scope,reading:StateReading|null):PropertyReading[] {
 const shared:PropertyReading[]=sharedControlCapabilities(snapshot).filter(c=>scopeContains(scope,c.address,snapshot)).map(capability=>({capability,label:`Whole Expression · ${capability.target.split(':')[1]} · ${NATIVE_BINDINGS.find(p=>capability.target.endsWith(':'+p.bind))?.label??capability.target}`,base:capability.base,active:['Expression override · scene bases and local drivers retained'],takeover:false,shared:true,effective:effectiveProperty(reading,capability.address,snapshot.view.document.revision,snapshot.currentConsumers)}));
 return shared.concat(snapshot.journey.scenes.flatMap(scene=>{
 const local={...snapshot,sceneId:scene.id},context=studioControlContext(local),r=retention(scene);
 return controlCapabilities(scene,context).filter(c=>scopeContains(scope,c.address,snapshot)).map(capability=>{
  const target=automationTarget(scene,capability.target)!,control=r.controls.find(c=>addressKey(c.address)===addressKey(capability.address));
  const lanes=scene.automation.filter(l=>l.target===capability.target&&resolvedAutomation(scene.automation,l).enabled);
  const active=lanes.map(l=>`${l.blend==='replace'?'Base':l.blend==='add'?'Add':'Multiply'} · ${l.type} · ${l.id}`);
  const tracks=scene.propertyTracks?.filter(t=>t.bind===target.bind&&t.entityId===target.entityId)??[];
  active.unshift(...tracks.map(t=>`Recorded base · ${t.id}`));
  if(control?.takeover)active.unshift(`Manual ${control.takeover.lifetime} · ${control.takeover.actor}; ${control.dormant_lanes.length} lanes and ${control.dormant_tracks.length} tracks retained`);
  if(!active.length)active.push('Authored manual base');
  const shared=!target.entityId&&isShared(snapshot.journey as Journey,scene,target.bind);
  if(shared){const commanded=automationTarget(effectiveScene(snapshot.journey as Journey,scene),capability.target)?.value;active.unshift(`Expression shared override · commanded ${commanded??'unavailable'} ${capability.units}; scene base retained`);}
  const sequence=target.entityId?scene.entities.find(e=>e.id===target.entityId)?.sequence:null;
  if(sequence?.enabled)active.push(`Entity sequence · ${sequence.clock}; ${sequence.steps.length} states`);
  return {capability,label:scope.kind==='expression'?`${scene.name} · ${target.label}`:target.label,base:control?.authored_base??capability.base,active,takeover:!!control?.takeover,shared,effective:effectiveProperty(reading,capability.address,snapshot.view.document.revision,snapshot.currentConsumers)};
 });
 }));
}
export function sourceDifferences(saved:readonly SourceBasis[],current:readonly SourceBasis[]|undefined):Array<{saved:SourceBasis;current:SourceBasis|null}> {
 return saved.flatMap(old=>{const now=current?.find(s=>s.ref===old.ref)??null;return !now||now.revision!==old.revision||now.availability!=='available'?[{saved:clone(old),current:now?clone(now):null}]:[];});
}

const showValue=(value:unknown)=>typeof value==='number'?Number(value.toPrecision(7)).toString():typeof value==='string'?value:typeof value==='boolean'?value?'On':'Off':value===null?'Unavailable':'Structured native value';
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function button(label:string,run:()=>void,disabled=false):HTMLButtonElement{const b=element('button',label,'secondary');b.type='button';b.disabled=disabled;b.style.whiteSpace='normal';b.addEventListener('click',event=>{event.stopPropagation();run();});return b;}
function label(text:string,input:HTMLElement):HTMLLabelElement{const l=element('label',undefined,'control');l.append(element('span',text),input);return l;}
function choices(rows:Array<[string,string]>,name:string):HTMLSelectElement{const s=element('select');s.setAttribute('aria-label',name);for(const [value,title] of rows){const o=element('option',title);o.value=value;s.append(o);}return s;}
function section(title:string):{root:HTMLDetailsElement;content:HTMLDivElement}{const root=element('details');root.open=true;root.append(element('summary',title));const content=element('div');root.append(content);return {root,content};}

export interface ProceduralStudio {readonly panel:HTMLElement;attach(mount:HTMLElement):void;setActive(active:boolean):void;refresh():void;read():Promise<void>;dispose():void;}
export function installProceduralStudio(host:ProceduralStudioHost):ProceduralStudio {
 const panel=element('section',undefined,'procedural-studio');panel.setAttribute('aria-label','Procedural stage');panel.style.overflowWrap='anywhere';panel.style.minWidth='0';
 const intro=element('p','Inspect the whole stage or a native constituent. Preview a change, then apply it to the same work.','control-note');
 const scopeChoice=choices([['expression','Whole Expression'],['scene','Current scene'],['selection','Selected occurrences'],['component','Component'],['subject','All manifestations of subject'],['locus','Source-qualified place']],'Procedural scope');scopeChoice.value='scene';
 const componentChoice=choices([],'Native component'),scopeRow=element('div');scopeRow.append(label('Scope',scopeChoice),label('Component',componentChoice));
 const identity=section('Subject · place · occurrence'),state=section('Base · active control · effective state'),rules=section('Procedures'),contributions=section('Generated material · human interventions'),flow=section('Scene flow'),continuation=section('Sources · save · restoration'),operations=section('Native operation');
 const notice=element('p','','control-note');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const refreshButton=button('Read current native state',()=>void read());
 panel.append(intro,scopeRow,refreshButton,notice,identity.root,state.root,rules.root,contributions.root,flow.root,continuation.root,operations.root);
 const client=new ProceduralClient(host.owner);
 let active=false,disposed=false,unsubscribe:(()=>void)|undefined,scope:Scope={kind:'expression'},scopeError='',snapshot:StudioSnapshot|null=null,reading:StateReading|null=null,readSignature='',renderedBasis='',requestGeneration=0,readingBusy=false,readAgain=false,busy=false,currentOperation:Operation|null=null;
 const componentMap=new Map<string,StageAddress>(),propertyMap=new Map<string,PropertyReading>(),drafts=new Map<string,string>();
 const propertyChoice=choices([],'Native property'),value=element('input');value.type='number';value.step='any';value.setAttribute('aria-label','Property value');
 const lifetime=choices([['persistent','Persistent authored override'],['gesture','Temporary takeover; release explicitly']],'Intervention lifetime');
 const propertyFacts=element('div'),controlActions=element('div'),draftNotice=element('p','','control-note');
 const control=(mode:'set_base'|'takeover'|'release'|'record')=>void run(async()=>{
  const row=propertyMap.get(propertyChoice.value);if(!snapshot||!row)throw Error('Choose a current native property');
  if(row.capability.address.component==='expression'){
   if(mode!=='set_base'||!value.value.trim())throw Error('This shared property admits an explicit base edit through the native whole-field target');
   await prepared(await host.prepare({kind:'shared_control',basis:studioBasis(snapshot),operation_ref:mint(),address:clone(row.capability.address),target:row.capability.target,value:Number(value.value)}));return;
  }
  const input:StudioChangeIntent={kind:'control',basis:studioBasis(snapshot),operation_ref:mint(),address:clone(row.capability.address),target:row.capability.target,mode,...(mode==='release'?{}:{value:Number(value.value),lifetime:lifetime.value as 'gesture'|'persistent'})};
  if(mode!=='release'&&!value.value.trim())throw Error('Enter a property value');
  if(mode==='record'){
   const position=host.recordPosition?.();
   if(!position||position.scene_ref!==row.capability.address.scene_ref||!Number.isFinite(position.time_seconds)||position.time_seconds<0)throw Error('The current property-take owner does not map this target to Scene seconds');
   const scene=snapshot.journey.scenes.find(s=>snapshot!.view.bindings[s.id].scene_ref===position.scene_ref)!,target=automationTarget(scene,row.capability.target)!;
   const track=scene.propertyTracks?.find(t=>t.bind===target.bind&&t.entityId===target.entityId);
   input.record={time_seconds:position.time_seconds,track_ref:track?.id??`track:studio-${crypto.randomUUID()}`};
  }
  await prepared(await host.prepare(input));
 });
 controlActions.append(button('Preview base edit',()=>control('set_base')),button('Preview takeover',()=>control('takeover')),button('Preview release',()=>control('release')),button('Use current base',()=>{if(propertyKey)drafts.delete(propertyKey);propertyKey='';showProperty();}),button('Preview recorded key',()=>control('record'),!host.recordPosition));
 state.content.append(label('Property',propertyChoice),propertyFacts,label('Value',value),label('Lifetime',lifetime),draftNotice,controlActions);
 let propertyKey='';
 value.addEventListener('input',()=>{if(propertyKey)drafts.set(propertyKey,value.value);draftNotice.textContent='Uncommitted value retained on this native target.';});
 propertyChoice.addEventListener('change',()=>showProperty());
 const templateChoice=choices([],'Native recipe'),recipeForm=element('div'),ruleFacts=element('p','','control-note'),recipeSources=element('div'),ruleActions=element('div');
 rules.content.append(label('Recipe',templateChoice),ruleFacts,recipeSources,recipeForm,ruleActions);
 let templateKey='',template:NativeProcedureTemplate|null=null,editingTemplate:NativeProcedureTemplate|null=null;
 const recipeInputs=new Map<string,HTMLInputElement>(),trigger=choices(['explicit','state_changed','musical_gesture','physical_gesture','source_changed','scene_entered','scene_left','sequence_transition'].map(k=>[k,k.replaceAll('_',' ')]),'Rule trigger'),triggerMode=choices([['edge','Once per edge'],['level','Sustained condition']],'Trigger mode'),membership=choices([['frozen','Frozen target set'],['sustained','Sustained membership']],'Membership'),seed=element('input');seed.maxLength=512;seed.setAttribute('aria-label','Procedure seed');
 const recipeDrafts=new Map<string,{trigger:string;mode:string;membership:string;seed:string;parameters:Record<string,unknown>}>();
 const saveRecipeDraft=()=>{if(!templateKey)return;recipeDrafts.set(templateKey,{trigger:trigger.value,mode:triggerMode.value,membership:membership.value,seed:seed.value,parameters:Object.fromEntries([...recipeInputs].map(([name,input])=>[name,input.type==='checkbox'?input.checked:input.type==='number'?input.value:input.value]))});};
 for(const input of [trigger,triggerMode,membership,seed]){input.addEventListener('input',saveRecipeDraft);input.addEventListener('change',saveRecipeDraft);}
 templateChoice.addEventListener('change',()=>{saveRecipeDraft();templateKey='';showRecipe();});
 const sceneChoice=choices([],'Destination native scene'),policy=choices([['continue','Continue background scene'],['hold','Hold background scene'],['checkpoint_release','Checkpoint and release']],'Scene background policy'),sceneList=element('div'),sceneName=element('input');sceneName.maxLength=160;sceneName.setAttribute('aria-label','New scene name');
 const flowActions=element('div');flow.content.append(sceneList,label('New authored scene',sceneName),label('Destination',sceneChoice),label('Continuity',policy),flowActions);
 flowActions.append(button('Preview scene insertion',()=>void run(async()=>{if(!snapshot)throw Error('Open a native Expression');await prepared(await host.prepare({kind:'insert_scene',basis:studioBasis(snapshot),operation_ref:mint(),name:sceneName.value}));})),button('Preview transition',()=>void run(async()=>{
  if(!snapshot||!reading||reading.document_revision!==snapshot.view.document.revision)throw Error('Read the current native scene before a transition');
  await prepared(await host.prepare({kind:'transition',basis:studioBasis(snapshot),operation_ref:mint(),to_scene_ref:sceneChoice.value,policy:policy.value as 'continue'|'hold'|'checkpoint_release',cursor:reading.cursor}));
 })));
 const sourceList=element('div'),sourceDiff=element('div'),restoreChoice=choices([['configuration','Open configuration'],['replay','Replay recorded act'],['checkpoint','Resume compatible checkpoint']],'Restoration mode'),continuationActions=element('div');
 continuation.content.append(sourceList,sourceDiff,label('Restoration',restoreChoice),continuationActions);
 continuationActions.append(button('Save through native owner',()=>void run(()=>host.save())),button('Restore selected mode',()=>void run(async()=>{
  if(!host.restore||!snapshot)throw Error('The native restoration owner is not connected');
  const selectedMode=restoreChoice.value as RestorationMode,result=await host.restore(selectedMode,studioBasis(snapshot));
  if(result.mode!==selectedMode||!['applied','pending','refused'].includes(result.state))throw Error('The restoration reply does not acknowledge the selected native mode');
  if(result.state==='refused')throw Error(result.reason??'The native owner refused restoration');
  say(`${selectedMode==='checkpoint'?'Checkpoint resume':selectedMode==='replay'?'Recorded replay':'Configuration open'} · ${result.state}${result.reason?` · ${result.reason}`:''}`);
 })));
 if(host.history)continuationActions.append(button('Undo',()=>void run(()=>host.history!('undo'))),button('Redo',()=>void run(()=>host.history!('redo'))));
 const operationFacts=element('div'),deltaFacts=element('div'),operationActions=element('div');operations.content.append(operationFacts,deltaFacts,operationActions);
 const applyButton=button('Apply prepared change',()=>void run(async()=>{if(!currentOperation)throw Error('Prepare a native change first');const result=await client.commit(currentOperation.envelope.operation_ref);currentOperation=result.operation;showOperation();sayStatus();await read();})),inspectButton=button('Inspect pending operation',()=>void run(async()=>{if(!currentOperation)throw Error('No native operation is selected');currentOperation=(await client.inspect(currentOperation.envelope.operation_ref)).operation;showOperation();sayStatus();await read();})),cancelButton=button('Cancel before application',()=>void run(async()=>{if(!currentOperation)throw Error('No native operation is selected');currentOperation=(await client.cancel(currentOperation.envelope.operation_ref)).operation;showOperation();sayStatus();}));operationActions.append(applyButton,inspectButton,cancelButton);
 const mint=()=>`operation:studio-${crypto.randomUUID()}`;
 const say=(message:string)=>{notice.textContent=message;host.report?.(message);};
 const signature=()=>snapshot?JSON.stringify([studioBasis(snapshot),scope]):'';
 const scopeChanged=()=>{requestGeneration++;reading=null;readSignature='';refresh();if(active)void read();};
 scopeChoice.addEventListener('change',scopeChanged);componentChoice.addEventListener('change',scopeChanged);
 async function run(task:()=>Promise<void>){if(busy||disposed)return;busy=true;panel.setAttribute('aria-busy','true');try{await task();}catch(error){say(error instanceof Error?error.message:String(error));}finally{busy=false;panel.removeAttribute('aria-busy');refresh();}}
 async function prepared(operation:Operation){const actual=validateOperation(operation);if(!snapshot||actual.envelope.expression_ref!==snapshot.view.document.expression_ref)throw Error('Prepared operation belongs to another native Expression');currentOperation=actual;deltaFacts.replaceChildren();showOperation();sayStatus();}
 function sayStatus(){if(!currentOperation)return;const o=currentOperation;say(o.status==='prepared'?`Prepared ${o.targets.length} native targets. Review the delta before applying.`:o.status==='applying'?`Document applied at revision ${o.applied_revision}; ${o.envelope.participants.length-o.observations.length} native consumers remain pending.`:o.status==='applied'?`Native operation applied at revision ${o.applied_revision}; ${o.observations.length} consumer observations retained.`:`Native operation ${o.status}${o.failure?` · ${o.failure}`:''}`);}
 function showOperation(){
  operationFacts.replaceChildren();const o=currentOperation;applyButton.disabled=!o||o.status!=='prepared'||busy;inspectButton.disabled=!o||busy;cancelButton.disabled=!o||!['prepared','scheduled'].includes(o.status)||busy;
  if(!o){operationFacts.append(element('p','No native change prepared.','control-note'));return;}
  operationFacts.append(element('p',`${o.status} · ${o.envelope.operation_ref}`),element('p',`Basis ${o.envelope.expected_revision} → accepted ${o.accepted_revision} → material ${o.applied_revision??'not applied'}`,'control-note'));
  const targets=element('ul');for(const a of o.targets)targets.append(element('li',addressLabel(a)));operationFacts.append(targets);
  const changes=element('ul');for(const change of o.envelope.changes)changes.append(element('li',`${String(change.change??'Native operation').replaceAll('_',' ')}${typeof change.scene_ref==='string'?` · ${change.scene_ref}`:''}${typeof change.entity_ref==='string'?` · ${change.entity_ref}`:''}`));operationFacts.append(element('p',`${o.envelope.changes.length} native changes`),changes);
  for(const p of o.envelope.participants){const observed=o.observations.find(obs=>obs.owner===p.owner&&obs.instance_ref===p.instance_ref);operationFacts.append(element('p',`${p.owner} · ${p.instance_ref} · ${observed?`observed generation ${observed.generation}, cursor ${observed.cursor}`:`pending generation ${p.required_generation}`}`,'control-note'));}
  if(o.failure)operationFacts.append(element('p',o.failure,'control-note'));
 }
 function sourceButton(source:SourceBasis){return button(`${source.ref} · ${source.revision} · ${source.availability}`,()=>host.openSource(clone(source)),source.availability==='withheld');}
 function showIdentity(){
  identity.content.replaceChildren();if(!snapshot)return;
  const basis=studioBasis(snapshot);identity.content.append(element('p',`${snapshot.view.document.title} · revision ${basis.document_revision}`),element('p',`Expression ${basis.expression_ref}`,'control-note'),element('p',`Scene ${basis.scene_ref}`,'control-note'));
  const general:StageAddress={expression_ref:basis.expression_ref,scene_ref:scope.kind==='expression'?null:basis.scene_ref,entity_ref:null,component:scope.kind==='expression'?'expression':'scene',constituent_ref:null,property:null};
  const admitted=snapshot.journey.scenes.flatMap(s=>retention(s).bindings).map(b=>b.address).filter(a=>scopeContains(scope,a,snapshot!));
  const addresses=scope.kind==='addresses'?scope.addresses:[general,...admitted,...selectedAddresses(snapshot).filter(a=>scopeContains(scope,a,snapshot!))];
  const seen=new Set<string>();
  for(const address of addresses){
   if(seen.has(addressKey(address)))continue;seen.add(addressKey(address));
   const binding=scopeBinding(snapshot,address),principal=binding?.principal??snapshot.view.document.entities[address.entity_ref??'']?.subject;
   identity.content.append(element('p',`Occurrence · ${addressLabel(address)}`,'control-note'));
   if(address.scene_ref){const material=inspectComponentMaterial(snapshot,address);identity.content.append(element('p',`Authored material · ${material.title}`,'control-note'));for(const fact of material.facts)identity.content.append(element('p',fact,'control-note'));if(material.reason)identity.content.append(element('p',material.reason,'control-note'));if(address.entity_ref)identity.content.append(button('Open existing constituent editor',()=>void run(async()=>{if(!host.editComponent)throw Error('The existing native constituent editor is not connected');await host.editComponent(clone(address));}),!host.editComponent||!material.editor));}
   identity.content.append(element('p',principal?`Principal · ${principal.subject_ref} · ${principal.native_owner}`:'No native principal disclosed','control-note'));
   if(binding){identity.content.append(element('p',`Place · ${binding.locus.ref}`,'control-note'),sourceButton(binding.locus));for(const c of binding.contributors)identity.content.append(element('p',`Contributor · ${c.subject_ref} · ${c.native_owner}`,'control-note'));for(const s of binding.principal.sources)identity.content.append(sourceButton(s));}
  }
 }
 function showProperty(){
  const row=propertyMap.get(propertyChoice.value);propertyFacts.replaceChildren();
  if(!row){propertyFacts.append(element('p','No controllable scalar in this admitted scope. Layers and sequence states remain inspectable above.','control-note'));value.disabled=true;return;}
  value.disabled=false;const key=addressKey(row.capability.address);
  if(key!==propertyKey){propertyKey=key;value.value=drafts.get(key)??String(row.capability.base);draftNotice.textContent=drafts.has(key)?'Uncommitted value retained on this native target.':'';}
  else if(!drafts.has(key)&&document.activeElement!==value)value.value=String(row.capability.base);
  value.min=String(row.capability.min);value.max=String(row.capability.max);
  value.dataset.nativeFactor=String(row.capability.native_factor);value.dataset.units=row.capability.units;
  propertyFacts.append(element('p',`Authored base · ${showValue(row.base)} ${row.capability.units}`),element('p',row.active.join(' · '),'control-note'),element('p',row.effective?`Effective · ${showValue(row.effective.value)} ${row.capability.units}`:'Effective · unobserved',row.effective?'':'control-note'));
  if(snapshot)for(const contribution of snapshot.journey.scenes.flatMap(s=>retention(s).contributions)){const generated=generatedPropertyBasis(snapshot,contribution,row.capability.address);if(generated!==undefined)propertyFacts.append(element('p',`Generated basis · ${showValue(generated)} ${row.capability.units} · ${contribution.procedure_ref} · recipe ${contribution.recipe_revision}`,'control-note'));}
  if(row.effective){const o=row.effective.observation;propertyFacts.append(element('p',`${o.owner} · ${o.instance_ref} · generation ${o.generation} · cursor ${o.cursor} · ${o.operation_ref}`,'control-note'));}
  propertyFacts.append(element('p',`${addressLabel(row.capability.address)} · ${row.capability.min}…${row.capability.max} ${row.capability.units}`,'control-note'));
  (controlActions.children[1] as HTMLButtonElement).disabled=row.shared;
  if(row.shared&&row.capability.address.component!=='expression')propertyFacts.append(element('p','An Expression override owns this value. Base edits retain it; select Whole Expression to edit its shared target.','control-note'));
  (controlActions.children[2] as HTMLButtonElement).disabled=!row.takeover;
  const record=host.recordPosition?.();(controlActions.children[4] as HTMLButtonElement).disabled=row.shared||!record||record.scene_ref!==row.capability.address.scene_ref;
 }
 function showRecipe(){
  const templates=host.procedureTemplates?.()??[],previous=templateChoice.value;
  replaceOptions(templateChoice,templates.map(t=>[t.procedure_ref,t.title]),previous);
  template=templates.find(t=>t.procedure_ref===templateChoice.value)??null;
  recipeSources.replaceChildren();
  if(!template){recipeForm.replaceChildren();ruleActions.replaceChildren();ruleFacts.textContent=host.prepareProcedure?'No admitted native recipe is available in this scope.':'Native procedural recipe producer is not connected.';templateKey='';return;}
  let key=JSON.stringify([template.procedure_ref,template.revision]);
  const incomingRevision=template.revision;
  if(editingTemplate&&editingTemplate.procedure_ref===template.procedure_ref&&templateKey!==key&&recipeDrafts.has(templateKey)){template=editingTemplate;key=templateKey;}
  ruleFacts.textContent=`${template.procedure_ref} · recipe ${template.revision}${incomingRevision!==template.revision?` · native recipe advanced to ${incomingRevision}; your uncommitted draft keeps its original basis`:template.reason?` · ${template.reason}`:''}`;
  for(const source of template.source_basis)recipeSources.append(sourceButton(source));
  if(templateKey!==key){
   saveRecipeDraft();templateKey=key;editingTemplate=clone(template);recipeInputs.clear();recipeForm.replaceChildren();const draft=recipeDrafts.get(key);
   trigger.value=draft?.trigger??template.trigger.kind;triggerMode.value=draft?.mode??template.trigger.mode;membership.value=draft?.membership??template.membership_mode;seed.value=draft?.seed??template.seed;
   recipeForm.append(label('Trigger',trigger),label('Trigger behaviour',triggerMode),label('Target membership',membership),label('Retained seed',seed));
   for(const descriptor of template.parameters){const input=element('input');input.setAttribute('aria-label',descriptor.label);input.type=descriptor.type==='number'?'number':descriptor.type==='boolean'?'checkbox':'text';input.step='any';if(descriptor.minimum!==undefined)input.min=String(descriptor.minimum);if(descriptor.maximum!==undefined)input.max=String(descriptor.maximum);const raw=draft?.parameters[descriptor.name]??template.recipe_parameters[descriptor.name];if(input.type==='checkbox')input.checked=raw===true;else input.value=raw===undefined?'':String(raw);input.addEventListener('input',saveRecipeDraft);recipeInputs.set(descriptor.name,input);recipeForm.append(label(`${descriptor.label}${descriptor.units?` · ${descriptor.units}`:''}`,input));}
  }
  ruleActions.replaceChildren();
  if(incomingRevision!==template.revision)ruleActions.append(button('Use current native recipe',()=>{recipeDrafts.delete(templateKey);editingTemplate=null;templateKey='';showRecipe();}));
  for(const action of ['prepare','regenerate'] as const)ruleActions.append(button(action==='prepare'?'Preview generated passage':'Preview regeneration',()=>void run(async()=>{
   if(!snapshot||!template||!host.prepareProcedure)throw Error('The native recipe producer is unavailable');
   const parameters=clone(template.recipe_parameters);
   for(const descriptor of template.parameters){const input=recipeInputs.get(descriptor.name)!;const parsed=descriptor.type==='number'?Number(input.value):descriptor.type==='boolean'?input.checked:input.value;if(descriptor.type==='number'&&(!input.value.trim()||!Number.isFinite(parsed)||descriptor.minimum!==undefined&&Number(parsed)<descriptor.minimum||descriptor.maximum!==undefined&&Number(parsed)>descriptor.maximum))throw Error(`${descriptor.label} is outside its native domain`);parameters[descriptor.name]=parsed;}
   if(!seed.value.trim())throw Error('Retain an explicit native procedure seed');
   const result=await host.prepareProcedure({basis:studioBasis(snapshot),operation_ref:mint(),procedure_ref:template.procedure_ref,expected_recipe_revision:template.revision,action,scope:clone(scope),trigger:{kind:trigger.value,mode:triggerMode.value as 'edge'|'level'},membership_mode:membership.value as 'frozen'|'sustained',seed:seed.value,recipe_parameters:parameters});
   if(result.procedure_ref!==template.procedure_ref||result.recipe_revision!==template.revision)throw Error('The producer returned a different native recipe basis');
   await prepared(result.operation);deltaFacts.replaceChildren(...result.changes.map(c=>element('p',`${c.kind} · ${c.label}${c.address?` · ${addressLabel(c.address)}`:''}`,'control-note')));
  }),!host.prepareProcedure||!template.actions.includes(action)));
  const retained=snapshot?.journey.scenes.flatMap(s=>retention(s).procedures).find(p=>p.procedure_ref===template?.procedure_ref);
  if(retained)for(const action of ['hold','interrupt','resume'] as const)ruleActions.append(button(action==='hold'?'Hold procedure':action==='interrupt'?'Interrupt procedure':'Resume procedure',()=>void run(async()=>{
   if(!snapshot||!template||!host.procedureAction)throw Error('The native rule execution owner is unavailable');
   const result=await host.procedureAction({basis:studioBasis(snapshot),procedure_ref:template.procedure_ref,expected_recipe_revision:template.revision,action,observed_cursor:retained.cursor});await prepared(result);sayStatus();await read();
  }),!host.procedureAction||!template.actions.includes(action)));
 }
 function showContributions(){
  contributions.content.replaceChildren();if(!snapshot)return;
  const records=snapshot.journey.scenes.flatMap(s=>retention(s).contributions.map(c=>({scene:s,c}))).filter(({c})=>c.owned_addresses.some(a=>scopeContains(scope,a,snapshot!)));
  if(!records.length)contributions.content.append(element('p','No generated contribution in this admitted scope.','control-note'));
  for(const {scene,c} of records){const card=element('div');card.append(element('p',`${c.output_slot} · ${c.status}`),element('p',`${c.contribution_ref} · ${c.procedure_ref} · recipe ${c.recipe_revision}`,'control-note'),element('p',`${c.owned_addresses.length} owned targets · ${c.authored_overrides.length} persistent interventions`,'control-note'));for(const o of c.authored_overrides)card.append(element('p',`${addressLabel(o.address)} · ${showValue(o.value)} · ${o.actor}`,'control-note'));card.append(button('Detach as authored material',()=>void run(async()=>{if(!snapshot||scene.id!==snapshot.sceneId)throw Error('Open the contribution’s native Scene before detaching it');await prepared(await host.prepare({kind:'detach',basis:studioBasis(snapshot),operation_ref:mint(),contribution_ref:c.contribution_ref}));}),c.status!=='active'||scene.id!==snapshot.sceneId));contributions.content.append(card);}
 }
 function showFlow(){
  if(!snapshot)return;const current=studioBasis(snapshot),previous=sceneChoice.value;
  replaceOptions(sceneChoice,snapshot.view.document.scenes.filter(s=>s.scene_ref!==current.scene_ref).map(s=>[s.scene_ref,s.title]),previous);sceneList.replaceChildren();
  const refs=snapshot.view.document.scenes.map(s=>s.scene_ref);
  snapshot.view.document.scenes.forEach((scene,index)=>{const row=element('div');row.append(element('span',`${index+1}. ${scene.title}${scene.scene_ref===current.scene_ref?' · current':''}`));for(const [delta,title] of [[-1,'Earlier'],[1,'Later']] as const)row.append(button(`${title}: ${scene.title}`,()=>void run(async()=>{if(!snapshot)throw Error('Open a native Expression');const order=refs.slice(),other=index+delta;[order[index],order[other]]=[order[other],order[index]];await prepared(await host.prepare({kind:'reorder_scenes',basis:studioBasis(snapshot),operation_ref:mint(),scene_refs:order}));}),index+delta<0||index+delta>=refs.length));sceneList.append(row);});
  const scene=snapshot.journey.scenes.find(s=>s.id===snapshot!.sceneId)!;for(const transition of retention(scene).scene_flow)sceneList.append(element('p',`${transition.from_scene_ref} → ${transition.to_scene_ref} · ${transition.policy} · native event cursor ${transition.cursor}`,'control-note'));
 }
 function showSources(){
  sourceList.replaceChildren();sourceDiff.replaceChildren();if(!snapshot)return;
  const scenes=scope.kind==='expression'?snapshot.journey.scenes:snapshot.journey.scenes.filter(s=>scope.kind==='scenes'?scope.scene_refs.includes(snapshot!.view.bindings[s.id].scene_ref):s.id===snapshot!.sceneId);
  const saved=[...new Map(scenes.flatMap(s=>retention(s).source_basis).map(s=>[JSON.stringify([s.ref,s.revision]),s])).values()];
  for(const source of saved)sourceList.append(sourceButton(source));
  if(!saved.length)sourceList.append(element('p','No procedure source basis retained in this scope.','control-note'));
  if(!snapshot.currentSources)sourceDiff.append(element('p','Current source revisions are unobserved; saved basis remains intact.','control-note'));
  else for(const d of sourceDifferences(saved,snapshot.currentSources))sourceDiff.append(element('p',`${d.saved.ref} · saved ${d.saved.revision} → ${d.current?`${d.current.revision} (${d.current.availability})`:'not currently disclosed'}. Re-evaluation requires a native preview.`,'control-note'));
  (continuationActions.children[1] as HTMLButtonElement).disabled=!host.restore;
 }
 function refresh(){
  if(disposed)return;const next=host.snapshot();snapshot=next;
  if(!next){say('Open or save a native Expression to use procedural Studio.');scopeRow.hidden=true;state.root.hidden=rules.root.hidden=contributions.root.hidden=flow.root.hidden=continuation.root.hidden=true;identity.content.replaceChildren();showOperation();return;}
  scopeRow.hidden=false;state.root.hidden=rules.root.hidden=contributions.root.hidden=flow.root.hidden=continuation.root.hidden=false;
  try{
   const formBasis=JSON.stringify([studioBasis(next),next.draft_revision??next.journey.updatedAt,next.selected,scopeChoice.value,componentChoice.value,next.currentSources,host.procedureTemplates?.().map(t=>[t.procedure_ref,t.revision])]);
   if(formBasis===renderedBasis&&!scopeError){for(const row of propertyMap.values())row.effective=effectiveProperty(reading,row.capability.address,next.view.document.revision,next.currentConsumers);showProperty();showOperation();return;}
   const components=componentAddresses(next),previous=componentChoice.value;componentMap.clear();for(const row of components)componentMap.set(addressKey(row.address),row.address);replaceOptions(componentChoice,components.map(row=>[addressKey(row.address),row.label]),previous);componentChoice.parentElement!.hidden=scopeChoice.value!=='component';
   scope=resolveStudioScope(next,scopeChoice.value as StudioScopeKind,scopeChoice.value==='component'?componentMap.get(componentChoice.value):undefined);scopeError='';
   if(reading&&(reading.expression_ref!==next.view.document.expression_ref||reading.document_revision!==next.view.document.revision||readSignature!==signature()))reading=null;
   showIdentity();const properties=propertyReadings(next,scope,reading),old=propertyChoice.value;propertyMap.clear();for(const p of properties)propertyMap.set(addressKey(p.capability.address),p);replaceOptions(propertyChoice,properties.map(p=>[addressKey(p.capability.address),p.label]),old);showProperty();showRecipe();showContributions();showFlow();showSources();showOperation();renderedBasis=JSON.stringify([studioBasis(next),next.draft_revision??next.journey.updatedAt,next.selected,scopeChoice.value,componentChoice.value,next.currentSources,host.procedureTemplates?.().map(t=>[t.procedure_ref,t.revision])]);
  }catch(error){scopeError=error instanceof Error?error.message:String(error);say(scopeError);reading=null;propertyMap.clear();showProperty();}
 }
 async function read():Promise<void>{
  if(disposed||!active)return;if(readingBusy){readAgain=true;return;}refresh();if(!snapshot||scopeError)return;
  readingBusy=true;const generation=++requestGeneration,key=signature(),expression=snapshot.view.document.expression_ref,requestedScope=clone(scope),after=readSignature===key?reading?.cursor??null:null;
  try{const result=await client.read(expression,requestedScope,after);if(disposed||generation!==requestGeneration||signature()!==key)return;reading=result;readSignature=key;if(result.document_revision!==snapshot.view.document.revision){say(`Native revision ${result.document_revision} differs from this working draft. Its text and intent were retained; reconcile through Workspace.`);reading=null;}else{if(currentOperation){const retained=result.operation_history?.find(row=>row.operation.envelope.operation_ref===currentOperation!.envelope.operation_ref);if(retained)currentOperation=validateOperation(retained.operation);}refresh();}}
  catch(error){if(generation===requestGeneration)say(error instanceof Error?error.message:String(error));}
  finally{readingBusy=false;if(readAgain){readAgain=false;void read();}}
 }
 refresh();
 return {panel,attach(mount){if(panel.parentElement!==mount)mount.replaceChildren(panel);},setActive(next){if(disposed||active===next)return;active=next;requestGeneration++;if(active){unsubscribe=host.subscribe?.(()=>{refresh();void read();});refresh();void read();}else{unsubscribe?.();unsubscribe=undefined;}},refresh,read,dispose(){if(disposed)return;disposed=true;requestGeneration++;unsubscribe?.();panel.remove();drafts.clear();recipeDrafts.clear();}};
}
function replaceOptions(select:HTMLSelectElement,rows:Array<[string,string]>,previous:string){const old=[...select.options];if(old.length!==rows.length||old.some((o,i)=>o.value!==rows[i]?.[0]||o.textContent!==rows[i]?.[1])){select.replaceChildren(...rows.map(([value,title])=>{const option=element('option',title);option.value=value;return option;}));}if(rows.some(([value])=>value===previous))select.value=previous;}
export function addressLabel(a:StageAddress):string{return [a.entity_ref??a.scene_ref??a.expression_ref,a.component,a.constituent_ref,a.property].filter(Boolean).join(' · ');}
