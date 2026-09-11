import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
export type EncounterRequest = {action:"start"|"providers"|"health"} | {action:"open";space:string;agent_session:string;provider:string} | {action:"read";agent_session:string;after:number;limit:number} | {action:"view";agent_session:string;before?:number} | {action:"draft";agent_session:string;basis:number;text:string} | {action:"prompt";agent_session:string;draft_revision:number} | {action:"cancel";agent_session:string;reason?:string} | {action:"status";agent_session:string} | {action:"permission";agent_session:string;request_id:string;decision:PermissionDecision} | {action:"send";agent_session:string;turn:AddressedTurn} | {action:"send-group";delivery_ref:string;sender:string;packet:AddressedPacket;recipients:GroupRecipient[]} | {action:"delivery";agent_session:string;delivery_ref:string} | {action:"reconnect";space:string;agent_session:string;provider:string};
/** Owner wire contract (bound ai-kit revision, `encounter_agency.rs`); field names verbatim. */
export interface AddressedPacket {text:string;source_refs:string[];audience:string[]}
export interface AddressedTurn {delivery_ref:string;sender:string;expected_binding_revision:string;packet:AddressedPacket}
export interface GroupRecipient {agent_session:string;expected_binding_revision:string}
/** One durable owner receipt. `submitted` is a transport ACK; `returned` means the
 * native host observed a completed provider turn — neither is task success. */
export interface DeliveryRecord {sender:string;phase:"dispatching"|"submitted"|"uncertain"|"returned"|"failed"|"cancelled"|"reconciled-no-replay"|string;first_cursor:number;terminal_cursor?:number|null;detail?:string|null}
export interface SendReceipt {duplicate:boolean;transport_accepted?:boolean;delivery:DeliveryRecord;task_completion?:string;recognition?:string}
export interface GroupReceipt {delivery_ref:string;recipients:{agent_session:string;result?:SendReceipt;error?:{code:string;message:string}}[];atomic_fanout:false;standing:string}
export interface Draft {revision:number;text:string}
export type PermissionDecision={outcome:"selected";option_id:string}|{outcome:"cancelled"};
export interface NativePermission {native_request_id:string;native_session_id:string;tool_call_id?:string;tool_call:unknown;raw:unknown;choices:{option_id:string;label:string;kind?:string}[];provenance:string[]}
export interface EncounterAction {ref:string;enabled:boolean;reason:string|null}
export interface EncounterReading {schema?:"aikit.encounter-view/v1";agent_session:string;blocks:{id:number;kind:string;text:string}[];more:boolean;draft:Draft;connection?:EncounterStatus;permissions?:NativePermission[];permission_authority?:"native-provider-consent";actions?:EncounterAction[]}
export interface EncounterStatus {resident?:boolean;native_session_id?:string;state:string;error?:string|null;provider?:{id:string;label:string}}
/** The owner A2A floor's returned difference (shared-field/a2a.mjs), as the
 * agency panel renders it: pending admission on the receiving installation. */
export interface A2aDifference {exchange_ref:string;binding_ref:string;binding_revision:number;agent_ref:string;initiator_participant_ref:string;transport_result:{kind:string;ref:string};transport_provenance?:{agent_card?:{name?:string;version?:string}};[field:string]:unknown}
export interface A2aPeerFields {peerAgent:string;peerEndpoint:string;peerCard:string;peerAvailability:string}
/** One page of the owner's raw journal (`aikit encounter read`): the events
 * behind the transcript view, on the owner's own cursor. */
export interface JournalEvent {cursor:number;event:unknown}
export interface JournalPage {agent_session:string;events:JournalEvent[];next_cursor:number;more:boolean}
/** Fresh sender-side delivery identity. The owner binds it durably; reuse with
 * different content is a conflict, and a repeat of the exact delivery is a
 * receipt read, never a resend. */
export function mintDeliveryRef():string {
  const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);
  return `delivery/desktop-${Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}`;
}
export async function encounter<T>(transport:KernelTransportStatus,project:string,request:EncounterRequest):Promise<T> {
  const result=await kernelOp(transport,{op:"encounter",project,request});
  if(result.error || result.outcome?.result!=="encounter_reading")throw new Error(result.error??"AIKit did not return an encounter reading");
  return result.outcome.data as T;
}
