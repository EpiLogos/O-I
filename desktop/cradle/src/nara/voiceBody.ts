/**
 * The caller-side voice-body satisfaction bridge (#336 follow-up): from the
 * desktop's constructed `actuation.speech-constitution/v1` document, construct
 * the QL `ql.nara-voice-body/v1` VoiceBodyDeclaration and evaluate whether the
 * resolved body satisfies Nara's dialogical floor.
 *
 * The shapes, names and satisfaction semantics are QL's owner
 * (`ql-mef/src/nara/voice.rs`, thread4 TA3), mirrored verbatim so a document
 * the desktop constructs is admitted by the owner unchanged:
 *
 *   - capability status is `supported | unsupported | unknown`, and unknown
 *     never satisfies a requirement;
 *   - `satisfies()` names every unmet requirement, it never stops at the first;
 *   - full-duplex satisfies a streamed-turn-taking requirement, never the
 *     inverse;
 *   - the voice body is neither the Nara nor the AgentSession carrying the
 *     turn.
 *
 * The reduction is a pure caller-side composition between existing wire
 * documents: no provider names are introduced and no transport is invented.
 * Where the Actuation four-state support vocabulary is richer than the QL
 * three-state vocabulary, the reduction is conservative — a degraded
 * capability reduces to `unknown` (never to `supported`), and the reduction
 * is carried in the result so the loss of resolution is a named fact.
 */

import {
  readSupport,exactKeys,wireText,wireRefs,noSecretMaterialKeys,
  type SpeechSupport,
} from "./support";
import type {SpeechConstitutionFacts} from "./constitution";

export const NARA_VOICE_BODY_CONTRACT = "ql.nara-voice-body/v1";
export const VOICE_BODY_SATISFACTION_VERSION = "oi.nara-voice-body-satisfaction/v1";

/** Explicit capability status (QL `VoiceCapabilityStatus`). Absence of
 * evidence is `unknown`, never a silent yes. */
export type VoiceCapabilityStatus = "supported" | "unsupported" | "unknown";

/** How the body carries a dialogue turn (QL `VoiceDuplexDisposition`) — a
 * statement about interaction shape, not a transport mechanism. */
export type VoiceDuplexDisposition = "full-duplex" | "streamed-turn-taking" | "unknown";

/** How the bounded dialogue context reaches the body across a turn (QL
 * `ContextRefreshDisposition`). */
export type ContextRefreshDisposition = "push-on-change" | "tool-access" | "none";

const CAPABILITY_STATUS: readonly VoiceCapabilityStatus[] = ["supported", "unsupported", "unknown"];
const DUPLEX_DISPOSITIONS: readonly VoiceDuplexDisposition[] = ["full-duplex", "streamed-turn-taking", "unknown"];
const CONTEXT_REFRESH_DISPOSITIONS: readonly ContextRefreshDisposition[] = ["push-on-change", "tool-access", "none"];

export interface VoiceBodyBinding {
  schema:typeof NARA_VOICE_BODY_CONTRACT;
  body_ref:string;
  body_provenance_ref:string;
}

export interface VoiceBodyRequirements {
  schema:typeof NARA_VOICE_BODY_CONTRACT;
  /** Full-duplex or at least streamed turn-taking. */
  duplex:VoiceDuplexDisposition;
  /** Interruption/barge-in status must be disclosed. */
  barge_in:VoiceCapabilityStatus;
  /** Manual stop must exist. */
  manual_interrupt:VoiceCapabilityStatus;
  /** A structured event/tool request channel so deixis and ExpressiveAct
   * operations can travel beside the speech. */
  structured_event_channel:VoiceCapabilityStatus;
  /** Connection/reconnect/degraded status must be observable, so a reconnect
   * preserves the canonical Nara/Expression instead of inventing a second
   * dialogue. */
  reconnect_status_reporting:VoiceCapabilityStatus;
  /** How the bounded context refreshes across turns. */
  context_refresh:ContextRefreshDisposition;
}

export interface VoiceBodyDeclaration {
  binding:VoiceBodyBinding;
  duplex:VoiceDuplexDisposition;
  barge_in:VoiceCapabilityStatus;
  manual_interrupt:VoiceCapabilityStatus;
  structured_event_channel:VoiceCapabilityStatus;
  reconnect_status_reporting:VoiceCapabilityStatus;
  context_refresh:ContextRefreshDisposition;
  observation_refs:string[];
}

