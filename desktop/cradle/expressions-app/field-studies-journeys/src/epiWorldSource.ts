/** Exact adapter for the complete native Bimba source owner. No HTTP graph
 * access, fixture path, frozen revision or duplicated semantic graph here.
 * Source values arrive through the existing protected native application port.
 */
import {validateCoordinateExpression,type CoordinateExpressionResult} from '../../../src/nara/coordinateExpression.js';
import type {ReadingRef} from '../../../src/expression/types.js';
import {assertCoupledClocks,registerVectorMaterial,rasterizeRegisterMaterialLosslessly,type CoordinateSource,type CoordinateInventoryRow,type EpiMaterialInput,type CoupledClockReading,type RegisterMember,type RegisterRole,type NativeCosmicScene,type PersonalInstance} from './epiWorldMaterial.js';
import type {ExpressionDocument,SubjectBinding} from '../../../src/expression/types.js';

export interface BimbaSourceIdentity {
 coordinate:string;native_coordinate:string|null;canonical_ref:string;uuid:string|null;title:string;aliases:string[];
 source_revision:string;registry_revision:string;full_source_ref:string;full_properties_ref:string;properties_sha256:string;
 properties?:Record<string,unknown>;labels?:string[];
}
export interface BimbaSourceRelation {
 source_index:number;relation_ref:string;from_coordinate:string;to_coordinate:string;from_ref:string;to_ref:string;
 kind:string;orientation:'directed';properties:Record<string,unknown>;properties_sha256:string;source_revision:string;
}
export interface BimbaCoordinateContent {
 schema:'ql.bimba-coordinate-content/v1';source_revision:string;registry_revision:string;
 identity:BimbaSourceIdentity;relations:BimbaSourceRelation[];standing:string;
}
export interface BimbaInventoryPage {
 schema:'ql.bimba-inventory/v1';source_revision:string;registry_revision:string;source_ref:string;
 total:number;relations:number;offset:number;next_offset:number|null;items:BimbaSourceIdentity[];
}
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const sameNative=(a:unknown,b:unknown)=>JSON.stringify(a,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([left],[right])=>left.localeCompare(right))):value)===JSON.stringify(b,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([left],[right])=>left.localeCompare(right))):value);
export function coordinateSourceFromNative(reading:CoordinateExpressionResult,content:BimbaCoordinateContent):CoordinateSource {
 validateCoordinateExpression(reading);const i=content?.identity,b=reading.binding;
 if(content?.schema!=='ql.bimba-coordinate-content/v1'||!i?.properties||!i.uuid||!hash(i.properties_sha256)||i.properties.coordinate!==i.coordinate||i.properties.c_2_uuid!==i.uuid||i.source_revision!==content.source_revision||i.registry_revision!==content.registry_revision||content.registry_revision!==b.rooted_world.registry_revision||i.native_coordinate!==b.coordinate_ref||i.canonical_ref!==reading.subject_binding.subject_ref)throw Error('The complete Bimba content does not identify this exact native coordinate/registry/source.');
 if(!b.property_sources.some(p=>p.source_revision===content.source_revision&&p.record.payload_sha256===i.properties_sha256))throw Error('The full property payload is absent from the native coordinate source records.');
 for(const r of content.relations){
  if(r.orientation!=='directed'||r.source_revision!==content.source_revision||!hash(r.properties_sha256)||!r.properties||!r.relation_ref||r.from_coordinate!==i.coordinate&&r.to_coordinate!==i.coordinate)throw Error('A qualified source relation is malformed or belongs to another selected source.');
 }
 return{reading,identity:{coordinate:i.coordinate,uuid:i.uuid,title:i.title,source_revision:i.source_revision,full_source_ref:i.full_source_ref,properties_sha256:i.properties_sha256,properties:i.properties},qualified_relations:content.relations};
}
export function inventoryFromNative(pages:readonly BimbaInventoryPage[]):{inventory:CoordinateInventoryRow[];receipt:EpiMaterialInput['inventory_receipt'];registry_revision:string} {
 if(!pages.length)throw Error('The complete native Bimba inventory has no source pages.');
 const first=pages[0];if(first.schema!=='ql.bimba-inventory/v1'||!hash(first.source_revision)||!hash(first.registry_revision)||!first.source_ref||!Number.isSafeInteger(first.total)||first.total<1)throw Error('The complete native Bimba inventory lacks an admitted source/count basis.');
 let offset=0;const inventory:CoordinateInventoryRow[]=[],seen=new Set<string>();
 for(const page of pages){
  if(page.schema!==first.schema||page.source_revision!==first.source_revision||page.registry_revision!==first.registry_revision||page.total!==first.total||page.relations!==first.relations||page.source_ref!==first.source_ref||page.offset!==offset||page.items.length<1||page.items.length>256)throw Error('Native source pages are missing, stale, duplicated or out of order.');
  for(const i of page.items){
   if(seen.has(i.coordinate)||i.source_revision!==first.source_revision||i.registry_revision!==first.registry_revision||!hash(i.properties_sha256)||!i.full_source_ref||!i.full_properties_ref||!i.title)throw Error('Native inventory coordinate identity/source is incomplete.');seen.add(i.coordinate);
   inventory.push({coordinate:i.coordinate,...(i.native_coordinate?{ql_coordinate:i.native_coordinate}:{}),identity:i.title,source_revision:i.source_revision,full_source_ref:i.full_source_ref,full_properties_ref:i.full_properties_ref,properties_sha256:i.properties_sha256,aliases:i.aliases,canonical_ref:i.canonical_ref});
  }
  offset+=page.items.length;if(page.next_offset!==(offset<first.total?offset:null))throw Error('The native inventory continuation does not cover the actual complete source.');
 }
 if(offset!==first.total||pages[pages.length-1].next_offset!==null)throw Error('The native source inventory is partial; no complete coverage claim is admitted.');
 const reading:ReadingRef={ref:first.source_ref,revision:first.source_revision,availability:'available'};
 return{inventory,registry_revision:first.registry_revision,receipt:{reading,source_revision:first.source_revision,node_count:first.total,relation_count:first.relations,complete:true}};
}

