/** Human proposals in the owner's existing vocabulary. QL remains validator
 * and mutation owner; these helpers neither execute nor infer personal state. */
import type {NativeFileReading} from '../../kernel/types';
import {object,text,type PersonalRecord,type ProtectedSource,type SourceBasis} from './client';
const slots=['birthdate-name','natal-chart','jungian-assessment','gene-keys','human-design','archetypal-quintessence'];
const perspectives=['gebser','ontological','epistemological','jungian-depth','phenomenological','trika-kashmir'];
export function protectedSource(reading:NativeFileReading):ProtectedSource{
  if(reading.schema!=='central.file-reading/v1'||reading.automatic_agent_or_model_invocation!==false||reading.location.schema!=='central.path-ref/v1')throw new Error('A native Central source reading is required');
  return {ref_id:text(reading.location.ref),revision:text(reading.revision),owner_ref:'central'};
}
export function sourceBasis(reading:NativeFileReading):SourceBasis{const source=protectedSource(reading);return {source_ref:source.ref_id,revision:source.revision,standing_ref:'human-selected-source'};}
export function identitySource(kind:string,reading:NativeFileReading|null,absenceReason='Not supplied by the person'):Record<string,unknown>{
  const ordinal=slots.indexOf(kind);if(ordinal<0)throw new Error('Unknown native identity layer');
  return {kind:'identity_replace',identity_revision:`identity-review/${crypto.randomUUID()}`,slot:{kind,coordinate_ref:`M4.0.${ordinal}`,source:reading?sourceBasis(reading):null,protected_value_ref:reading?protectedSource(reading):null,evidence_refs:[],tensions:[],absence_reason:reading?null:text(absenceReason,'Reason for leaving the layer unprovided'),standing:reading?'reported':'unavailable'}};
}
export function contextSource(branch:string,coordinate:string,reading:NativeFileReading,modelRef:string):Record<string,unknown>{
  const ordinal=perspectives.indexOf(branch),prefix=`M4.4.${ordinal}`;
  if(ordinal<0||!(coordinate===prefix||coordinate.startsWith(prefix+'.'))||!/^M4\.4\.[0-5](\.[0-5])*$/.test(coordinate))throw new Error('Choose an exact coordinate inside the selected contextual branch');
  return {kind:'context_record',branch,reading:{reading_ref:`nara-reading/${crypto.randomUUID()}`,coordinate_ref:coordinate,source:sourceBasis(reading),protected_content_ref:protectedSource(reading),model_ref:modelRef.trim()?text(modelRef):null,confidence:null,evidence_refs:[],standing:'reported'}};
}
export function nextPractice(record:PersonalRecord,reading:NativeFileReading,confirmed:boolean,now=Date.now()):Record<string,unknown>{
  if(!confirmed)throw new Error('Review the selected practice protocol and deliberately confirm starting');
  const history=object(record.domain.transformation.phase_history),phases=history.phases;
  if(!Array.isArray(phases))throw new Error('No native practice history was returned');
  const last=phases[phases.length-1] as Record<string,unknown>|undefined;
  if(last&&last.closed_at_unix_ms==null)throw new Error('Close the current practice before starting its next segment');
  const n=last?(Number(last.storey)*72+Number(last.decan)*24+Number(last.stroke)+1)%864:0;
  return {kind:'practice_start',phase:{phase_ref:`nara-practice/${crypto.randomUUID()}`,storey:Math.floor(n/72),decan:Math.floor(n/24)%3,stroke:n%24,operation_refs:[],protocol_ref:reading.location.ref,container_ref:record.target.record_ref,source_revisions:[sourceBasis(reading)],opened_at_unix_ms:now,closed_at_unix_ms:null,safety:'clear',feedback_refs:[]}};
}

export function interpretOracle(packetRef:string,reading:NativeFileReading,modelRef:string,at=Date.now()):Record<string,unknown>{
  text(packetRef,'Original oracle packet');
  return {kind:'oracle_interpret',packet_ref:packetRef,interpretation:{interpretation_ref:`oracle-interpretation/${crypto.randomUUID()}`,packet_ref:packetRef,interpretation_revision:reading.revision,model_ref:modelRef.trim()?text(modelRef):null,output_ref:protectedSource(reading),source_refs:[reading.location.ref],evidence_refs:[],standing:'reported',interpreted_at_unix_ms:at}};
}