const REQUIREMENT_KEYS=["schema","duplex","barge_in","manual_interrupt","structured_event_channel","reconnect_status_reporting","context_refresh"] as const;
const DECLARATION_KEYS=["binding","duplex","barge_in","manual_interrupt","structured_event_channel","reconnect_status_reporting","context_refresh","observation_refs"] as const;

function capabilityStatus(value:unknown,label:string):VoiceCapabilityStatus {
  if(typeof value!=="string"||!CAPABILITY_STATUS.includes(value as VoiceCapabilityStatus))throw new Error(`invalid ${label} capability status`);
  return value as VoiceCapabilityStatus;
}

export function validateVoiceBodyBinding(value:unknown):VoiceBodyBinding {
  const v=exactKeys(value,["schema","body_ref","body_provenance_ref"],"voice body binding") as unknown as VoiceBodyBinding;
  if(v.schema!==NARA_VOICE_BODY_CONTRACT)throw new Error("unsupported Nara voice body contract");
  wireText(v.body_ref,"voice body reference");
  wireText(v.body_provenance_ref,"voice body provenance reference");
  return v;
}

export function validateVoiceBodyRequirements(value:unknown):VoiceBodyRequirements {
  const v=exactKeys(value,REQUIREMENT_KEYS,"voice body requirements") as unknown as VoiceBodyRequirements;
  if(v.schema!==NARA_VOICE_BODY_CONTRACT)throw new Error("unsupported Nara voice body contract");
  if(typeof v.duplex!=="string"||!DUPLEX_DISPOSITIONS.includes(v.duplex))throw new Error("invalid duplex disposition");
  capabilityStatus(v.barge_in,"barge-in");
  capabilityStatus(v.manual_interrupt,"manual interrupt");
  capabilityStatus(v.structured_event_channel,"structured event channel");
  capabilityStatus(v.reconnect_status_reporting,"reconnect status reporting");
  if(typeof v.context_refresh!=="string"||!CONTEXT_REFRESH_DISPOSITIONS.includes(v.context_refresh))throw new Error("invalid context refresh disposition");
  return v;
}

export function validateVoiceBodyDeclaration(value:unknown):VoiceBodyDeclaration {
  const v=exactKeys(value,DECLARATION_KEYS,"voice body declaration") as unknown as VoiceBodyDeclaration;
  validateVoiceBodyBinding(v.binding);
  if(typeof v.duplex!=="string"||!DUPLEX_DISPOSITIONS.includes(v.duplex))throw new Error("invalid duplex disposition");
  capabilityStatus(v.barge_in,"barge-in");
  capabilityStatus(v.manual_interrupt,"manual interrupt");
  capabilityStatus(v.structured_event_channel,"structured event channel");
  capabilityStatus(v.reconnect_status_reporting,"reconnect status reporting");
  if(typeof v.context_refresh!=="string"||!CONTEXT_REFRESH_DISPOSITIONS.includes(v.context_refresh))throw new Error("invalid context refresh disposition");
  v.observation_refs=wireRefs(v.observation_refs,"voice observation reference",256);
  return v;
}

/** Speech-era identity law: the body is neither the Nara nor the AgentSession
 * carrying the turn (QL `binds_distinctly`). */
export function bodyBindsDistinctly(binding:VoiceBodyBinding,naraRef:string,agentSessionRef:string):void {
  validateVoiceBodyBinding(binding);
  if(binding.body_ref===naraRef)throw new Error("the voice body is not the Nara");
  if(binding.body_ref===agentSessionRef)throw new Error("the voice body is not the AgentSession");
}

/** The floor for foreground dialogical Nara (QL `dialogical_floor`):
 * streamed interaction, disclosed barge-in, manual stop, a structured
 * channel, observable reconnect status, and a context path that is not
 * absent. */
export function dialogicalFloor():VoiceBodyRequirements {
  return validateVoiceBodyRequirements({
    schema:NARA_VOICE_BODY_CONTRACT,
    duplex:"streamed-turn-taking",
    barge_in:"supported",
    manual_interrupt:"supported",
    structured_event_channel:"supported",
    reconnect_status_reporting:"supported",
    context_refresh:"tool-access",
  });
}

