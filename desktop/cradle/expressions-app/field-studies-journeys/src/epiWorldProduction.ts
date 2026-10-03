/** Ordinary native production: one admitted occasion → reusable material →
 * one Expression CAS → owner readback → the existing application loader.
 * This coordinator contains no domain solver and no second document store. */
import {buildEpiWorldMaterial,verifyEpiWorldReadback,rebindEpiPersonalSubjects,PERSONAL_WAVE_PRESENTATION,EPI_CLOCK_A_CAPTION,EPI_OLD_CLOCK_A_CAPTION,EPI_WORLD_AUTHORED_REVISION,EPI_COSMIC_CAPTION_GEOMETRY,epiCosmicCaptionCohort,type EpiWorldMaterialPlan,type PersonalInstance,type CoordinateSource,type RegisterRole} from './epiWorldMaterial.js';
import {coordinateSourceFromNative,prepareEpiMaterialInputFromNative,requiredEpiWorldCoordinates,type NativeSceneWorldReading,type BimbaInventoryPage,type BimbaCoordinateContent} from './epiWorldSource.js';
import {validateCoordinateExpression,type CoordinateExpressionResult,type CoordinateProfile} from '../../../src/nara/coordinateExpression.js';
import type {ExpressionDocument,ExpressionRequest,ExpressionResult,ReadingRef,SubjectBinding} from '../../../src/expression/types.js';
import type {InstrumentIdentity,NaraInstrumentRequest,NaraInstrumentReply} from '../../../src/nara/instrumentProtocol.js';
import {requireRetainedSkyAdmission} from '../../../src/nara/nativeSkyInput.js';
import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent.js';
import type {NativeWorldInput,NativeSky,NativeSkySnapshot} from './native-field/controller.js';
import {SCENE_MATERIAL_STANDING,requireSceneMaterial,requireCurrentSceneMaterialPolicy,type CurrentSceneMaterialPolicy} from './native-field/material.js';
import type {NativeTargetMap} from './native-field/projection.js';
import type {Scene} from './model.js';
import {toNativeConfig} from './nativeBridge.js';
import {layoutPartitions} from '../../src/engine/fieldModel.js';
import {ConnectionRuntime} from '../../../../../packages/oi-design-system/expressions-engine/oi/connectionRuntime.mjs';
import {sameSceneData} from './sceneCorrespondence.js';
import type {FormationGeometryProjection} from '../../src/engine/formationGeometryProjection.js';

export interface PreparedEpiWorld {
 schema:'oi.native-expression-prepared-world/v1';
 source:{schema:'oi.native-expression-composed-source/v1';world:NativeSceneWorldReading;sky:NativeSkySnapshot;ql_revision:string|null;ql_selection:'installed'|'operator-override';ql_executable_sha256:string;request_sha256:string;[key:string]:unknown};
 binding:Record<string,unknown>;
}
export interface EpiCaptionGeometryAdjustment {
 schema:'oi.epi-instance-caption-geometry-adjustment/v1';standing:'authored-presentation';actor:'agent:codex:epi-fidelity-lead';purpose:'Separate the complete generated cosmic caption cohort without changing source, bodies or typography';
 basis_revision:number;scene_ref:string;event_ref:string;person_ref:string;
 source:ReadingRef;before_y:number[];after_y:number[];
}
export interface EpiWorldRecord {
 kept_answers?:import('../../../src/nara/nativeKeptAnswer').KeptAnswer[];
 schema:'oi.epi-world-material/v1';world:Omit<NativeSceneWorldReading,'schema'|'native_owner_sources'> & {schema:'oi.epi-portable-world/v1';native_owner_sources:{role:'constructor'|'coupled'|'field';reading:ReadingRef}[]};native_source:Omit<PreparedEpiWorld['source'],'world'> & {world_ref:ReadingRef};
 runtime_buffers:{schema:'oi.epi-native-runtime-buffers/v1';policy:'native-owner-recompose';reading:ReadingRef;buffers:{key:'slots_a'|'slots_b';values:number;json_sha256:string}[]};
 identity_source:InstrumentIdentity['source'];identity_input_revision:string;person_ref:string;nara_ref:string;
 presentation_adjustments?:{schema:'oi.epi-instance-presentation-adjustment/v1';actor:string;purpose:string;basis_revision:number;entity_ref:string;scene_ref:string;parameter:'share';before:number;after:number;event_ref:string;person_ref:string}[];
 scene_field_adjustments?:{schema:'oi.epi-instance-scene-field-adjustment/v1';actor:string;purpose:string;basis_revision:number;scene_ref:string;parameter:'cymatics.dominance';before:number;after:number;event_ref:string;person_ref:string;source:ReadingRef}[];
 caption_geometry_adjustment?:EpiCaptionGeometryAdjustment;
 authored_revision:string;receiving:EpiWorldMaterialPlan['receiving'];register_members:EpiWorldMaterialPlan['register_members'];
 inventory:Awaited<ReturnType<typeof prepareEpiMaterialInputFromNative>>['inventory'];
 source_basis:EpiWorldMaterialPlan['source_basis'];profile_definitions:ExpressionRequest[];
 native_readback?:NativeSceneWorldReading['native_readback'];continuation_start?:Record<string,unknown>;
 current_material_policy?:CurrentSceneMaterialPolicy;
}
export interface EpiProductionPort {
 expression:(request:ExpressionRequest)=>Promise<ExpressionResult>;
 nara:(request:NaraInstrumentRequest)=>Promise<NaraInstrumentReply>;
 prepare:(options:{world:NativeWorldInput;sky?:NativeSky;skySnapshot?:NativeSkySnapshot;snapshotPurpose?:import('../../../src/nara/identity/types').SnapshotPurpose})=>Promise<unknown>;
 load:(ref:string)=>Promise<boolean>;edit:(changes:(document:ExpressionDocument)=>Record<string,unknown>[])=>Promise<void>;persist:(name:string)=>Promise<{location:{path:string;ref:string};revision:string;expression_ref:string}>;canvas:()=>HTMLCanvasElement;
 status:(text:string)=>void;presentationRest:()=>boolean;
}
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
/** Compiled slot buffers are runtime output, not portable Scene material. Keep
 * their exact qualification; the native owner recreates them from this world's
 * admitted event, sky and continuation. No numerical value is recomputed here. */
