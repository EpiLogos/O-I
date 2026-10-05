/** Coordinate-bound authored material over admitted native readings.
 * Intended production location: field-studies-journeys/src/epiWorldMaterial.ts.
 * This module performs no graph, sky, quaternion, oscillator or clock computation.
 * It prepares real profile definitions and one bounded native Expression CAS.
 * The owner must commit/read back the plan before it is an installed Expression.
 */
import {blankScene,entity,clone,validateJourney,type Entity,type Scene,type Vec3} from './model.js';
import {kernelDocumentToJourney,type KernelConversion} from './kernelDocumentBridge.js';
import {CHAKRA_DEFINITIONS} from '../../src/engine/semantics/chakraSemantics.js';
import {makeFormation} from '../../src/engine/fieldModel.js';
import {validateCoordinateExpression,type CoordinateExpressionResult,type CoordinateProfile} from '../../../src/nara/coordinateExpression.js';
import type {Change,ExpressionDocument,ExpressionRequest,ReadingRef,SubjectBinding,Relation,Reuse} from '../../../src/expression/types.js';
import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent.js';

export const PERSONAL_LOCUS={coordinate:'#4.4.4.4',canonical:'ql:m-coordinate:bimba:M4.4.4.4',uuid:'dcb274c1-fbbc-5914-b27d-dea979c78558'} as const;
export const EPI_CLOCK_A_CAPTION='Gold circle and diamond. Advance one tick moves the M1/M3 source clocks by 30° and aligns Clock A with their new position.';
export const EPI_OLD_CLOCK_A_CAPTION='Gold circle and diamond. Advance one native tick to turn the inscription by 30°.';
export const EPI_WORLD_AUTHORED_REVISION='epi-world-20261001-v6';
/** Authored placement, distinct from every native source/clock reading. The
 * original 1020×819 encounter measured a 146.703125px introductory block; its
 * old .13-height separation from Earth was only 106.47px. The wider authored
 * gaps preserve the same five complete captions and typography. */
export const EPI_COSMIC_CAPTION_GEOMETRY={
 before_y:[.16,.29,.43,.56,.69],after_y:[.16,.36,.51,.67,.81],
 source:{ref:'material:epi-world:epi-world-20261001-v6:cosmic-caption-geometry',revision:EPI_WORLD_AUTHORED_REVISION,availability:'available' as const}
} as const;
/** One generated cohort owns both new material and exact legacy recognition.
 * Personal/branch captions keep their independent authored presentation. */
export function epiCosmicCaptionCohort(sceneRef:string,legacy=false):Scene['text']{
 const y=legacy?EPI_COSMIC_CAPTION_GEOMETRY.before_y:EPI_COSMIC_CAPTION_GEOMETRY.after_y;
 const caption={id:`${sceneRef}:caption`,visible:true,kicker:'Epi-Logos',title:'Cosmic field',italic:'',body:'Earth, played torus and seven centres share this geocentric occasion. Select a body to follow its source.',x:.045,y:y[0],width:230,size:21,align:'left' as const,role:'caption'};
 const labels=[
  ['earth','⊕ Earth · observer','The origin of this sky reading. Planetary positions retain their actual geocentric longitudes.'],
  ['clock-a','Clock A · inscription',EPI_CLOCK_A_CAPTION],
  ['clock-b','Clock B · lens','Blue circle and diamond. Its continuous phase is distinct from the selected reading aperture.'],
  ['register','Source registers','360 degrees · 24 governors · 36 decans\n64 codons · 72 skins · 18 aperture and ground readings']
 ] as const;
 return[caption,...labels.map(([role,title,body],index)=>({id:`${sceneRef}:label-${role}`,visible:true,kicker:'',title,italic:'',body,x:.045,y:y[index+1],width:230,size:15,align:'left' as const,role:`${role}.caption`}))];
}

/** Authored seven-centre mixture, recovered from the existing Kundalini
 * presentation. This is no native M2 coefficient; native driver frequencies,
 * shares and orientation remain owner readings. The shared resonator stays off. */
export const PERSONAL_WAVE_PRESENTATION={dominance:.25,source:{ref:'oi:source:desktop/cradle/expressions-app/src/engine/compositionPresets.ts#kundalini_focus',revision:'sha256:7d9b4328f38c7f3524add1c0b739907f447cbf8e7cdf0579a16d6b8c886dc826',availability:'available' as const}} as const;
export const BODY_NAMES=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'] as const;
export type SkyBodyName=typeof BODY_NAMES[number];
export type MaterialPurpose='earth'|'planet'|'torus'|'clock-a-ring'|'clock-a-hand'|'clock-b-ring'|'clock-b-hand'|'degree'|'governor'|'decan'|'codon'|'skin'|'centre'|'locus'|'form'|'form-hinge'|'aperture'|'branch';
export type RegisterRole='degree'|'governor'|'decan'|'codon'|'skin'|'aperture';
const REGISTER_COUNTS:Record<RegisterRole,number>={degree:360,governor:24,decan:36,codon:64,skin:72,aperture:18};
type SourceRelation=CoordinateExpressionResult['binding']['source_relations'][number];

export interface CoordinateSource {
 reading:CoordinateExpressionResult;
 /** Full, current source stays a reading; authored summaries never replace it. */
 identity:{coordinate:string;uuid:string;title:string;source_revision:string;full_source_ref:string;properties_sha256:string;properties:Record<string,unknown>};
 qualified_relations?:readonly {relation_ref:string;from_coordinate:string;to_coordinate:string;kind:string;orientation:'directed';properties:Record<string,unknown>;source_revision:string}[];
}
export interface CoordinateInventoryRow {
 coordinate:string;ql_coordinate?:string;identity:string;source_revision:string;full_source_ref:string;
 full_properties_ref:string;properties_sha256:string;[key:string]:unknown;
}
export interface RegisterMember {
 reading:ReadingRef;coordinate_ref?:string;title:string;source_refs:ReadingRef[];standing:'canonical'|'source-backed-correspondence';
 /** Native placements are supplied by the source owner. A source-order
  * overview is explicitly authored, and never a fixed canonical codon ring. */
 display?:{angle_degrees:number;label?:string;standing:'canonical'|'authored-source-order'};
 ground?:{role:'fibonacci'|'void';positions:number;quantum_degrees:number};
}
export interface RegisterMaterial {source:CoordinateSource;members:readonly RegisterMember[];summary:string;focused_scene_ref?:string}
export interface NativeSceneBody {
 body:SkyBodyName;planet_ref:string|null;longitude_deg:number;speed_deg_per_day:number;retrograde:boolean;
 seed:{degree_ref:string;decan_ref:string;pip_codon_ref:string;relations:string[];[key:string]:unknown};
 resonant_chakra_ref:string|null;decan_rulers:string[];
 voice:{planet_ref:string;frequency_hz:number;[key:string]:unknown}|null;
}
export interface NativeCosmicScene {
 schema:'ql.scene/v1';snapshot_ref:string;epoch_utc:string;observer_ref:string;
 m1:{tick12:number;cycle:number;root_hz:number;[key:string]:unknown};
 form:{codon:number;advanced_by:string};bodies:NativeSceneBody[];
 centres:{centre_ref:string;anatomy:unknown;receiving:string[]}[];
 sources:{registry_revision:string;sky_revision:string};[key:string]:unknown;
}
/** This is an application input port, NOT a fabricated ql schema.
 * It is filled by the native coupled constructor, with its original readback.
 * Current M3 deep-matrix §11 defines the successor T² as inscription-circle ×
 * lens-circle. Old ecliptic/Spanda wheels remain original-source provenance.
 * ql.scene/v1 alone cannot establish this coupled clock/event basis.
 */