/** QL `satisfies`, verbatim semantics: every unmet requirement is named;
 * `unknown` and `unsupported` are refusals, not tolerances. */
export function voiceBodySatisfaction(declaration:VoiceBodyDeclaration,requirements:VoiceBodyRequirements):string[] {
  const d=validateVoiceBodyDeclaration(declaration);
  const r=validateVoiceBodyRequirements(requirements);
  const unmet:string[]=[];
  // Full-duplex satisfies a streamed-turn-taking requirement; unknown
  // satisfies nothing.
  const duplexMeets=r.duplex==="unknown"
    ?true
    :r.duplex==="streamed-turn-taking"
      ?d.duplex==="streamed-turn-taking"||d.duplex==="full-duplex"
      :d.duplex==="full-duplex";
  if(!duplexMeets)unmet.push(`duplex: requires at least ${r.duplex}, body discloses ${d.duplex}`);
  const statusSatisfies=(status:VoiceCapabilityStatus):boolean=>status==="supported";
  for(const [name,required,disclosed] of [
    ["barge-in",r.barge_in,d.barge_in],
    ["manual interrupt",r.manual_interrupt,d.manual_interrupt],
    ["structured event channel",r.structured_event_channel,d.structured_event_channel],
    ["reconnect status reporting",r.reconnect_status_reporting,d.reconnect_status_reporting],
  ] as const){
    if(statusSatisfies(required)&&!statusSatisfies(disclosed)){
      unmet.push(`${name}: required supported, body discloses ${disclosed}`);
    }
  }
  const contextMeets=r.context_refresh==="none"?true:d.context_refresh===r.context_refresh;
  if(!contextMeets)unmet.push(`context refresh: requires ${r.context_refresh}, body discloses ${d.context_refresh}`);
  return unmet;
}

// ---------------------------------------------------------------------------
// Reduction from the Actuation speech constitution
// ---------------------------------------------------------------------------

/** One named reduction: which constitution fact produced which QL status, so
 * the three-state declaration never hides a four-state fact. */
export interface CapabilityReduction {
  status:VoiceCapabilityStatus;
  source:string;
  note:string;
}

/** The duplex slot reduces to a disposition, not a capability status. */
export interface DuplexReduction {
  disposition:VoiceDuplexDisposition;
  source:string;
  note:string;
}

/** The context-refresh slot is the composition's own disposition fact. */
export interface ContextRefreshReduction {
  disposition:ContextRefreshDisposition;
  source:string;
  note:string;
}

export interface VoiceBodyReduction {
  binding:VoiceBodyBinding;
  declaration:VoiceBodyDeclaration;
  duplex:DuplexReduction;
  barge_in:CapabilityReduction;
  manual_interrupt:CapabilityReduction;
  structured_event_channel:CapabilityReduction;
  reconnect_status_reporting:CapabilityReduction;
  context_refresh:ContextRefreshReduction;
}

/** Conservative three-state reduction of an Actuation four-state support
 * fact: proven stays supported; degraded is real evidence of reduction, not
 * proof, so it reduces to unknown; unsupported stays unsupported; unknown
 * stays unknown. */
function reduceSupport(support:SpeechSupport,source:string,label:string):CapabilityReduction {
  readSupport(support,label);
  switch(support.state){
    case "supported":return {status:"supported",source,note:`${label}: supported`};
    case "degraded":return {status:"unknown",source,note:`: degraded reduces to unknown — a stated reduction is not proven support`};
    case "unsupported":return {status:"unsupported",source,note:`: unsupported (${support.reason})`};
    case "unknown":return {status:"unknown",source,note:`: unknown (${support.reason})`};
  }
}

/** The provenance ref a desktop constitution cites for the resolution behind
 * the body (the AIKit read-model ref when carried, the provider ref as the
 * fallback) — a ref only, never material. */
function bodyProvenanceRef(constitution:SpeechConstitutionFacts):string {
  const cited=(constitution.provenance?.source_refs??[]).find(ref=>ref.startsWith("aikit:model-runtime:"));
  return cited??`provider:${constitution.provider_binding.provider_ref}`;
}

