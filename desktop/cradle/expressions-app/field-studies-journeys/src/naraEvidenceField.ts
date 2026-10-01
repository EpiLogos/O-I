import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
import type {EpiWorldRecord} from './epiWorldProduction';
import type {ReadingRef} from '../../../src/expression/types';
import type {LocalizedResonanceProjection} from '../../src/engine/localizedResonanceProjection';
import type {InstrumentIdentity} from '../../../src/nara/instrumentProtocol';
import type {NatalEvidenceChannel} from '../../../src/nara/identity/evidencePartition';
import type {KernelConversion} from './kernelDocumentBridge';
import type {ForceEmitterProjection} from '../../src/engine/forceRuntime';
import {NARA_EVIDENCE_FORCE_POLICY, projectNaraEvidenceForces} from '../../src/engine/naraEvidenceProjection';
import type {Scene} from './model';
import {DEFAULT_ENTITY_SOUND} from './native-field/entitySound';

// The retained template declares these typed chakra IDs. Display titles and
// cymatic station indices are deliberately not correspondence inputs.
const CENTRES=['muladhara','svadhisthana','manipura','anahata','vishuddha','ajna','sahasrara'] as const;
function hasCurrentSource(value:unknown,ref:string,revision:string):boolean {
  return Array.isArray(value)&&value.some((source:unknown)=>!!source&&typeof source==='object'&&'ref' in source&&source.ref===ref&&'revision' in source&&source.revision===revision&&'availability' in source&&source.availability==='available');
}
export interface EvidencePresentation {identity:InstrumentIdentity;channel:NatalEvidenceChannel;sound?:boolean;waves?:boolean;current?:NativeCurrentReading|null}
export interface PrivateEvidenceField {
  expressionRef:string;sceneRef:string;sourceRef:string;sourceRevision:string;
  resonance:LocalizedResonanceProjection|null;
  project:(view:KernelConversion|undefined,sceneId:string)=>ForceEmitterProjection|null;
  sound:(scene:Readonly<Scene>)=>Readonly<Scene>;
}
/** Private host-to-aperture state, qualified against the actually loaded world.
 * This is neither a new identity selection nor portable Expression material. */
export interface NaraPersonalContext {
  expressionRef:string;sceneId:string;identity:InstrumentIdentity;admission:number;
  current:NativeCurrentReading;presentation:EvidencePresentation|null;
}
/** The saved pointer and native live current are admitted independently of
 * the presentation. Explicit native activity can advance current; a new
 * saved-body admission supersedes both receipts. No data is synthesized. */
export interface PersonalCurrentAdmission {generation:number;savedCurrent:ReadingRef;current:NativeCurrentReading}
export function personalIdentityKey(identity:InstrumentIdentity):string {
  return JSON.stringify([identity.source.source_ref,identity.source.revision,
    identity.reading.person_ref,identity.reading.nara_ref,identity.reading.input_revision]);
}
export function personalCurrentKey(current:NativeCurrentReading|null):string {
  return JSON.stringify([current?.expression_ref,current?.nara_ref,current?.context,
    current?.reading?.identity.input_revision,current?.reading?.transit.sky?.snapshot_ref]);
}
export function personalContextBasisKey(context:NaraPersonalContext):string {
  return JSON.stringify([context.expressionRef,personalIdentityKey(context.identity),context.current.context?.event_ref,context.admission]);
}
export function personalContextKey(context:NaraPersonalContext):string {
  return JSON.stringify([context.expressionRef,context.sceneId,personalIdentityKey(context.identity),
    personalCurrentKey(context.current),context.presentation?.channel??null,
    !!context.presentation?.sound,!!context.presentation?.waves,context.admission]);
}
/** Absence or a mismatched person/source/input/occasion refuses hydration.
 * The caller supplies the world read from the loaded native document, not a
 * remembered label, registry row, or a fabricated local identity. */
