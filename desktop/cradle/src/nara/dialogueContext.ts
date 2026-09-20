/**
 * `ql.nara-dialogue-context/v1` — the bounded semantic context of one
 * dialogical Nara turn (QL-MEF #201, `ql-mef/src/nara/dialogue.rs`).
 *
 * The desktop CONSTRUCTS this from real current application state each turn:
 * the live Expression document's refs and revisions, the app-owned subject
 * bindings, the refs actually disclosed (with their disclosure receipts),
 * the pointed/hovered/pinned attention facts, and the actions the owners
 * disclose. Disclosure is a fact carried by the context, never an ambient
 * right: a ref enters a turn only when it is disclosed, selected, or
 * structural. Renderer scraping is not part of the contract and protected
 * source is never filled in.
 */

import {
  EPII_ENRICHMENT_VERSION,NARA_DEIXIS_VERSION,NARA_DIALOGUE_CONTEXT_VERSION,NARA_EPII_DELEGATION_VERSION,
  exactKeys,readSupport,requireObject,wireLongText,wireRefs,wireText,wireTimestamp,wireUnixMs,
  type SpeechSupport,
} from "./support";

export const MAX_DISCLOSED_REFS=256;
export const MAX_PINNED_REFS=64;
export const MAX_SELECTION_REFS=64;
export const MAX_ACTION_REFS=256;
export const MAX_SCOPE_REFS=256;
export const MAX_CITED_REFS=256;
export const MAX_PROPOSED_REFS=64;
export const MAX_QUESTIONS=16;
export const MAX_BRIEF_LEN=16_384;

export type MFocus="m0"|"m1"|"m2"|"m3"|"m4"|"m5";
export type M4Branch="identity"|"embodied"|"oracle"|"transformation"|"context"|"integration";
const BRANCH_COORDINATE:Record<M4Branch,string>={identity:"M4.0",embodied:"M4.1",oracle:"M4.2",transformation:"M4.3",context:"M4.4",integration:"M4.5"};
export type DialogueFrame="nous"|"logos"|"eros"|"mythos"|"anima"|"psyche"|"sophia";
export type EvidenceStanding="source"|"authored-architecture"|"implementation"|"observed"|"derived"|"reported"|"proposed"|"unavailable";
export type DisclosureKind="khora-entry"|"hen-disclosure"|"personal-consent"|"shared-projection";
export type ExpressiveActPhase="composing"|"active"|"interrupted"|"completed"|"cancelled";
const LIVE_PHASES:ExpressiveActPhase[]=["composing","active"];

export interface AdmittedOccasion {day_ref:string;day_revision:string;now_ref:string;now_revision:string;admitted_via_ref:string}
export interface DisclosedRef {ref_id:string;revision:string;standing:EvidenceStanding;disclosure:DisclosureKind;disclosed_via_ref:string}
export interface BimbaSelectionBinding {owner_contract_ref:string;registry_revision:string;selected_source_ref:string;direct_canonical_ref:string;conjugate_canonical_ref:string}
export interface CPrimeDialogueBinding {participation:"dialogical"|"authorised-undertaking";content_type:string;position:string;frame:DialogueFrame;thread_form:string;sequence:string;composition_ref:string;composition_revision:string}
export interface SharedFieldRelation {shared_field_ref:string;consent_ref:string;participant_subject_refs:string[]}
export interface ExpressiveActCheckpoint {checkpoint_ref:string;checkpoint_expression_revision:string}
export interface ExpressiveActState {
  expressive_act_ref:string;
  phase:ExpressiveActPhase;
  basis_expression_revision:string;
  speech_turn_ref:string|null;
  checkpoint:ExpressiveActCheckpoint|null;
}

export interface NaraDialogueContext {
  schema:typeof NARA_DIALOGUE_CONTEXT_VERSION;
  context_ref:string;
  nara_ref:string;
  subject_ref:string;
  agent_session_ref:string;
  m4_branch:M4Branch|null;
  coordinate_ref:string;
  bimba:BimbaSelectionBinding|null;
  expression_ref:string;
  expression_revision:string;
  profile_ref:string;
  profile_revision:string;
  scene_ref:string|null;
  active_m_focus:MFocus;
  pointed_ref:string|null;
  hovered_ref:string|null;
  pinned_refs:string[];
  occasion:AdmittedOccasion|null;
  disclosed:DisclosedRef[];
  available_action_refs:string[];
  c_prime:CPrimeDialogueBinding|null;
  shared_field:SharedFieldRelation|null;
  expressive_act:ExpressiveActState|null;
}

const CONTEXT_KEYS=["schema","context_ref","nara_ref","subject_ref","agent_session_ref","m4_branch","coordinate_ref","bimba","expression_ref","expression_revision","profile_ref","profile_revision","scene_ref","active_m_focus","pointed_ref","hovered_ref","pinned_refs","occasion","disclosed","available_action_refs","c_prime","shared_field","expressive_act"] as const;
const STANDINGS:EvidenceStanding[]=["source","authored-architecture","implementation","observed","derived","reported","proposed","unavailable"];
const DISCLOSURES:DisclosureKind[]=["khora-entry","hen-disclosure","personal-consent","shared-projection"];
const MFOCUSES:MFocus[]=["m0","m1","m2","m3","m4","m5"];
const BRANCHES:M4Branch[]=["identity","embodied","oracle","transformation","context","integration"];