export interface NativeSceneWorldReading {
 schema:'ql.scene-world/v1';instance_ref:string;event_ref:string;subject_ref:string;snapshot_ref:string;sky:Record<string,unknown>;
 event:{m1:{event_ref:string;tick12:number;cycle:string};m3:{subject_ref:string;[key:string]:unknown};[key:string]:unknown};
 basis:{input:NativeSceneWorldReading['event'];m2_input:{resonator?:{modes:{mode_ref:string;frequency_hz:number}[]}|null;[key:string]:unknown};m2:Record<string,unknown>;derivation:{sky_voices?:{mode_ref:string;planet_ref:string;frequency_hz:number}[];[key:string]:unknown};[key:string]:unknown};
 scene:NativeCosmicScene;
 native_readback:{schema:'ql.scene-source-reading/v1';event_ref:string;subject_ref:string;profile_generation:number;
  m1_clock:{tick12:number;degree360:number;degree720:number;[key:string]:unknown};
  form:{address:number;[key:string]:unknown};selected_aperture:{index:number;[key:string]:unknown};
  continuous_clock:{inscription:{turns:string;half_degrees:number};lensing:{turns:string;half_degrees:number}};[key:string]:unknown};
 registers:{schema:'ql.scene-register-catalogue/v1';source_revision:string;degree:unknown[];backbone:unknown[];decan:unknown[];codon:unknown[];skin:unknown[];aperture:unknown[]};
 current_form:{process_subject_ref:string;canonical_subject_ref:string;current_reading:ReadingRef;coordinate_ref:string;triplet:string;hexagram_coordinate_ref:string;hexagram_source_ref:string;hexagram_reading:ReadingRef;hexagram_glyph:string|null;source_refs:ReadingRef[];native_form:unknown;native_hinge:unknown;event_ref:string;subject_ref:string;reading:{reading:ReadingRef;[key:string]:unknown}};
 binding:Record<string,unknown>;
 native_owner_sources:Record<'constructor'|'coupled'|'field',ReadingRef>;
}
/** The native host qualifies graph and implementation pointers from the exact
 * runtime source cut. The browser cannot stamp graph revision onto code paths. */