export interface CoupledClockReading {
 owner:'ql-mef';reading:ReadingRef;native_readback:unknown;event_ref:string;subject_ref:string;snapshot_ref:string;
 tick12:number;cycle:number;codon:number;
 a:{role:'inscription-circle';phase:{turns:string;half_degrees:number}};
 b:{role:'lens-circle';phase:{turns:string;half_degrees:number}};
 /** M1 pole orientation is separate from the continuous rational driver. */
 m1_pole:{tick12:number;degree360:number;degree720:number};
 aperture:{index:number;standing:'action-only-selection';reading:ReadingRef};
}
export interface PersonalInstance {
 person:ReadingRef;identity:ReadingRef;instance_ref:string;nara_ref:string;event_ref:string;snapshot_ref:string;
 /** Protected native state is consumed by Nara; no state values enter material. */
 current?:ReadingRef;
 native_current?:NativeCurrentReading;
}
export interface EpiMaterialInput {
 document:ExpressionDocument;actor:string;authored_revision:string;source_revision:string;
 inventory:readonly CoordinateInventoryRow[];coordinates:Readonly<Record<string,CoordinateSource>>;
 inventory_receipt:{reading:ReadingRef;source_revision:string;node_count:number;relation_count:number;complete:true};
 scene:NativeCosmicScene;scene_reading:ReadingRef;native_owner_sources:readonly ReadingRef[];sky_subject:SubjectBinding;
 /** Exact real CoupledInput event; default-event/default-subject is refused. */
 event:{event_ref:string;subject_ref:string;tick12:number;cycle:number;codon:number;reading:ReadingRef};
 clocks:CoupledClockReading;personal:PersonalInstance;
 registers:Record<RegisterRole,RegisterMaterial>;
 torus:CoordinateSource;form:CoordinateSource;locus:CoordinateSource;clock_source:CoordinateSource;
 personal_branches:readonly CoordinateSource[];
 form_material:{reading:ReadingRef;subject_ref:string;glyph:string;source_refs:ReadingRef[];source?:Entity['source'];native_geometry?:unknown};
 /** Actual persisted image formation. Production uses rasterizeRegisterMaterial;
  * the canvas port permits controlled visual reference without a second engine. */
 register_images:Record<RegisterRole,Entity['source']>;
}
export interface BuiltOccurrence {role:string;purpose:MaterialPurpose;material:Entity;subject:SubjectBinding;coordinate:CoordinateSource|null;source_member?:{snapshot_ref:string;body:SkyBodyName};profile_ref:string}
export interface CoordinateDisposition {
 coordinate:string;native_coordinate:string;identity:string;source_revision:string;full_source_ref:string;full_properties_ref:string;properties_sha256:string;
 disposition:'scene-material'|'focused-source';entity_refs:string[];
 route:({kind:'coordinate';coordinate_ref:string;face:'bimba'}|{kind:'source';reading:ReadingRef})&{return_scene_ref:string;standing:'prepared-route'};
}
export interface NativeReceivingDeclaration {
 expression_ref:string;basis_revision:number;scene_ref:string;event_ref:string;subject_ref:string;snapshot_ref:string;
 torus:{entity_ref:string;subject_ref:string;native_constituent:'#1-5-1';sampling:'whole-domain-stratified';units_per_metre:120};
 preserve_authored_entity_refs:string[];preserve_density_w:true;preserve_connection_and_padding:true;
 personal:{locus_entity_ref:string;canonical_locus:string;person:ReadingRef;identity:ReadingRef;instance_ref:string;current:ReadingRef|null;standing:'awaiting-native-current'|'qualified-native-current';centre_entity_refs:string[];participant_entity_refs:string[]};
}
export interface EpiWorldMaterialPlan {
 standing:'prepared-native-edit';definitions:ExpressionRequest[];edit:Extract<ExpressionRequest,{operation:'edit'}>;
 scenes:Scene[];occurrences:BuiltOccurrence[];dispositions:CoordinateDisposition[];receiving:NativeReceivingDeclaration;
 register_members:Record<RegisterRole,readonly RegisterMember[]>;
 form_material:EpiMaterialInput['form_material'];
 source_basis:{source_revision:string;registry_revision:string;numerical_registry_revision:string;numerical_source_revision:string;native_owner_sources:readonly ReadingRef[];scene:ReadingRef;event:ReadingRef;clocks:ReadingRef};
 reuse:Reuse;
}
const available=(r:ReadingRef,name:string)=>{if(!r||r.availability!=='available'||!r.ref||!r.revision)throw Error(`${name} has no current native reading.`);};
const equal=(a:unknown,b:unknown):boolean=>JSON.stringify(a,sort)===JSON.stringify(b,sort);
function sort(_k:string,v:unknown):unknown{return v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v;}
function finite(value:number,label:string){if(!Number.isFinite(value))throw Error(`${label} is not finite.`);return value;}
function safePart(value:string):string {if(!/^[a-zA-Z0-9_.:-]{1,120}$/.test(value))throw Error('The Expression instance ref is not an admitted native ref.');return value;}
const canonical=(source:CoordinateSource)=>validateCoordinateExpression(source.reading).subject_binding.subject_ref;
function checkSource(source:CoordinateSource,revision:string,registry:string):void {
 const r=validateCoordinateExpression(source.reading),i=source.identity;
 if(r.binding.face!=='bimba'||i.source_revision!==revision||r.binding.rooted_world.registry_revision!==registry||!i.uuid||!i.title||!i.full_source_ref)throw Error('Coordinate identity/source/current registry disagree.');
 if(!r.binding.property_sources.some(p=>p.source_revision===revision))throw Error(`The coordinate ${r.binding.coordinate_ref} has no qualified current property source.`);
 if(!r.binding.property_sources.some(p=>p.record.payload_sha256===i.properties_sha256&&p.source_revision===revision))throw Error('Full expressive property content is disconnected from the native coordinate source payload.');
 if(i.properties.c_2_uuid!==i.uuid)throw Error('The full coordinate property identity disagrees with the source UUID.');
}
export function assertPersonalLocus(source:CoordinateSource):void {
 const r=validateCoordinateExpression(source.reading);
 if(r.binding.coordinate_ref!==PERSONAL_LOCUS.coordinate||r.subject_binding.subject_ref!==PERSONAL_LOCUS.canonical||source.identity.coordinate!=='M4.4.4.4'||source.identity.uuid!==PERSONAL_LOCUS.uuid||source.identity.properties.c_2_uuid!==PERSONAL_LOCUS.uuid||!equal(r.binding.branch_path,['#4.4','#4.4.4','#4.4.4.4']))throw Error('Personal Pratibimba requires the exact M4.4.4.4 locus and ancestry, not a same-labelled branch.');
 const relations=r.binding.source_relations;
 for(const [kind,from,to] of [['CONTAINS_REFLECTION_SPACE','#4.4.4','#4.4.4.4'],['FLOWS_TO','#4.4.4.3','#4.4.4.4'],['FLOWS_TO','#4.4.4.4','#4.4.4.5'],['REFLECTS_FOUNDATION','#4.4.4.4','#0']] as const){
  if(!relations.some(x=>x.class==='bimba-source'&&x.orientation==='directed'&&x.source_kind===kind&&x.from_ref===from&&x.to_ref===to))throw Error(`Personal Pratibimba is missing the source-qualified ${kind} relation.`);
 }
}
export function assertCoupledClocks(input:Pick<EpiMaterialInput,'scene'|'event'|'clocks'>):void {
 const {scene,event,clocks:c}=input;
 if(!c||c.owner!=='ql-mef'||!c.native_readback||c.a?.role!=='inscription-circle'||c.b?.role!=='lens-circle')throw Error('The current native inscription/lens T² successor clock readback is missing.');
 available(c.reading,'Coupled clock');available(event.reading,'Event');
 if(/default-(event|subject)/.test(event.event_ref+' '+event.subject_ref)||!event.event_ref||!event.subject_ref)throw Error('A default field event cannot stand in for the actual cosmic/personal occasion.');
 if(c.event_ref!==event.event_ref||c.subject_ref!==event.subject_ref||c.snapshot_ref!==scene.snapshot_ref||c.tick12!==scene.m1.tick12||c.cycle!==scene.m1.cycle||c.codon!==scene.form.codon||event.tick12!==c.tick12||event.cycle!==c.cycle||event.codon!==c.codon)throw Error('The coupled clocks, scene and actual event do not share their native M1/M3/sky basis.');
 for(const phase of [c.a.phase,c.b.phase])if(!phase||!/^\d{1,20}$/.test(phase.turns)||!Number.isSafeInteger(phase.half_degrees)||phase.half_degrees<0||phase.half_degrees>=720)throw Error('The native continuous circle phase is not an exact half-degree readback.');
 if(c.m1_pole?.tick12!==c.tick12||c.m1_pole.degree360!==c.tick12*30||!Number.isSafeInteger(c.m1_pole.degree720)||c.m1_pole.degree720<0||c.m1_pole.degree720>=720)throw Error('M1 pole orientation must retain the native one-tick = 30° source law separately from continuous phase.');
 if(c.aperture?.standing!=='action-only-selection'||!Number.isSafeInteger(c.aperture.index)||c.aperture.index<0||c.aperture.index>=16)throw Error('The selected static aperture must remain an action-only index 0–15; two ground readings complete the 18-member display.');
 available(c.aperture.reading,'Selected aperture');
}
/** Called again after the material CAS and protected pin; preparation can
 * precede that pin without claiming a live personal computational effect. */
export function qualifyPersonalCurrent(personal:PersonalInstance,expressionRef:string,snapshotRef:string):ReadingRef|null {
 if(!personal.native_current&&!personal.current)return null;
 const current=personal.native_current;
 if(!personal.current||!current)throw Error('The personal current needs both its exact reading ref and actual protected owner output.');
 available(personal.current,'Protected personal current');
 if(current.schema!=='oi.nara-personal-current-context/v1'||current.status!=='available'||current.private!==true||current.public_export!==false||current.expression_ref!==expressionRef||current.nara_ref!==personal.nara_ref||current.context?.event_ref!==personal.event_ref||current.context.identity_source_ref!==personal.identity.ref||current.context.identity_revision!==personal.identity.revision||current.context.reading_ref!==personal.current.ref||current.context.reading_revision!==personal.current.revision||current.reading?.identity.person_ref!==personal.person.ref||current.reading.transit.sky?.snapshot_ref!==snapshotRef)throw Error('The actual protected personal current does not share this saved identity, Expression and exact cosmic occasion.');
 if(current.reading.activity_status==='unavailable'&&(current.reading.q_activity!==null||current.reading.q_composed!==null))throw Error('Unavailable activity must remain null; identity/transit is not a fabricated three-input composition.');
 return clone(personal.current);
}

