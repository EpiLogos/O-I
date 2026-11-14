import type {ContextOperation,ContextExpectation} from "../context/nativeContext";
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
export {EPI_PRIME_QL_BODY_REF} from "../workspace/agentBody";
export type EncounterRequest = import("./nativeModel").NativeModelRequest | import("./nativeMode").NativeModeRequest | {action:"context";agent_session?:string;request:ContextOperation} | {action:"prompt-context";agent_session:string;draft_revision:number;context:ContextExpectation} | {action:"start"|"providers"|"health"} | {action:"open";space:string;agent_session:string;provider:string} | {action:"read";agent_session:string;after:number;limit:number} | {action:"view";agent_session:string;before?:number} | {action:"draft";agent_session:string;basis:number;text:string} | {action:"prompt";agent_session:string;draft_revision:number} | {action:"cancel";agent_session:string;reason?:string} | {action:"status";agent_session:string} | {action:"permission";agent_session:string;request_id:string;decision:PermissionDecision} | {action:"reconnect";space:string;agent_session:string;provider:string};
export interface Draft {revision:number;text:string}
export type PermissionDecision={outcome:"selected";option_id:string}|{outcome:"cancelled"};
export interface NativePermission {native_request_id:string;native_session_id:string;tool_call_id?:string;tool_call:unknown;raw:unknown;choices:{option_id:string;label:string;kind?:string}[];provenance:string[]}
export interface EncounterAction {ref:string;enabled:boolean;reason:string|null}
export interface EncounterReading {prepared_context_receipts?:{cursor:number;digest:string;revision:number;items:{id:string;title:string;source_ref:string;source_revision?:string}[];standing:string}[];schema?:"aikit.encounter-view/v1";agent_session:string;blocks:{id:number;kind:string;text:string}[];more:boolean;draft:Draft;connection?:EncounterStatus;permissions?:NativePermission[];permission_authority?:"native-provider-consent";actions?:EncounterAction[]}
export interface EncounterStatus {resident?:boolean;native_session_id?:string;state:string;error?:string|null;provider?:{id:string;label:string;body_ref?:string|null;body_revision?:string|null}}
/** The owner A2A floor's returned difference (shared-field/a2a.mjs), as the
 * agency panel renders it: pending admission on the receiving installation. */
export interface A2aDifference {exchange_ref:string;binding_ref:string;binding_revision:number;agent_ref:string;initiator_participant_ref:string;transport_result:{kind:string;ref:string};transport_provenance?:{agent_card?:{name?:string;version?:string}};[field:string]:unknown}
export interface A2aPeerFields {peerAgent:string;peerEndpoint:string;peerCard:string;peerAvailability:string}
/** One page of the owner's raw journal (`aikit encounter read`): the events
 * behind the transcript view, on the owner's own cursor. */
export interface JournalEvent {cursor:number;event:unknown}
export interface JournalPage {agent_session:string;events:JournalEvent[];next_cursor:number;more:boolean}
export async function encounter<T>(transport:KernelTransportStatus,project:string,request:EncounterRequest,sourceWorldRef?:string):Promise<T> {
  const op={op:"encounter" as const,project,request};
  const result=await kernelOp(transport,sourceWorldRef?{op:"hosted_native",source_world_ref:sourceWorldRef,request:op}:op);
  if(result.error || result.outcome?.result!=="encounter_reading")throw new Error(result.error??"AIKit did not return an encounter reading");
  return result.outcome.data as T;
}
/** One freshly provisioned chat conversation (new-chat first Send): the minted
 * refs, the owner's own project spelling and the provider the kernel opened:
 * the census agent's (`provider_default` "census-agent") or a mode's body. The transcript, draft and every later action stay the ordinary
 * encounter actions — provision creates the plumbing once, nothing else. */
export interface EncounterProvisioning {project:string;space:string;agent_session:string;provider:string;provider_default?:string;resolved_body?:{body_ref:string;body_revision:string;standing:string}|null}
/** Ask the kernel to provision a new conversation for a project (create the
 * SessionSpace, bind the project context, attach a fresh agent session,
 * configure its agency binding and open the provider) and return the refs.
 * `agent` is the census agent the person picked (a slug of the World Model's
 * agents, O-I #1003); none, the census's first agent that starts. `agentRef`
 * mints the conversation's Agency for a roster Agent (a Flow participant
 * answers as itself); `preferredBodyRef` opens a mode's body instead. */
export interface ProvisionChoice {agent?:string;agentRef?:string;preferredBodyRef?:string}
export async function encounterProvision(transport:KernelTransportStatus,project:string,choice:ProvisionChoice={}):Promise<EncounterProvisioning> {
  const result=await kernelOp(transport,{op:"encounter_provision",project,...(choice.agent?{agent:choice.agent}:{}),...(choice.agentRef?{agent_ref:choice.agentRef}:{}),...(choice.preferredBodyRef?{preferred_body_ref:choice.preferredBodyRef}:{})});
  if(result.error || result.outcome?.result!=="encounter_provisioned")throw new Error(result.error??"AIKit did not provision a chat conversation");
  return result.outcome.data as EncounterProvisioning;
}
/** Your conversation with one roster Agent (the kernel's agent_conversation, made by the one provision, O-I #1003): its SessionSpace and
 * current session, the census agent it is with (`provider`), its Agency, and how its body stood. Every later act is the one encounter
 * session's (EncounterSession): it observes `agent_session` and sends there. */
export interface AgentConversation {agent_ref:string;space:string;agent_session:string;provider:string;agency:"minted-per-project"|"retained-native-binding";
  body:"opened"|"resumed"|"renewed";
  /** Every canonical session of this conversation, oldest first; the last is `agent_session`. A harness that cannot resume (pi) renews
   * into a new session after its owner restarts, so the earlier ones hold the conversation's history. */
  sessions:string[]}
export async function agentConversation(transport:KernelTransportStatus,agentRef:string,project=""):Promise<AgentConversation> {
  const result=await kernelOp(transport,{op:"agent_conversation",project,agent_ref:agentRef});
  if(result.error || result.outcome?.result!=="encounter_provisioned")throw new Error(result.error??"AIKit did not open a conversation with this agent");
  return result.outcome.data as AgentConversation;
}
/** The session's task record (`aikit.encounter-task/v1`), read through the
 * owner's `encounter-task-read`. `null` is honest absence — no task is bound
 * to this session. Refusals surface the owner's own words. */
export interface EncounterTaskReading {schema:"aikit.encounter-task/v1";revision:string;ready:boolean;request:{central:{task_ref:string;project?:string|null;purpose:string;participant_refs:string[];source_refs:string[]};cwd:string;authority_ref:string};allocation?:{request:unknown;allocation:{now_ref:string;revision:{revision:string};policy:{revision:string}}}|null;agency_revision?:string;[field:string]:unknown}
export async function taskRead(transport:KernelTransportStatus,project:string,agent_session:string,sourceWorldRef?:string):Promise<EncounterTaskReading|null> {
  const op={op:"encounter_task_read" as const,project,agent_session};
  const result=await kernelOp(transport,sourceWorldRef?{op:"hosted_native",source_world_ref:sourceWorldRef,request:op}:op);
  if(result.error || result.outcome?.result!=="encounter_task_reading")throw new Error(result.error??"AIKit did not return a task reading");
  return (result.outcome.data ?? null) as EncounterTaskReading|null;
}