/** Construct the QL VoiceBodyDeclaration from the desktop's constructed
 * speech constitution. Every field reduces from a fact the constitution
 * already carries; the reduction is conservative and fully named:
 *
 *   - duplex ← the interaction map: proven full-duplex is `full-duplex`;
 *     proven streaming in both directions is `streamed-turn-taking`;
 *     anything else is `unknown`;
 *   - barge-in ← the interaction map's barge-in fact;
 *   - manual interrupt ← the constitution's own interruption fact (the
 *     Actuation "can this body be stopped" disclosure; on desktop
 *     constitutions it is the same disclosure as barge-in — recorded, never
 *     invented twice);
 *   - structured event channel ← the conjunction of the map's
 *     structured-events and tool-requests facts (the channel deixis and
 *     ExpressiveAct operations travel through);
 *   - reconnect status reporting ← the connection semantics: a connected
 *     body disclosing resumable/reconnect-without-session satisfies;
 *     anything else (including stateless, which discloses no reconnect)
 *     does not;
 *   - context refresh ← the composition's own fact: the desktop rebuilds the
 *     bounded context from live application state each turn and pushes it —
 *     `push-on-change`.
 */
export function voiceBodyFromConstitution(input:{constitution:SpeechConstitutionFacts;nara_ref:string;observation_refs?:string[]}):VoiceBodyReduction {
  const constitution=input.constitution;
  const binding=validateVoiceBodyBinding({
    schema:NARA_VOICE_BODY_CONTRACT,
    body_ref:constitution.body_ref,
    body_provenance_ref:bodyProvenanceRef(constitution),
  });
  bodyBindsDistinctly(binding,input.nara_ref,constitution.agent_session_ref);

  const duplexSupport=constitution.interaction["full-duplex-realtime"]??{state:"unknown" as const,reason:"capability full-duplex-realtime was not adjudicated in this constitution"};
  const streamingIn=constitution.interaction["streaming-input"]??{state:"unknown" as const,reason:"capability streaming-input was not adjudicated in this constitution"};
  const streamingOut=constitution.interaction["streaming-output"]??{state:"unknown" as const,reason:"capability streaming-output was not adjudicated in this constitution"};
  const fullDuplexProven=duplexSupport.state==="supported";
  const streamingProven=streamingIn.state==="supported"&&streamingOut.state==="supported";
  const fullDuplexNote=fullDuplexProven
    ?"full duplex: proven on this body"
    :duplexSupport.state==="degraded"
      ?`full duplex: degraded reduces to unknown — ${duplexSupport.reason}`
      :duplexSupport.state==="unsupported"
        ?`full duplex: unsupported (${duplexSupport.reason})`
        :`full duplex: unknown (${duplexSupport.reason})`;
  const streamedNote=streamingProven
    ?"streamed turn-taking: proven streaming in both directions"
    :(streamingIn.state==="unknown"||streamingOut.state==="unknown")
      ?"streamed turn-taking: unproven on this body"
      :"streamed turn-taking: declared and not supported in both directions";
  // The strongest honest disposition wins: proven full-duplex outranks
  // proven turn-taking; a stated reduction never upgrades to either.
  const duplex:DuplexReduction=fullDuplexProven
    ?{disposition:"full-duplex",source:"interaction.full-duplex-realtime",note:fullDuplexNote}
    :streamingProven
      ?{disposition:"streamed-turn-taking",source:"interaction.streaming-input + interaction.streaming-output",note:streamedNote}
      :{disposition:"unknown",source:"interaction.full-duplex-realtime; interaction.streaming-input + interaction.streaming-output",note:`${fullDuplexNote}; ${streamedNote}`};

  const bargeIn=reduceSupport(constitution.interaction["barge-in"]??{state:"unknown" as const,reason:"capability barge-in was not adjudicated in this constitution"},"interaction.barge-in","barge-in");
  const manualInterrupt=reduceSupport(constitution.interruption,"interruption","manual interrupt");

  const structuredEvents=constitution.interaction["structured-events"]??{state:"unknown" as const,reason:"capability structured-events was not adjudicated in this constitution"};
  const toolRequests=constitution.interaction["tool-requests"]??{state:"unknown" as const,reason:"capability tool-requests was not adjudicated in this constitution"};
  const eventsReduce=reduceSupport(structuredEvents,"interaction.structured-events","structured events");
  const toolsReduce=reduceSupport(toolRequests,"interaction.tool-requests","tool requests");
  const structuredChannel:CapabilityReduction=
    eventsReduce.status==="unknown"||toolsReduce.status==="unknown"
      ?{status:"unknown",source:"interaction.structured-events + interaction.tool-requests",note:"structured event channel: unproven (a conjunction is never proven by an unknown limb)"}
      :eventsReduce.status==="supported"&&toolsReduce.status==="supported"
        ?{status:"supported",source:"interaction.structured-events + interaction.tool-requests",note:"structured event channel: proven in both directions"}
        :{status:"unsupported",source:"interaction.structured-events + interaction.tool-requests",note:"structured event channel: declared and not supported in both directions"};

  let reconnect:CapabilityReduction;
  if(constitution.connection.kind==="connected"&&(constitution.connection.reconnect==="resumable"||constitution.connection.reconnect==="reconnect-without-session")){
    reconnect={status:"supported",source:"connection",note:`reconnect status reporting: connected body discloses ${constitution.connection.reconnect}`};
  }else if(constitution.connection.kind==="connected"){
    reconnect={status:"unsupported",source:"connection",note:`reconnect status reporting: connected body discloses ${constitution.connection.reconnect??"no"} reconnect`};
  }else{
    reconnect={status:"unsupported",source:"connection",note:"reconnect status reporting: stateless connection discloses no reconnect"};
  }

  // The disposition is the composition's own fact, not a body disclosure:
  // the desktop rebuilds the bounded context from live application state
  // each turn and pushes it. The reduction names that owner honestly — it is
  // not a claim that the composition meets any particular requirement.
  const contextRefresh:ContextRefreshReduction={
    disposition:"push-on-change",source:"composition",
    note:"the desktop rebuilds the bounded context from live application state each turn and pushes it",
  };

  const declaration=validateVoiceBodyDeclaration({
    binding,
    duplex:duplex.disposition,
    barge_in:bargeIn.status,
    manual_interrupt:manualInterrupt.status,
    structured_event_channel:structuredChannel.status,
    reconnect_status_reporting:reconnect.status,
    context_refresh:contextRefresh.disposition,
    observation_refs:wireRefs([...(input.observation_refs??[]),bodyProvenanceRef(constitution)],"voice observation reference",256),
  });
  return {binding,declaration,duplex,barge_in:bargeIn,manual_interrupt:manualInterrupt,structured_event_channel:structuredChannel,reconnect_status_reporting:reconnect,context_refresh:contextRefresh};
}

