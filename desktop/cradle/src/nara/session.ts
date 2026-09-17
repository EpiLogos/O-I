/**
 * The canonical Nara speech binding, desktop consumer side (Actuation #91 on
 * the #94 constitution; O:I #336).
 *
 * One Nara across bodies: realtime, cascade, reconnect or text-only — the
 * AgentRef/AgencyRef stay the same and a body swap is a constitution-change
 * receipt, never a re-identification. Interruption is not destruction: the
 * receipt names what was cancelled, `session_destroyed` stays false, and an
 * unsupported body degrades honestly instead of faking a cancel. A speech
 * model's tool request is a request, never a canonical Action: available is
 * not authorised and authorised is not executed — the authorised execution
 * crosses the desktop authority seam as its own receipt.
 *
 * The turn loop here drives the *documents and receipts*; the audio
 * transport (microphone/playback) is presentation-only and never gains
 * native Action authority from this session.
 */

import {
  interactionSupport,interruptionSupport,recordConstitutionChange,realtimeCapable,speechCapable,textPathSupport,
  validateSpeechConstitution,
  type SpeechConstitutionChangeReceipt,type SpeechConstitutionFacts,
} from "./constitution";
import {
  contextContinues,validateDialogueContext,
  type NaraDialogueContext,
} from "./dialogueContext";
import {
  EPII_ENRICHMENT_VERSION,NARA_DELEGATION_VERSION,NARA_ENRICHMENT_VERSION,
  NARA_EPII_DELEGATION_VERSION,NARA_INTERRUPTION_VERSION,SPEECH_INTERRUPTION_VERSION,
  SPEECH_SESSION_READ_VERSION,SPEECH_TOOL_DECISION_VERSION,
  exactKeys,noSecretMaterialKeys,readSupport,requireObject,
  wireText,wireTimestamp,type SpeechSupport,
} from "./support";

export type SpeechTurnPhase="idle"|"listening"|"speaking"|"interrupted"|"completed";

export interface AllowedAuthority {
  /** Explicit allowed Action refs. Absence is not permission. */
  allowed_action_refs:string[];
  denied_action_refs:string[];
}

export interface NaraSpeechRead {
  schema:typeof SPEECH_SESSION_READ_VERSION;
  nara_ref:string;
  agent_ref:string;
  agency_ref:string;
  agent_session_ref:string;
  context_ref:string;
  constitution_ref:string;
  body_ref:string;
  speech_capable:boolean;
  realtime_capable:boolean;
  text_capable:boolean;
  phase:SpeechTurnPhase;
  in_flight_response_ref:string|null;
  executed_refs:string[];
  interruption:SpeechSupport;
  full_duplex_realtime:SpeechSupport;
  vad_turn_detection:SpeechSupport;
  barge_in:SpeechSupport;
  final_transcripts:SpeechSupport;
  partial_transcripts:SpeechSupport;
  reconnect:string|null;
  expressive_act:{expressive_act_ref:string|null;live:boolean;speech_turn_ref:string|null};
}

/** A structured tool request emitted by a speech/realtime model: a request,
 * nothing more (Actuation SpeechToolRequest). */
export interface SpeechToolRequest {
  schema:typeof SPEECH_TOOL_DECISION_VERSION;
  request_ref:string;
  constitution_ref:string;
  agent_session_ref:string;
  proposed_action_ref:string|null;
  payload_refs:string[];
  requested_at:string;
}

export type SpeechToolResolution=
  |{resolution:"authorised";action_ref:string}
  |{resolution:"refused";stage:"channel"|"denied"|"unauthorised";reason:string};

export interface SpeechToolDecision {
  schema:typeof SPEECH_TOOL_DECISION_VERSION;
  decision_ref:string;
  request:SpeechToolRequest;
  constitution_ref:string;
  resolution:SpeechToolResolution;
  decided_by:string;
  decided_at:string;
}

export interface SpeechExecutionReceipt {
  schema:typeof SPEECH_TOOL_DECISION_VERSION;
  execution_ref:string;
  decision_ref:string;
  action_ref:string;
  constitution_ref:string;
  agent_session_ref:string;
  /** The owner operation that served the Action and its verbatim result —
   * filled by the caller after the real dispatch through the desktop
   * authority seam. */
  owner_operation:string;
  result:unknown;
  evidence_refs:string[];
  executed_at:string;
}

