import {createParticipantAddress} from '../../../../shared-field/addressing.mjs';
import {validateActivity} from '../../../../shared-field/activity.mjs';

const record=(value)=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'&&item.trim()):[];

/**
 * Project the policy-selected portion of one hosted Participant as a Being.
 * Every optional disclosure remains optional; absence is never filled from a
 * local AgentSession or the viewer's personal context.
 */
export function beingEncounter(snapshot,participantRef) {
  if(!snapshot||snapshot.state==='unavailable')return {state:'unavailable',reason:snapshot?.detail??'the SharedField is unavailable'};
  const participant=(snapshot.participants??[]).find(row=>row.participant_ref===participantRef);
  if(!participant)return {state:'absent',reason:`The field holds no Being ${participantRef}.`};
  const presentation=record(participant.presentation);
  const activity=(()=>{try{return presentation.activity?validateActivity(presentation.activity):null;}catch{return null;}})();
  const relations=(snapshot.relations??[]).filter(row=>row.from===participantRef||row.to===participantRef).map(row=>({
    relation:row.relation,origin:row.origin,direction:row.from===participantRef?'out':'in',other:row.from===participantRef?row.to:row.from,
  }));
  const membership=(snapshot.my_authority??[]).filter(row=>row.field_ref===participant.field_ref&&!row.revoked);
  const address=createParticipantAddress({to:[{
    kind:participant.identity.kind==='agent'?'agent':'human',participant:participant.participant_ref,
    address:typeof presentation.address==='string'&&/^@\S+$/.test(presentation.address)?presentation.address:`@${participant.participant_ref.replace(/^participant:/,'').replace(/[^A-Za-z0-9_.-]+/g,'-')}`,
  }],mentions:[]});
  return {
    state:'available',participant,identity:participant.identity,label:presentation.chosen_name??participant.participant_ref,
    profile:typeof presentation.summary==='string'?presentation.summary:null,
    presence:typeof presentation.presence==='string'?presentation.presence:null,
    activity,methods:strings(presentation.method_refs),relations,membership,address,
    agency:participant.identity.kind==='agent'&&participant.agency?participant.agency:null,
    expressionRef:typeof presentation.expression_ref==='string'?presentation.expression_ref:null,
    expressionRevision:Number.isSafeInteger(presentation.expression_revision)&&presentation.expression_revision>0?presentation.expression_revision:null,
    expressionComposition:record(presentation.expression_composition).schema==='oi.expression/v1'?presentation.expression_composition:null,
    sourceRefs:strings(presentation.source_refs),
  };
}

/**
 * Invocation is available only when a native owner supplies an exact local
 * AgentSession binding for the projected Agent. Participant membership,
 * addressability and presence are deliberately insufficient.
 */
export function invocationStanding(encounter,nativeBinding=null) {
  if(encounter?.state!=='available'||encounter.identity.kind!=='agent')return {available:false,reason:'This Being is not a projected Agent.'};
  if(!encounter.agency)return {available:false,reason:'The Projection discloses no native Agent agency.'};
  if(!nativeBinding)return {available:false,reason:'No native Gateway authority reading is available.'};
  if(nativeBinding.state!=='available')return {available:false,reason:nativeBinding.detail??'The native gateway did not disclose an invocable relation.'};
  if(nativeBinding.target?.agent_ref!==encounter.identity.ref)return {available:false,reason:'The native gateway reading belongs to a different AgentRef.'};
  return {available:true,binding:nativeBinding};
}