/** Personal participation supplements the shared canonical subject. Private
 * owner values remain outside portable material; only admitted reading refs
 * enter its native binding. This one operation also serves later correction. */
export function bindPersonalParticipation(subject:SubjectBinding,previous:PersonalInstance|null,next:PersonalInstance,current:ReadingRef|null):SubjectBinding {
 const binding=clone(subject),oldRefs=new Set(previous?[previous.person.ref,previous.identity.ref,...(previous.current?[previous.current.ref]:[])]:[]);
 const retain=(readings:ReadingRef[])=>readings.filter(r=>!oldRefs.has(r.ref));
 const append=(readings:ReadingRef[],added:ReadingRef[])=>[...readings,...added.filter(r=>!readings.some(old=>equal(old,r)))].map(r=>clone(r));
 binding.sources=append(retain(binding.sources),[next.person,next.identity]);
 binding.readings=append(retain(binding.readings),current?[current]:[]);
 if(previous){
  binding.actions=binding.actions.flatMap(action=>{
   const target=action.target_ref===previous.identity.ref?next.identity.ref:previous.current&&action.target_ref===previous.current.ref?current?.ref:null;
   if(previous.current&&action.target_ref===previous.current.ref&&!current)return[];
   return[{...action,...(target?{target_ref:target}:{})}];
  });
 }
 return binding;
}

/** Rebind a correction to the SAME saved world. The only native changes are
 * subject bindings, so selected deck, continuing journey and authored scene
 * material survive. The caller pins the actual next owner current first and
 * persists the returned receiving metadata in its existing native CAS. */
export function rebindEpiPersonalSubjects(input:{document:ExpressionDocument;receiving:NativeReceivingDeclaration;previous:PersonalInstance;next:PersonalInstance;actor:string}):{edit:Extract<ExpressionRequest,{operation:'edit'}>;receiving:NativeReceivingDeclaration} {
 const {document,receiving,previous,next}=input;
 available(next.person,'Corrected person');available(next.identity,'Corrected identity');
 if(receiving.expression_ref!==document.expression_ref||receiving.personal.instance_ref!==document.expression_ref||previous.instance_ref!==document.expression_ref||next.instance_ref!==document.expression_ref||!equal(previous.person,receiving.personal.person)||!equal(previous.identity,receiving.personal.identity)||!equal(previous.current??null,receiving.personal.current)||previous.person.ref!==receiving.subject_ref||previous.person.ref!==next.person.ref||next.person.ref===PERSONAL_LOCUS.canonical||next.identity.ref===PERSONAL_LOCUS.canonical||previous.nara_ref!==next.nara_ref||!next.nara_ref||previous.event_ref!==receiving.event_ref||next.event_ref!==receiving.event_ref||previous.snapshot_ref!==receiving.snapshot_ref||next.snapshot_ref!==receiving.snapshot_ref)throw Error('Personal correction must retain the actual person, Expression instance and single occasion.');
 const current=qualifyPersonalCurrent(next,document.expression_ref,receiving.snapshot_ref);
 const locus=document.entities[receiving.personal.locus_entity_ref];
 if(receiving.personal.canonical_locus!==PERSONAL_LOCUS.canonical||locus?.subject?.subject_ref!==PERSONAL_LOCUS.canonical||locus.subject.native_owner!=='ql-mef')throw Error('The saved Personal Pratibimba locus is a same-labelled wrong branch.');
 const expectedCentres=Array.from({length:7},(_,i)=>`ql:m-coordinate:bimba:M2-5-0/1-${i+1}`);
 if(receiving.personal.centre_entity_refs.length!==7||new Set(receiving.personal.centre_entity_refs).size!==7)throw Error('Personal correction requires the exact seven saved centre subjects.');
 for(let index=0;index<7;index++)if(document.entities[receiving.personal.centre_entity_refs[index]]?.subject?.subject_ref!==expectedCentres[index])throw Error('A personal centre was replaced with a same-labelled wrong coordinate.');
 const refs=receiving.personal.participant_entity_refs;
 if(!refs||new Set(refs).size!==refs.length||!refs.includes(locus.entity_ref)||receiving.personal.centre_entity_refs.some(ref=>!refs.includes(ref)))throw Error('The actual personal participant subjects are incomplete.');
 const allowed=new Set([PERSONAL_LOCUS.canonical,'ql:m-coordinate:bimba:M2-5-0/1-0',...expectedCentres,...Array.from({length:6},(_,i)=>`ql:m-coordinate:bimba:M4.${i}`)]),changes:Change[]=[];
 if(refs.length!==allowed.size||new Set(refs.map(ref=>document.entities[ref]?.subject?.subject_ref)).size!==allowed.size)throw Error('Personal correction requires each exact participant subject once, preserving the six branch entrances.');
 for(const entity_ref of refs){
  const subject=document.entities[entity_ref]?.subject;
  if(!subject||subject.native_owner!=='ql-mef'||!allowed.has(subject.subject_ref)||!subject.sources.some(s=>equal(s,previous.person))||!subject.sources.some(s=>equal(s,previous.identity)))throw Error('A participant subject lost its exact canonical or saved personal binding.');
  changes.push({change:'subject_bind',entity_ref,binding:bindPersonalParticipation(subject,previous,next,current)});
 }
 const updated=clone(receiving);updated.personal.person=clone(next.person);updated.personal.identity=clone(next.identity);updated.personal.current=current;updated.personal.standing=current?'qualified-native-current':'awaiting-native-current';
 return{edit:{operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:input.actor,changes},receiving:updated};
}

/** Authored polar placement only: native longitude remains the determinant.
 * Zero is top and increasing ecliptic longitude runs clockwise. Radius, depth
 * and glyph size are presentation choices, never an orbit-distance model.
 */
export function longitudePose(longitude:number,radius:number,z=0):Vec3 {
 const angle=finite(longitude,'Native longitude')*Math.PI/180;
 return{x:radius*Math.sin(angle),y:radius*Math.cos(angle),z};
}
/** Exact current mantra/yantra source controls the subject's form. Translating
 * the source's Roman mantra into its retained Sanskrit glyph, the palette and
 * compact yantra drawing are authored presentation. Crown silence is not OM.
 */
export function centrePresentationFromSource(source:CoordinateSource):{name:string;glyph:string;mantra:string;yantra:string;anatomy:string} {
 const p=source.identity.properties,mantra=p.l_2_mantra_signature,yantra=p.c_1_yantra_form,anatomy=p.c_2_anatomical_location;
 if(typeof mantra!=='string'||typeof yantra!=='string'||typeof anatomy!=='string'||!mantra||!yantra||!anatomy)throw Error('The personal centre needs its full current native mantra, yantra and anatomy sources.');
 const glyphs:Record<string,string>={LAM:'लं',VAM:'वं',RAM:'रं',YAM:'यं',HAM:'हं',OM:'ॐ'};
 const glyph=mantra.startsWith('Silence beyond sound')?'✧':glyphs[mantra.split(/[\s-]/)[0]];
 if(!glyph)throw Error('This native mantra has no authored glyph correspondence; retain its source before presenting a substitute.');
 return{name:source.identity.title,glyph,mantra,yantra,anatomy};
}
export interface RegisterVectorMark {index:number;member:ReadingRef;angle_degrees:number;placement_standing:'canonical'|'authored-source-order';x0:number;y0:number;x1:number;y1:number;label:string}
export interface RegisterVectorMaterial {role:RegisterRole;count:number;size:1024;marks:RegisterVectorMark[];grounds:{index:number;member:ReadingRef;radius:number;positions:number;quantum_degrees:number;label:string}[];source_members:readonly RegisterMember[]}
/** Reusable source-member vector grammar. Geometry is authored over exact
 * source membership; only explicitly source-supplied placements are canonical. */
export function registerVectorMaterial(role:RegisterRole,members:readonly RegisterMember[]):RegisterVectorMaterial {
 if(members.length!==REGISTER_COUNTS[role]||new Set(members.map(m=>m.reading.ref)).size!==members.length)throw Error(`Incomplete ${role} source register.`);
 const grounds:RegisterVectorMaterial['grounds']=[];
 const marks=members.map((member,index):RegisterVectorMark=>{
  available(member.reading,'Register member');
  const angle=member.ground?0:member.display?.angle_degrees??index*360/members.length,a=finite(angle,'Register display angle')*Math.PI/180;
  const major=role==='degree'?index%30===0:true;let r0=major?397:418,r1=447;
  if(member.ground){const g=member.ground;if(role!=='aperture'||!Number.isSafeInteger(g.positions)||g.positions<1||!Number.isFinite(g.quantum_degrees)||g.quantum_degrees<=0)throw Error('Ground display requires the actual native ground register.');const radius=g.role==='fibonacci'?288:342;grounds.push({index,member:member.reading,radius,positions:g.positions,quantum_degrees:g.quantum_degrees,label:g.role==='fibonacci'?'Fibonacci ground':'Void ring'});r0=radius-10;r1=radius+10;}
  const triplet=role==='codon'?member.title.match(/^Codon[_ ]([ACGT]{3})$/)?.[1]:undefined;
  let label=member.display?.label??triplet??(members.length<=72?String(index+1):'');
  // Compact authored entrances preserve full source titles in the member.
  if(role==='degree')label=major?String(angle):'';
  if(role==='decan'){const decan=member.title.match(/^(.+) Decan ([1-3])$/);if(decan)label=decan[1].slice(0,3)+decan[2];}
  if(role==='skin')label=index%6===0?member.title.split(' · ')[0].slice(0,10):'';
  if(member.ground)label='';
  if(label.length>12)label=String(index+1);
  return{index,member:clone(member.reading),angle_degrees:angle,placement_standing:member.display?.standing??'authored-source-order',x0:512+r0*Math.sin(a),y0:512-r0*Math.cos(a),x1:512+r1*Math.sin(a),y1:512-r1*Math.cos(a),label};
 });return{role,count:members.length,size:1024,marks,grounds,source_members:members};
}
/** Production browser Canvas → ordinary PNG image formation. SVG is not an
 * admitted native image source; the PNG is persisted in the Scene material. */