export function qualifyPersonalContext(world:EpiWorldRecord|null,identity:InstrumentIdentity|null,
  current:NativeCurrentReading|null,presentation:EvidencePresentation|null,
  field:PrivateEvidenceField|null,view:KernelConversion|undefined,sceneId:string,admission:PersonalCurrentAdmission|null=null):NaraPersonalContext|null {
  if(!world||!identity||!current||!view)return null;
  const document=view.document,personal=world.receiving.personal,reading=identity.reading;
  const context=current.context,now=current.reading;
  if(world.world.instance_ref!==document.expression_ref||world.receiving.expression_ref!==document.expression_ref
    ||world.world.subject_ref!==world.person_ref||world.receiving.subject_ref!==world.person_ref
    ||personal.canonical_locus!=='ql:m-coordinate:bimba:M4.4.4.4'
    ||document.entities[personal.locus_entity_ref]?.subject?.subject_ref!==personal.canonical_locus
    ||reading.person_ref!==world.person_ref||reading.profile.person_ref!==world.person_ref
    ||reading.nara_ref!==world.nara_ref||reading.profile.nara_ref!==world.nara_ref
    ||identity.source.source_ref!==world.identity_source.source_ref||identity.source.revision!==world.identity_source.revision
    ||reading.input_revision!==world.identity_input_revision
    ||personal.person.ref!==world.person_ref||personal.person.revision!==reading.input_revision||personal.person.availability!=='available'
    ||personal.identity.ref!==identity.source.source_ref||personal.identity.revision!==identity.source.revision||personal.identity.availability!=='available'
    ||current.schema!=='oi.nara-personal-current-context/v1'||current.status!=='available'||!current.private||current.public_export!==false
    ||current.expression_ref!==document.expression_ref||current.nara_ref!==world.nara_ref
    ||!Number.isSafeInteger(current.expression_revision)||current.expression_revision<0||current.expression_revision>document.revision
    ||!context?.reading_ref||!context.reading_revision||context.identity_source_ref!==identity.source.source_ref||context.identity_revision!==identity.source.revision
    ||!now||now.identity.person_ref!==world.person_ref||now.identity.nara_ref!==world.nara_ref||now.identity.input_revision!==reading.input_revision
    ||context.event_ref!==world.world.event_ref||context.event_ref!==world.receiving.event_ref
    ||now.transit.sky?.snapshot_ref!==world.world.snapshot_ref||world.receiving.snapshot_ref!==world.world.snapshot_ref
    ||world.world.sky.snapshot_ref!==world.world.snapshot_ref||now.sky_admission?.snapshot_ref!==world.world.snapshot_ref
    ||!view.bindings[sceneId]||!view.journey.scenes.some(scene=>scene.id===sceneId))return null;
  const saved=personal.current;
  if(!saved||saved.availability!=='available'||!saved.ref||!saved.revision)return null;
  if(admission){
    if(!Number.isSafeInteger(admission.generation)||admission.generation<1
      ||admission.savedCurrent.availability!=='available'||admission.savedCurrent.ref!==saved.ref||admission.savedCurrent.revision!==saved.revision
      ||personalCurrentKey(admission.current)!==personalCurrentKey(current))return null;
  }else if(context.reading_ref!==saved.ref||context.reading_revision!==saved.revision)return null;
  if(presentation&&(personalIdentityKey(presentation.identity)!==personalIdentityKey(identity)
    ||personalCurrentKey(presentation.current??null)!==personalCurrentKey(current)
    ||!field||field.expressionRef!==document.expression_ref||field.sourceRef!==identity.source.source_ref
    ||field.sourceRevision!==identity.source.revision||!field.project(view,sceneId)))return null;
  return {expressionRef:document.expression_ref,sceneId,identity,current,presentation,admission:admission?.generation??0};
}
type NatalComposition=NonNullable<InstrumentIdentity['reading']['natal_composition']>;
type CentrePartition=NonNullable<NatalComposition['presentation_partition']>;
type ResonanceBinding=Readonly<{ordinal:number;entityId:string}>;
export interface NativePlanetaryResonanceDriver {driverRef:string;entityId:string;frequencyHz:number;driveShare:number}

/** Exact presentation projection of the owner's ten-body contribution basis.
 * Driver identity and target formation identity remain distinct: qualified
 * bodies can share a centre without merging their frequency or modal state. */
