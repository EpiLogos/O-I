import {useCallback,useEffect,useRef,useState} from "react";
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import {encounter} from "../encounter/client";
import type {EncounterProvisioning} from "../encounter/client";

/** The owner's conversation-request contract (`aikit.conversation-request/v1`,
 * `encounter_conversation.rs` in the bound ai-kit revision), carried verbatim.
 * One authored Flow entry, several recipients: the owner records it, commits
 * the entry through Central, dispatches each recipient as its own delivery and
 * — owner-side, with no view open — appends each returned reply to the Flow
 * under its author. What this module reads is the owner's record of that, not
 * a renderer guess: a recipient's state is whatever the owner says it is. */
export interface ConversationSendRequest {
  request_ref:string;
  flow_location:{schema:string;ref:string;root:string;path:string};
  /** Exact UUID from the actual observed Flow; optional for legacy callers. */
  expected_document_id?:string|null;
  sender:string;actor:string;actor_kind?:"human"|"agent";author_session?:string;
  entry:{author_key:string;html:string;at:string;relations?:unknown[];addressees?:string[];audience?:unknown;basis_revision?:number};
  recipients:{participant_key:string;agent_session:string}[];
}
export type ConversationRequestWire=
  |{action:"conversation-send";request:ConversationSendRequest}
  |{action:"conversation-read";request_ref:string}
  |{action:"conversation-list";flow_ref:string}
  |{action:"conversation-reconcile";request_ref:string};

export type RecipientState="waiting-for-entry"|"held"|"queued"|"delivered"|"answering"|"returned"|"included"|"refused"|"returned-not-included"|"failed"|"cancelled"|"uncertain"|"unknown";
export interface ConversationRecipient {
  participant_key:string;agent_session:string;agent_ref?:string|null;delivery_ref:string;state:RecipientState;
  dispatch:{standing:string;detail?:string|null};
  delivery?:{phase:string;detail?:string|null;first_cursor:number;terminal_cursor?:number|null}|null;
  reply?:{text:string;complete:boolean;bytes:number;truncated:boolean}|null;
  inclusion:{standing:string;detail?:string|null;entry_id?:string|null;revision?:string|null;attempts:number};
}
export interface ConversationReading {
  schema:"aikit.conversation-request/v1";request_ref:string;
  flow:{location:{ref:string};document_id?:string};
  entry?:{entry_id?:string;revision?:string;document_revision?:number}|null;
  author_key:string;recipients:ConversationRecipient[];task_completion:"not-inferred";
}
const call=async<T>(transport:KernelTransportStatus,project:string,request:ConversationRequestWire):Promise<T>=>encounter<T>(transport,project,request);

export const conversationSend=(transport:KernelTransportStatus,project:string,request:ConversationSendRequest)=>call<{fresh:boolean;request:ConversationReading}>(transport,project,{action:"conversation-send",request});
export const conversationRead=(transport:KernelTransportStatus,project:string,requestRef:string)=>call<ConversationReading>(transport,project,{action:"conversation-read",request_ref:requestRef});
export const conversationReconcile=(transport:KernelTransportStatus,project:string,requestRef:string)=>call<ConversationReading>(transport,project,{action:"conversation-reconcile",request_ref:requestRef});
export async function conversationList(transport:KernelTransportStatus,project:string,flowRef:string):Promise<ConversationReading[]> {
  // An owner that predates conversation requests, or answers oddly, is an
  // absence of requests — never a reason for the flow itself to fail.
  const reading=await call<{requests?:ConversationReading[]}|null>(transport,project,{action:"conversation-list",flow_ref:flowRef});
  return Array.isArray(reading?.requests)?reading.requests:[];
}
/** Bring a named roster Agent into a Flow: a fresh Agency session for exactly
 * that Agent with this one sender and Flow admitted. Starts the agent's
 * resident; the caller does this only when a person has asked that agent. */
export async function flowParticipantProvision(transport:KernelTransportStatus,project:string,input:{agent_ref:string;flow_ref:string;sender:string;preferred_body_ref?:string}):Promise<EncounterProvisioning&{agent_ref?:string|null;admission?:{admitted:boolean;unchanged:boolean}}> {
  const result=await kernelOp(transport,{op:"flow_participant_provision",project,...input});
  if(result.error||result.outcome?.result!=="encounter_provisioned")throw new Error(result.error??"AIKit did not bring this agent into the Flow");
  return result.outcome.data as EncounterProvisioning&{agent_ref?:string|null};
}
/** Fresh identity for one ask. The owner binds it durably; the same ref with
 * different content is a conflict and a repeat is a readback, never a resend. */
export function mintConversationRef():string {
  const bytes=new Uint8Array(10);crypto.getRandomValues(bytes);
  return `conversation/desktop-${Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}`;
}
/** A recipient's standing in ordinary words — each effect its own fact, never a
 * single success bit. The owner's detail is appended verbatim when it has one. */
export function stateText(recipient:ConversationRecipient,name:string):string {
  const detail=recipient.dispatch.detail||recipient.inclusion.detail||recipient.delivery?.detail;
  const more=detail?` — ${detail}`:"";
  switch(recipient.state){
   case "waiting-for-entry":return `Waiting for your entry to be saved before asking ${name}`;
   case "held":return `${name} is busy with another request; this one waits its turn${more}`;
   case "queued":return `Queued for ${name}; it is delivered when they are next ready`;
   case "delivered":return `Delivered to ${name}; no answer yet`;
   case "answering":return `${name} is answering`;
   case "returned":return `${name} has answered; adding it to the flow`;
   case "included":return `${name} answered; the reply is in the flow`;
   case "refused":return `${name} was not asked${more}`;
   case "returned-not-included":return `${name} answered, but the reply could not be added${more}`;
   case "failed":return `${name}'s turn failed${more}`;
   case "cancelled":return `${name}'s turn was stopped`;
   case "uncertain":return `It is not certain whether ${name} received this; it was not resent${more}`;
   default:return `${name}: state unknown`;
  }
}
export const terminalState=(state:RecipientState)=>["included","refused","returned-not-included","failed","cancelled","uncertain"].includes(state);

/** The owner's conversation records for one Flow, refreshed while any recipient
 * is still in motion (quickly) and otherwise slowly — so a reply that arrived
 * while the view was closed is found on reopening, once, without re-asking. */
export function useFlowConversations(transport:KernelTransportStatus,project:string|undefined,flowRef:string|undefined,onChange?:(requests:ConversationReading[])=>void){
  const [requests,setRequests]=useState<ConversationReading[]>([]);const [error,setError]=useState<string>();
  const latest=useRef(onChange);latest.current=onChange;
  const refresh=useCallback(async()=>{
    if(!project||!flowRef)return [];
    try{const next=await conversationList(transport,project,flowRef);setRequests(next);setError(undefined);latest.current?.(next);return next;}
    catch(reason){setError(String(reason));return [];}
  },[transport,project,flowRef]);
  useEffect(()=>{
    let live=true;let timer:ReturnType<typeof setTimeout>|undefined;
    const tick=async()=>{
      const next=await refresh();if(!live)return;
      const active=next.some(request=>request.recipients.some(recipient=>!terminalState(recipient.state)));
      timer=setTimeout(()=>void tick(),active?1500:8000);
    };
    void tick();
    return()=>{live=false;if(timer)clearTimeout(timer);};
  },[refresh]);
  return {requests,error,refresh};
}