export function rasterizeRegisterMaterial(vector:RegisterVectorMaterial,canvas:HTMLCanvasElement):Entity['source'] {
 canvas.width=vector.size;canvas.height=vector.size;const c=canvas.getContext('2d');if(!c)throw Error('Register raster material requires an actual 2D canvas.');
 c.clearRect(0,0,1024,1024);c.strokeStyle='#ffffff';c.fillStyle='#ffffff';c.lineWidth=vector.role==='degree'?3:4;
 c.beginPath();c.arc(512,512,445,0,Math.PI*2);c.stroke();c.font=vector.count>72?'20px sans-serif':'19px sans-serif';c.textAlign='center';c.textBaseline='middle';
 for(const mark of vector.marks){c.beginPath();c.moveTo(mark.x0,mark.y0);c.lineTo(mark.x1,mark.y1);c.stroke();if(mark.label){const a=mark.angle_degrees*Math.PI/180;c.fillText(mark.label,512+475*Math.sin(a),512-475*Math.cos(a));}}
 for(const ground of vector.grounds){c.beginPath();c.arc(512,512,ground.radius,0,Math.PI*2);c.stroke();for(let i=0;i<ground.positions;i++){const a=i*ground.quantum_degrees*Math.PI/180;c.beginPath();c.moveTo(512+(ground.radius-8)*Math.sin(a),512-(ground.radius-8)*Math.cos(a));c.lineTo(512+(ground.radius+8)*Math.sin(a),512-(ground.radius+8)*Math.cos(a));c.stroke();}c.fillText(ground.label,512,512+ground.radius-28);}
 // Silhouette intentionally fills closed outlines. These images are source
 // marks and text, so luminance must preserve their separate strokes rather
 // than replacing the complete register with one filled circular cloud.
 return{kind:'image',image:{dataUrl:canvas.toDataURL('image/png'),mode:'luminance',threshold:.1,scale:1,invert:false,name:`${vector.role} · ${vector.count} source members`}};
}
/** Lossless PNG storage for the actual grayscale register canvas. Enumerating
 * exact grayscale/alpha tuples preserves antialiasing and transparency;
 * no threshold, palette quantisation or source geometry is changed here. */