/** The desktop Nara binding: constitution + bounded context + governance
 * lists + recorded decisions/delegations. */
export class NaraSpeechBinding {
  private constitution:SpeechConstitutionFacts;
  private context:NaraDialogueContext;
  private readonly authority:AllowedAuthority;
  private phase:SpeechTurnPhase="idle";
  private inFlight:string|null=null;
  private readonly executed:string[]=[];
  private readonly decisions:SpeechToolDecision[]=[];
  private readonly delegations:Record<string,unknown>[]=[];
  private readonly enrichments:Record<string,unknown>[]=[];

  private constructor(constitution:SpeechConstitutionFacts,context:NaraDialogueContext,authority:AllowedAuthority){
    this.constitution=constitution;
    this.context=context;
    this.authority=authority;
  }

  /** Constitute canonical Nara on a resolved body with the caller's bounded
   * dialogue context. A text-only body constitutes exactly like a realtime
   * body; Nara is not defined by any of them (Actuation `NaraBinding::constitute`). */
  static constitute(input:{constitution:unknown;dialogue_context:unknown;allowed_action_refs:string[];denied_action_refs:string[]}):NaraSpeechBinding {
    const constitution=validateSpeechConstitution(input.constitution);
    const context=validateDialogueContext(input.dialogue_context);
    if(context.agent_session_ref!==constitution.agent_session_ref)throw new Error("dialogue context does not name the constituted AgentSession");
    noSecretMaterialKeys({allowed:input.allowed_action_refs,denied:input.denied_action_refs},"authority");
    const allowed=input.allowed_action_refs.map(ref=>wireText(ref,"allowed action ref"));
    const denied=input.denied_action_refs.map(ref=>wireText(ref,"denied action ref"));
    for(const ref of denied)if(allowed.includes(ref))throw new Error(`action ${ref} cannot be both allowed and denied`);
    return new NaraSpeechBinding(constitution,context,{allowed_action_refs:allowed,denied_action_refs:denied});
  }

  get naraRef():string {return this.context.nara_ref;}
  get agentRef():string {return this.constitution.agent_ref;}
  get phaseNow():SpeechTurnPhase {return this.phase;}
  get contextNow():NaraDialogueContext {return this.context;}
  get constitutionNow():SpeechConstitutionFacts {return this.constitution;}
  get decisionsRecorded():readonly SpeechToolDecision[] {return this.decisions;}
  get delegationReceipts():readonly Record<string,unknown>[] {return this.delegations;}
  get enrichmentReceipts():readonly Record<string,unknown>[] {return this.enrichments;}

  /** A deictic/expression context update on the same encounter. The session
   * is never reminted: same Nara, same session, updated bounded context. */
  updateContext(next:unknown):NaraDialogueContext {
    const context=validateDialogueContext(next);
    if(context.nara_ref!==this.context.nara_ref)throw new Error("a context update cannot change the Nara identity");
    if(context.agent_session_ref!==this.context.agent_session_ref)throw new Error("a context update cannot change the AgentSession");
    this.context=context;
    return context;
  }

  /** Reconnect or body replacement: the change receipt enforces the enduring
   * identity; the refreshed QL context must still be this Nara's and must
   * continue the same dialogue. */
  reconnect(input:{change_ref:string;next_constitution:unknown;next_context:unknown;reason:string;evidence_refs:string[];at:string}):SpeechConstitutionChangeReceipt {
    const next=validateSpeechConstitution(input.next_constitution);
    const context=validateDialogueContext(input.next_context);
    if(context.agent_session_ref!==next.agent_session_ref)throw new Error("reconnect context does not name the new AgentSession");
    const change=recordConstitutionChange({
      change_ref:input.change_ref,
      before:this.constitution,
      after:next,
      reason:input.reason,
      evidence_refs:input.evidence_refs,
      changed_at:input.at,
    });
    contextContinues(this.context,context);
    this.constitution=next;
    this.context=context;
    this.phase="idle";
    this.inFlight=null;
    return change;
  }

