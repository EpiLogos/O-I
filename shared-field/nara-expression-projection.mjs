import { projectExpression, hostedExpressionArgs } from './expression-projection.mjs';
import { createProjection, withdrawProjection } from './index.mjs';

export const NARA_PRESENCE_CONSENT_SCHEMA = 'oi.nara-presence-consent/v1';
const text = (value, name) => {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new TypeError(`${name} must be non-empty text`);
  return value;
};
const clone = (value) => JSON.parse(JSON.stringify(value));

export function isNaraCueExpression(document) {
  try { validateNaraCueExpression(document); return true; } catch { return false; }
}

/** Detect Nara ownership independently of whether its safe publication
 * specimen is valid. The desktop must route a malformed Nara document into
 * the protected path so validation fails closed instead of treating it as an
 * ordinary Expression. */
export function isNaraBoundExpression(document) {
  if(!document||document.schema!=='oi.expression/v1')return false;
  if(/^Nara(?:\s|\s*·|$)/i.test(String(document.title??'')))return true;
  if(Object.values(document.entities??{}).some(entity=>String(entity?.subject?.subject_ref??'').startsWith('ql:nara:')))return true;
  return (document.provenance??[]).some(reading=>String(reading?.ref??'').startsWith('ql:nara:'));
}

const forbidden=/identity|journal|activity|bioquaternion|personal|agent.session|private|credential|scalar|resonance/i;
export function validateNaraCueExpression(document) {
  if (!document || document.schema !== 'oi.expression/v1') throw new TypeError('Nara cue document must be oi.expression/v1');
  const allowedKeys=['schema','expression_ref','revision','title','scenes','entities','relations','selection','provenance','representations','refinements'];
  if(Object.keys(document).some(key=>!allowedKeys.includes(key)))throw new TypeError('Nara cue document contains non-contract state');
  if(document.title!=='Nara · safe cues'||!Array.isArray(document.scenes)||document.scenes.length!==1||document.scenes[0].title!=='Seven centres and EarthBody')throw new TypeError('Nara cue document must use the authored safe scene');
  if(Object.keys(document.relations??{}).length||document.representations?.length||document.refinements?.length)throw new TypeError('Nara cue document cannot carry relations, renderer state or refinements');
  const entries=Object.values(document.entities??{});if(entries.length!==8)throw new TypeError('Nara cue document requires exactly eight loci');
  const exact=(value,keys)=>value&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
  if(!exact(document.scenes[0],['scene_ref','revision','title','entity_refs'])||!exact(document.selection,['scene_ref','entity_ref']))throw new TypeError('Nara scene carries non-contract state');
  const loci=entries.map(entity=>entity?.subject?.subject_ref);const matches=loci.map(ref=>typeof ref==='string'&&ref.match(/^(ql:nara:.+):(centre:([0-6])|earth-body)$/));
  if(matches.some(match=>!match)||new Set(matches.map(match=>match[1])).size!==1)throw new TypeError('All Nara loci must share one occasion/subject basis');
  const ordinals=matches.filter(match=>match[2].startsWith('centre:')).map(match=>Number(match[3])).sort();
  if(JSON.stringify(ordinals)!=='[0,1,2,3,4,5,6]'||matches.filter(match=>match[2]==='earth-body').length!==1)throw new TypeError('Nara cue document requires centres 0..6 and one distinct EarthBody');
  for(const [index,entity] of entries.entries()){
    const earth=matches[index][2]==='earth-body';const expected=new Set(['glyph','x','y','scale']);
    if(!exact(entity,['entity_ref','revision','title','subject','parameters'])||!exact(entity.subject,['subject_ref','native_owner','presentation_role','sources','readings','actions']))throw new TypeError('Nara locus carries non-contract state');
    if(entity.subject.native_owner!=='ql'||entity.subject.presentation_role!=='thing'||entity.subject.sources.length||entity.subject.readings.length||entity.subject.actions.length)throw new TypeError('Nara loci must remain neutral QL-owned subject bindings');
    if(Object.keys(entity.parameters??{}).some(key=>!expected.has(key))||Object.keys(entity.parameters??{}).length!==4)throw new TypeError('Nara cues carry only neutral glyph and layout parameters');
    if(Object.values(entity.parameters).some(parameter=>!exact(parameter,['value','automation'])||parameter.automation!==null))throw new TypeError('Nara cue parameters must be static scalar values');
    const ordinal=earth?7:Number(matches[index][3]),expectedY=earth?-376:-264+ordinal*88;
    if(entity.title!==(earth?'EarthBody':`Centre ${ordinal+1}`)||entity.parameters.glyph.value!==(earth?'⊕':String(ordinal+1))||entity.parameters.x.value!==0||entity.parameters.y.value!==expectedY||entity.parameters.scale.value!==1)throw new TypeError('Nara cue material differs from the authored neutral scene');
  }
  for(const reading of document.provenance??[])if(!exact(reading,['ref','revision','availability'])||typeof reading.ref!=='string'||forbidden.test(reading.ref)||!(/^(source:[a-z0-9@._:/-]+|ql:nara:focus:m4)$/i.test(reading.ref))||reading.availability!=='unavailable')throw new TypeError('Nara provenance is not an admitted source/Epi cue ref');
  return document;
}