/** The desktop's caller-side satisfaction receipt: the QL floor evaluation
 * plus the named reduction, as one exact document. `satisfied:false` is a
 * fact about the composed body against the authored floor — never an error,
 * and never softened. */
export function voiceBodySatisfactionReceipt(input:{satisfaction_ref:string;nara_ref:string;reduction:VoiceBodyReduction;requirements?:VoiceBodyRequirements;evaluated_at:string}):Record<string,unknown> {
  const requirements=input.requirements??dialogicalFloor();
  const unmet=voiceBodySatisfaction(input.reduction.declaration,requirements);
  const receipt=exactKeys({
    schema:VOICE_BODY_SATISFACTION_VERSION,
    satisfaction_ref:wireText(input.satisfaction_ref,"satisfaction_ref"),
    voice_body_contract:NARA_VOICE_BODY_CONTRACT,
    requirement_set:"dialogical-floor",
    nara_ref:wireText(input.nara_ref,"nara_ref"),
    body_ref:input.reduction.binding.body_ref,
    satisfied:unmet.length===0,
    unmet,
    declaration:input.reduction.declaration,
    reduction:{
      duplex:input.reduction.duplex,
      barge_in:input.reduction.barge_in,
      manual_interrupt:input.reduction.manual_interrupt,
      structured_event_channel:input.reduction.structured_event_channel,
      reconnect_status_reporting:input.reduction.reconnect_status_reporting,
      context_refresh:input.reduction.context_refresh,
    },
    evaluated_at:wireText(input.evaluated_at,"evaluated_at"),
  },["schema","satisfaction_ref","voice_body_contract","requirement_set","nara_ref","body_ref","satisfied","unmet","declaration","reduction","evaluated_at"],"voice body satisfaction receipt");
  noSecretMaterialKeys(receipt,"voice body satisfaction receipt");
  return receipt;
}
