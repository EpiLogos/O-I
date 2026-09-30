import {useState} from "react";
import type {QlDoc} from "./instance";
import type {PluralParticipant} from "./plural";
import {stateText,terminalState,type ConversationReading} from "./conversation";

/** Who was asked what, and where each answer stands, as the owner records it.
 * Every recipient is its own line with its own standing — a sibling's failure
 * never reads as this one's, and an answer still arriving is shown as arriving,
 * not as done. Closing this view changes none of it. */
export function FlowConversations({doc,requests,onReconcile,onOpenEntry}:{doc:QlDoc;requests:ConversationReading[];onReconcile:(requestRef:string)=>Promise<void>;onOpenEntry:(entryId:string)=>void}){
 const [busy,setBusy]=useState<string>();
 if(!requests.length)return null;
 const participants=(doc.meta.participants??[]) as PluralParticipant[];
 const nameOf=(key:string)=>participants.find(p=>p.key===key)?.name||participants.find(p=>p.key===key)?.initial||key;
 const numberOf=(id?:string)=>{const i=doc.entries.findIndex(e=>e.id===id);return i<0?undefined:i+1;};
 return <section className="flow-conversations" aria-label="Requests for a response" data-flow-conversations>
  {requests.map(request=>{
   const asked=numberOf(request.entry?.entry_id);
   const open=request.recipients.some(recipient=>!terminalState(recipient.state));
   return <article key={request.request_ref} className="flow-conversation" data-request={request.request_ref} data-open={open?"true":"false"}>
    <header><strong>{asked?<button type="button" className="flow-relation-link" onClick={()=>request.entry?.entry_id&&onOpenEntry(request.entry.entry_id)}>Asked in entry {asked}</button>:"Asked"}</strong>{open&&<small className="oi-note"> — in progress</small>}</header>
    <ul>
     {request.recipients.map(recipient=>{
      const name=nameOf(recipient.participant_key);
      const included=recipient.inclusion.entry_id;
      const retryable=["failed","returned-not-included","held","uncertain","waiting-for-entry"].includes(recipient.state);
      return <li key={recipient.participant_key} data-recipient={recipient.participant_key} data-recipient-state={recipient.state}>
       <span role="status">{stateText(recipient,name)}</span>
       {included&&numberOf(included)&&<> <button type="button" className="flow-relation-link" onClick={()=>onOpenEntry(included)}>Open the reply (entry {numberOf(included)})</button></>}
       {retryable&&<> <button type="button" disabled={busy===request.request_ref} onClick={async()=>{setBusy(request.request_ref);try{await onReconcile(request.request_ref);}finally{setBusy(undefined);}}}>Check again</button></>}
       {recipient.reply&&recipient.state!=="included"&&recipient.reply.text&&<details open={!recipient.reply.complete}><summary>{recipient.reply.complete?"Answer":"Answer so far"}{recipient.reply.truncated&&" (longer than shown)"}</summary><p className="flow-conversation-reply">{recipient.reply.text}</p></details>}
      </li>;
     })}
    </ul>
   </article>;
  })}
 </section>;
}
