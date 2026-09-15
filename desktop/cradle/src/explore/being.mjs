import {createParticipantAddress} from '../../../../shared-field/addressing.mjs';
import {validateActivity} from '../../../../shared-field/activity.mjs';
import {validateExpressionComposition} from '../../../../shared-field/expression-projection.mjs';

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
  const reviewers=membership.map(row=>(snapshot.participants??[]).find(candidate=>candidate.participant_ref===row.participant_ref)).filter(candidate=>candidate?.identity?.kind==='human');
  const viewer=reviewers.length===1?reviewers[0]:null;
  const related=new Set(relations.map(row=>row.other));
  const projectedExpression=(()=>{
    const latest=new Map();for(const projection of snapshot.projections??[]){const prior=latest.get(projection.projection_ref);if(!prior||Number(projection.projection_revision)>Number(prior.projection_revision))latest.set(projection.projection_ref,projection);}
    const candidates=[];for(const projection of latest.values()){if(projection.state!=="published"||projection.subject?.kind!=="expression"||!related.has(projection.subject.ref)||projection.representation?.kind!=="oi.world-presentation/v1")continue;for(const region of projection.representation.payload?.regions??[]){for(const binding of region.bindings??[]){if((binding.portable_renderer??binding.component_ref)!=="oi.presentation/expression/v1")continue;try{const composition=validateExpressionComposition(binding.props?.composition),expression=record(binding.props?.expression);if(expression.expression_ref!==composition.expression_ref||expression.expression_revision!==composition.revision||projection.subject.ref!==composition.expression_ref||projection.source?.ref!==composition.expression_ref||String(projection.source?.revision)!==String(composition.revision))continue;candidates.push({composition,projection_ref:projection.projection_ref,projection_revision:projection.projection_revision,source_refs:composition.provenance});}catch{continue;}}}}
    candidates.sort((a,b)=>b.composition.revision-a.composition.revision||Number(b.projection_revision)-Number(a.projection_revision)||a.projection_ref.localeCompare(b.projection_ref));if(!candidates.length)return null;const selected=candidates[0],conflict=candidates.some(row=>row.composition.expression_ref===selected.composition.expression_ref&&row.composition.revision===selected.composition.revision&&JSON.stringify(row.composition)!==JSON.stringify(selected.composition));return conflict?null:selected;
  })();
  const address=createParticipantAddress({to:[{
    kind:participant.identity.kind==='agent'?'agent':'human',participant:participant.participant_ref,
    address:typeof presentation.address==='string'&&/^@\S+$/.test(presentation.address)?presentation.address:`@${participant.participant_ref.replace(/^participant:/,'').replace(/[^A-Za-z0-9_.-]+/g,'-')}`,
  }],mentions:[]});
  return {
    state:'available',participant,identity:participant.identity,label:presentation.chosen_name??participant.participant_ref,
    profile:typeof presentation.summary==='string'?presentation.summary:null,
    presence:typeof presentation.presence==='string'?presentation.presence:null,
    activity,methods:strings(presentation.method_refs),relations,membership,reviewers,viewer,address,
    agency:participant.identity.kind==='agent'&&participant.agency?participant.agency:null,
    expressionRef:projectedExpression?.composition.expression_ref??null,
    expressionRevision:projectedExpression?.composition.revision??null,
    expressionComposition:projectedExpression?.composition??null,
    expressionProjection:projectedExpression?{projection_ref:projectedExpression.projection_ref,projection_revision:projectedExpression.projection_revision}:null,
    sourceRefs:projectedExpression?.source_refs??[],
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
  if(!nativeBinding)return {available:false,reason:'No native session-owner authority reading is available.'};
  if(nativeBinding.state!=='available')return {available:false,reason:nativeBinding.detail??'The native session owner did not disclose an invocable relation.'};
  if(nativeBinding.target?.agent_ref!==encounter.identity.ref)return {available:false,reason:'The native session-owner reading belongs to a different AgentRef.'};
  return {available:true,binding:nativeBinding};
}