/** Validate the context exactly as the QL owner admits it (serde mirror,
 * `deny_unknown_fields` included). */
export function validateDialogueContext(value:unknown):NaraDialogueContext {
  const v=exactKeys(value,CONTEXT_KEYS,"dialogue context") as unknown as NaraDialogueContext;
  if(v.schema!==NARA_DIALOGUE_CONTEXT_VERSION)throw new Error("unsupported Nara dialogue context contract");
  wireText(v.context_ref,"dialogue context reference");
  wireText(v.nara_ref,"Nara reference");
  wireText(v.subject_ref,"Nara subject");
  wireText(v.agent_session_ref,"AgentSession reference");
  if(v.nara_ref===v.agent_session_ref)throw new Error("NaraRef and AgentSessionRef must remain distinct identities");
  if(v.m4_branch!=null){
    if(!BRANCHES.includes(v.m4_branch))throw new Error("invalid M4 branch");
    if(!v.coordinate_ref.startsWith(BRANCH_COORDINATE[v.m4_branch]))throw new Error("dialogue coordinate lies outside its M4 branch");
  }
  if(v.active_m_focus==="m4"&&v.m4_branch==null)throw new Error("M4 focus requires the M4 branch relation");
  if(!MFOCUSES.includes(v.active_m_focus))throw new Error("invalid M focus");
  wireText(v.coordinate_ref,"dialogue coordinate");
  wireText(v.expression_ref,"Expression reference");
  wireText(v.expression_revision,"Expression revision");
  wireText(v.profile_ref,"profile reference");
  wireText(v.profile_revision,"profile revision");
  if(v.scene_ref!=null)wireText(v.scene_ref,"scene reference");
  if(v.bimba!=null){
    exactKeys(v.bimba,["owner_contract_ref","registry_revision","selected_source_ref","direct_canonical_ref","conjugate_canonical_ref"],"Bimba selection binding");
    wireText(v.bimba.owner_contract_ref,"owner contract reference");
    wireText(v.bimba.registry_revision,"Bimba registry revision");
    wireText(v.bimba.selected_source_ref,"selected Bimba source reference");
    wireText(v.bimba.direct_canonical_ref,"direct canonical reference");
    wireText(v.bimba.conjugate_canonical_ref,"conjugate canonical reference");
  }
  if(v.pointed_ref!=null)wireText(v.pointed_ref,"pointed reference");
  if(v.hovered_ref!=null)wireText(v.hovered_ref,"hovered reference");
  v.pinned_refs=wireRefs(v.pinned_refs,"pinned reference",MAX_PINNED_REFS);
  if(v.occasion!=null){
    exactKeys(v.occasion,["day_ref","day_revision","now_ref","now_revision","admitted_via_ref"],"admitted occasion");
    wireText(v.occasion.day_ref,"Central Day reference");
    wireText(v.occasion.day_revision,"Central Day revision");
    wireText(v.occasion.now_ref,"Central NOW reference");
    wireText(v.occasion.now_revision,"Central NOW revision");
    wireText(v.occasion.admitted_via_ref,"occasion admission authority");
  }
  if(!Array.isArray(v.disclosed))throw new Error("disclosed must be a list");
  if(v.disclosed.length>MAX_DISCLOSED_REFS)throw new Error("too many disclosed references");
  const seen=new Set<string>();
  for(const entry of v.disclosed){
    exactKeys(entry,["ref_id","revision","standing","disclosure","disclosed_via_ref"],"disclosed reference");
    wireText(entry.ref_id,"disclosed reference");
    wireText(entry.revision,"disclosed revision");
    wireText(entry.disclosed_via_ref,"disclosure receipt");
    if(!STANDINGS.includes(entry.standing))throw new Error("invalid disclosed standing");
    if(!DISCLOSURES.includes(entry.disclosure))throw new Error("invalid disclosure kind");
    if(seen.has(entry.ref_id))throw new Error("duplicate disclosed reference");
    seen.add(entry.ref_id);
  }
  v.available_action_refs=wireRefs(v.available_action_refs,"available action reference",MAX_ACTION_REFS);
  if(v.c_prime!=null){
    exactKeys(v.c_prime,["participation","content_type","position","frame","thread_form","sequence","composition_ref","composition_revision"],"C′ dialogue binding");
    wireText(v.c_prime.composition_ref,"C′ composition reference");
    wireText(v.c_prime.composition_revision,"C′ composition revision");
    if(v.c_prime.participation!=="dialogical"&&v.c_prime.participation!=="authorised-undertaking")throw new Error("invalid C′ participation");
    if(!/^CT[0-5]b?'?$/.test(v.c_prime.content_type))throw new Error("invalid C′ content type");
    if(!/^4\.[0-5]$/.test(v.c_prime.position))throw new Error("invalid C′ position");
    if(!/^CFP[0-5]$/.test(v.c_prime.thread_form))throw new Error("invalid C′ thread form");
    if(!/^CS[0-5]$/.test(v.c_prime.sequence))throw new Error("invalid C′ sequence");
  }
  if(v.shared_field!=null){
    exactKeys(v.shared_field,["shared_field_ref","consent_ref","participant_subject_refs"],"SharedField relation");
    wireText(v.shared_field.shared_field_ref,"SharedField reference");
    wireText(v.shared_field.consent_ref,"shared-presence consent reference");
    v.shared_field.participant_subject_refs=wireRefs(v.shared_field.participant_subject_refs,"shared participant subject",64);
  }
  if(v.expressive_act!=null){
    validateExpressiveActState(v.expressive_act);
    if(v.expressive_act.basis_expression_revision!==v.expression_revision)throw new Error("active ExpressiveAct is not on the current Expression revision");
  }
  return v;
}

/** The QL ExpressiveAct turn-state laws: a non-live act claims no speech
 * turn — interruption must stop the voice. */
export function validateExpressiveActState(state:ExpressiveActState):ExpressiveActState {
  const s=exactKeys(state,["expressive_act_ref","phase","basis_expression_revision","speech_turn_ref","checkpoint"],"ExpressiveAct state") as unknown as ExpressiveActState;
  wireText(s.expressive_act_ref,"ExpressiveAct reference");
  wireText(s.basis_expression_revision,"ExpressiveAct basis revision");
  if(!["composing","active","interrupted","completed","cancelled"].includes(s.phase))throw new Error("invalid ExpressiveAct phase");
  if(s.speech_turn_ref!=null)wireText(s.speech_turn_ref,"speech turn reference");
  if(!LIVE_PHASES.includes(s.phase)&&s.speech_turn_ref!=null)throw new Error("a non-live ExpressiveAct still claims a speech turn: interruption must stop the voice");
  if(s.checkpoint!=null){
    exactKeys(s.checkpoint,["checkpoint_ref","checkpoint_expression_revision"],"ExpressiveAct checkpoint");
    wireText(s.checkpoint.checkpoint_ref,"checkpoint reference");
    wireText(s.checkpoint.checkpoint_expression_revision,"checkpoint Expression revision");
  }
  return s;
}

export function expressiveActLive(phase:ExpressiveActPhase):boolean {return LIVE_PHASES.includes(phase);}

/** Reconnect continuity: the same Nara, subject, coordinate, Expression and
 * profile standing means the same canonical dialogue continues. A new
 * AgentSession or body is expected; a changed identity refuses (QL `continues`). */
export function contextContinues(previous:NaraDialogueContext,next:NaraDialogueContext):void {
  validateDialogueContext(previous);validateDialogueContext(next);
  if(next.nara_ref!==previous.nara_ref)throw new Error("reconnect changed the Nara identity");
  if(next.subject_ref!==previous.subject_ref)throw new Error("reconnect changed the subject");
  if(next.coordinate_ref!==previous.coordinate_ref)throw new Error("reconnect changed the coordinate");
  if(next.expression_ref!==previous.expression_ref)throw new Error("reconnect changed the Expression");
  if(next.profile_ref!==previous.profile_ref||next.profile_revision!==previous.profile_revision)throw new Error("reconnect changed the profile standing");
}

// ---------------------------------------------------------------------------
// Construction from real desktop state
// ---------------------------------------------------------------------------

/** Everything the construction needs from the live application. The caller
 * passes only what is actually true right now — the builder invents nothing. */
export interface DialogueContextInput {
  context_ref:string;
  nara_ref:string;
  subject_ref:string;
  agent_session_ref:string;
  coordinate_ref:string;
  m4_branch?:M4Branch|null;
  bimba?:BimbaSelectionBinding|null;
  expression_ref:string;
  expression_revision:string;
  profile_ref:string;
  profile_revision:string;
  scene_ref?:string|null;
  active_m_focus?:MFocus;
  pointed_ref?:string|null;
  hovered_ref?:string|null;
  pinned_refs?:string[];
  occasion?:AdmittedOccasion|null;
  /** Only refs actually disclosed, each with its disclosure receipt. */
  disclosed:DisclosedRef[];
  available_action_refs?:string[];
  c_prime?:CPrimeDialogueBinding|null;
  shared_field?:SharedFieldRelation|null;
  expressive_act?:ExpressiveActState|null;
}

export function buildDialogueContext(input:DialogueContextInput):NaraDialogueContext {
  return validateDialogueContext({
    schema:NARA_DIALOGUE_CONTEXT_VERSION,
    context_ref:input.context_ref,
    nara_ref:input.nara_ref,
    subject_ref:input.subject_ref,
    agent_session_ref:input.agent_session_ref,
    m4_branch:input.m4_branch??null,
    coordinate_ref:input.coordinate_ref,
    bimba:input.bimba??null,
    expression_ref:input.expression_ref,
    expression_revision:input.expression_revision,
    profile_ref:input.profile_ref,
    profile_revision:input.profile_revision,
    scene_ref:input.scene_ref??null,
    active_m_focus:input.active_m_focus??"m4",
    pointed_ref:input.pointed_ref??null,
    hovered_ref:input.hovered_ref??null,
    pinned_refs:input.pinned_refs??[],
    occasion:input.occasion??null,
    disclosed:input.disclosed,
    available_action_refs:input.available_action_refs??[],
    c_prime:input.c_prime??null,
    shared_field:input.shared_field??null,
    expressive_act:input.expressive_act??null,
  });
}

// ---------------------------------------------------------------------------
// Admission law
// ---------------------------------------------------------------------------

function isStructural(context:NaraDialogueContext,refId:string):boolean {
  return refId===context.coordinate_ref
    ||refId===context.expression_ref
    ||refId===context.profile_ref
    ||context.scene_ref===refId
    ||(context.bimba!=null&&(context.bimba.selected_source_ref===refId||context.bimba.direct_canonical_ref===refId||context.bimba.conjugate_canonical_ref===refId));
}

function isSelected(context:NaraDialogueContext,refId:string):boolean {
  return context.pointed_ref===refId||context.hovered_ref===refId||context.pinned_refs.includes(refId);
}

/** A ref is admitted to the dialogue turn only when it is disclosed,
 * selected, or structural. */
export function isAdmitted(context:NaraDialogueContext,refId:string):boolean {
  return context.disclosed.some(entry=>entry.ref_id===refId)||isSelected(context,refId)||isStructural(context,refId);
}

/** Admit a candidate set for one turn. Refusal names the offending ref; no
 * silent narrowing and no silent widening (QL `admit_refs`). */
export function admitRefs(context:NaraDialogueContext,candidates:readonly string[]):string[] {
  const admitted:string[]=[];const unique=new Set<string>();
  for(const candidate of candidates){
    wireText(candidate,"turn candidate reference");
    if(!isAdmitted(context,candidate))throw new Error(`reference ${candidate} is not admitted to Nara context: it is neither disclosed, selected, nor structural`);
    if(!unique.has(candidate)){unique.add(candidate);admitted.push(candidate);}
  }
  if(admitted.length>MAX_SCOPE_REFS)throw new Error("too many admitted turn references");
  return admitted;
}

export interface BoundedTurnContext {coordinate_ref:string;expression_ref:string;expression_revision:string;turn_refs:string[]}

/** The bounded context actually attached to one dialogue turn. */
export function turnContext(context:NaraDialogueContext,turnRefs:readonly string[]):BoundedTurnContext {
  return {
    coordinate_ref:context.coordinate_ref,
    expression_ref:context.expression_ref,
    expression_revision:context.expression_revision,
    turn_refs:admitRefs(context,turnRefs),
  };
}

// ---------------------------------------------------------------------------
// Deixis (ql.nara-deixis/v1) — the official pointing path
// ---------------------------------------------------------------------------

export type DeicticKind="pointed"|"hovered"|"pinned"|"spoken";
export type SemanticTargetKind="subject"|"coordinate"|"relation"|"source"|"property"|"scene"|"expression"|"profile"|"page";
export type FocusAction="highlight"|"select"|"open";

export function defaultFocusAction(kind:DeicticKind):FocusAction {
  return kind==="hovered"?"highlight":"select";
}

export type DeicticTarget=
  |{target:"exact";ref_id:string;target_kind:SemanticTargetKind}
  |{target:"spoken";phrase:string;candidate_refs:string[]};

export interface DeixisRequest {
  schema:typeof NARA_DEIXIS_VERSION;
  deixis_ref:string;
  nara_ref:string;
  turn_ref:string;
  basis_expression_revision:string;
  kind:DeicticKind;
  target:DeicticTarget;
  requested_at_unix_ms:number;
}

/** Build a deixis request from an application attention fact. Pointer/hover/
 * selection/pin arrive already mapped to the exact ref the application owns. */
export function buildDeixisRequest(input:{deixis_ref:string;nara_ref:string;turn_ref:string;basis_expression_revision:string;kind:DeicticKind;target:DeicticTarget;requested_at_unix_ms:number}):DeixisRequest {
  const request:DeixisRequest={
    schema:NARA_DEIXIS_VERSION,
    deixis_ref:wireText(input.deixis_ref,"deixis reference"),
    nara_ref:wireText(input.nara_ref,"deixis Nara reference"),
    turn_ref:wireText(input.turn_ref,"dialogue turn reference"),
    basis_expression_revision:wireText(input.basis_expression_revision,"deixis basis revision"),
    kind:input.kind,
    target:validateDeicticTarget(input.kind,input.target),
    requested_at_unix_ms:wireUnixMs(input.requested_at_unix_ms,"requested_at_unix_ms"),
  };
  return request;
}

function validateDeicticTarget(kind:DeicticKind,target:DeicticTarget):DeicticTarget {
  if(target.target==="exact"){
    if(kind==="spoken")throw new Error("a spoken deixis kind cannot carry an exact target");
    return {target:"exact",ref_id:wireText(target.ref_id,"exact deictic target"),target_kind:target.target_kind};
  }
  if(kind!=="spoken")throw new Error("an exact deictic target cannot carry the spoken kind");
  return {target:"spoken",phrase:wireLongText(target.phrase,"spoken phrase",4096),candidate_refs:wireRefs(target.candidate_refs,"spoken candidate reference",MAX_SELECTION_REFS)};
}

export interface DeicticFocus {ref_id:string;target_kind:SemanticTargetKind|null;focus_action:FocusAction}

export type DeixisOutcome=
  |{outcome:"focused";focus:DeicticFocus[];turn_context:BoundedTurnContext}
  |{outcome:"unresolved-outside-context";ref_id:string};

export interface DeixisResolution {
  schema:typeof NARA_DEIXIS_VERSION;
  resolution_ref:string;
  deixis_ref:string;
  turn_ref:string;
  nara_ref:string;
  outcome:DeixisOutcome;
}

/** Semantic deixis resolution against the bounded context only: human
 * pointer/selection arrives already mapped; Nara's spoken reference resolves
 * against its own context. Nothing outside the context is ever invented.
 * A stale basis (the Expression revision moved) is refused — re-read state,
 * do not force it. */
export function resolveDeixis(context:NaraDialogueContext,request:DeixisRequest):DeixisResolution {
  if(request.schema!==NARA_DEIXIS_VERSION)throw new Error("unsupported Nara deixis contract");
  validateDeicticTarget(request.kind,request.target);
  if(request.nara_ref!==context.nara_ref)throw new Error("deixis request belongs to another Nara");
  if(request.basis_expression_revision!==context.expression_revision){
    throw new Error(`deixis request is stale: composed against Expression revision ${request.basis_expression_revision} while the live context is at ${context.expression_revision}`);
  }
  let outcome:DeixisOutcome;
  if(request.target.target==="exact"){
    if(!isAdmitted(context,request.target.ref_id)){
      outcome={outcome:"unresolved-outside-context",ref_id:request.target.ref_id};
    }else{
      const focus:DeicticFocus={ref_id:request.target.ref_id,target_kind:request.target.target_kind,focus_action:defaultFocusAction(request.kind)};
      outcome={outcome:"focused",focus:[focus],turn_context:turnContext(context,[request.target.ref_id])};
    }
  }else{
    if(!request.target.candidate_refs.length)throw new Error(`spoken reference ${JSON.stringify(request.target.phrase)} resolved to no candidate and Nara does not invent refs`);
    const admitted=admitRefs(context,request.target.candidate_refs);
    outcome={outcome:"focused",focus:admitted.map(refId=>({ref_id:refId,target_kind:null,focus_action:defaultFocusAction(request.kind)})),turn_context:turnContext(context,admitted)};
  }
  const resolution:DeixisResolution={
    schema:NARA_DEIXIS_VERSION,
    resolution_ref:`${request.deixis_ref}:resolution`,
    deixis_ref:request.deixis_ref,
    turn_ref:request.turn_ref,
    nara_ref:context.nara_ref,
    outcome,
  };
  validateDeixisResolution(resolution);
  return resolution;
}

export function validateDeixisResolution(resolution:DeixisResolution):DeixisResolution {
  exactKeys(resolution,["schema","resolution_ref","deixis_ref","turn_ref","nara_ref","outcome"],"deixis resolution");
  wireText(resolution.resolution_ref,"deixis resolution reference");
  wireText(resolution.deixis_ref,"deixis reference");
  wireText(resolution.turn_ref,"dialogue turn reference");
  wireText(resolution.nara_ref,"deixis Nara reference");
  if(resolution.outcome.outcome==="focused"){
    if(!resolution.outcome.focus.length)throw new Error("focused deixis resolution lost its focus set");
    const unique=new Set<string>();
    for(const item of resolution.outcome.focus){
      wireText(item.ref_id,"deictic focus reference");
      if(unique.has(item.ref_id))throw new Error("duplicate deictic focus reference");
      unique.add(item.ref_id);
      if(!resolution.outcome.turn_context.turn_refs.includes(item.ref_id))throw new Error("deictic focus is missing from its bounded turn context");
    }
  }else wireText(resolution.outcome.ref_id,"unresolved deictic reference");
  return resolution;
}

// ---------------------------------------------------------------------------
// Epii delegation (ql.nara-epii-delegation/v1 + ql.epii-enrichment/v1)
// ---------------------------------------------------------------------------

export interface DelegationBasis {context_ref:string;expression_ref:string;expression_revision:string;profile_ref:string;profile_revision:string;coordinate_ref:string;bimba_registry_revision:string;occasion:AdmittedOccasion|null}
export type DelegationState={state:"delegated"}|{state:"returned";enrichment_ref:string}|{state:"withdrawn";reason:string};

export interface EpiiDelegation {
  schema:typeof NARA_EPII_DELEGATION_VERSION;
  delegation_ref:string;
  nara_ref:string;
  epii_session_ref:string;
  basis:DelegationBasis;
  brief:string;
  scope_refs:string[];
  delegated_at_unix_ms:number;
  state:DelegationState;
}

/** Derive a delegation from the live dialogue context. The basis is bound by
 * construction; the scope is admitted by the context itself, so an
 * undisclosed ref can never be handed over (QL `EpiiDelegation::from_context`). */
export function buildEpiiDelegation(input:{delegation_ref:string;context:NaraDialogueContext;epii_session_ref:string;brief:string;scope_candidates:string[];delegated_at_unix_ms:number}):EpiiDelegation {
  const context=validateDialogueContext(input.context);
  wireText(input.delegation_ref,"delegation reference");
  wireText(input.epii_session_ref,"Epii AgentSession reference");
  if(input.epii_session_ref===context.nara_ref||input.epii_session_ref===context.agent_session_ref)throw new Error("Epii AgentSession must remain distinct from the delegating Nara");
  wireLongText(input.brief,"delegation brief",MAX_BRIEF_LEN);
  const scopeRefs=admitRefs(context,input.scope_candidates);
  if(context.bimba==null)throw new Error("dialogue context carries no Bimba selection to delegate against");
  const basis:DelegationBasis={
    context_ref:context.context_ref,
    expression_ref:context.expression_ref,
    expression_revision:context.expression_revision,
    profile_ref:context.profile_ref,
    profile_revision:context.profile_revision,
    coordinate_ref:context.coordinate_ref,
    bimba_registry_revision:context.bimba.registry_revision,
    occasion:context.occasion,
  };
  const delegation:EpiiDelegation={
    schema:NARA_EPII_DELEGATION_VERSION,
    delegation_ref:input.delegation_ref,
    nara_ref:context.nara_ref,
    epii_session_ref:input.epii_session_ref,
    basis,
    brief:input.brief,
    scope_refs:scopeRefs,
    delegated_at_unix_ms:wireUnixMs(input.delegated_at_unix_ms,"delegated_at_unix_ms"),
    state:{state:"delegated"},
  };
  return validateEpiiDelegation(delegation);
}

export function validateEpiiDelegation(delegation:EpiiDelegation):EpiiDelegation {
  const d=exactKeys(delegation,["schema","delegation_ref","nara_ref","epii_session_ref","basis","brief","scope_refs","delegated_at_unix_ms","state"],"Epii delegation") as unknown as EpiiDelegation;
  if(d.schema!==NARA_EPII_DELEGATION_VERSION)throw new Error("unsupported Nara Epii delegation contract");
  wireText(d.delegation_ref,"delegation reference");
  wireText(d.nara_ref,"delegating Nara reference");
  wireText(d.epii_session_ref,"Epii AgentSession reference");
  if(d.nara_ref===d.epii_session_ref)throw new Error("NaraRef and Epii AgentSessionRef must remain distinct");
  exactKeys(d.basis,["context_ref","expression_ref","expression_revision","profile_ref","profile_revision","coordinate_ref","bimba_registry_revision","occasion"],"delegation basis");
  wireText(d.basis.context_ref,"delegation context reference");
  wireText(d.basis.expression_ref,"delegation Expression reference");
  wireText(d.basis.expression_revision,"delegation Expression revision");
  wireText(d.basis.profile_ref,"delegation profile reference");
  wireText(d.basis.profile_revision,"delegation profile revision");
  wireText(d.basis.coordinate_ref,"delegation coordinate");
  wireText(d.basis.bimba_registry_revision,"delegation Bimba registry revision");
  if(d.basis.occasion!=null){
    exactKeys(d.basis.occasion,["day_ref","day_revision","now_ref","now_revision","admitted_via_ref"],"delegation occasion");
    wireText(d.basis.occasion.day_ref,"Central Day reference");
    wireText(d.basis.occasion.day_revision,"Central Day revision");
    wireText(d.basis.occasion.now_ref,"Central NOW reference");
    wireText(d.basis.occasion.now_revision,"Central NOW revision");
    wireText(d.basis.occasion.admitted_via_ref,"occasion admission authority");
  }
  wireLongText(d.brief,"delegation brief",MAX_BRIEF_LEN);
  d.scope_refs=wireRefs(d.scope_refs,"delegation scope reference",MAX_SCOPE_REFS);
  wireUnixMs(d.delegated_at_unix_ms,"delegated_at_unix_ms");
  if(d.state.state==="delegated"){}
  else if(d.state.state==="returned")wireText(d.state.enrichment_ref,"returned enrichment reference");
  else if(d.state.state==="withdrawn")wireText(d.state.reason,"delegation withdrawal reason");
  else throw new Error("invalid delegation state");
  return d;
}

export interface EpiiFactoryCommissionProposal {proposal_ref:string;discrepancy:string;diagnosis_refs:string[];proposed_owner_ref:string}

export interface EpiiEnrichment {
  schema:typeof EPII_ENRICHMENT_VERSION;
  enrichment_ref:string;
  delegation_ref:string;
  basis_context_ref:string;
  basis_expression_revision:string;
  coordinate_refs:string[];
  source_refs:string[];
  method_refs:string[];
  evidence_refs:string[];
  standing:EvidenceStanding;
  synthesis:string;
  proposed_focus_refs:string[];
  proposed_scene_change_refs:string[];
  proposed_profile_variant_ref:string|null;
  proposed_expressive_act_refs:string[];
  proposed_native_action_refs:string[];
  continuing_questions:string[];
  factory_commission_proposal:EpiiFactoryCommissionProposal|null;
  returned_at_unix_ms:number;
}

export function validateEpiiEnrichment(value:unknown):EpiiEnrichment {
  const e=exactKeys(value,["schema","enrichment_ref","delegation_ref","basis_context_ref","basis_expression_revision","coordinate_refs","source_refs","method_refs","evidence_refs","standing","synthesis","proposed_focus_refs","proposed_scene_change_refs","proposed_profile_variant_ref","proposed_expressive_act_refs","proposed_native_action_refs","continuing_questions","factory_commission_proposal","returned_at_unix_ms"],"Epii enrichment") as unknown as EpiiEnrichment;
  if(e.schema!==EPII_ENRICHMENT_VERSION)throw new Error("unsupported Epii enrichment contract");
  wireText(e.enrichment_ref,"enrichment reference");
  wireText(e.delegation_ref,"enrichment delegation reference");
  wireText(e.basis_context_ref,"enrichment basis context");
  wireText(e.basis_expression_revision,"enrichment basis revision");
  e.coordinate_refs=wireRefs(e.coordinate_refs,"enrichment coordinate reference",MAX_CITED_REFS);
  e.source_refs=wireRefs(e.source_refs,"enrichment source reference",MAX_CITED_REFS);
  e.method_refs=wireRefs(e.method_refs,"enrichment method reference",MAX_CITED_REFS);
  e.evidence_refs=wireRefs(e.evidence_refs,"enrichment evidence reference",MAX_CITED_REFS);
  if(e.standing==="source")throw new Error("an Epii enrichment cannot claim source standing");
  if(!STANDINGS.includes(e.standing))throw new Error("invalid enrichment standing");
  wireLongText(e.synthesis,"enrichment synthesis",MAX_BRIEF_LEN);
  e.proposed_focus_refs=wireRefs(e.proposed_focus_refs,"enrichment focus proposal",MAX_PROPOSED_REFS);
  e.proposed_scene_change_refs=wireRefs(e.proposed_scene_change_refs,"enrichment scene change proposal",MAX_PROPOSED_REFS);
  if(e.proposed_profile_variant_ref!=null)wireText(e.proposed_profile_variant_ref,"proposed profile variant reference");
  e.proposed_expressive_act_refs=wireRefs(e.proposed_expressive_act_refs,"enrichment ExpressiveAct proposal",MAX_PROPOSED_REFS);
  e.proposed_native_action_refs=wireRefs(e.proposed_native_action_refs,"enrichment native action proposal",MAX_PROPOSED_REFS);
  if(e.continuing_questions.length>MAX_QUESTIONS)throw new Error("too many continuing questions");
  e.continuing_questions=e.continuing_questions.map(question=>wireText(question,"continuing question"));
  if(e.factory_commission_proposal!=null){
    exactKeys(e.factory_commission_proposal,["proposal_ref","discrepancy","diagnosis_refs","proposed_owner_ref"],"Factory commission proposal");
    wireText(e.factory_commission_proposal.proposal_ref,"Factory commission proposal reference");
    wireLongText(e.factory_commission_proposal.discrepancy,"diagnosed discrepancy",MAX_BRIEF_LEN);
    e.factory_commission_proposal.diagnosis_refs=wireRefs(e.factory_commission_proposal.diagnosis_refs,"diagnosis reference",MAX_CITED_REFS);
    if(e.factory_commission_proposal.proposed_owner_ref!=="factory")throw new Error("a developmental commission may only be proposed to factory, which remains the execution owner");
  }
  wireUnixMs(e.returned_at_unix_ms,"returned_at_unix_ms");
  return e;
}

/** Receive an enrichment against this delegation: retained as returned
 * material; receiving it applies nothing (QL `receive_enrichment`). */
export function receiveEnrichment(delegation:EpiiDelegation,enrichment:EpiiEnrichment):EpiiDelegation {
  validateEpiiDelegation(delegation);
  validateEpiiEnrichment(enrichment);
  if(enrichment.delegation_ref!==delegation.delegation_ref)throw new Error("enrichment answers another delegation");
  if(enrichment.basis_context_ref!==delegation.basis.context_ref||enrichment.basis_expression_revision!==delegation.basis.expression_revision)throw new Error("enrichment is not bound to this delegation's basis");
  if(delegation.state.state==="delegated")return {...delegation,state:{state:"returned",enrichment_ref:enrichment.enrichment_ref}};
  if(delegation.state.state==="returned"){
    if(delegation.state.enrichment_ref===enrichment.enrichment_ref)throw new Error("enrichment already received for this delegation");
    throw new Error("delegation already returned an enrichment; a new answer needs a new delegation");
  }
  throw new Error("withdrawn delegation cannot receive enrichment");
}

/** The application gate. Ok means the enrichment is live against this exact
 * context and may be *proposed* to the owning human/Nara. It never mutates
 * anything itself, and a result produced against revision N cannot apply once
 * the live encounter has moved to revision N+k (QL `apply_gate`). */
export function applyGate(delegation:EpiiDelegation,enrichment:EpiiEnrichment,current:NaraDialogueContext):void {
  validateEpiiDelegation(delegation);
  validateEpiiEnrichment(enrichment);
  validateDialogueContext(current);
  if(enrichment.delegation_ref!==delegation.delegation_ref)throw new Error("enrichment answers another delegation");
  if(enrichment.basis_context_ref!==delegation.basis.context_ref||enrichment.basis_expression_revision!==delegation.basis.expression_revision)throw new Error("enrichment is not bound to the original delegation basis");
  if(delegation.state.state==="withdrawn")throw new Error("withdrawn delegation cannot be applied");
  if(delegation.state.state==="returned"&&delegation.state.enrichment_ref!==enrichment.enrichment_ref)throw new Error("another enrichment was received for this delegation");
  if(current.nara_ref!==delegation.nara_ref)throw new Error("application context belongs to another Nara");
  if(delegation.basis.expression_ref!==current.expression_ref)throw new Error("delegation basis names another Expression");
  if(delegation.basis.profile_ref!==current.profile_ref||delegation.basis.profile_revision!==current.profile_revision)throw new Error("delegation basis is not on the current profile standing");
  if(delegation.basis.coordinate_ref!==current.coordinate_ref)throw new Error("delegation basis names another coordinate");
  const registry=current.bimba?.registry_revision??null;
  if(registry!==delegation.basis.bimba_registry_revision)throw new Error("delegation basis is not on the current Bimba registry revision");
  if(enrichment.basis_expression_revision!==current.expression_revision){
    throw new Error(`stale Epii enrichment: produced against Expression revision ${enrichment.basis_expression_revision} which can no longer auto-apply to live revision ${current.expression_revision}`);
  }
  if(current.context_ref!==delegation.basis.context_ref)throw new Error("stale dialogue context: the permitted selection or source basis changed");
  for(const proposal of enrichment.proposed_focus_refs){
    const inScope=delegation.scope_refs.some(scope=>scope===proposal);
    const cited=enrichment.coordinate_refs.some(coordinate=>coordinate===proposal);
    if(!inScope&&!cited)throw new Error(`enrichment proposes focus ${proposal} outside the delegated scope and its cited coordinates`);
  }
}

/** The desktop receipt for one received enrichment: `applied:false` is
 * structural — presented as a proposal, never auto-applied. */
export function enrichmentReceptionReceipt(input:{enrichment_receipt_ref:string;enrichment:EpiiEnrichment;current:NaraDialogueContext;recorded_at:string}):Record<string,unknown> {
  const current=validateDialogueContext(input.current);
  const currentness=enrichmentBasisCurrent(input.enrichment,current);
  return exactKeys({
    schema:"actuation.nara-enrichment/v1",
    enrichment_receipt_ref:wireText(input.enrichment_receipt_ref,"enrichment_receipt_ref"),
    enrichment_ref:input.enrichment.enrichment_ref,
    delegation_ref:input.enrichment.delegation_ref,
    nara_ref:current.nara_ref,
    standing:currentness.current?"proposed-only":"retained-not-applied",
    currentness,
    applied:false,
    recorded_at:wireTimestamp(input.recorded_at,"recorded_at"),
  },["schema","enrichment_receipt_ref","enrichment_ref","delegation_ref","nara_ref","standing","currentness","applied","recorded_at"],"nara enrichment receipt");
}

function enrichmentBasisCurrent(enrichment:EpiiEnrichment,current:NaraDialogueContext):Record<string,unknown> {
  if(enrichment.basis_expression_revision===current.expression_revision)return {current:true};
  return {current:false,reason:`produced against Expression revision ${enrichment.basis_expression_revision} while the live encounter is at ${current.expression_revision}; the QL apply gate refuses stale application`};
}

/** Session-read support entry for disclosed transcript availability. */
export function disclosedTranscriptSupport(final:SpeechSupport,partial:SpeechSupport):{final_transcripts:SpeechSupport;partial_transcripts:SpeechSupport} {
  readSupport(final,"final transcripts");readSupport(partial,"partial transcripts");
  return {final_transcripts:final,partial_transcripts:partial};
}

/** Helper for the surface: which refs of the live document may be handed to
 * the dialogue this turn, given what was disclosed. */
export function disclosedRefsFromReceipts(entries:{ref_id:string;revision:string;standing:EvidenceStanding;disclosure:DisclosureKind;disclosed_via_ref:string}[]):DisclosedRef[] {
  return entries.map(entry=>{
    wireText(entry.ref_id,"disclosed reference");
    wireText(entry.revision,"disclosed revision");
    wireText(entry.disclosed_via_ref,"disclosure receipt");
    if(!STANDINGS.includes(entry.standing))throw new Error("invalid disclosed standing");
    if(!DISCLOSURES.includes(entry.disclosure))throw new Error("invalid disclosure kind");
    return {...entry};
  });
}

/** Timestamp helper for request construction on the desktop clock. */
export function nowUnixMs():number {return Date.now();}

export function requireContext(value:unknown):NaraDialogueContext {
  return validateDialogueContext(requireObject(value,"dialogue context"));
}