export async function encodeRegisterMaskPNG(canvas:HTMLCanvasElement):Promise<string> {
 const c=canvas.getContext('2d');if(!c||canvas.width!==1024||canvas.height!==1024)throw Error('Register PNG encoding requires its actual 1024px canvas.');
 if(typeof CompressionStream==='undefined')throw Error('Lossless register PNG encoding requires the native browser compression stream.');
 const pixels=c.getImageData(0,0,canvas.width,canvas.height).data,tuples=new Set<number>();
 for(let p=0;p<pixels.length;p+=4){if(pixels[p]!==pixels[p+1]||pixels[p]!==pixels[p+2])throw Error('Register PNG encoding refuses coloured pixels rather than changing their channels.');tuples.add((pixels[p]<<8)|pixels[p+3]);}
 // A palette enumerates actual samples, rather than finding nearest colours.
 // More than 256 exact tuples use PNG's direct grayscale/alpha representation.
 const indexed=tuples.size<=256,palette=[...tuples].sort((a,b)=>a-b),indexes=new Map(palette.map((tuple,index)=>[tuple,index]));
 const bytesPerPixel=indexed?1:2,rowBytes=1+canvas.width*bytesPerPixel,scanlines=new Uint8Array(rowBytes*canvas.height);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  const p=(y*canvas.width+x)*4,out=y*rowBytes+1+x*bytesPerPixel;
  if(indexed)scanlines[out]=indexes.get((pixels[p]<<8)|pixels[p+3])!;else{scanlines[out]=pixels[p];scanlines[out+1]=pixels[p+3];}
 }
 // PNG row filters are reversible byte differences. Choose the smallest
 // signed residual sum for compression, retaining the complete samples.
 const filtered=new Uint8Array(scanlines.length),candidate=new Uint8Array(rowBytes-1),best=new Uint8Array(rowBytes-1);
 for(let y=0;y<canvas.height;y++){
  let bestScore=Infinity,bestFilter=0;const start=y*rowBytes+1,previous=start-rowBytes;
  for(let filter=0;filter<5;filter++){
   let score=0;
   for(let i=0;i<candidate.length;i++){
    const left=i>=bytesPerPixel?scanlines[start+i-bytesPerPixel]:0,up=y?scanlines[previous+i]:0,upperLeft=y&&i>=bytesPerPixel?scanlines[previous+i-bytesPerPixel]:0;
    let predictor=0;if(filter===1)predictor=left;else if(filter===2)predictor=up;else if(filter===3)predictor=Math.floor((left+up)/2);else if(filter===4){const p=left+up-upperLeft,a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upperLeft);predictor=a<=b&&a<=c?left:b<=c?up:upperLeft;}
    const difference=(scanlines[start+i]-predictor)&255;candidate[i]=difference;score+=Math.min(difference,256-difference);
   }
   if(score<bestScore){bestScore=score;bestFilter=filter;best.set(candidate);}
  }
  filtered[y*rowBytes]=bestFilter;filtered.set(best,start);
 }
 const compressed=new Uint8Array(await new Response(new Blob([filtered]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 const chunk=(type:string,data:Uint8Array):Uint8Array=>{
  const bytes=new Uint8Array(data.length+12),view=new DataView(bytes.buffer);view.setUint32(0,data.length);
  for(let i=0;i<4;i++)bytes[4+i]=type.charCodeAt(i);bytes.set(data,8);
  let crc=0xffffffff;for(let i=4;i<bytes.length-4;i++){crc^=bytes[i];for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(bytes.length-4,(crc^0xffffffff)>>>0);return bytes;
 };
 const header=new Uint8Array(13),headerView=new DataView(header.buffer);headerView.setUint32(0,canvas.width);headerView.setUint32(4,canvas.height);header[8]=8;header[9]=indexed?3:4;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header)];
 if(indexed){const colours=new Uint8Array(palette.length*3),alphas=new Uint8Array(palette.length);palette.forEach((tuple,index)=>{colours.fill(tuple>>>8,index*3,index*3+3);alphas[index]=tuple&255;});parts.push(chunk('PLTE',colours),chunk('tRNS',alphas));}
 parts.push(chunk('IDAT',compressed),chunk('IEND',new Uint8Array()));
 const bytes=new Uint8Array(parts.reduce((size,part)=>size+part.length,0));let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 const encoded:string[]=[];for(let i=0;i<bytes.length;i+=32768)encoded.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return'data:image/png;base64,'+btoa(encoded.join(''));
}
/** Same authored drawing and native image metadata, with bounded lossless
 * grayscale/alpha storage for the production persisted scene. */
export async function rasterizeRegisterMaterialLosslessly(vector:RegisterVectorMaterial,canvas:HTMLCanvasElement):Promise<Entity['source']> {
 const source=rasterizeRegisterMaterial(vector,canvas);if(!source||source.kind!=='image')throw Error('Register raster material must be an image.');
 return{...source,image:{...source.image,dataUrl:await encodeRegisterMaskPNG(canvas)}};
}
export function selectRegisterMember(plan:EpiWorldMaterialPlan,role:RegisterRole,index:number):{reading:ReadingRef;sources:ReadingRef[];coordinate_request:{coordinate_ref:string;face:'bimba'}|null;return_scene_ref:string} {
 if(!Number.isSafeInteger(index)||index<0||index>=plan.register_members[role].length)throw Error('Select an actual source register member.');
 const member=plan.register_members[role][index];available(member.reading,'Selected register member');
 return{reading:clone(member.reading),sources:clone([...member.source_refs]),coordinate_request:member.coordinate_ref?{coordinate_ref:member.coordinate_ref,face:'bimba'}:null,return_scene_ref:plan.receiving.scene_ref};
}
/** Hit against actual supplied/authored mark angles, preserving unequal
 * source placements. The UI invokes the exact native member route above. */
export function registerMemberAtAngle(plan:EpiWorldMaterialPlan,role:RegisterRole,degrees:number):number {
 const vector=registerVectorMaterial(role,plan.register_members[role]);let best=Infinity,selected=-1;
 for(const mark of vector.marks){const distance=Math.abs(((degrees-mark.angle_degrees+540)%360)-180);if(distance<best){best=distance;selected=mark.index;}}return selected;
}
export function registerMemberAtPoint(plan:EpiWorldMaterialPlan,role:RegisterRole,x:number,y:number):number {
 const vector=registerVectorMaterial(role,plan.register_members[role]),radius=Math.hypot(x-512,y-512);
 const ground=vector.grounds.find(g=>Math.abs(radius-g.radius)<12);if(ground)return ground.index;
 const degrees=(Math.atan2(x-512,512-y)*180/Math.PI+360)%360;return registerMemberAtAngle(plan,role,degrees);
}
function material(ref:string,name:string,text:string,purpose:MaterialPurpose,position:Vec3,size:number,tint:string):Entity {
 const e=entity(name,text,position);e.id=ref;e.sequence.steps[0].id=`${ref}:step`;e.role=purpose.replaceAll('-','.');
 e.size={x:size,y:size};e.tint=tint;e.tintWeight=1;e.force={kind:'none',strength:0,radius:.2,spin:0};
 e.locked=false;e.enabled=true;e.share=purpose==='torus'?4:purpose==='planet'?2.2:purpose==='centre'?2:purpose==='earth'?5:purpose.endsWith('-ring')?3.5:purpose.endsWith('-hand')?1.4:1;
 if(['clock-a-ring','clock-b-ring','degree','governor','decan','codon','skin','aperture'].includes(purpose))e.shape='ring';
 if(purpose==='earth')e.shape='disc';
 return e;
}
/** Body construction consumes the ten actual native scene members. It never
 * substitutes a nine-voice list for the geocentric sky body inventory.
 */
export function constructCosmicBodies(scene:NativeCosmicScene,source:(ref:string)=>CoordinateSource,skySubject:SubjectBinding,refPrefix:string):BuiltOccurrence[] {
 if(scene.schema!=='ql.scene/v1'||scene.bodies.length!==10||new Set(scene.bodies.map(b=>b.body)).size!==10||BODY_NAMES.some(name=>!scene.bodies.some(b=>b.body===name)))throw Error('The native cosmic scene must retain all ten source sky bodies.');
 available(skySubject.sources[0],'Sky snapshot');
 // sky_revision qualifies the Bimba numerical projection, while the dated
 // provider snapshot has its own native content receipt. Never stamp the map
 // revision onto that independent sky source.
 if(skySubject.subject_ref!==scene.snapshot_ref||skySubject.native_owner!=='ql-mef'||!skySubject.sources.some(r=>r.ref===scene.snapshot_ref&&r.availability==='available'&&!!r.revision))throw Error('The sky body occurrence has no exact admitted snapshot subject.');
 const earthSource=source(scene.observer_ref);
 const earthMaterial=material(`${refPrefix}-earth`,'Earth · observer','⊕','earth',{x:0,y:0,z:.02},.34,'#edf5e7');earthMaterial.shape='text';
 const earth:BuiltOccurrence={role:'earth',purpose:'earth',material:earthMaterial,subject:clone(earthSource.reading.subject_binding),coordinate:earthSource,profile_ref:''};
 const glyphs:Record<SkyBodyName,string>={Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇'};
 const colours:Record<SkyBodyName,string>={Sun:'#eac982',Moon:'#deded7',Mercury:'#a6d1c6',Venus:'#d5b4a4',Mars:'#d78870',Jupiter:'#cab287',Saturn:'#adb299',Uranus:'#89bcc9',Neptune:'#939bc8',Pluto:'#b39ac2'};
 const rows=BODY_NAMES.map((name,index):BuiltOccurrence=>{
  const b=scene.bodies.find(body=>body.body===name)!;finite(b.longitude_deg,`${name} longitude`);
  const coordinate=b.planet_ref?source(b.planet_ref):null;
  if(name!=='Uranus'&&!coordinate)throw Error(`The native ${name} body lost its coordinate binding.`);
  if(name==='Uranus'&&(b.planet_ref!==null||b.voice!==null))throw Error('Uranus standing changed; explicitly reconcile its source mapping instead of silently assuming an unvoiced body.');
  if(b.voice&&(b.voice.planet_ref!==b.planet_ref||!Number.isFinite(b.voice.frequency_hz)))throw Error('The native body voice/source disagree.');
  const e=material(`${refPrefix}-planet-${name.toLowerCase()}`,name,glyphs[name],'planet',longitudePose(b.longitude_deg,.82+index*.048,.08),name==='Sun'?.18:.15,colours[name]);
  // Pitch is exact native readback. Sound is quiet until a deliberate play act.
  if(b.voice)e.sound={enabled:false,frequencyHz:b.voice.frequency_hz,followCymatic:false,gain:.08,waveform:'sine',attack:.02,release:.15,pan:0};
  return{role:`planet.${name.toLowerCase()}`,purpose:'planet',material:e,subject:coordinate?clone(coordinate.reading.subject_binding):clone(skySubject),coordinate,source_member:{snapshot_ref:scene.snapshot_ref,body:name},profile_ref:''};
 });return[earth,...rows];
}
function reusableMaterial(e:Entity):Record<string,unknown>{
 // Occasion pitch and instance identities belong to the live occurrence;
 // portable inherited grammar must be reusable for a second person/event.
 const {id:_,position:__,role:___,overrides:____,sound:_____,...rest}=clone(e);
 rest.sequence.steps=rest.sequence.steps.map((step,index)=>({...step,id:`material-step-${index}`}));
 if(rest.native)delete (rest.native as unknown as Record<string,unknown>).id;
 return rest;
}
/** Matches current native profile inheritance: first parent, key replacement.
 * A rich `material` is one value; the kernel does not deep-merge its fields.
 */
export function resolveMaterialDefaults(profiles:readonly CoordinateProfile[],profileRef:string):Record<string,unknown>{
 const byRef=new Map(profiles.map(p=>[p.profile_ref,p])),seen=new Set<string>();
 const walk=(ref:string,depth:number):Record<string,unknown>=>{
  if(depth>8||seen.has(ref))throw Error('The authored material lineage exceeds the native depth/cycle guard.');
  const p=byRef.get(ref);if(!p)throw Error(`The material profile ${ref} is absent.`);seen.add(ref);
  const inherited=p.parent_profile_refs[0]?walk(p.parent_profile_refs[0],depth+1):{};
  const defaults=p.material_defaults as Record<string,{value:unknown}>|undefined;
  return{...inherited,...Object.fromEntries(Object.entries(defaults??{}).map(([k,v])=>[k,clone(v.value)]))};
 };return walk(profileRef,1);
}
function authoredProfile(ref:string,title:string,parent:string|null,basis:ReadingRef,defaults:Record<string,unknown>,seeds:{role:string;title:string}[]):CoordinateProfile {
 return{profile_ref:ref,revision:1,title,parent_profile_refs:parent?[parent]:[],accepted_binding_kinds:['engine_composition','glyph_form','text_source','image_media'],accepted_native_owners:['ql-mef','expressions'],material_defaults:Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,{value,automation:null}])),formation_vocabulary:['text','ring','disc','triangle','cymatic','yantra'],target_rules:{glyph_form:{formation:'text',text:null},text_source:{formation:'text',text:null}},automation_defaults:{},permitted_parameter_domains:{share:{min:0,max:1000}},scene_seeds:seeds,framing_note:'Authored geocentric hierarchy. Native source determines subject, sky and clock state; radius, colour, glyph and density are presentation.',fallback_policy:'preview',provenance:[basis]};
}
function sceneMaterial(ref:string,title:string,entities:Entity[],description:string):Scene {
 const s=blankScene(title);s.id=ref;s.character=description;s.duration=3600;s.transition=.4;s.entities=entities;
 s.field.background='#10191c';s.field.palette=['#d8dfd4','#799caa'];s.field.material='round';
 Object.assign(s.field.params,{count:112000,size:2.15,opacity:.96,dispersion:.004,turbulence:.018,speed:.45,frequency:220});
 Object.assign(s.engine,{inkMode:'whiteOnBlack',autoOscillate:false,morphEnabled:false,resonanceEnabled:false,relationalEnabled:false,grainProfile:false,autoFitSizes:false,volumeEnabled:false,pointerClick:'off'});
 // Camera angles are radians. Keep the authored eight-degree depth reading
 // close to the geocentric face, rather than turning it almost edge-on.
 // Scene pan is a viewport fraction; the ordinary loader converts it to pixels.
 s.view={mode:'3d',yaw:0,pitch:8*Math.PI/180,zoom:.45,panX:0,panY:.01,nativeScaffold:'off'};
 s.composition={layout:'free',plane:'XY',focus:'parallel',focusDuration:4,carryTint:true,carryStation:false,frequencyDriver:'manual'};
 s.text=[{id:`${ref}:caption`,visible:true,kicker:'Epi-Logos',title,italic:'',body:description,x:.045,y:.16,width:230,size:21,align:'left',role:'caption'}];
 return s;
}

