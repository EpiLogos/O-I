import { projectExpression, hostedExpressionArgs } from './expression-projection.mjs';
import { createProjection, withdrawProjection } from './index.mjs';
import { projectionStorageKey } from './spacetimedb.mjs';

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
  if(isCanonicalNaraBody(document))return true;
  return (document.provenance??[]).some(reading=>String(reading?.ref??'').startsWith('ql:nara:'));
}

/** A source-bound centre/anchor triggers native admission even when the scene
 * has an ordinary authored title. Detection never grants publication. */
export function isCanonicalNaraBody(document) {
  return Object.values(document?.entities??{}).some(entity=>/^ql:m-coordinate:bimba:M2-5-0\/1-[0-7]$/.test(String(entity?.subject?.subject_ref??'')));
}

/** Validate the native coordinate-only projection using the retained neutral
 * SF5 cue vocabulary. The normalized value is validation-only, never emitted. */
export function validateCanonicalNaraCues(document) {
  const normalized=clone(document);
  for(const entity of Object.values(normalized?.entities??{})) {
    const match=entity?.subject?.subject_ref?.match(/^ql:m-coordinate:bimba:M2-5-0\/1-([0-7])$/);
    if(!match||entity.subject.native_owner!=='ql-mef')throw new TypeError('Native canonical Nara cues require actual QL centre/anchor subjects');
    const index=Number(match[1]);
    entity.subject.subject_ref=`ql:nara:canonical:${index===0?'earth-body':`centre:${index-1}`}`;
    entity.subject.native_owner='ql';
  }
  validateNaraCueExpression(normalized);
  return document;
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
  if(isCanonicalNaraBody(input?.document))validateCanonicalNaraCues(input?.document);
  else validateNaraCueExpression(input?.document);
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

// ---------------------------------------------------------------- the hosted presences: listed and withdrawn

export const NARA_PRESENCES_SCHEMA = 'oi.nara-presences/v1';
export const NARA_PRESENCE_WITHDRAWAL_SCHEMA = 'oi.nara-presence-withdrawal/v1';

const consentedHint = (projection) => (projection?.relation_hints ?? []).find((hint) => hint?.kind === 'consented-presence');

/** Each hosted projection's revisions, newest first, parsed from the caller-visible rows (projectionRef, projectionRevision, fieldRef,
 * contractJson). A row whose contract does not parse is left out, never guessed. */
function projectionHistories(projectionRows) {
  const histories = new Map();
  for (const row of projectionRows ?? []) {
    let projection;
    try { projection = JSON.parse(row.contractJson); } catch { continue; }
    if (!projection || projection.projection_ref !== row.projectionRef) continue;
    histories.set(row.projectionRef, [...(histories.get(row.projectionRef) ?? []), {row, projection}]);
  }
  for (const history of histories.values()) history.sort((a, b) => Number(b.projection.projection_revision) - Number(a.projection.projection_revision));
  return histories;
}

/** The consented Nara presences the hosted field holds, as the caller may see them: each projection that ever carried a
 * consented-presence relation, its consent as that relation and its target Participant name it (the grant's time is the
 * publication's, publish_nara publishes at the grant), and whether a later revision withdrew it (its withdrawal's time is that
 * revision's publication). `filter` narrows to one publishing Participant or one field. Newest grant first. Pure. */
export function naraPresencesFromRows(rows, filter = {}) {
  const participants = new Map((rows?.participants ?? []).map((row) => [row.participantRef, row]));
  const presences = [];
  for (const [projectionRef, history] of projectionHistories(rows?.projections)) {
    const granted = history.find((entry) => consentedHint(entry.projection));
    if (!granted) continue;
    const hint = consentedHint(granted.projection), latest = history[0];
    if (filter.participant_ref && hint.from !== filter.participant_ref) continue;
    if (filter.field_ref && latest.row.fieldRef !== filter.field_ref) continue;
    const withdrawn = latest !== granted && latest.projection.state === 'withdrawn';
    const target = participants.get(hint.to);
    presences.push({projection_ref: projectionRef, projection_revision: latest.projection.projection_revision, field_ref: latest.row.fieldRef,
      state: withdrawn ? 'withdrawn' : 'published', published_at: granted.projection.published_at,
      consent: {consent_ref: hint.consent_ref, participant_ref: hint.from, expression_ref: hint.expression_ref, target_ref: hint.to,
        ...(target?.identityRef ? {target_identity_ref: target.identityRef} : {}), granted_at: granted.projection.published_at,
        state: withdrawn ? 'withdrawn' : 'granted', ...(withdrawn ? {withdrawn_at: latest.projection.published_at} : {})}});
  }
  presences.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  return {schema: NARA_PRESENCES_SCHEMA, presences};
}

/** Withdraw one hosted presence: its standing consent, rebuilt from the hosted relation and its target Participant, withdrawn
 * (withdrawNaraPresenceConsent), and the projection's next revision withdrawn with the relation expired (withdrawNaraProjection), with
 * the hosted reducer args publishArgs takes for that one revision — the field and the publisher as the module holds them, no entry or
 * relation put again. Refused in words where the presence is not hosted, is withdrawn already, stands on another consent, or the
 * withdrawal would precede its grant. Pure: publishing the args is the transport's. */
export function naraWithdrawal(rows, request, now = new Date().toISOString()) {
  const projectionRef = text(request?.projection_ref, 'withdraw_nara.projection_ref');
  const consentRef = text(request?.consent_ref, 'withdraw_nara.consent_ref');
  const withdrawalRef = text(request?.withdrawal_ref, 'withdraw_nara.withdrawal_ref');
  const history = projectionHistories(rows?.projections).get(projectionRef);
  if (!history) throw new TypeError(`No hosted Nara presence is visible at ${projectionRef}`);
  const latest = history[0], hint = consentedHint(latest.projection);
  if (latest.projection.state === 'withdrawn' || !hint) throw new TypeError(`The Nara presence at ${projectionRef} is withdrawn already`);
  if (hint.consent_ref !== consentRef) throw new TypeError(`The hosted presence stands on consent ${hint.consent_ref}, not ${consentRef}`);
  const participants = new Map((rows?.participants ?? []).map((row) => [row.participantRef, row]));
  const target = participants.get(hint.to);
  if (!target?.identityRef) throw new TypeError(`The presence's target Participant ${hint.to} is not visible to the caller`);
  const consent = createNaraPresenceConsent({consent_ref: hint.consent_ref, participant_ref: hint.from, expression_ref: hint.expression_ref,
    target_ref: hint.to, target_identity_ref: target.identityRef, granted_at: latest.projection.published_at});
  const withdrawnAt = request.withdrawn_at ?? now;
  if (!(Date.parse(withdrawnAt) > Date.parse(consent.granted_at))) throw new TypeError('A withdrawal comes after the grant it withdraws');
  const {consent: withdrawnConsent, projection} = withdrawNaraProjection({projection: latest.projection}, consent, {withdrawn_at: withdrawnAt, withdrawal_ref: withdrawalRef});
  const fieldRow = (rows?.sharedFields ?? []).find((row) => row.fieldRef === latest.row.fieldRef);
  const publisherRow = participants.get(projection.publisher_participant_ref);
  if (!fieldRow || !publisherRow) throw new TypeError(`The field ${latest.row.fieldRef} or its publisher ${projection.publisher_participant_ref} is not visible to the caller`);
  const field = JSON.parse(fieldRow.contractJson), participant = JSON.parse(publisherRow.contractJson);
  const args = {
    putSharedField: {fieldRef: field.field_ref, kind: field.kind, visibility: field.visibility, contractJson: fieldRow.contractJson},
    putParticipant: {participantRef: participant.participant_ref, fieldRef: participant.field_ref, identityKind: participant.identity.kind, identityRef: participant.identity.ref,
      sourceSystem: participant.provenance.source_system, sourceRevision: participant.provenance.source_revision, contractJson: publisherRow.contractJson},
    putProjection: {projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision), fieldRef: field.field_ref,
      projectionRef: projection.projection_ref, projectionRevision: projection.projection_revision, sourceRevision: projection.source.revision,
      publisherParticipantRef: projection.publisher_participant_ref, state: projection.state, contractJson: JSON.stringify(projection)},
    putExploreEntries: [],
    putExploreRelations: [],
  };
  return {consent: withdrawnConsent, projection, args};
}