export function sceneWorldFromNative(world:NativeSceneWorldReading,reading:ReadingRef,qualifySource:(ref:string)=>ReadingRef):{
 scene:NativeCosmicScene;event:EpiMaterialInput['event'];clocks:CoupledClockReading;
 registers:Record<RegisterRole,RegisterMember[]>;form_material:EpiMaterialInput['form_material'];
 form_coordinate_ref:string;binding:Record<string,unknown>;
} {
 if(world?.schema!=='ql.scene-world/v1'||world.native_readback?.schema!=='ql.scene-source-reading/v1'||world.registers?.schema!=='ql.scene-register-catalogue/v1'||reading.availability!=='available')throw Error('The complete native scene world owner did not return an admitted reading.');
 const n=world.native_readback,s=world.scene;
 const b=world.binding,basis=world.basis;
 if(!basis||!b?.native_basis||!sameNative(basis,b.native_basis)||!sameNative(world.event,basis.input)||!sameNative(s,b.scene)||!sameNative(n,b.native_readback))throw Error('The native world must retain the actual completed basis consumed by the field, not its pre-material intent.');
 const voices=basis.derivation.sky_voices,modes=basis.m2_input.resonator?.modes;
 if(!voices||voices.length!==9||!modes||modes.length!==9||new Set(voices.map(v=>v.planet_ref)).size!==9||new Set(modes.map(m=>m.mode_ref)).size!==9||!Array.isArray(world.event.sky_frequency_bindings)||world.event.sky_frequency_bindings.length!==9)throw Error('The actual native receiving basis must retain all nine qualified planetary material voices.');
 for(const voice of voices){
  const mode=modes.find(mode=>mode.mode_ref===voice.mode_ref),body=s.bodies.find(body=>body.voice?.planet_ref===voice.planet_ref);
  if(!mode||!Number.isFinite(voice.frequency_hz)||voice.frequency_hz<=0||mode.frequency_hz!==voice.frequency_hz||body?.voice?.frequency_hz!==voice.frequency_hz)throw Error('A native material voice does not reach the actual composed M2 receiving mode and source body.');
 }
 for(const [owner,source] of Object.entries(world.native_owner_sources??{}))if(!source?.ref||!/^sha256:[0-9a-f]{64}$/.test(source.revision)||source.availability!=='available')throw Error(`The ${owner} constructor receipt has no exact native compiled-source qualification.`);
 if(!world.native_owner_sources?.constructor||!world.native_owner_sources.coupled||!world.native_owner_sources.field)throw Error('The native world must retain its actual constructor/coupled/field owner receipts.');
 if(world.registers.source_revision!==s.sources.sky_revision)throw Error('The numerical scene and native register catalogue come from different Bimba source cuts.');
 if(world.event_ref!==n.event_ref||world.subject_ref!==n.subject_ref||world.snapshot_ref!==s.snapshot_ref||world.sky.snapshot_ref!==s.snapshot_ref||world.event.m1.event_ref!==world.event_ref||world.event.m3.subject_ref!==world.subject_ref||world.event.m1.tick12!==s.m1.tick12||world.event.m1.cycle!==String(s.m1.cycle)||n.form.address!==s.form.codon||world.current_form.event_ref!==world.event_ref||world.current_form.subject_ref!==world.subject_ref)throw Error('The native world fields disagree about the single admitted event/person/sky/M1/M3 basis.');
 const event:EpiMaterialInput['event']={event_ref:world.event_ref,subject_ref:world.subject_ref,tick12:s.m1.tick12,cycle:s.m1.cycle,codon:s.form.codon,reading};
 const clocks:CoupledClockReading={owner:'ql-mef',reading,native_readback:n,event_ref:world.event_ref,subject_ref:world.subject_ref,snapshot_ref:world.snapshot_ref,tick12:s.m1.tick12,cycle:s.m1.cycle,codon:s.form.codon,a:{role:'inscription-circle',phase:n.continuous_clock.inscription},b:{role:'lens-circle',phase:n.continuous_clock.lensing},m1_pole:n.m1_clock,aperture:{index:n.selected_aperture.index,standing:'action-only-selection',reading}};
 assertCoupledClocks({scene:s,event,clocks});
 const row=(value:unknown):RegisterMember=>{
  const v=value as Record<string,unknown>,r=v?.reading as ReadingRef;
  if(!r||r.availability!=='available'||typeof v.title!=='string'||!Array.isArray(v.source_refs)||!['canonical','source-backed-correspondence'].includes(String(v.standing)))throw Error('The native register member has no exact source correspondence.');
  const source_refs=v.source_refs.map(ref=>typeof ref==='string'?qualifySource(ref):ref as ReadingRef);
  if(source_refs.some(ref=>!ref.ref||!ref.revision||ref.availability!=='available'))throw Error('A native register source pointer lacks its actual runtime source-cut qualification.');
  return{reading:r,...(typeof v.coordinate_ref==='string'?{coordinate_ref:v.coordinate_ref}:{}),title:v.title,source_refs,standing:v.standing as RegisterMember['standing'],...(v.display?{display:v.display as RegisterMember['display']}:{}),...(['fibonacci','void'].includes(String(v.role))?{ground:{role:v.role as 'fibonacci'|'void',positions:v.positions as number,quantum_degrees:v.quantum_degrees as number}}:{})};
 };
 const registers:Record<RegisterRole,RegisterMember[]>={degree:world.registers.degree.map(row),governor:world.registers.backbone.map(row),decan:world.registers.decan.map(row),codon:world.registers.codon.map(row),skin:world.registers.skin.map(row),aperture:world.registers.aperture.map(row)};
 const f=world.current_form;if(!f.triplet||!f.reading?.reading||f.process_subject_ref!==`ql:scene-form:${world.instance_ref}`||f.canonical_subject_ref!==f.current_reading?.ref||f.current_reading?.ref!==f.reading.reading.ref||f.current_reading.revision!==f.reading.reading.revision||f.current_reading.availability!=='available')throw Error('The native current form lacks its exact instance-owned process/current canonical reading/source glyph.');
 const formSources=[f.hexagram_reading,...(f.source_refs??[])];
 if(!f.source_refs?.length||formSources.some(source=>!source?.ref||!source.revision||source.availability!=='available'))throw Error('The current form has no qualified native codon/hexagram/manuscript source readings.');
 const form_material:EpiMaterialInput['form_material']={reading:f.current_reading,subject_ref:f.process_subject_ref,glyph:f.hexagram_glyph||f.triplet,source_refs:formSources,native_geometry:f.native_hinge};
 // Retained host envelope is strict; richer scene/readback members remain in
 // this native world reading rather than leaking into its binding parser.
 if(b.schema!=='oi.native-expression-binding/v1'||!b.host||!b.presentation)throw Error('The native world has no current retained-field binding.');
 return{scene:s,event,clocks,registers,form_material,form_coordinate_ref:f.coordinate_ref,binding:{schema:b.schema,host:b.host,presentation:b.presentation}};
}

