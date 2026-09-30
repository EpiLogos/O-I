import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
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
  if(input.sound||input.waves)for(const b of bindings){
    const rows=natal!.planetary_contributions.filter(row=>row.receiving_centre_ordinal===b.ordinal);
    if(rows.length!==1||!Number.isFinite(rows[0].native_cousto_frequency_hz)||rows[0].native_cousto_frequency_hz<=0)throw Error('This centre has no unique native planetary frequency.');
    frequencies.set(b.ordinal,rows[0].native_cousto_frequency_hz);
  }
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
      drivers:bindings.map(b=>({entityId:b.entityId,frequencyHz:frequencies.get(b.ordinal)!,
        driveShare:partition.centres.find(c=>c.ordinal===b.ordinal)!.mass_share_l1!}))};
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