  // -- turn phases (mirrors SpeechSession's phase law) ----------------------

  beginListening():void {
    if(this.phase!=="idle"&&this.phase!=="completed"&&this.phase!=="interrupted")throw new Error(`phase ${this.phase} cannot begin listening`);
    this.phase="listening";
  }

  /** Manual turn-end for the push-to-talk path: where the body does not run
   * VAD turn detection, the person's own release ends the input. */
  endListening():void {
    if(this.phase!=="listening")throw new Error(`phase ${this.phase} cannot end listening`);
    this.phase="idle";
  }

  beginResponse(responseRef:string):void {
    if(this.phase!=="listening"&&this.phase!=="idle"&&this.phase!=="completed"&&this.phase!=="interrupted")throw new Error(`phase ${this.phase} cannot begin a response`);
    this.inFlight=wireText(responseRef,"response ref");
    this.phase="speaking";
  }

  commitResult(resultRef:string):void {
    if(this.phase!=="speaking")throw new Error(`phase ${this.phase} cannot commit a result`);
    this.executed.push(wireText(resultRef,"result ref"));
  }

  completeResponse():void {
    if(this.phase!=="speaking")throw new Error(`phase ${this.phase} cannot complete`);
    this.inFlight=null;
    this.phase="completed";
  }

  /** Interrupt the in-flight Nara response. Where the body supports
   * interruption the response is cancelled and the receipt carries the O:I
   * hold/cancel disposition for the correlated ExpressiveAct; where it does
   * not, the attempt is recorded honestly and the response continues —
   * pretending otherwise would falsify the body. The session and the Nara
   * identity survive either way (`session_destroyed:false`). */
  interrupt(input:{interruption_ref:string;reason:string;at:string}):NaraInterruptionReceipt {
    const support=interruptionSupport(this.constitution);
    const correlated=this.context.expressive_act;
    const correlatedAct=correlated&&expressiveActLiveState(correlated)&&correlated.speech_turn_ref!=null
      ?{expressive_act_ref:correlated.expressive_act_ref,disposition:"hold-and-cancel-pending-choreography" as const}
      :null;
    let outcome:"cancelled"|"nothing-in-flight"|"refused";
    let refusalReason:string|null=null;
    if(support.state==="supported"&&this.inFlight!=null){
      this.inFlight=null;
      this.phase="interrupted";
      outcome="cancelled";
    }else if(support.state==="supported"){
      outcome="nothing-in-flight";
    }else{
      outcome="refused";
      refusalReason=support.state==="degraded"
        ?`interruption is degraded and cannot be trusted to cancel cleanly: ${support.reason}`
        :support.state==="unsupported"
          ?`the body does not support interruption: ${support.reason}`
          :"interruption is unproven on this body, and unknown never behaves as a yes: "+support.reason;
    }
    const generic:Record<string,unknown>=exactKeys({
      schema:SPEECH_INTERRUPTION_VERSION,
      interruption_ref:wireText(input.interruption_ref,"interruption_ref"),
      agent_ref:this.constitution.agent_ref,
      agency_ref:this.constitution.agency_ref,
      agent_session_ref:this.constitution.agent_session_ref,
      constitution_ref:this.constitution.constitution_ref,
      body_ref:this.constitution.body_ref,
      response_ref:this.inFlight,
      executed_refs:[...this.executed],
      reason:wireText(input.reason,"reason"),
      support,
      at:wireTimestamp(input.at,"at"),
      outcome,
      refusal_reason:refusalReason,
      phase_after:this.phase,
    },["schema","interruption_ref","agent_ref","agency_ref","agent_session_ref","constitution_ref","body_ref","response_ref","executed_refs","reason","support","at","outcome","refusal_reason","phase_after"],"speech interruption receipt");
    return exactKeys({
      schema:NARA_INTERRUPTION_VERSION,
      interruption_receipt:generic,
      nara_ref:this.context.nara_ref,
      context_ref:this.context.context_ref,
      session_destroyed:false,
      expressive_act:correlatedAct,
    },["schema","interruption_receipt","nara_ref","context_ref","session_destroyed","expressive_act"],"nara interruption receipt") as unknown as NaraInterruptionReceipt;
  }