export function buildEpiWorldMaterial(input:EpiMaterialInput):EpiWorldMaterialPlan {
 const {document,scene,personal}=input,registry=input.locus.reading.binding.rooted_world.registry_revision;
 // The coordinate registry and the admitted numerical sky registry have
 // distinct versioned owners. They share the exact Bimba source cut, not a
 // registry identity; preserving both is required by the personal consumer.
 if(scene.sources.sky_revision!==input.source_revision||!scene.sources.registry_revision)throw Error('The numerical scene and complete coordinate material do not share the admitted Bimba source cut.');
 if(document.schema!=='oi.expression/v1'||document.revision<1||Object.keys(document.entities).length||document.scenes.some(s=>s.entity_refs.length))throw Error('Construct into an actual empty native Expression; preserve authored material by using a native fork/graft first.');
 safePart(document.expression_ref);if(!/^[a-zA-Z0-9_.:-]{1,120}$/.test(input.authored_revision))throw Error('An exact authored material revision is required.');
 assertPersonalLocus(input.locus);assertCoupledClocks(input);
 available(input.scene_reading,'Native scene');
 if(!Array.isArray(input.native_owner_sources)||input.native_owner_sources.length<3)throw Error('The native world constructor/coupled/field source receipts are required.');for(const owner of input.native_owner_sources)available(owner,'Native world owner source');
 for(const r of [personal.person,personal.identity])available(r,'Protected personal source');
 if(personal.person.ref===PERSONAL_LOCUS.canonical||personal.identity.ref===PERSONAL_LOCUS.canonical||personal.instance_ref===PERSONAL_LOCUS.canonical||personal.instance_ref!==document.expression_ref||!personal.nara_ref||personal.event_ref!==input.event.event_ref||personal.snapshot_ref!==scene.snapshot_ref||personal.person.ref!==input.event.subject_ref)throw Error('Person, shared locus, particular Expression and current occasion must remain distinct and exactly bound.');
 const current=qualifyPersonalCurrent(personal,document.expression_ref,scene.snapshot_ref);
 const source=(ref:string)=>{const s=input.coordinates[ref];if(!s||s.reading.binding.coordinate_ref!==ref)throw Error(`Native coordinate ${ref} is missing from material production.`);checkSource(s,input.source_revision,registry);return s;};
 for(const s of [input.locus,input.torus,input.form,input.clock_source,...Object.values(input.registers).map(r=>r.source)])checkSource(s,input.source_revision,registry);
 if(input.torus.reading.binding.coordinate_ref!=='#1-5-1')throw Error('The native torus consumer requires its exact #1-5-1 constituent.');
 const prefix=`${document.expression_ref}:entity:world`,overviewRef=`${document.expression_ref}:scene:cosmic`,personalRef=`${document.expression_ref}:scene:personal`,branchesRef=`${document.expression_ref}:scene:branches`;
 const occurrences=constructCosmicBodies(scene,source,input.sky_subject,prefix);
 const qualifyNumericalBody=(occurrence:BuiltOccurrence)=>{
  if(!occurrence.coordinate)throw Error('A numerical body requires its exact canonical Bimba coordinate.');
  const reading:ReadingRef={ref:canonical(occurrence.coordinate),revision:scene.sources.registry_revision,availability:'available'};
  // This stamp comes from the actual scene owner whose full-source cut was
  // admitted above. It supplements, never overwrites, the v2 coordinate basis.
  if(!occurrence.subject.sources.some(s=>s.ref===reading.ref&&s.revision===reading.revision&&s.availability==='available'))occurrence.subject.sources.push(reading);
  occurrence.subject.readings.push(input.scene_reading);
 };
 for(const occurrence of occurrences)if(occurrence.coordinate)qualifyNumericalBody(occurrence);
 const add=(role:string,purpose:MaterialPurpose,s:CoordinateSource,name:string,text:string,position:Vec3,size:number,tint:string)=>{
  const e=material(`${prefix}-${role}`,name,text,purpose,position,size,tint);
  occurrences.push({role,purpose,material:e,subject:clone(s.reading.subject_binding),coordinate:s,profile_ref:''});return e;
 };
 const torus=add('torus','torus',input.torus,'Played torus','◯',{x:0,y:0,z:-.28},2.22,'#477b7d');torus.shape='ring';torus.share=12;
 const wheel=input.clock_source;if(wheel.reading.binding.coordinate_ref!=='#3-5')throw Error('The current T² clock body must retain the exact #3-5 whole-wheel source.');
 // A glyph circle has a visible narrow contour. The primitive ring is a
 // filled annulus, whose broad cloud concealed the two authored clock bodies.
 const clockA=add('clock-a-ring','clock-a-ring',wheel,'Clock A · inscription circle','◯',{x:0,y:0,z:.12},2.75,'#f0cf86');clockA.shape='text';
 add('clock-a-hand','clock-a-hand',wheel,'Clock A · native inscription phase','◆',longitudePose(input.clocks.a.phase.half_degrees/2,1.375,.15),.11,'#ffe0a2');
 const clockB=add('clock-b-ring','clock-b-ring',wheel,'Clock B · lens circle','◯',{x:0,y:0,z:-.11},1.43,'#9fe4e6');clockB.shape='text';
 add('clock-b-hand','clock-b-hand',wheel,'Clock B · native lens phase','◆',longitudePose(input.clocks.b.phase.half_degrees/2,.715,.16),.10,'#bcfbf3');
 const registerSize:Record<RegisterRole,number>={degree:3.18,governor:3.02,decan:2.9,codon:2.08,skin:2.3,aperture:1.76};
 const registerTitles:Record<RegisterRole,string>={degree:'Degrees · 360 marks',governor:'Governors · 24',decan:'Decans · 36',codon:'Codons · 64',skin:'Skins · 72',aperture:'Apertures & grounds · 18'};
 for(const role of ['degree','governor','decan','codon','skin','aperture'] as const){
  const r=input.registers[role];
  if(r.members.length!==REGISTER_COUNTS[role]||new Set(r.members.map(m=>m.reading.ref)).size!==REGISTER_COUNTS[role])throw Error(`The ${role} register requires its complete distinct ${REGISTER_COUNTS[role]} source members.`);
  for(const m of r.members){available(m.reading,`${role} member`);if(!m.title||!m.source_refs.length)throw Error('A grouped member must preserve its exact source and intelligible entrance.');for(const p of m.source_refs)available(p,`${role} member source`);}
  const register=add(`register-${role}`,role,r.source,registerTitles[role],'',{x:0,y:0,z:role==='skin'?-.25:.01},registerSize[role],role==='skin'?'#6c939a':'#8e9ca0');
  const image=input.register_images[role];if(image?.kind!=='image'||!image.image.dataUrl?.startsWith('data:image/png;base64,'))throw Error('Every grouped register requires actual source-member mark image material, not a count-only ring.');
  register.source=clone(image);register.shape='text';
  // These source-bearing rings contain hundreds of independently selectable
  // marks. Their authored allocation must give those marks a visible body;
  // a ring with only a few hundred particles is a failed encounter.
  register.share=({degree:8,governor:4,decan:4,codon:4,skin:2,aperture:4} as const)[role];
  register.tint=role==='degree'?'#cbd2be':role==='governor'?'#8eaa9e':role==='decan'?'#b5c6b2':role==='codon'?'#c9b5dc':role==='skin'?'#578d96':'#a7d2d3';
 }
 if(scene.centres.length!==7||new Set(scene.centres.map(c=>c.centre_ref)).size!==7)throw Error('The native scene requires seven distinct source-defined centres.');
 const centreRefs:string[]=[];
 for(const d of CHAKRA_DEFINITIONS){
  const nativeRef=`#2-5-0/1-${d.order+1}`,reading=source(nativeRef);
  const nativeCentre=scene.centres.find(c=>c.centre_ref===nativeRef),presentation=centrePresentationFromSource(reading);
  if(!nativeCentre||nativeCentre.anatomy!==presentation.anatomy)throw Error('The native body centre inventory disagrees with the full current anatomy source.');
  const e=add(`centre-${d.order}`,'centre',reading,presentation.name,presentation.glyph,{x:.46,y:-.4+d.order*.133,z:.28},.10,d.canonicalColor);
  e.shape='yantra';e.yantraId=d.id;
  e.station=null;e.native=makeFormation({id:e.id,chakraId:d.id,shape:{kind:'yantra',yantraId:d.id}});centreRefs.push(e.id);
  qualifyNumericalBody(occurrences[occurrences.length-1]);
 }
 const locus=add('personal-locus','locus',input.locus,'Personal Pratibimba','◯',{x:.46,y:0,z:.25},.98,'#8f88a5');locus.shape='text';
 const fm=input.form_material;available(fm.reading,'Current source form');
 // The source catalogue reads the exact native # coordinate at the full
 // Bimba source revision; coordinate subjects use the qualified ql identity.
 // Both spellings are admitted only against this exact resolved source.
 const qualifiedFormReading=fm.reading.ref===input.form.reading.binding.coordinate_ref&&fm.reading.revision===input.source_revision||fm.reading.ref===canonical(input.form)&&(fm.reading.revision===input.source_revision||input.form.reading.subject_binding.sources.some(r=>r.ref===fm.reading.ref&&r.revision===fm.reading.revision&&r.availability==='available'));
 if(!qualifiedFormReading||fm.subject_ref!==`ql:scene-form:${document.expression_ref}`||!fm.glyph||fm.glyph===String(scene.form.codon))throw Error('The live form needs its actual instance-owned native process subject, qualified initial codon and source glyph/hexagram material.');
 const form=add('current-form','form',input.form,'Current M3 form',fm.glyph,{x:-.55,y:.17,z:.3},.27,'#f2d4a0');if(fm.source)form.source=clone(fm.source);
 if(!fm.source_refs.length)throw Error('Current symbolic form must retain its codon/hexagram correspondence sources.');for(const ref of fm.source_refs)available(ref,'Current form source');
 const qualifyFormProcess=(occurrence:BuiltOccurrence)=>{
  occurrence.subject.subject_ref=fm.subject_ref;
  occurrence.subject.sources=[...occurrence.subject.sources,fm.reading,...fm.source_refs,input.scene_reading];
  occurrence.subject.readings=[...occurrence.subject.readings,fm.reading,...fm.source_refs,input.scene_reading];
 };
 qualifyFormProcess(occurrences[occurrences.length-1]);
 if(!fm.native_geometry)throw Error('The separately received native M3 hinge geometry is missing.');
 const hinge=add('current-form-hinge','form-hinge',input.form,'M3 form · native hinge','◇',{x:-.55,y:-.24,z:.3},.28,'#bfd9bc');hinge.shape='ring';
 qualifyFormProcess(occurrences[occurrences.length-1]);
 if(occurrences.length!==32)throw Error('The coherent overview requires exactly 32 named source-bound occurrences, preserving both glyph and native hinge.');
 if(input.personal_branches.length!==6||new Set(input.personal_branches.map(s=>s.reading.binding.coordinate_ref)).size!==6)throw Error('The personal hub requires six exact M4 branch entrances.');
 const branchActs=['Identity','Embodiment','Oracle','Transformation','Context & lenses','Integration'];
 for(let index=0;index<6;index++){
  const s=input.personal_branches.find(s=>s.reading.binding.coordinate_ref===`#4.${index}`);
  if(!s||s.reading.binding.family!=='M4')throw Error('A personal branch entrance was replaced with a same-labelled wrong native branch.');checkSource(s,input.source_revision,registry);
  const symbol=s.identity.properties.c_1_symbol,text=typeof symbol==='string'&&symbol.length<=20?symbol:branchActs[index];
  const symbolic=typeof symbol==='string'&&symbol.length<=20;
  const e=add(`branch-${index}`,'branch',s,branchActs[index],text,longitudePose(index*60,1.02,.06),symbolic?.3:.47,'#cbd8d0');e.share=3;
  // The native glyph pool normalizes both axes. A word needs an authored
  // horizontal extent; giving it a square stretches it into illegible strips.
  if(!symbolic)e.size={x:.76,y:.13};
 }
 const personalParticipants=occurrences.filter(o=>['earth','centre','locus','branch'].includes(o.purpose));
 for(const occurrence of personalParticipants)occurrence.subject=bindPersonalParticipation(occurrence.subject,null,personal,current);

 const definitions:ExpressionRequest[]=[],profiles:CoordinateProfile[]=[],seen=new Map<string,CoordinateProfile>();
 const define=(p:CoordinateProfile)=>{const prior=seen.get(p.profile_ref);if(prior&&!equal(prior,p))throw Error('Two material sources disagree about an immutable profile.');if(!prior){seen.set(p.profile_ref,p);profiles.push(p);definitions.push({operation:'profile_define',profile:p,actor:input.actor});}};
 // Canonical lineage is retained in each exact source reading. Only the
 // adopted Personal Pratibimba lineage needs cache definitions; duplicating
 // every semantic lineage would exhaust the actual native 64-profile owner.
 for(const p of input.locus.reading.profiles)define(p);
 const authoredBasis:ReadingRef={ref:`material:epi-world:${input.authored_revision}`,revision:input.authored_revision,availability:'available'};
 const globalRef=`profile:epi-world-${input.authored_revision}-${input.source_revision.slice(0,16)}-${registry.slice(0,16)}`;
 define(authoredProfile(globalRef,'Epi world · authored grammar',null,authoredBasis,{glyph:'∴',shape:'glyph'},[{role:'cosmic',title:'Cosmic field'},{role:'personal',title:'Personal Pratibimba'}]));
 const families=new Map<string,string>();
 for(const o of occurrences){
  const family=o.coordinate?.reading.binding.family??'sky';
  let familyRef=families.get(family);if(!familyRef){familyRef=`${globalRef}-${family.toLowerCase()}`;families.set(family,familyRef);define(authoredProfile(familyRef,`Epi ${family} · authored family form`,globalRef,authoredBasis,{share:family==='M1'?12:1},[]));}
  const branch=o.coordinate?.reading.binding.branch_path[0]??family;
  const branchRef=`${familyRef}-${branch.replaceAll('#','').replaceAll('/','-').replaceAll('(','').replaceAll(')','')}`;
  const semanticBasis=o.coordinate?o.subject.sources[0]:authoredBasis;
  if(!seen.has(branchRef))define(authoredProfile(branchRef,`Epi ${branch} · authored branch form`,familyRef,semanticBasis,{shape:o.purpose==='planet'?'glyph':'ring'},[]));
  // Native profile refs admit at most128 local bytes. The complete canonical
  // profile/source identity remains in provenance; this bounded address key
  // is checked for immutable-content collisions by define() above.
  const semanticKey=o.coordinate?.reading.binding.resolved_profile_ref.split(':').at(-1)?.replace(/^epi-coordinate-/,'').slice(0,20)??'dated-sky-body';
  const variationRef=`${globalRef}-${o.role}-${semanticKey}`;
  define(authoredProfile(variationRef,o.material.name,branchRef,semanticBasis,{material:reusableMaterial(o.material)},[{role:o.role,title:o.material.name}]));o.profile_ref=variationRef;
  const inherited=resolveMaterialDefaults(profiles,variationRef).material as Record<string,unknown>;
  if(!inherited||!Object.keys(inherited).length||inherited.text!==o.material.text||inherited.shape!==o.material.shape)throw Error('Profile adoption without real inherited expressive material is refused.');
  o.material={...o.material,...clone(inherited)} as Entity;
  if(o.material.native)o.material.native.id=o.material.id;
 }
 if(definitions.length>64)throw Error(`The actual native 64-profile definition budget is exceeded (${definitions.length}); recover reusable grammar at its owner instead of omitting bodies.`);
 const overview=sceneMaterial(overviewRef,'Cosmic field',occurrences.filter(o=>o.purpose!=='branch').map(o=>clone(o.material)),'Earth, played torus and seven centres share this geocentric occasion. Select a body to follow its source.');
 overview.text=epiCosmicCaptionCohort(overviewRef);
 const personalMembers=occurrences.filter(o=>['earth','centre','locus'].includes(o.purpose));
 const personalEntities=personalMembers.map(o=>{const e=clone(o.material);if(o.purpose==='centre'){const ordinal=CHAKRA_DEFINITIONS.find(d=>d.id===e.native?.chakraId)!.order;e.position={x:0,y:-.8+ordinal*.267,z:.08};e.size={x:.17,y:.17};e.share=3;}else if(o.purpose==='earth'){e.position={x:0,y:-1.04,z:0};e.size={x:.2,y:.2};}else{e.position={x:0,y:0,z:-.12};e.size={x:1.72,y:2.34};e.share=1;}return e;});
 const personalScene=sceneMaterial(personalRef,'Personal Pratibimba',personalEntities,'Your situated body at M4.4.4.4. Identity, lived history and the present cosmic occasion meet here. Return to the cosmic field without changing this person or event.');personalScene.view={mode:'2d',yaw:0,pitch:0,zoom:.60,panX:0,panY:.01,nativeScaffold:'off'};
 const personalWaveMix=PERSONAL_WAVE_PRESENTATION.dominance;
 personalScene.field.params.dominance=personalWaveMix;
 const branchLocus=clone(locus);branchLocus.position={x:0,y:0,z:.03};branchLocus.size={x:.54,y:.54};
 const branchesScene=sceneMaterial(branchesRef,'Ways through your world',[branchLocus,...occurrences.filter(o=>o.purpose==='branch').map(o=>clone(o.material))],'Identity, embodiment, oracle, transformation, context and integration open from Personal Pratibimba. Each entrance retains its exact Bimba source and applicable native operations.');branchesScene.view={mode:'2d',yaw:0,pitch:0,zoom:.60,panX:0,panY:.01,nativeScaffold:'off'};
 const scenes=[overview,personalScene,branchesScene];
 validateJourney({schema:'oi.journey',version:1,id:document.expression_ref,name:'Epi-Logos world',description:'Native coordinate-bound world material.',loop:false,scenes,updatedAt:new Date(0).toISOString()});
 const changes:Change[]=[{change:'rename',title:'Epi-Logos · cosmic and personal world'},{change:'composition_set',presentation:{schema:'oi.journey-properties/v1',description:'Bimba through Expressions, with the person situated at Personal Pratibimba.',loop:false}}];
 // An owner-created empty starter Scene is removed after the real Scenes exist.
 for(const s of scenes)changes.push({change:'scene_create',scene_ref:s.id,title:s.name});
 for(const o of occurrences)changes.push({change:'entity_add',scene_ref:o.purpose==='branch'?branchesRef:overviewRef,entity_ref:o.material.id,title:o.material.name},{change:'subject_bind',entity_ref:o.material.id,binding:o.subject},{change:'parameter_set',entity_ref:o.material.id,parameter:'glyph',value:o.material.text});
 const endpoint=new Map<string,string[]>();for(const o of occurrences){const key=o.coordinate?.reading.binding.coordinate_ref;if(key)endpoint.set(key,[...(endpoint.get(key)??[]),o.material.id]);}
 const relations=new Map<string,SourceRelation>();for(const o of occurrences)for(const r of o.coordinate?.reading.binding.source_relations??[])if(r.from_ref&&r.to_ref&&endpoint.has(r.from_ref)&&endpoint.has(r.to_ref))relations.set(r.relation_ref,r);
 for(const r of relations.values()){
  // Same subject can have several purposeful carriers; bind each exact subject
  // relation once between deliberate canonical occurrences, never by title.
  const from=endpoint.get(r.from_ref!)![0],to=endpoint.get(r.to_ref!)![0];
  if(from===to||!/^[0-9a-f]{16}$/.test(r.id)||r.class!=='bimba-source')continue;
  const binding:Relation={binding_ref:`${document.expression_ref}:relation:${r.id}`,native_owner:'ql-mef',relation:{ref:r.relation_ref,revision:registry,availability:'available'},from_entity_ref:from,to_entity_ref:to,provenance:[documentBasis(input),authoredBasis]};
  changes.push({change:'relation_bind',binding});
 }
 for(const s of scenes){
  changes.push({change:'scene_compose',scene_ref:s.id,entity_refs:s.entities.map(e=>e.id)},{change:'scene_material_set',scene_ref:s.id,presentation:{schema:'oi.journey-scene/v1',scene:s as unknown as Record<string,unknown>}},{change:'scene_body_set',scene_ref:s.id,body:{carrier:'engine_composition',subject_ref:document.expression_ref,native_owner:'expressions',reading:authoredBasis,provenance:[documentBasis(input),input.scene_reading],actions:[],presentation:'live',capability:{state:'renderable'}}});
 }
 for(const s of document.scenes)changes.push({change:'scene_remove',scene_ref:s.scene_ref});
 for(const p of document.profiles??[])if(p.profile_ref.startsWith('profile:epi-coordinate-'))changes.push({change:'profile_release',profile_ref:p.profile_ref});
 changes.push({change:'profile_adopt',adoption:{profile_ref:input.locus.reading.binding.resolved_profile_ref,revision:input.locus.reading.binding.profile_revision,source_basis:input.locus.reading.subject_binding.sources[0]}},{change:'profile_adopt',adoption:{profile_ref:globalRef,revision:1,source_basis:authoredBasis}});
 const reuse:Reuse={schema:'oi.expression-reuse/v1',kind:'expression',title:'Epi cosmic and personal world',roles:[{role:'personalLocus',accepts:'object',entity_ref:locus.id},{role:'observer',accepts:'object',entity_ref:occurrences[0].material.id}],entry_scene_ref:overviewRef,states:{cosmic:overviewRef,personal:personalRef,branches:branchesRef},gestures:{returnCosmic:{scene_ref:overviewRef},enterPersonal:{scene_ref:personalRef},enterBranches:{scene_ref:branchesRef}},preview_state:'cosmic',associations:{event_families:['epi.cosmic','nara.personal']},authored_by:input.actor};
 changes.push({change:'reuse_set',reuse},{change:'focus',scene_ref:overviewRef,entity_ref:locus.id});
 if(changes.length>256)throw Error(`The native atomic edit budget is exceeded (${changes.length}); use dependency-ordered native edits rather than truncating semantic structure.`);
 available(input.inventory_receipt.reading,'Full native source inventory');
 if(input.inventory_receipt.complete!==true||input.inventory_receipt.source_revision!==input.source_revision||input.inventory_receipt.node_count!==input.inventory.length||!Number.isSafeInteger(input.inventory_receipt.relation_count))throw Error('The full source inventory must be complete against its native count/revision receipt.');
 const coords=new Set<string>(),sourceEndpoints=new Map<string,string[]>();for(const o of occurrences)if(o.coordinate){const key=o.coordinate.identity.coordinate;sourceEndpoints.set(key,[...(sourceEndpoints.get(key)??[]),o.material.id]);}
 const dispositions=input.inventory.map((row):CoordinateDisposition=>{
  if(coords.has(row.coordinate)||row.source_revision!==input.source_revision||!row.full_source_ref||!row.full_properties_ref||!/^[0-9a-f]{64}$/.test(row.properties_sha256))throw Error('The full current source inventory is incomplete or inconsistent.');coords.add(row.coordinate);
  const entity_refs=sourceEndpoints.get(row.coordinate)??[];
  // The actual native source spelling itself is admitted by the coordinate
  // owner. Non-M lattices/primes retain their source route; no # is invented.
  const route:CoordinateDisposition['route']=row.ql_coordinate?{kind:'coordinate',coordinate_ref:row.ql_coordinate,face:'bimba',return_scene_ref:personalRef,standing:'prepared-route'}:{kind:'source',reading:{ref:row.full_source_ref,revision:row.source_revision,availability:'available'},return_scene_ref:personalRef,standing:'prepared-route'};
  return{coordinate:row.coordinate,native_coordinate:row.ql_coordinate??row.full_source_ref,identity:row.identity,source_revision:row.source_revision,full_source_ref:row.full_source_ref,full_properties_ref:row.full_properties_ref,properties_sha256:row.properties_sha256,disposition:entity_refs.length?'scene-material':'focused-source',entity_refs,route};
 });
 if(!dispositions.length||!coords.has('M4.4.4.4'))throw Error('The material producer requires the actual complete current inventory, including the personal locus.');
 const receiving:NativeReceivingDeclaration={expression_ref:document.expression_ref,basis_revision:document.revision,scene_ref:overviewRef,event_ref:input.event.event_ref,subject_ref:input.event.subject_ref,snapshot_ref:scene.snapshot_ref,torus:{entity_ref:torus.id,subject_ref:canonical(input.torus),native_constituent:'#1-5-1',sampling:'whole-domain-stratified',units_per_metre:120},preserve_authored_entity_refs:occurrences.filter(o=>o.purpose!=='torus'&&o.purpose!=='branch').map(o=>o.material.id),preserve_density_w:true,preserve_connection_and_padding:true,personal:{locus_entity_ref:locus.id,canonical_locus:PERSONAL_LOCUS.canonical,person:clone(personal.person),identity:clone(personal.identity),instance_ref:personal.instance_ref,current,standing:current?'qualified-native-current':'awaiting-native-current',centre_entity_refs:centreRefs,participant_entity_refs:personalParticipants.map(o=>o.material.id)}};
 return{standing:'prepared-native-edit',definitions,edit:{operation:'edit',expression_ref:document.expression_ref,expected_revision:document.revision,actor:input.actor,changes},scenes,occurrences,dispositions,receiving,register_members:Object.fromEntries(Object.entries(input.registers).map(([key,value])=>[key,value.members])) as EpiWorldMaterialPlan['register_members'],form_material:clone(input.form_material),source_basis:{source_revision:input.source_revision,registry_revision:registry,numerical_registry_revision:scene.sources.registry_revision,numerical_source_revision:scene.sources.sky_revision,native_owner_sources:clone(input.native_owner_sources),scene:input.scene_reading,event:input.event.reading,clocks:input.clocks.reading},reuse};
}
function documentBasis(input:EpiMaterialInput):ReadingRef{return input.locus.reading.subject_binding.sources[0];}

