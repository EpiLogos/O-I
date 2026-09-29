/** An accepted proposal becomes Factory work through Factory's own intake.
 *
 * The person accepts a proposal in the Inbox (Central records the decision);
 * the desktop then asks Factory to commission it (`factory development
 * commission`), and records the Run Factory made back on the Return as that
 * owner's realisation (`central.receiving.include`). Central never calls
 * Factory, and Factory never reads the Inbox: the person's hand joins them.
 *
 * The request is derived only from the accepted Return. Its `requestRef` is
 * a function of the Return's identity, so repeating a commission after an
 * interruption replays in Factory (`already-applied`) instead of minting a
 * second Run. */
import type {ReturnReading} from "./client";
import type {AgentSetReading} from "../central/client";

/** Who carries a commissioned Run: the O:I guardian and the family under it
 * (Central's root agent-set `oi-guardians`), which calls on the Factory
 * guardian where needed — the owner's standing arrangement (2026-09-29).
 * The proposing Agent asked for the work; it is not thereby its carrier. */
export const CARRYING_FAMILY="oi-guardians";

export interface FactorySource {statePath:string;projectKey:string}

/** The register a Return was received in, as a Central scope ref. */
export const registerScope=(project?:string|null)=>project?`project:${project}`:"control:root";

/** Whether this Return is an accepted proposal still waiting for Factory. */
export function awaitsFactory(reading:ReturnReading):boolean{
 const record=reading.record;
 return record.kind==="request"&&record.request?.kind==="proposal"&&record.request.proposed_owner_ref==="factory"&&record.status==="accepted"&&!record.realisation;
}

/** The person commissioned the work when they accepted it: the acceptance
 * time, never the clock at retry, so a repeated commission is byte-identical. */
export const acceptedAt=(reading:ReturnReading)=>new Date((reading.record.review?.reviewed_at_unix_seconds??0)*1000).toISOString().replace(/\.\d{3}Z$/,"Z");

/** Factory's commission text is one trimmed line with no control
 * characters; an Agent's paragraphs are joined, never refused downstream. */
export const oneLine=(text:string)=>text.replace(/[\s\p{Cc}]+/gu," ").trim();

export function commissionRequest(reading:ReturnReading,source:FactorySource,project:string|null|undefined,family:AgentSetReading){
 const record=reading.record,request=record.request;
 if(!awaitsFactory(reading)||!request||!record.review)throw new Error("Only an accepted proposal for Factory can be commissioned");
 const carrier=family.record.orchestrator_agent_ref;
 if(family.kind!=="agent-set"||!carrier||!family.source_path.startsWith("Control/"))throw new Error(`The carrying family ${family.ref} has no orchestrator to carry the Run`);
 const identity=reading.return_ref.slice(reading.return_ref.lastIndexOf(":")+1);
 if(!/^[0-9a-f]{16,}$/i.test(identity))throw new Error("The Return has no stable identity to commission from");
 const requestRef=`commission:inbox-${identity}`;
 const producer=record.declared_producer?.ref??record.author.principal_ref;
 const frontier=oneLine([request.body??record.summary??request.subject,record.review.note?`The person's note on acceptance: ${record.review.note}`:undefined].filter(Boolean).join(" — "));
 return {
  contract:"factory.commission-request/v1",
  requestRef,
  projectKey:source.projectKey,
  purpose:oneLine(request.subject),
  frontier,
  runDestination:oneLine(`The accepted proposal ${reading.return_ref}${request.proposal_ref?` (${request.proposal_ref})`:""}; its evidence: ${(record.evidence_refs??[]).join(", ")||"none named"}`),
  writeOwner:"factory",
  commissionedAt:acceptedAt(reading),
  rootAct:{actRef:`act:inbox-${identity}`,agentRef:carrier,purpose:oneLine(request.subject),
   scopeRefs:[registerScope(project)],standing:"commissioned-not-executed"},
  participantRequirements:[
   {ref:carrier,
    description:oneLine(`Carries the proposal ${producer} made and the person accepted; returns actual evidence through the existing Factory Return.`),
    sourceOwner:"central",sourceRef:reading.return_ref,sourceRevision:reading.revision},
   {ref:`agent-set/${family.ref}`,
    description:oneLine(`The family ${carrier} orchestrates and calls on where needed, as Central records it.`),
    sourceOwner:"central",sourceRef:`central:source:control:root:${family.source_path}`,sourceRevision:family.revision}],
 };
}