  // -- authority ------------------------------------------------------------

  /** Adjudicate a speech-model tool request against this Nara's explicit
   * governance lists. The decision is recorded either way; authorisation
   * never executes by itself. */
  adjudicateToolRequest(input:{decision_ref:string;request:unknown;decided_by:string;at:string}):SpeechToolDecision {
    const request=validateToolRequest(input.request);
    if(request.constitution_ref!==this.constitution.constitution_ref)throw new Error("tool request belongs to another constitution");
    const channel=interactionSupport(this.constitution,"tool-requests");
    let resolution:SpeechToolResolution;
    const usable=channel.state==="supported"||channel.state==="degraded";
    if(!usable){
      resolution={resolution:"refused",stage:"channel",reason:"the constituted body does not carry a usable structured tool-request channel"};
    }else if(request.proposed_action_ref!=null){
      const action=request.proposed_action_ref;
      if(this.authority.denied_action_refs.includes(action)){
        resolution={resolution:"refused",stage:"denied",reason:"the proposed action is explicitly denied by the governing autonomy"};
      }else if(this.authority.allowed_action_refs.includes(action)){
        resolution={resolution:"authorised",action_ref:action};
      }else{
        resolution={resolution:"refused",stage:"unauthorised",reason:"available capability is not authorised authority: the action is absent from the explicit allowed list"};
      }
    }else{
      resolution={resolution:"refused",stage:"unauthorised",reason:"the request proposes no canonical action; there is nothing to authorise"};
    }
    const decision:SpeechToolDecision=exactKeys({
      schema:SPEECH_TOOL_DECISION_VERSION,
      decision_ref:wireText(input.decision_ref,"decision_ref"),
      request,
      constitution_ref:this.constitution.constitution_ref,
      resolution,
      decided_by:wireText(input.decided_by,"decided_by"),
      decided_at:wireTimestamp(input.at,"decided_at"),
    },["schema","decision_ref","request","constitution_ref","resolution","decided_by","decided_at"],"speech tool decision") as unknown as SpeechToolDecision;
    this.decisions.push(decision);
    return decision;
  }

  /** Record the actual execution of an authorised decision, after the real
   * dispatch crossed the desktop authority seam. A refused or absent decision
   * cannot be executed; the authorisation itself stays immutable. */
  recordExecution(decision:SpeechToolDecision,input:{execution_ref:string;owner_operation:string;result:unknown;evidence_refs:string[];executed_at:string}):SpeechExecutionReceipt {
    if(!decision.resolution||decision.resolution.resolution!=="authorised")throw new Error("a refused tool request cannot be executed");
    if(!input.evidence_refs.length)throw new Error("execution requires evidence");
    return exactKeys({
      schema:SPEECH_TOOL_DECISION_VERSION,
      execution_ref:wireText(input.execution_ref,"execution_ref"),
      decision_ref:decision.decision_ref,
      action_ref:decision.resolution.action_ref,
      constitution_ref:decision.constitution_ref,
      agent_session_ref:decision.request.agent_session_ref,
      owner_operation:wireText(input.owner_operation,"owner_operation"),
      result:input.result,
      evidence_refs:input.evidence_refs.map(ref=>wireText(ref,"evidence ref")),
      executed_at:wireTimestamp(input.executed_at,"executed_at"),
    },["schema","execution_ref","decision_ref","action_ref","constitution_ref","agent_session_ref","owner_operation","result","evidence_refs","executed_at"],"speech execution receipt") as unknown as SpeechExecutionReceipt;
  }