async function portableWorld(world:NativeSceneWorldReading,reading:ReadingRef):Promise<Pick<EpiWorldRecord,'world'|'runtime_buffers'>>{
 const stored=structuredClone(world),presentation=stored.binding.presentation;
 if(!object(presentation))throw Error('The native world has no compiled field presentation.');
 const buffers:EpiWorldRecord['runtime_buffers']['buffers']=[];
 for(const key of ['slots_a','slots_b'] as const){
  const values=presentation[key];
  if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('The native field omitted its actual '+key+' buffer.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(values)));
  buffers.push({key,values:values.length,json_sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')});
  delete presentation[key];
 }
 const owners=Object.entries(stored.native_owner_sources).map(([role,reading])=>({role:role as 'constructor'|'coupled'|'field',reading}));
 // `constructor` is an original owner role, not a JavaScript property name.
 // The portable carrier declares its changed representation explicitly.
 return{world:{...stored,schema:'oi.epi-portable-world/v1',native_owner_sources:owners},runtime_buffers:{schema:'oi.epi-native-runtime-buffers/v1',policy:'native-owner-recompose',reading,buffers}};
}
/** Authored reset material excludes the live continuation receipt. The native
 * document retains that complete receipt once in its cosmic Scene. */
export function epiAuthoredSceneSnapshot(scene:Record<string,unknown>):Record<string,unknown>{
 const saved=structuredClone(scene);delete saved.epiWorld;return saved;
}
function prepared(value:unknown,instance:string,person:string):PreparedEpiWorld {
 const p=value as PreparedEpiWorld;
 if(p?.schema!=='oi.native-expression-prepared-world/v1'||p.source?.schema!=='oi.native-expression-composed-source/v1'||p.source.world?.schema!=='ql.scene-world/v1'||p.source.world.instance_ref!==instance||p.source.world.subject_ref!==person||p.source.world.event_ref!==p.source.sky?.snapshot_ref||p.source.world.snapshot_ref!==p.source.sky.snapshot_ref||!['installed','operator-override'].includes(p.source.ql_selection)||!/^[a-f0-9]{64}$/.test(p.source.ql_executable_sha256)||!(p.source.ql_revision===null||typeof p.source.ql_revision==='string'&&p.source.ql_revision.length>0)||!p.source.request_sha256)throw Error('The native owner did not preserve the actual instance, person and single occasion.');
 return p;
}
export function readEpiWorldRecord(document:ExpressionDocument):EpiWorldRecord|null {
 const raw=document.scenes.find(s=>object(s.presentation?.scene)&&object(s.presentation?.scene.epiWorld))?.presentation?.scene?.epiWorld as EpiWorldRecord|undefined;
 const record=raw;
 if(!record)return null;
 if(record.schema!=='oi.epi-world-material/v1'||record.world.schema!=='oi.epi-portable-world/v1'||record.world.instance_ref!==document.expression_ref||record.world.subject_ref!==record.person_ref||record.receiving.expression_ref!==document.expression_ref||record.receiving.personal.canonical_locus!=='ql:m-coordinate:bimba:M4.4.4.4'||record.world.snapshot_ref!==record.receiving.snapshot_ref)throw Error('This saved Epi world has an inconsistent native instance or personal locus.');
 const owners=record.world.native_owner_sources;
 if(!Array.isArray(owners)||owners.length!==3||new Set(owners.map(owner=>owner.role)).size!==3||owners.some(owner=>!['constructor','coupled','field'].includes(owner.role)||!owner.reading.ref||!/^sha256:[0-9a-f]{64}$/.test(owner.reading.revision)||owner.reading.availability!=='available'))throw Error('This saved world lost its exact original native owner-role receipts.');
 const runtime=record.runtime_buffers;
 if(runtime?.schema!=='oi.epi-native-runtime-buffers/v1'||runtime.policy!=='native-owner-recompose'||runtime.reading.ref!==record.native_source.world_ref.ref||runtime.reading.revision!==record.native_source.world_ref.revision||runtime.buffers?.length!==2||new Set(runtime.buffers.map(buffer=>buffer.key)).size!==2||runtime.buffers.some(buffer=>!['slots_a','slots_b'].includes(buffer.key)||!Number.isSafeInteger(buffer.values)||buffer.values<1||!/^[a-f0-9]{64}$/.test(buffer.json_sha256)))throw Error('This saved world lost its exact native runtime-buffer qualification.');
 const locus=document.entities[record.receiving.personal.locus_entity_ref];
 if(locus?.subject?.subject_ref!==record.receiving.personal.canonical_locus)throw Error('The saved personal locus is absent or belongs to another native branch.');
 if(record.current_material_policy!==undefined)requireCurrentSceneMaterialPolicy(record.current_material_policy);
 if(record.native_readback!==undefined)requireEpiNativeReadback(record,record.native_readback,true);
 return record;
}
/** Retain the acknowledged instance adjustment beside immutable original world
 * material. Returning to the original policy removes only this adjustment. */
export function epiMaterialContinuation(record:EpiWorldRecord,material:unknown):Pick<EpiWorldRecord,'current_material_policy'> {
 const current=requireSceneMaterial(material),host=record.world.binding.host as {material?:unknown}|undefined;
 const original=requireSceneMaterial(host?.material);
 if(sameSceneData(current,original))return{};
 return{current_material_policy:{schema:'oi.epi-current-material-policy/v1',material:structuredClone(current),standing:SCENE_MATERIAL_STANDING}};
}
export function epiOpeningMaterial(record:EpiWorldRecord){return requireSceneMaterial((record.world.binding.host as {material?:unknown}|undefined)?.material);}
export function requireEpiNativeReadback(record:EpiWorldRecord,value:unknown,retained:boolean){
 const n=value as NativeSceneWorldReading['native_readback'];
 const process=(n as unknown as Record<string,unknown>)?.form_process as {instance_ref?:string;process_subject_ref?:string;event_ref?:string;subject_ref?:string;canonical_subject_ref?:string;current_reading?:ReadingRef;reading?:{reading?:ReadingRef}}|undefined;
 if(n?.schema!=='ql.scene-source-reading/v1'||n.event_ref!==record.world.event_ref||n.subject_ref!==record.person_ref||
    process?.instance_ref!==record.world.instance_ref||process.process_subject_ref!==record.world.current_form.process_subject_ref||
    process.event_ref!==record.world.event_ref||process.subject_ref!==record.person_ref||
    process.current_reading?.availability!=='available'||!process.current_reading.ref.startsWith('ql:m-coordinate:bimba:M3')||
    process.current_reading.ref!==process.canonical_subject_ref||
    process.current_reading.revision!==record.source_basis.source_revision||!sameSceneData(process.current_reading,process.reading?.reading))throw Error('The native readback lost its exact instance, process, event, person or Bimba source.');
 if(retained&&(!object(record.continuation_start)||!sameSceneData(record.continuation_start,(n as unknown as Record<string,unknown>).continuation_start)))throw Error('The retained native readback lost its acknowledged continuation.');
 return n;
}
export function createEpiWorldProduction(port:EpiProductionPort){
 let inFlight=false;
 async function defineProfile(request:ExpressionRequest){
  if(request.operation!=='profile_define'||!object(request.profile)||typeof request.profile.profile_ref!=='string')throw Error('Only native reusable profile definitions are admitted here.');
  const result=await port.expression(request);
  if(result.state!=='profile'||!object(result.profile)||result.profile.profile_ref!==request.profile.profile_ref||!object(result.resolved_defaults))throw Error('The native profile owner refused '+request.profile.profile_ref+': '+JSON.stringify(result));
  return result.resolved_defaults;
 }
 async function construct(identity:InstrumentIdentity,sky:NativeSky='now',retainedSky?:NativeSkySnapshot){
  if(inFlight)throw Error('The current native world construction is still being acknowledged.');
  inFlight=true;
  try{
   if(!identity.source.source_ref||!identity.source.revision||!identity.reading.person_ref||!identity.reading.nara_ref)throw Error('Save and select the particular person before entering their world.');
   const instance=`expression:epi-${crypto.randomUUID()}`,person=identity.reading.person_ref;
   const selected=await port.nara({operation:'select_identity',source:identity.source,input_revision:identity.reading.input_revision});
   if(selected.schema!=='oi.nara-instrument-state/v1'||selected.identity?.reading.person_ref!==person)throw Error('The native identity selection did not acknowledge this particular person.');
   port.status('Reading one native sky and its cosmic event…');
   const p=prepared(await port.prepare({world:{instance_ref:instance,subject_ref:person},...(retainedSky?{skySnapshot:retainedSky,snapshotPurpose:'retained-occasion'}:{sky})}),instance,person);
   const world=p.source.world,refs=requiredEpiWorldCoordinates(world);
   if(retainedSky)requireRetainedSkyAdmission((world as unknown as Record<string,unknown>).sky_admission,retainedSky as unknown as import('../../../src/nara/identity/types').NativeSkySnapshot);
   if(refs.length>64)throw Error('The first native world exceeds its bounded source bundle.');
   port.status('Resolving the exact cosmic and personal subjects…');
   const root=validateCoordinateExpression(await port.nara({operation:'coordinate',request:{coordinate_ref:refs[0],face:'bimba',include_content:true,related_coordinates:refs.slice(1),inventory:{offset:0,limit:256}}}));
   const coordinates:Record<string,CoordinateSource>={};
   for(const r of [root,...(root.related_readings??[])]){
    if(!r.source_content)throw Error('A native material subject arrived without its full properties and relations.');
    coordinates[r.binding.coordinate_ref]=coordinateSourceFromNative(r,r.source_content as BimbaCoordinateContent);
   }
   if(!root.source_inventory)throw Error('The source owner omitted the actual inventory.');
   const pages:BimbaInventoryPage[]=[root.source_inventory as BimbaInventoryPage];
   while(pages.at(-1)!.next_offset!==null){
    const page=await port.nara({operation:'source',coordinate_ref:'bimba-source:M',inventory:{offset:pages.at(-1)!.next_offset!,limit:256}});
    if(page.schema!=='ql.bimba-inventory/v1')throw Error('The native source inventory continuation was refused.');
    pages.push(page as unknown as BimbaInventoryPage);port.status(`Reading the Bimba field · ${Math.min(pages.length*256,pages[0].total)} of ${pages[0].total} sources`);
   }
   const created=await port.expression({operation:'create',expression_ref:instance,title:`${identity.reading.profile.name} · Epi world`,actor:'human:epi-world'});
   if(!created.document||created.state!=='ready')throw Error('The native owner did not create this Expression instance.');
   const reading:ReadingRef={ref:`ql:scene-world:${instance}`,revision:p.source.request_sha256,availability:'available'};
   const qualifySource=(ref:string):ReadingRef=>Object.values(world.native_owner_sources).find(source=>source.ref===ref)??({ref,revision:/^(#|M\d|bimba:|bimba-source:|ql:m-coordinate:)/.test(ref)?world.scene.sources.sky_revision:p.source.ql_revision??`sha256:${p.source.ql_executable_sha256}`,availability:'available'});
   const personal:PersonalInstance={person:{ref:person,revision:identity.reading.input_revision,availability:'available'},identity:{ref:identity.source.source_ref,revision:identity.source.revision,availability:'available'},instance_ref:instance,nara_ref:identity.reading.nara_ref,event_ref:world.event_ref,snapshot_ref:world.snapshot_ref};
   const skySubject:SubjectBinding={subject_ref:world.snapshot_ref,native_owner:'ql-mef',presentation_role:'thing',sources:[{ref:world.snapshot_ref,revision:world.snapshot_ref,availability:'available'}],readings:[reading],actions:[]};
   const authored_revision=EPI_WORLD_AUTHORED_REVISION;
   const input=await prepareEpiMaterialInputFromNative({document:created.document,actor:'human:epi-world',authored_revision,world,world_reading:reading,coordinates,inventory_pages:pages,sky_subject:skySubject,personal,qualifySource,canvas:port.canvas});
   const plan=buildEpiWorldMaterial(input);
   port.status('Resolving reusable form through the native profile owner…');
   const resolved=new Map<string,Record<string,unknown>>(),declaredMaterials=new Map<string,unknown>();
   for(const definition of plan.definitions){
    const defaults=await defineProfile(definition);
    if(definition.operation==='profile_define'){
     const profile=definition.profile as CoordinateProfile;resolved.set(profile.profile_ref,defaults);
     const authored=profile.material_defaults;
     if(object(authored)&&object(authored.material))declaredMaterials.set(profile.profile_ref,authored.material.value);
    }
   }
   // Actual owner inheritance supplies the rich form. The particular Scene's
   // authored placement and personal/live state remain instance material.
   for(const occurrence of plan.occurrences){
    const defaults=resolved.get(occurrence.profile_ref),material=object(defaults?.material)?defaults!.material.value:null;
    const declared=declaredMaterials.get(occurrence.profile_ref);
    if(!object(material)||!Object.keys(material).length||!sameSceneData(material,declared))throw Error('The native inherited form differs from its authored material: '+occurrence.profile_ref);
    for(const scene of plan.scenes){
     const body=scene.entities.find(e=>e.id===occurrence.material.id);if(!body)continue;
     const situated={id:body.id,position:body.position,size:body.size,share:body.share,role:body.role,overrides:body.overrides,sound:body.sound};
     Object.assign(body,structuredClone(material),situated);if(body.native)body.native.id=body.id;
    }
   }
   for(const change of plan.edit.changes)if(change.change==='scene_material_set'){
    const scene=plan.scenes.find(s=>s.id===change.scene_ref);if(!scene)throw Error('The native inherited material lost its Scene.');
    change.presentation.scene=structuredClone(scene) as unknown as Record<string,unknown>;change.presentation.saved=structuredClone(scene) as unknown as Record<string,unknown>;
   }
   const cosmicScene=plan.scenes.find(s=>s.id===plan.receiving.scene_ref);if(!cosmicScene)throw Error('The native plan omitted its cosmic Scene.');
   epiTorusMaterialCapacity(cosmicScene,plan.receiving.torus.entity_ref,world,plan.edit.changes.flatMap(c=>c.change==='relation_bind'?[c.binding]:[]));
   const {world:receivedWorld,...sourceReceipt}=p.source;
   if(receivedWorld!==world)throw Error('The native world source changed during construction.');
   const portable=await portableWorld(world,reading);
   const record:EpiWorldRecord={schema:'oi.epi-world-material/v1',...portable,native_source:{...sourceReceipt,world_ref:reading},identity_source:identity.source,identity_input_revision:identity.reading.input_revision,person_ref:person,nara_ref:identity.reading.nara_ref,authored_revision,receiving:plan.receiving,register_members:plan.register_members,inventory:input.inventory,source_basis:plan.source_basis,profile_definitions:plan.definitions};
   const sceneChange=plan.edit.changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===plan.receiving.scene_ref);
   if(!sceneChange||sceneChange.change!=='scene_material_set')throw Error('The native plan omitted its cosmic material.');
   sceneChange.presentation.scene.epiWorld=record;
   sceneChange.presentation.saved=epiAuthoredSceneSnapshot(sceneChange.presentation.scene);
   port.status('Constructing the native Expression material…');
   const edited=await port.expression(plan.edit);
   if(edited.state!=='ready'||!edited.document)throw Error('The native world CAS was not acknowledged. The created instance remains available for recovery.');
   const inspected=await port.expression({operation:'inspect',expression_ref:instance});
   if(!inspected.document)throw Error('The committed native world could not be read back.');
   verifyEpiWorldReadback(inspected.document,plan);readEpiWorldRecord(inspected.document);
   if(!await port.load(instance))throw Error('The native world is committed; resolve the retained working draft to open it.');
   const file=await port.persist(`epi-world-${instance.slice('expression:epi-'.length)}.expression.json`);
   if(file.expression_ref!==instance||!file.revision||!file.location.ref)throw Error('The native material file was not saved and read back under this Expression identity.');
   port.status('Cosmic field · one occasion, with your Personal Pratibimba');
   return{document:inspected.document,record,plan,identity,file};
  }finally{inFlight=false;}
 }
 async function pin(record:EpiWorldRecord,intent:'acquire'|'restore'='acquire'):Promise<NativeCurrentReading>{
  // The native profile registry is a host faculty. Reopening a durable world
  // resolves its canonical lineage again instead of relying on session memory.
  const locus=validateCoordinateExpression(await port.nara({operation:'coordinate',request:{coordinate_ref:record.receiving.personal.canonical_locus,face:'bimba'}}));
  if(locus.binding.rooted_world.registry_revision!==record.source_basis.registry_revision)throw Error('The saved world has a different current coordinate source.');
  const inspected=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
  if(!inspected.document)throw Error('The saved native world cannot be read before personal reception.');
  const adopted=(inspected.document.profiles??[]).filter(profile=>profile.profile_ref.startsWith('profile:epi-coordinate-'));
  const source=locus.subject_binding.sources[0];
  if(adopted.length!==1||adopted[0].profile_ref!==locus.binding.resolved_profile_ref||adopted[0].revision!==locus.binding.profile_revision||!sameSceneData(adopted[0].source_basis,source))throw Error('The saved coordinate profile needs review. Open Coordinate Atlas, read Personal Pratibimba, and choose Use profile for this Expression before receiving its personal current.');
  for(const profile of locus.profiles)await defineProfile({operation:'profile_define',profile,actor:'human:epi-world-reopen'});
  const definitions=record.profile_definitions;if(!Array.isArray(definitions)||definitions.length>64)throw Error('The saved world has no bounded reusable profile definitions.');
  const unique=new Map<string,string>();
  for(const definition of definitions){if(definition.operation!=='profile_define')throw Error('A saved reusable profile receipt contains another native operation.');if(!object(definition.profile)||typeof definition.profile.profile_ref!=='string')throw Error('A saved profile definition has no native identity.');const ref=definition.profile.profile_ref,bytes=JSON.stringify(definition.profile);if(unique.has(ref)&&unique.get(ref)!==bytes)throw Error('A saved profile has conflicting immutable definitions.');unique.set(ref,bytes);await defineProfile(definition);}
  const selected=await port.nara({operation:'select_identity',source:record.identity_source,input_revision:record.identity_input_revision});
  if(selected.schema!=='oi.nara-instrument-state/v1'||selected.identity?.reading.person_ref!==record.person_ref)throw Error('Reopen the saved person for this particular world.');
  const basis={expression_ref:record.world.instance_ref,source:record.identity_source};
  // Ordinary reopening restores the exact saved private admission. Acquisition
  // remains an explicit identity Use/correction or first construction act.
  const current=await port.nara(intent==='restore'
   ?{operation:'current_restore',basis,role:'nara'}
   :{operation:'current_pin',basis,role:'nara',snapshot_purpose:'retained-occasion',sky_snapshot:record.world.sky as unknown as import('../../../src/nara/identity/types').NativeSkySnapshot});
  if(current.schema!=='oi.nara-personal-current-context/v1'||current.status!=='available'||current.context?.event_ref!==record.world.event_ref||current.reading?.identity.person_ref!==record.person_ref||current.reading.transit.sky?.snapshot_ref!==record.world.snapshot_ref)throw Error('The personal owner did not receive the exact saved cosmic occasion.');
  requireRetainedSkyAdmission(current.reading?.sky_admission,record.world.sky as unknown as import('../../../src/nara/identity/types').NativeSkySnapshot);
  return current;
 }
 async function rebind(record:EpiWorldRecord,identity:InstrumentIdentity,intent:'acquire'|'restore'='restore'){
  if(identity.reading.person_ref!==record.person_ref||identity.reading.nara_ref!==record.nara_ref)throw Error('An identity correction must retain this world’s actual person and Nara binding.');
  const inspected=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
  if(!inspected.document)throw Error('The saved native world cannot be read for presentation correction.');
  const correction=epiTorusCapacityCorrection(inspected.document,record);
  if(correction.changes.length){
   if(!port.presentationRest())throw Error('Reopen this saved world at rest to correct its torus allocation; live particle continuity was preserved.');
   port.status('Making room for the complete native torus…');
   await port.edit(document=>epiTorusCapacityCorrection(document,record).changes);
   const received=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
   if(!received.document)throw Error('The native torus correction was not read back.');
   const acknowledged=readEpiWorldRecord(received.document);if(!acknowledged)throw Error('The corrected world lost its native occasion.');
   const receivedMaterial=received.document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref)?.presentation;
   const receivedScene=receivedMaterial?.scene as unknown as Scene,receivedReset=receivedMaterial?.saved as unknown as Scene;
   if(epiTorusCapacityCorrection(received.document,acknowledged).changes.length||received.document.entities[record.receiving.torus.entity_ref].parameters.share?.value!==12||receivedScene?.entities.find(e=>e.id===record.receiving.torus.entity_ref)?.share!==12||receivedReset?.entities.find(e=>e.id===record.receiving.torus.entity_ref)?.share!==12||!sameSceneData(acknowledged,correction.record))throw Error('The exact native torus correction was not acknowledged.');
   record=acknowledged;
  }
  const personalDocument=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
  if(!personalDocument.document)throw Error('The saved personal material cannot be read for presentation correction.');
  const personalCorrection=epiPersonalResonanceCorrection(personalDocument.document,record);
  if(personalCorrection.changes.length){
   if(!port.presentationRest())throw Error('Reopen this saved world at rest to correct its personal wave mixture; live particle continuity was preserved.');
   port.status('Receiving the native personal waves in the authored medium…');
   await port.edit(document=>epiPersonalResonanceCorrection(document,record).changes);
   const received=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
   if(!received.document)throw Error('The native personal material correction was not read back.');
   const acknowledged=readEpiWorldRecord(received.document);
   if(!acknowledged||!sameSceneData(acknowledged,personalCorrection.record)||epiPersonalResonanceCorrection(received.document,acknowledged).changes.length)throw Error('The exact live and saved personal wave correction was not acknowledged.');
   record=acknowledged;
  }
  const captionDocument=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
  if(!captionDocument.document)throw Error('The saved cosmic material cannot be read for its clock caption.');
  const captionChanges=epiClockCaptionCorrection(captionDocument.document,record);
  if(captionChanges.length){
   await port.edit(document=>epiClockCaptionCorrection(document,record));
   const received=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
   if(!received.document||!sameSceneData(readEpiWorldRecord(received.document),record)||!sameSceneData(received.document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref)?.presentation,captionChanges[0].presentation)||epiClockCaptionCorrection(received.document,record).length)throw Error('The native clock caption correction was not acknowledged.');
  }
  const geometryDocument=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
  if(!geometryDocument.document)throw Error('The saved cosmic captions cannot be read for their authored geometry.');
  const geometryCorrection=epiCosmicCaptionGeometryCorrection(geometryDocument.document,record);
  if(geometryCorrection.changes.length){
   if(!port.presentationRest())throw Error('Reopen this saved world at rest to separate its generated captions; live field continuity was preserved.');
   port.status('Separating the complete authored cosmic captions…');
   // SceneMaterialSet changes exactly this presentation; the native owner
   // advances its containing Scene and Document once. No other body may drift.
   const expectedDocument=structuredClone(geometryDocument.document),expectedScene=expectedDocument.scenes.find(scene=>scene.scene_ref===record.receiving.scene_ref);
   if(!expectedScene)throw Error('The caption geometry correction lost its containing Scene.');
   expectedDocument.revision++;expectedScene.revision=expectedDocument.revision;expectedScene.presentation=geometryCorrection.changes[0].presentation;
   await port.edit(document=>{
    if(!sameSceneData(document,geometryDocument.document))throw Error('The native world changed before its caption geometry edit.');
    return epiCosmicCaptionGeometryCorrection(document,record).changes;
   });
   const received=await port.expression({operation:'inspect',expression_ref:record.world.instance_ref});
   const acknowledged=received.document&&readEpiWorldRecord(received.document);
   if(!received.document||!acknowledged||!sameSceneData(received.document,expectedDocument)||!sameSceneData(acknowledged,geometryCorrection.record)||!sameSceneData(received.document.scenes.find(scene=>scene.scene_ref===record.receiving.scene_ref)?.presentation,geometryCorrection.changes[0].presentation)||epiCosmicCaptionGeometryCorrection(received.document,acknowledged).changes.length)throw Error('The exact native live/saved caption geometry correction was not acknowledged.');
   record=acknowledged;
  }
  if(intent==='restore'&&(!sameSceneData(identity.source,record.identity_source)||identity.reading.input_revision!==record.identity_input_revision))throw Error('The saved identity changed. Review it and choose Use to admit its new current.');
  const updated={...record,identity_source:identity.source,identity_input_revision:identity.reading.input_revision};
  const current=await pin(updated,intent),context=current.context!;
  const previous:PersonalInstance={person:record.receiving.personal.person,identity:record.receiving.personal.identity,instance_ref:record.world.instance_ref,nara_ref:record.nara_ref,event_ref:record.world.event_ref,snapshot_ref:record.world.snapshot_ref,...(record.receiving.personal.current?{current:record.receiving.personal.current}:{})};
  const next:PersonalInstance={...previous,person:{ref:record.person_ref,revision:identity.reading.input_revision,availability:'available'},identity:{ref:identity.source.source_ref,revision:identity.source.revision,availability:'available'},current:{ref:context.reading_ref,revision:context.reading_revision,availability:'available'},native_current:current};
  let held=updated;
  if(!sameSceneData(previous.person,next.person)||!sameSceneData(previous.identity,next.identity)||!sameSceneData(previous.current??null,next.current)){
   await port.edit(document=>{
    const rebound=rebindEpiPersonalSubjects({document,receiving:record.receiving,previous,next,actor:'human:epi-personal-reception'});held={...updated,receiving:rebound.receiving};
    const material=document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref)?.presentation;if(!material?.scene)throw Error('The saved cosmic scene material is absent.');
    const presentation=structuredClone(material),scene={...presentation.scene,epiWorld:held};
    return[...rebound.edit.changes,{change:'scene_material_set',scene_ref:record.receiving.scene_ref,presentation:{...presentation,scene,saved:epiAuthoredSceneSnapshot(scene)}}] as unknown as Record<string,unknown>[];
   });
  }
  // A recovered native basis may already carry this same personal reception
  // while its attached durable file still stands on an earlier revision.
  const file=await port.persist(`epi-world-${record.world.instance_ref.slice('expression:epi-'.length)}.expression.json`);
  if(file.expression_ref!==record.world.instance_ref||!file.revision)throw Error('The personal reception was not saved to its native material file.');
  // The acknowledged file ends the recovery operation's progress notice.
  port.status('');
  return{record:held,current,identity};
 }
 return{construct,pin,rebind,read:readEpiWorldRecord};
}

/** Correct only the former generated caption in its exact cosmic Scene. Native
 * readings, private identity, custom wording and all layout remain unchanged. */
export function epiClockCaptionCorrection(document:ExpressionDocument,record:EpiWorldRecord):Record<string,unknown>[] {
 if(!sameSceneData(readEpiWorldRecord(document),record))throw Error('The clock caption basis differs from the actual native world.');
 const sceneRef=`${document.expression_ref}:scene:cosmic`;
 if(record.world.instance_ref!==document.expression_ref||record.receiving.scene_ref!==sceneRef)throw Error('The clock caption belongs to another Expression or Scene.');
 if(!['epi-world-20261001-v3','epi-world-20261001-v4','epi-world-20261001-v5'].includes(record.authored_revision))return[];
 const material=document.scenes.find(s=>s.scene_ref===sceneRef)?.presentation;
 if(!object(material?.scene)||!object(material?.saved)||material.scene.id!==sceneRef||material.saved.id!==sceneRef||!Array.isArray(material.scene.text)||!Array.isArray(material.saved.text))throw Error('The clock caption requires complete live and saved cosmic material.');
 const presentation=structuredClone(material);let changed=false;
 for(const scene of [presentation.scene,presentation.saved]){
  const labels=(scene!.text as unknown[]).filter(label=>object(label)&&label.id===`${sceneRef}:label-clock-a`);
  if(labels.length>1)throw Error('The generated clock caption has an ambiguous authored identity.');
  const label=labels[0];
  if(object(label)&&label.role==='clock-a.caption'&&label.title==='Clock A · inscription'&&label.body===EPI_OLD_CLOCK_A_CAPTION){label.body=EPI_CLOCK_A_CAPTION;changed=true;}
 }
 return changed?[{change:'scene_material_set',scene_ref:sceneRef,presentation}]:[];
}

/** One-time authored geometry correction of the complete former generated
 * cohort only. Unknown wording/layout/visibility is a person's material and
 * is left untouched. An acknowledged receipt never re-normalises later edits. */
function captionGeometryAdjustment(document:ExpressionDocument,record:EpiWorldRecord):EpiCaptionGeometryAdjustment{
 return{schema:'oi.epi-instance-caption-geometry-adjustment/v1',standing:'authored-presentation',actor:'agent:codex:epi-fidelity-lead',purpose:'Separate the complete generated cosmic caption cohort without changing source, bodies or typography',basis_revision:document.revision,scene_ref:record.receiving.scene_ref,event_ref:record.world.event_ref,person_ref:record.person_ref,source:structuredClone(EPI_COSMIC_CAPTION_GEOMETRY.source),before_y:[...EPI_COSMIC_CAPTION_GEOMETRY.before_y],after_y:[...EPI_COSMIC_CAPTION_GEOMETRY.after_y]};
}
export function epiCosmicCaptionGeometryCorrection(document:ExpressionDocument,record:EpiWorldRecord):{changes:Extract<import('../../../src/expression/types.js').Change,{change:'scene_material_set'}>[];record:EpiWorldRecord}{
 const actual=readEpiWorldRecord(document),sceneRef=`${document.expression_ref}:scene:cosmic`;
 if(!actual||!sameSceneData(actual,record)||record.world.instance_ref!==document.expression_ref||record.receiving.scene_ref!==sceneRef||record.receiving.subject_ref!==record.person_ref||record.receiving.event_ref!==record.world.event_ref||record.receiving.snapshot_ref!==record.world.snapshot_ref||record.world.sky.snapshot_ref!==record.world.snapshot_ref)throw Error('The caption geometry correction lost its exact native world, person, instance or occasion.');
 const adjustment=record.caption_geometry_adjustment;
 if(adjustment!==undefined){
  if(!object(adjustment)||!Number.isSafeInteger(adjustment.basis_revision)||adjustment.basis_revision<1||adjustment.basis_revision>document.revision||!sameSceneData(adjustment,{...captionGeometryAdjustment(document,record),basis_revision:adjustment.basis_revision}))throw Error('The caption geometry receipt belongs to another source or occasion.');
  return{changes:[],record};
 }
 // Fresh v6 already has this layout; its later quiet/custom choices belong
 // to the person. Unsupported material requires its own authored account.
 if(!['epi-world-20261001-v3','epi-world-20261001-v4','epi-world-20261001-v5'].includes(record.authored_revision))return{changes:[],record};
 const material=document.scenes.find(scene=>scene.scene_ref===sceneRef)?.presentation;
 if(!object(material?.scene)||!object(material?.saved)||material.scene.id!==sceneRef||material.saved.id!==sceneRef||!Array.isArray(material.scene.text)||!Array.isArray(material.saved.text)||material.saved.epiWorld||document.scenes.filter(scene=>object(scene.presentation?.scene?.epiWorld)).length!==1||document.scenes.some(scene=>object(scene.presentation?.saved?.epiWorld)))throw Error('The caption correction requires sole live world custody and complete live/saved cosmic material.');
 const expected=epiCosmicCaptionCohort(sceneRef,true);
 for(const scene of [material.scene,material.saved]){
  const layers=scene.text as unknown[];
  for(const label of expected)if(layers.filter(value=>object(value)&&value.id===label.id).length>1)throw Error('The generated caption cohort has an ambiguous authored identity.');
  if(layers.length!==expected.length)return{changes:[],record};
  // Exact property equality preserves custom bodySize and any other authored
  // extension, not just the known position fields. Legacy Clock A wording
  // remains the separate existing wording correction's responsibility.
  if(layers.some((value,index)=>!object(value)||!sameSceneData(value.id===`${sceneRef}:label-clock-a`&&value.body===EPI_OLD_CLOCK_A_CAPTION?{...value,body:EPI_CLOCK_A_CAPTION}:value,expected[index])))return{changes:[],record};
 }
 const held:EpiWorldRecord={...record,caption_geometry_adjustment:captionGeometryAdjustment(document,record)};
 const corrected=structuredClone(material);
 for(const scene of [corrected.scene,corrected.saved])for(const [index,label] of (scene!.text as unknown as Scene['text']).entries())label.y=EPI_COSMIC_CAPTION_GEOMETRY.after_y[index];
 corrected.scene.epiWorld=held;
 return{changes:[{change:'scene_material_set',scene_ref:sceneRef,presentation:corrected}],record:held};
}

/** Admission uses the renderer's actual allocation owners, including native
 * relation reservations. The loaded retained partition remains the final gate. */
export function epiTorusMaterialCapacity(scene:Scene,entityRef:string,world:NativeSceneWorldReading|EpiWorldRecord['world'],relations:ExpressionDocument['relations'][string][],requireComplete=true){
 const config=toNativeConfig(scene),members=new Set(scene.entities.map(e=>e.id));
 const connections=new ConnectionRuntime();connections.configure(relations.filter(r=>members.has(r.from_entity_ref)&&members.has(r.to_entity_ref)).map(r=>({...r})),[],config.particleCount);
 const partitions=layoutPartitions(config.entities??[],connections.start),target=partitions.find(p=>p.entityId===entityRef);
 const host=world.binding.host as {geometry?:{longitude_samples:number;latitude_samples:number}},required=Number(host?.geometry?.longitude_samples)*Number(host?.geometry?.latitude_samples);
 if(!Number.isSafeInteger(required)||required<1||!target||partitions.length!==scene.entities.filter(e=>e.kind==='formation'&&e.enabled).length||partitions.some(p=>p.end<=p.start)||connections.overflow.length)throw Error('The complete native cosmic material cannot be allocated.');
 const count=target.end-target.start;
 if(requireComplete&&count<required)throw Error('The authored torus allocation cannot represent the complete native sample domain.');
 return{required,count,particle_count:config.particleCount,formation_particles:connections.start,connection_particles:config.particleCount-connections.start,partitions};
}
/** Correct only the known v3 authored allocation fault, through ordinary
 * native edit/CAS. Immutable profile definitions and the admitted occasion are
 * preserved; this record names a particular instance's presentation change. */
export function epiTorusCapacityCorrection(document:ExpressionDocument,record:EpiWorldRecord):{changes:import('../../../src/expression/types.js').Change[];record:EpiWorldRecord}{
 const actual=readEpiWorldRecord(document),ref=record.receiving.torus.entity_ref;
 if(!actual||!sameSceneData(actual,record)||document.expression_ref!==record.world.instance_ref||record.receiving.torus.subject_ref!=='ql:m-coordinate:bimba:M1-5-1'||document.entities[ref]?.subject?.subject_ref!==record.receiving.torus.subject_ref||record.receiving.torus.native_constituent!=='#1-5-1')throw Error('The torus correction lost its exact native subject, person or occasion.');
 const nativeScene=document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref),presentation=nativeScene?.presentation;
 if(!presentation?.scene||!presentation.saved)throw Error('The saved cosmic Scene is absent.');
 const scene=presentation.scene as unknown as Scene,relations=Object.values(document.relations),capacity=epiTorusMaterialCapacity(scene,ref,record.world,relations,false);
 const body=scene.entities.find(e=>e.id===ref),saved=presentation.saved as unknown as Scene,savedBody=saved.entities.find(e=>e.id===ref);
 if(capacity.count>=capacity.required){
  epiTorusMaterialCapacity(saved,ref,record.world,relations);
  const parameter=document.entities[ref].parameters.share;
  if(record.presentation_adjustments?.some(a=>a.entity_ref===ref)&&(!parameter||parameter.automation||parameter.value!==body?.share))throw Error('The native torus parameter and corrected Scene material disagree.');
  return{changes:[],record};
 }
 if(record.authored_revision!=='epi-world-20261001-v3'||body?.share!==4||savedBody?.share!==4||capacity.required!==4096)throw Error('This saved material requires an explicitly authored capacity correction.');
 const corrected=structuredClone(presentation),current=corrected.scene as unknown as Scene,reset=corrected.saved as unknown as Scene;
 current.entities.find(e=>e.id===ref)!.share=12;reset.entities.find(e=>e.id===ref)!.share=12;
 epiTorusMaterialCapacity(current,ref,record.world,relations);epiTorusMaterialCapacity(reset,ref,record.world,relations);
 const held:EpiWorldRecord={...record,presentation_adjustments:[...(record.presentation_adjustments??[]),{schema:'oi.epi-instance-presentation-adjustment/v1',actor:'agent:codex:epi-fidelity-lead',purpose:'Complete native torus sample reception; authored allocation repair',basis_revision:document.revision,entity_ref:ref,scene_ref:record.receiving.scene_ref,parameter:'share',before:4,after:12,event_ref:record.world.event_ref,person_ref:record.person_ref}]};
 corrected.scene.epiWorld=held;
 return{changes:[{change:'parameter_set',entity_ref:ref,parameter:'share',value:12},{change:'scene_material_set',scene_ref:record.receiving.scene_ref,presentation:corrected}],record:held};
}

/** Correct the known zero authored personal mixture only. Canonical subjects,
 * the admitted world, protected current and immutable profile definitions are
 * preserved. An unknown user mixture or mismatched reset material refuses. */
export function epiPersonalResonanceCorrection(document:ExpressionDocument,record:EpiWorldRecord):{changes:import('../../../src/expression/types.js').Change[];record:EpiWorldRecord}{
 const actual=readEpiWorldRecord(document),personal=record.receiving.personal,sceneRef=`${document.expression_ref}:scene:personal`;
 if(document.scenes.filter(s=>object(s.presentation?.scene?.epiWorld)).length!==1||document.scenes.some(s=>object(s.presentation?.saved?.epiWorld)))throw Error('The personal correction requires the sole live cosmic world carrier and source-only saved material.');
 if(!actual||!sameSceneData(actual,record)||document.expression_ref!==record.world.instance_ref||personal.instance_ref!==document.expression_ref||record.world.subject_ref!==record.person_ref||record.receiving.subject_ref!==record.person_ref||record.receiving.event_ref!==record.world.event_ref||record.receiving.snapshot_ref!==record.world.snapshot_ref||record.world.sky.snapshot_ref!==record.world.snapshot_ref||personal.person.ref!==record.person_ref||personal.person.revision!==record.identity_input_revision||personal.identity.ref!==record.identity_source.source_ref||personal.identity.revision!==record.identity_source.revision||personal.canonical_locus!=='ql:m-coordinate:bimba:M4.4.4.4')throw Error('The personal presentation correction lost its exact source, person, instance or occasion.');
 const centres=personal.centre_entity_refs,locus=personal.locus_entity_ref,earth=`${document.expression_ref}:entity:world-earth`,expected=[earth,...centres,locus];
 if(centres.length!==7||new Set(expected).size!==9)throw Error('The personal presentation correction needs the original seven centres, Earth and locus.');
 for(const [index,ref] of centres.entries())if(document.entities[ref]?.subject?.subject_ref!==`ql:m-coordinate:bimba:M2-5-0/1-${index+1}`)throw Error('A personal centre was replaced by another coordinate.');
 if(document.entities[locus]?.subject?.subject_ref!==personal.canonical_locus||document.entities[earth]?.subject?.subject_ref!=='ql:m-coordinate:bimba:M2-5-0/1-0')throw Error('The original personal locus or Earth subject is absent.');
 for(const ref of expected){const subject=document.entities[ref]?.subject;if(subject?.native_owner!=='ql-mef'||!subject.sources.some(s=>sameSceneData(s,personal.person))||!subject.sources.some(s=>sameSceneData(s,personal.identity)))throw Error('A personal subject lost its exact identity source participation.');}
 const nativeScene=document.scenes.find(s=>s.scene_ref===sceneRef),presentation=nativeScene?.presentation;
 if(!nativeScene||!presentation?.scene||!presentation.saved||nativeScene.entity_refs.length!==9||nativeScene.entity_refs.some(ref=>!expected.includes(ref)))throw Error('The exact native personal Scene material or membership is absent.');
 const scene=presentation.scene as unknown as Scene,saved=presentation.saved as unknown as Scene;
 for(const value of [scene,saved])if(value.id!==sceneRef||value.entities.length!==9||new Set(value.entities.map(e=>e.id)).size!==9||value.entities.some(e=>!expected.includes(e.id)||e.kind!=='formation'||e.enabled===false)||value.engine.resonanceEnabled!==false||Object.prototype.hasOwnProperty.call(value,'epiWorld'))throw Error('The personal current/reset body material or quiet shared resonator standing changed.');
 const chakraIds=['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'];
 for(const value of [scene,saved])for(const [index,ref] of centres.entries())if(value.entities.find(e=>e.id===ref)?.native?.chakraId!==chakraIds[index])throw Error('The exact typed personal centre material is absent.');
 const before=scene.field?.params?.dominance,resetBefore=saved.field?.params?.dominance,after=PERSONAL_WAVE_PRESENTATION.dominance;
 const acknowledged=record.scene_field_adjustments?.find(a=>a.scene_ref===sceneRef&&a.parameter==='cymatics.dominance');
 if(acknowledged){
  if(acknowledged.schema!=='oi.epi-instance-scene-field-adjustment/v1'||acknowledged.before!==0||acknowledged.after!==after||acknowledged.event_ref!==record.world.event_ref||acknowledged.person_ref!==record.person_ref||!sameSceneData(acknowledged.source,PERSONAL_WAVE_PRESENTATION.source))throw Error('The personal presentation adjustment receipt has another source or occasion.');
  // A later zero or unsaved live/saved difference belongs to the person.
  // This one-time migration never re-enables or normalises their live choice.
  return{changes:[],record};
 }
 // Fresh v5/v6 material already authors this mixture. Subsequent live edits
 // remain user choices, including an explicitly quiet zero reading.
 if(['epi-world-20261001-v5',EPI_WORLD_AUTHORED_REVISION].includes(record.authored_revision))return{changes:[],record};
 if(before===after&&resetBefore===after)return{changes:[],record};
 if(!['epi-world-20261001-v3','epi-world-20261001-v4'].includes(record.authored_revision)||before!==0||resetBefore!==0)throw Error('This personal wave mixture needs an explicitly reviewed authored correction.');
 const cosmic=document.scenes.find(s=>s.scene_ref===record.receiving.scene_ref)?.presentation;
 if(!cosmic?.scene||!sameSceneData(cosmic.scene.epiWorld,record)||cosmic.saved?.epiWorld)throw Error('The sole cosmic world carrier or its authored reset material changed.');
 const corrected=structuredClone(presentation);
 (corrected.scene as unknown as Scene).field.params.dominance=after;
 (corrected.saved as unknown as Scene).field.params.dominance=after;
 const held:EpiWorldRecord={...record,scene_field_adjustments:[...(record.scene_field_adjustments??[]),{schema:'oi.epi-instance-scene-field-adjustment/v1',actor:'agent:codex:epi-fidelity-lead',purpose:'Receive nine protected native personal drivers in the existing authored seven-centre medium',basis_revision:document.revision,scene_ref:sceneRef,parameter:'cymatics.dominance',before,after,event_ref:record.world.event_ref,person_ref:record.person_ref,source:structuredClone(PERSONAL_WAVE_PRESENTATION.source)}]};
 const carrier=structuredClone(cosmic);carrier.scene={...carrier.scene,epiWorld:held};
 // Cosmic reset artistry is independent of this personal field change.
 // Preserve carrier.saved byte-for-byte, rather than cloning the live scene.
 return{changes:[{change:'scene_material_set',scene_ref:sceneRef,presentation:corrected},{change:'scene_material_set',scene_ref:record.receiving.scene_ref,presentation:carrier}],record:held};
}

/** A sparse map covers the complete native torus sample domain once. The
 * receiver stratifies that whole domain into this actual entity partition. */
export function epiTorusTargetMap(record:EpiWorldRecord,worldValue:unknown,partitionValue:unknown):NativeTargetMap {
 const world=worldValue as NativeSceneWorldReading,partition=partitionValue as {schema:string;partition_signature:string;partitions:{entity_ref:string;start:number;end:number}[]};
 if(world?.schema!=='ql.scene-world/v1'||world.instance_ref!==record.world.instance_ref||world.snapshot_ref!==record.world.snapshot_ref||world.subject_ref!==record.person_ref||partition?.schema!=='oi.retained-partition-snapshot/v1')throw Error('The live native world or actual retained partition belongs to another occasion.');
 const host=world.binding.host as {geometry?:{longitude_samples:number;latitude_samples:number}};
 const count=Number(host?.geometry?.longitude_samples)*Number(host?.geometry?.latitude_samples),target=partition.partitions.find(p=>p.entity_ref===record.receiving.torus.entity_ref);
 if(!Number.isSafeInteger(count)||count<1||!target||target.end-target.start<count)throw Error('The actual torus partition cannot represent the complete native sample domain.');
 const identities=Array.from({length:count},(_,i)=>i);
 return{schema:'oi.native-target-map/v1',policy:'sparse-replace',partition_signature:partition.partition_signature,partitions:[{entity_ref:target.entity_ref,target_a:{sample_identities:identities},target_b:{sample_identities:identities}}]};
}

/** Native source readback is the determinant. Placement is the disclosed
 * authored polar presentation; there is no browser clock or codon solver. */
export function epiSceneReception(scene:Scene,record:EpiWorldRecord,readbackValue:unknown):{scene:Scene;geometry:FormationGeometryProjection|null;revision:string}{
 const n=(readbackValue??record.native_readback??record.world.native_readback) as NativeSceneWorldReading['native_readback'];
 requireEpiNativeReadback(record,n,n===record.native_readback);
 const revision=String(n.profile_generation)+':'+JSON.stringify(n.continuous_clock);
 const copy={...scene,entities:scene.entities.map(e=>({...e,position:{...e.position}}))};
 const prefix=`${record.world.instance_ref}:entity:world-`;
 for(const [role,phase,radius] of [['clock-a-hand',n.continuous_clock.inscription,1.375],['clock-b-hand',n.continuous_clock.lensing,.715]] as const){
  const hand=copy.entities.find(e=>e.id===prefix+role);if(!hand)continue;
  const angle=phase.half_degrees/2*Math.PI/180;hand.position.x=radius*Math.sin(angle);hand.position.y=radius*Math.cos(angle);
 }
 const form=copy.entities.find(e=>e.id===prefix+'current-form-hinge'),hinge=(n.form as Record<string,unknown>).hinge_geometry as {schema:string;points:{id:string;xyz:[number,number,number]}[];segments:{from:string;to:string}[]}|undefined;
 let geometry:FormationGeometryProjection|null=null;
 if(form&&hinge?.schema==='ql.m3-hinge-presentation/v1'){
  const ids=hinge.points.map(p=>p.id);geometry={entityId:form.id,revision,points:hinge.points.map(p=>p.xyz),segments:hinge.segments.map(s=>[ids.indexOf(s.from),ids.indexOf(s.to)] as const)};
 }
 return{scene:copy,geometry,revision};
}

/** A current acknowledged native act may move static cosmic bodies while held.
 * The shared personal locus and other scenes never inherit these body ranges. */
export function epiStationaryReception(scene:Scene,record:EpiWorldRecord,readbackValue:unknown,document:ExpressionDocument|undefined):{sourceRevision:string;entityIds:readonly string[]}|undefined{
 if(scene.id!==record.receiving.scene_ref)return undefined;
 // Retaining an acknowledged act closes/reopens the native lease. Its live
 // influence is briefly absent, while the exact acknowledged readback has
 // already been committed to this world's native document. Receive that
 // retained act; the immutable opening world fallback is not a new act.
 const acknowledged=readbackValue??record.native_readback;
 if(acknowledged===undefined)return undefined;
 const current=document&&readEpiWorldRecord(document);
 if(!current||!sameSceneData(current,record))throw Error('The stationary native readback is stale against its current owner document.');
 requireEpiNativeReadback(record,acknowledged,readbackValue==null);
 const received=epiSceneReception(scene,record,acknowledged);
 const entityIds=['clock-a-hand','clock-b-hand','current-form','current-form-hinge'].map(role=>`${record.world.instance_ref}:entity:world-${role}`);
 if(entityIds.some(id=>!scene.entities.some(entity=>entity.id===id&&entity.kind==='formation'&&entity.enabled)))throw Error('A native cosmic receiving body is missing or disabled.');
 return {sourceRevision:record.world.instance_ref+':'+record.world.event_ref+':'+record.person_ref+':'+received.revision,entityIds};
}