/** Verify actual native owner readback above useful schema validation. The
 * caller then opens this SAME document through NativeWorkspace, and separately
 * proves real rendered pixels/audio/consumer effects in the installed app.
 */
export function verifyEpiWorldReadback(document:ExpressionDocument,plan:EpiWorldMaterialPlan):KernelConversion {
 if(document.expression_ref!==plan.edit.expression_ref||document.revision!==plan.edit.expected_revision+1)throw Error('The world readback is not the exact committed native CAS.');
 for(const o of plan.occurrences){const actual=document.entities[o.material.id];if(!actual||!equal(actual.subject,o.subject))throw Error(`Required native body ${o.material.name} is absent or incorrectly bound.`);}
 const locus=document.entities[plan.receiving.personal.locus_entity_ref];if(locus.subject?.subject_ref!==PERSONAL_LOCUS.canonical)throw Error('The personal locus was replaced with a wrong same-labelled branch.');
 for(const authored of plan.scenes){
  const s=document.scenes.find(s=>s.scene_ref===authored.id);
  // The ordinary producer adds the qualified live-world carrier to its actual
  // CAS after authored material is built. Compare the complete issued material,
  // including that carrier, rather than falsely rejecting its extra receipt.
  const issued=plan.edit.changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===authored.id);
  if(!issued||issued.change!=='scene_material_set'||!s||!equal(s.entity_refs,authored.entities.map(e=>e.id))||!equal(s.presentation,issued.presentation))throw Error('Native Scene exists without the complete required expressive material.');
 }
 const view=kernelDocumentToJourney(document);
 for(const authored of plan.scenes){const binding=Object.values(view.bindings).find(b=>b.scene_ref===authored.id);if(!binding||binding.loaded_refs.length!==authored.entities.length||binding.hidden_refs.length||binding.page_count!==1)throw Error('The required composition was lost in the actual production loading adapter.');}
 return view;
}