  /** Record a structured Nara→Epii delegation receipt: identity and
   * currentness are what Actuation checks; the QL document carries the
   * delegation's own law. */
  recordDelegation(delegation:unknown,input:{delegation_receipt_ref:string;at:string}):Record<string,unknown> {
    const d=requireObject(delegation,"delegation");
    if(d["schema"]!==NARA_EPII_DELEGATION_VERSION)throw new Error("expected ql.nara-epii-delegation/v1");
    if(d["nara_ref"]!==this.context.nara_ref)throw new Error("the delegation belongs to another Nara");
    const epii=wireText(d["epii_session_ref"],"Epii AgentSession reference");
    if(epii===this.context.nara_ref)throw new Error("Epii must remain distinct from the delegating Nara");
    const basis=requireObject(d["basis"],"delegation basis");
    const basisCurrent=basis["context_ref"]===this.context.context_ref;
    const receipt=exactKeys({
      schema:NARA_DELEGATION_VERSION,
      delegation_receipt_ref:wireText(input.delegation_receipt_ref,"delegation_receipt_ref"),
      delegation_ref:d["delegation_ref"],
      nara_ref:this.context.nara_ref,
      nara_agent_ref:this.constitution.agent_ref,
      nara_agent_session_ref:this.context.agent_session_ref,
      epii_session_ref:epii,
      basis_context_ref:basis["context_ref"]??null,
      basis_expression_revision:basis["expression_revision"]??null,
      scope_ref_count:Array.isArray(d["scope_refs"])?d["scope_refs"].length:0,
      foreground_agent:this.context.nara_ref,
      basis_current_at_receipt:basisCurrent,
      recorded_at:wireTimestamp(input.at,"recorded_at"),
    },["schema","delegation_receipt_ref","delegation_ref","nara_ref","nara_agent_ref","nara_agent_session_ref","epii_session_ref","basis_context_ref","basis_expression_revision","scope_ref_count","foreground_agent","basis_current_at_receipt","recorded_at"],"nara delegation receipt");
    this.delegations.push(receipt);
    return receipt;
  }

  /** Receive an Epii result: a late result is retained, never applied; even a
   * current one is proposed-only. `applied:false` is structural. */
  recordEnrichment(enrichment:unknown,input:{enrichment_receipt_ref:string;at:string}):Record<string,unknown> {
    const e=requireObject(enrichment,"enrichment");
    if(e["schema"]!==EPII_ENRICHMENT_VERSION)throw new Error("expected ql.epii-enrichment/v1");
    const delegationRef=wireText(e["delegation_ref"],"enrichment delegation reference");
    if(!this.delegations.some(d=>d["delegation_ref"]===delegationRef))throw new Error(`enrichment answers unknown delegation ${delegationRef}`);
    const basisRevision=wireText(e["basis_expression_revision"],"enrichment basis revision");
    const liveRevision=this.context.expression_revision;
    const current=basisRevision===liveRevision;
    const receipt=exactKeys({
      schema:NARA_ENRICHMENT_VERSION,
      enrichment_receipt_ref:wireText(input.enrichment_receipt_ref,"enrichment_receipt_ref"),
      enrichment_ref:e["enrichment_ref"],
      delegation_ref:delegationRef,
      nara_ref:this.context.nara_ref,
      standing:current?"proposed-only":"retained-not-applied",
      currentness:current?{current:true}:{current:false,reason:`produced against Expression revision ${basisRevision} while the live encounter is at ${liveRevision}; the QL apply gate refuses stale application`},
      applied:false,
      recorded_at:wireTimestamp(input.at,"recorded_at"),
    },["schema","enrichment_receipt_ref","enrichment_ref","delegation_ref","nara_ref","standing","currentness","applied","recorded_at"],"nara enrichment receipt");
    this.enrichments.push(receipt);
    return receipt;
  }