/** Complete production assembly from actual owner responses. `coordinates`
 * is indexed by binding.coordinate_ref (# spelling), never canonical string.
 * Source and world revisions are recovered from the native responses.
 */
export async function prepareEpiMaterialInputFromNative(input:{
 document:ExpressionDocument;actor:string;authored_revision:string;world:NativeSceneWorldReading;world_reading:ReadingRef;
 coordinates:Readonly<Record<string,CoordinateSource>>;inventory_pages:readonly BimbaInventoryPage[];
 sky_subject:SubjectBinding;personal:PersonalInstance;qualifySource:(ref:string)=>ReadingRef;canvas:()=>HTMLCanvasElement;
}):Promise<EpiMaterialInput> {
 const world=sceneWorldFromNative(input.world,input.world_reading,input.qualifySource),inventory=inventoryFromNative(input.inventory_pages);
 if(input.world.instance_ref!==input.document.expression_ref||inventory.receipt.source_revision!==world.scene.sources.sky_revision)throw Error('The admitted world, native document and complete source inventory do not share one instance/Bimba source basis.');
 const get=(ref:string):CoordinateSource=>{const value=input.coordinates[ref];if(!value||value.reading.binding.coordinate_ref!==ref)throw Error(`The production constructor lacks exact native coordinate content for ${ref}.`);return value;};
 for(const coordinate of Object.values(input.coordinates))if(coordinate.reading.binding.rooted_world.registry_revision!==inventory.registry_revision||coordinate.identity.source_revision!==inventory.receipt.source_revision)throw Error('The material coordinate/full-content bindings disagree with the current native source inventory.');
 const roots:Record<RegisterRole,string>={degree:'#3-5-5/0',governor:'#3-5',decan:'#2-3',codon:'#3-2',skin:'#2-1',aperture:'#3-5'};
 const register=(role:RegisterRole)=>({source:get(roots[role]),members:world.registers[role],summary:role});
 const registers:EpiMaterialInput['registers']={degree:register('degree'),governor:register('governor'),decan:register('decan'),codon:register('codon'),skin:register('skin'),aperture:register('aperture')};
 const register_images=Object.fromEntries(await Promise.all(Object.entries(world.registers).map(async([role,members])=>[role,await rasterizeRegisterMaterialLosslessly(registerVectorMaterial(role as RegisterRole,members),input.canvas())]))) as EpiMaterialInput['register_images'];
 return{document:input.document,actor:input.actor,authored_revision:input.authored_revision,source_revision:inventory.receipt.source_revision,inventory:inventory.inventory,inventory_receipt:inventory.receipt,coordinates:input.coordinates,scene:world.scene,scene_reading:input.world_reading,native_owner_sources:Object.values(input.world.native_owner_sources),sky_subject:input.sky_subject,event:world.event,clocks:world.clocks,personal:input.personal,registers,register_images,torus:get('#1-5-1'),clock_source:get('#3-5'),locus:get('#4.4.4.4'),form:get(world.form_coordinate_ref),form_material:world.form_material,personal_branches:Array.from({length:6},(_,i)=>get(`#4.${i}`))};
}
export function requiredEpiWorldCoordinates(world:NativeSceneWorldReading):string[] {
 return[...new Set([world.scene.observer_ref,...world.scene.bodies.flatMap(b=>b.planet_ref?[b.planet_ref]:[]),'#1-5-1','#3-5','#3-5-5/0','#2-3','#3-2','#2-1','#4.4.4.4',...Array.from({length:7},(_,i)=>`#2-5-0/1-${i+1}`),...Array.from({length:6},(_,i)=>`#4.${i}`),world.current_form.coordinate_ref])];
}