export function projectNativePlanetaryResonanceDrivers(natal:NatalComposition,partition:CentrePartition,
  bindings:readonly ResonanceBinding[],sourceRef:string):NativePlanetaryResonanceDriver[]{
  const rows=natal.planetary_contributions;
  if(rows.length!==10||new Set(rows.map(row=>row.native_planet_id)).size!==10)throw Error('The native planetary driver basis must contain the ten distinct owner contributions.');
  const denominator=rows.reduce((sum,row)=>sum+row.weighted_contribution,0);
  if(!Number.isFinite(denominator)||denominator<=0||rows.some(row=>!Number.isFinite(row.weighted_contribution)||row.weighted_contribution<0))throw Error('The native planetary driver denominator is invalid.');
  const drivers:NativePlanetaryResonanceDriver[]=[];
  for(const row of rows){
    if(row.receiving_centre_ordinal==null){
      if(row.body!=='Uranus')throw Error('Only the owner-unallocated Uranus contribution may lack a receiving centre.');
      continue;
    }
    const binding=bindings.find(value=>value.ordinal===row.receiving_centre_ordinal);
    if(!binding||!Number.isFinite(row.native_cousto_frequency_hz)||row.native_cousto_frequency_hz<=0)throw Error('A qualified planetary driver has no exact native target or frequency.');
    drivers.push({driverRef:JSON.stringify([sourceRef,row.native_planet_id]),entityId:binding.entityId,
      frequencyHz:row.native_cousto_frequency_hz,driveShare:row.weighted_contribution/denominator});
  }
  for(const binding of bindings){
    const projected=drivers.filter(driver=>driver.entityId===binding.entityId).reduce((sum,driver)=>sum+driver.driveShare,0);
    const centre=partition.centres.find(value=>value.ordinal===binding.ordinal)?.mass_share_l1;
    if(!Number.isFinite(centre)||Math.abs(projected-centre!)>1e-10)throw Error('The native planetary drivers do not reconstruct their owner centre partition.');
  }
  return drivers;
}

/** A reversible presentation of an actual native evidence partition. This is
 * never a constitution, an authored coefficient, or an exported scene field. */