  /** The wire read a desktop client consumes (Actuation `NaraBinding::read`
   * + the session read the speech UI adapts to). */
  read():NaraSpeechRead {
    return exactKeys({
      schema:SPEECH_SESSION_READ_VERSION,
      nara_ref:this.context.nara_ref,
      agent_ref:this.constitution.agent_ref,
      agency_ref:this.constitution.agency_ref,
      agent_session_ref:this.constitution.agent_session_ref,
      context_ref:this.context.context_ref,
      constitution_ref:this.constitution.constitution_ref,
      body_ref:this.constitution.body_ref,
      speech_capable:speechCapable(this.constitution),
      realtime_capable:realtimeCapable(this.constitution),
      text_capable:textPathSupport(this.constitution).state==="supported",
      phase:this.phase,
      in_flight_response_ref:this.inFlight,
      executed_refs:[...this.executed],
      interruption:interruptionSupport(this.constitution),
      full_duplex_realtime:interactionSupport(this.constitution,"full-duplex-realtime"),
      vad_turn_detection:interactionSupport(this.constitution,"vad-turn-detection"),
      barge_in:interactionSupport(this.constitution,"barge-in"),
      final_transcripts:interactionSupport(this.constitution,"final-transcripts"),
      partial_transcripts:interactionSupport(this.constitution,"partial-transcripts"),
      reconnect:this.constitution.connection.kind==="connected"?this.constitution.connection.reconnect:null,
      expressive_act:{
        expressive_act_ref:this.context.expressive_act?.expressive_act_ref??null,
        live:this.context.expressive_act?expressiveActLiveState(this.context.expressive_act):false,
        speech_turn_ref:this.context.expressive_act?.speech_turn_ref??null,
      },
    },["schema","nara_ref","agent_ref","agency_ref","agent_session_ref","context_ref","constitution_ref","body_ref","speech_capable","realtime_capable","text_capable","phase","in_flight_response_ref","executed_refs","interruption","full_duplex_realtime","vad_turn_detection","barge_in","final_transcripts","partial_transcripts","reconnect","expressive_act"],"speech session read") as unknown as NaraSpeechRead;
  }

  /** Build a fresh bounded context for the next turn from the caller's
   * current application state (same Nara/session), validating admission. */
  nextTurnContext(patch:Partial<NaraDialogueContext>):NaraDialogueContext {
    return this.updateContext({...this.context,...patch});
  }
}

function expressiveActLiveState(act:NonNullable<NaraDialogueContext["expressive_act"]>):boolean {
  return act.phase==="composing"||act.phase==="active";
}

export interface NaraInterruptionReceipt {
  schema:typeof NARA_INTERRUPTION_VERSION;
  interruption_receipt:Record<string,unknown>;
  nara_ref:string;
  context_ref:string;
  session_destroyed:false;
  expressive_act:{expressive_act_ref:string;disposition:"hold-and-cancel-pending-choreography"}|null;
}

export function validateToolRequest(value:unknown):SpeechToolRequest {
  const v=requireObject(value,"speech tool request");
  if(v["schema"]!==SPEECH_TOOL_DECISION_VERSION)throw new Error("wrong schema; expected actuation.speech-tool-decision/v1");
  for(const key of ["request_ref","constitution_ref","agent_session_ref","requested_at"])wireText(v[key],key);
  if(v["proposed_action_ref"]!=null)wireText(v["proposed_action_ref"],"proposed_action_ref");
  const payloads=v["payload_refs"];
  if(!Array.isArray(payloads)||!payloads.length)throw new Error("a tool request names what it wants");
  const request=exactKeys({
    schema:SPEECH_TOOL_DECISION_VERSION,
    request_ref:v["request_ref"] as string,
    constitution_ref:v["constitution_ref"] as string,
    agent_session_ref:v["agent_session_ref"] as string,
    proposed_action_ref:v["proposed_action_ref"]??null,
    payload_refs:payloads.map(ref=>wireText(ref,"payload ref")),
    requested_at:wireTimestamp(v["requested_at"],"requested_at"),
  },["schema","request_ref","constitution_ref","agent_session_ref","proposed_action_ref","payload_refs","requested_at"],"speech tool request") as unknown as SpeechToolRequest;
  noSecretMaterialKeys(request,"tool request");
  return request;
}

/** Read a session-read document handed over from elsewhere (e.g. a native
 * bridge) with the same admission the live read satisfies. */
export function validateSessionRead(value:unknown):NaraSpeechRead {
  const read=requireObject(value,"speech session read");
  if(read["schema"]!==SPEECH_SESSION_READ_VERSION)throw new Error("wrong schema; expected actuation.speech-session-read/v1");
  for(const key of ["interruption","full_duplex_realtime","vad_turn_detection","barge_in","final_transcripts","partial_transcripts"])readSupport(read[key],key);
  return read as unknown as NaraSpeechRead;
}