export function createNaraPresenceConsent(input) {
  if (!input || typeof input !== 'object') throw new TypeError('Nara presence consent must be an object');
  const participantRef = text(input.participant_ref, 'consent.participant_ref');
  const expressionRef = text(input.expression_ref, 'consent.expression_ref');
  const targetRef = text(input.target_ref, 'consent.target_ref');
  const targetIdentityRef = text(input.target_identity_ref, 'consent.target_identity_ref');
  const consentRef = text(input.consent_ref, 'consent.consent_ref');
  const grantedAt = text(input.granted_at, 'consent.granted_at');
  if (!expressionRef.startsWith('expression:')) throw new TypeError('consent.expression_ref must be an Expression ref');
  if (!targetRef.startsWith('participant:')) throw new TypeError('consent.target_ref must be a Participant ref');
  if (Number.isNaN(Date.parse(grantedAt))) throw new TypeError('consent.granted_at must be an ISO timestamp');
  return {schema:NARA_PRESENCE_CONSENT_SCHEMA,consent_ref:consentRef,participant_ref:participantRef,
    expression_ref:expressionRef,target_ref:targetRef,target_identity_ref:targetIdentityRef,state:'granted',granted_at:grantedAt,
    source_refs:[...(input.source_refs ?? []).map((ref, i) => text(ref, `consent.source_refs[${i}]`))]};
}

export function withdrawNaraPresenceConsent(consent, input) {
  const current = validateNaraPresenceConsent(consent);
  if (current.state !== 'granted') throw new TypeError('Nara presence consent is already withdrawn');
  const withdrawnAt = text(input?.withdrawn_at, 'withdrawal.withdrawn_at');
  if (Number.isNaN(Date.parse(withdrawnAt))) throw new TypeError('withdrawal.withdrawn_at must be an ISO timestamp');
  return {...current,state:'withdrawn',withdrawn_at:withdrawnAt,withdrawal_ref:text(input.withdrawal_ref,'withdrawal.withdrawal_ref')};
}

export function validateNaraPresenceConsent(value) {
  if (!value || value.schema !== NARA_PRESENCE_CONSENT_SCHEMA) throw new TypeError(`Unsupported Nara presence consent: ${value?.schema}`);
  const base=createNaraPresenceConsent(value);
  if (value.state === 'withdrawn') return {...base,state:'withdrawn',withdrawn_at:text(value.withdrawn_at,'consent.withdrawn_at'),withdrawal_ref:text(value.withdrawal_ref,'consent.withdrawal_ref')};
  if (value.state !== 'granted') throw new TypeError('consent.state must be granted or withdrawn');
  return base;
}

export function projectNaraExpression(input) {
  validateNaraCueExpression(input?.document);
  const consent=validateNaraPresenceConsent(input.consent);
  if (consent.state !== 'granted') throw new TypeError('Current explicit Nara presence consent is required at publication time');
  if (consent.expression_ref !== input.document.expression_ref) throw new TypeError('Nara presence consent belongs to another Expression');
  const bundle=projectExpression({...input,selection:{...(input.selection??{}),include_source_refs:[],disclose_sources:'none'}});
  if (consent.participant_ref !== bundle.participant.participant_ref) throw new TypeError('Nara presence consent belongs to another publishing Participant');
  if (!bundle.projection.audience.refs?.includes(consent.target_ref)) throw new TypeError('Nara presence target must be explicitly named in the Projection audience');
  const relation={kind:'consented-presence',from:consent.participant_ref,to:consent.target_ref,expression_ref:consent.expression_ref,consent_ref:consent.consent_ref};
  const projection=createProjection({...bundle.projection,relation_hints:[relation]});
  return {...bundle,projection,nara_presence:{consent:clone(consent),relation}};
}

export function hostedNaraExpressionArgs(bundle) {
  if (!bundle?.nara_presence) throw new TypeError('Hosted Nara publication requires an admitted presence relation');
  const args=hostedExpressionArgs(bundle),consent=validateNaraPresenceConsent(bundle.nara_presence.consent);
  if (consent.state !== 'granted') throw new TypeError('Withdrawn Nara presence consent cannot be hosted');
  const targetParticipant={schema:'oi.participant/v1',participant_ref:consent.target_ref,field_ref:bundle.field_ref,
    identity:{kind:'human',ref:consent.target_identity_ref},presentation:{world_ref:`world:${consent.target_identity_ref}`},
    provenance:{source_system:'o-i',source_revision:consent.granted_at,source_ref:consent.consent_ref}};
  return {...args,putParticipants:[{participantRef:targetParticipant.participant_ref,fieldRef:targetParticipant.field_ref,identityKind:'human',identityRef:targetParticipant.identity.ref,sourceSystem:'o-i',sourceRevision:consent.granted_at,contractJson:JSON.stringify(targetParticipant)}]};
}

export function withdrawNaraProjection(bundle, consent, input) {
  const withdrawnConsent=withdrawNaraPresenceConsent(consent,input);
  const withdrawn=withdrawProjection(bundle.projection,{published_at:withdrawnConsent.withdrawn_at,reason:'Nara shared-presence consent withdrawn'});
  const {relation_hints:_expired,...withoutExpiredRelation}=withdrawn;
  const projection=createProjection(withoutExpiredRelation);
  return {consent:withdrawnConsent,projection};
}