export function createEvidenceField(input:EvidencePresentation,view:KernelConversion|undefined,sceneId:string):PrivateEvidenceField {
  if(!view)throw Error('Save this Expression through the native owner before presenting identity evidence.');
  const {identity,channel}=input;
  const natal=identity.reading.natal_composition;
  const partition=channel==='direct-planetary-resonance'?natal?.presentation_partition:natal?.decanic_channel?.presentation_partition;
  if(!partition?.available)throw Error('This saved identity has no available native evidence partition for that route.');
  const source=identity.source;
  if(!source.source_ref||!source.revision||identity.reading.person_ref!==identity.reading.profile.person_ref)throw Error('The native identity basis is incomplete.');
  const binding=view.bindings[sceneId],scene=view.journey.scenes.find(s=>s.id===sceneId);
  if(!binding||!scene)throw Error('Open the actual native chakral Scene first.');
  const bindings=CENTRES.map((id,ordinal)=>{
    const entities=scene.entities.filter(e=>e.native?.chakraId===id);
    if(entities.length!==1)throw Error('The Scene must contain exactly one explicitly bound occurrence of each of the seven centres.');
    const occurrence=binding.occurrences.filter(o=>o.view_entity_id===entities[0].id);
    if(occurrence.length!==1||!view.document.entities[occurrence[0].entity_ref])throw Error('A centre has no unique native occurrence.');
    const evidence=natal!.centre_evidence.filter(row=>row.ordinal===ordinal);
    const zone=evidence[0]?.body?.body_zone;
    const subject=view.document.entities[occurrence[0].entity_ref].subject;
    if(evidence.length!==1||evidence[0].native_m2_chakra_id!==ordinal+1||!zone?.source_ref.startsWith('#')||!zone.registry_revision)throw Error('The saved reading has no exact native body source for this centre.');
    const sourceRef=`ql:m-coordinate:bimba:M${zone.source_ref.slice(1)}`;
    if(subject?.native_owner!=='ql-mef'||subject.subject_ref!==sourceRef||!hasCurrentSource(subject.sources,sourceRef,zone.registry_revision))throw Error('Bind your seven centres to their current native body sources before presenting identity evidence.');
    return {ordinal,entityId:entities[0].id,nativeRef:occurrence[0].entity_ref,sourceRef,registryRevision:zone.registry_revision};
  });
  const projection={policy:NARA_EVIDENCE_FORCE_POLICY,channel,partition,bindings};
  projectNaraEvidenceForces([],projection); // Admission before any field effect.
  const transform:ForceEmitterProjection=emitters=>projectNaraEvidenceForces(emitters,projection);
  const frequencies=new Map<number,number>();
  if(input.sound)for(const b of bindings){
    const rows=natal!.planetary_contributions.filter(row=>row.receiving_centre_ordinal===b.ordinal);
    if(rows.length!==1||!Number.isFinite(rows[0].native_cousto_frequency_hz)||rows[0].native_cousto_frequency_hz<=0)throw Error('This centre has no unique native planetary frequency.');
    frequencies.set(b.ordinal,rows[0].native_cousto_frequency_hz);
  }
  const resonanceDrivers=input.waves?projectNativePlanetaryResonanceDrivers(natal!,partition,bindings,source.source_ref):[];
  const expressionRef=view.document.expression_ref,sceneRef=binding.scene_ref;
  let resonance:LocalizedResonanceProjection|null=null;
  if(input.waves){
    const current=input.current,reading=current?.reading;
    if(current?.schema!=='oi.nara-personal-current-context/v1'||current.status!=='available'
      ||current.expression_ref!==expressionRef||current.nara_ref!==identity.reading.nara_ref
      ||current.context?.identity_source_ref!==source.source_ref||current.context.identity_revision!==source.revision
      ||reading?.identity.input_revision!==identity.reading.input_revision||!reading.baseline_available||!reading.q_identity_transit)
      throw Error('Pin the actual sky for this saved identity and Expression before entering its standing-wave field.');
    const activity=reading.activity;
    if(!['available','unavailable'].includes(reading.activity_status)
      ||(reading.activity_status==='unavailable'&&(reading.q_activity!=null||reading.q_composed!=null)))
      throw Error('The current reading has no consistent native activity standing.');
    if(reading.activity_status==='available'&&(!reading.q_activity||!reading.q_composed
      ||activity?.schema!=='ql.nara-m3-activity/v1'||activity.status!=='available'
      ||activity.policy!=='historical-personal-frame-sprite-v1'||activity.subject_ref!==identity.reading.person_ref
      ||activity.event_ref!==current.context.event_ref||activity.identity_source_ref!==source.source_ref||activity.identity_revision!==source.revision))
      throw Error('The activity contribution does not match this saved person and native occasion.');
    resonance={scope:JSON.stringify([source.source_ref,expressionRef]),orientation:reading.activity_status==='available'?reading.q_composed!:reading.q_identity_transit,
      drivers:resonanceDrivers};
  }
  return {expressionRef,sceneRef,sourceRef:source.source_ref,sourceRevision:source.revision,resonance,
    sound(scene){
      if(!input.sound)return scene;
      return {...scene,entities:scene.entities.map(entity=>{
        const b=bindings.find(b=>b.entityId===entity.id);if(!b)return entity;
        const share=partition.centres.find(c=>c.ordinal===b.ordinal)!.mass_share_l1!;
        return {...entity,sound:{...DEFAULT_ENTITY_SOUND,...entity.sound,enabled:share>0,followCymatic:false,
          frequencyHz:frequencies.get(b.ordinal)!,gain:(entity.sound?.gain??DEFAULT_ENTITY_SOUND.gain)*share}};
      })};
    },
    project(current,currentSceneId){
      if(current?.document.expression_ref!==expressionRef||current.bindings[currentSceneId]?.scene_ref!==sceneRef)return null;
      const material=current.journey.scenes.find(s=>s.id===currentSceneId);
      for(const b of bindings){
        const subject=current.document.entities[b.nativeRef]?.subject;
        if(subject?.native_owner!=='ql-mef'||subject.subject_ref!==b.sourceRef||!hasCurrentSource(subject.sources,b.sourceRef,b.registryRevision)||!current.bindings[currentSceneId].occurrences.some(o=>o.entity_ref===b.nativeRef&&o.view_entity_id===b.entityId)
          ||material?.entities.find(e=>e.id===b.entityId)?.native?.chakraId!==CENTRES[b.ordinal])return null;
      }
      return transform;
    }};
}
