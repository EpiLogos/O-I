import {useEffect,useState} from "react";
import type {AddressedPacket,AddressedTurn,DeliveryRecord,GroupRecipient} from "./client";

/** Explicit addressed work: a machine turn the sender composes and commits,
 * carried by the owner's addressed dispatch — never the shared human draft.
 * Recipient, sender identity and participation basis are owner-validated at
 * commit; a refusal here is the owner's own structured answer, shown verbatim.
 * A selected passage can compose this request (oi:addressed-candidate); the
 * selection supplies its exact source ref and quote, never sender/basis. */
export interface AddressedFields {sender:string;audience:string;basis:string;sourceRefs:string;text:string}
export type DispatchState =
  | {kind:"idle"}
  | {kind:"running";ref:string;phase:string}
  | {kind:"settled";ref:string;record:DeliveryRecord;duplicate:boolean}
  | {kind:"refused";ref:string;error:string};
export interface DeliveryHistoryEntry {ref:string;record:DeliveryRecord;duplicate:boolean}
/** Per-recipient line of a group dispatch. `error` is the owner's own refusal
 * verbatim; phases are the owner's durable delivery phases. */
export interface GroupRow {agentSession:string;phase?:string;error?:string;duplicate?:boolean}
export interface GroupState {ref:string;rows:GroupRow[]}
export const ACTIVE_PHASES=["dispatching","submitted","uncertain"];
/** A selection handed to the addressed composer (context tray → addressed
 * request). Presentation state only: it is held until the named conversation's
 * composer next renders, then consumed — never persisted, never auto-sent. */
export interface AddressedCandidate {agentSession:string;sourceRef:string;text:string}
let pendingAddressed:AddressedCandidate|undefined;
/** The context tray's addressed destination. Surfaces unmount with their tab,
 * so the event alone is not enough — the pending slot survives until the
 * composer consumes it. */
export function composeAddressed(candidate:AddressedCandidate) {
  pendingAddressed=candidate;
  window.dispatchEvent(new CustomEvent("oi:addressed-candidate",{detail:candidate}));
}
const TERMINAL_NOTE:Record<string,string>={
  returned:"Provider turn completed — observed by the native host. This is not task success and no recognition is implied.",
  failed:"The provider turn failed.",
  cancelled:"The turn was cancelled.",
  "reconciled-no-replay":"Correlated with reviewed owner evidence; never replayed.",
};
export function AddressedComposer({disabled,dispatch,history,service,agentSession,group,onGroupSend,onDispatchFields,onSend}:{disabled:boolean;dispatch:DispatchState;history:DeliveryHistoryEntry[];service?:{running:boolean;pid?:number;detail?:string};agentSession?:string;group?:GroupState;onGroupSend?:(sender:string,recipients:GroupRecipient[],packet:AddressedPacket)=>void;onDispatchFields?:(fields:AddressedFields)=>void;onSend:(turn:AddressedTurn,fields:AddressedFields)=>void}) {
  const [sender,setSender]=useState("");const [audience,setAudience]=useState("");
  const [basis,setBasis]=useState("");const [sourceRefs,setSourceRefs]=useState("");
  const [text,setText]=useState("");const [selection,setSelection]=useState<{sourceRef:string}|undefined>();
  const running=dispatch.kind==="running";
  const update=(patch:Partial<AddressedFields>)=>{const next={sender,audience,basis,sourceRefs,text,...patch};onDispatchFields?.(next);setSender(next.sender);setAudience(next.audience);setBasis(next.basis);setSourceRefs(next.sourceRefs);setText(next.text);};
  const applyCandidate=(candidate:AddressedCandidate)=>{
    const next={sender,audience,basis,sourceRefs:candidate.sourceRef,text:candidate.text??text};
    onDispatchFields?.(next);setSender(next.sender);setAudience(next.audience);setBasis(next.basis);setSourceRefs(next.sourceRefs);setText(next.text);
    setSelection({sourceRef:candidate.sourceRef});};
  useEffect(()=>{if(!agentSession)return;
    const take=(event:Event)=>{const detail=(event as CustomEvent<AddressedCandidate>).detail;
      if(detail?.agentSession===agentSession&&detail.sourceRef)applyCandidate(detail);};
    window.addEventListener("oi:addressed-candidate",take);
    return()=>window.removeEventListener("oi:addressed-candidate",take);
  },[agentSession,sender,audience,basis,sourceRefs,text]);
  // A composition addressed to this conversation while another tab held the
  // view: consume it the moment this composer renders.
  useEffect(()=>{if(!agentSession)return;
    if(pendingAddressed?.agentSession===agentSession){const candidate=pendingAddressed;pendingAddressed=undefined;applyCandidate(candidate);}
  },[agentSession]);
  const submit=()=>{if(running||disabled||!text.trim()||!sender.trim()||!audience.trim()||!basis.trim())return;
    onSend({delivery_ref:"",sender:sender.trim(),expected_binding_revision:basis.trim(),
      packet:{text,source_refs:sourceRefs.split(/[\s,]+/).filter(Boolean),audience:[audience.trim()]}},{sender,audience,basis,sourceRefs,text});};
  const [recipientsLines,setRecipientsLines]=useState("");const [groupAudienceField,setGroupAudienceField]=useState("");
  const parsedRecipients:GroupRecipient[]=recipientsLines.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{const [session,basis]=line.split(/\s+/);return {agent_session:session??"",expected_binding_revision:basis??""};}).filter(row=>row.agent_session&&row.expected_binding_revision);
  const groupAudienceRefs=groupAudienceField.split(/[\s,]+/).filter(Boolean);
  const groupReady=()=>!running&&!disabled&&!!sender.trim()&&!!text.trim()&&parsedRecipients.length>0&&groupAudienceRefs.length>0;
  const submitGroup=()=>{if(groupReady()&&onGroupSend)onGroupSend(sender.trim(),parsedRecipients,{text,source_refs:sourceRefs.split(/[\s,]+/).filter(Boolean),audience:groupAudienceRefs});};
  const preview=`${sender.trim()||"—"} → ${audience.trim()||"—"} · basis ${basis.trim()||"—"} · ${sourceRefs.split(/[\s,]+/).filter(Boolean).length||"no"} source ref${sourceRefs.split(/[\s,]+/).filter(Boolean).length===1?"":"s"}`;
  return <section className="encounter-addressed" aria-label="Addressed request">
    <header><strong>Addressed request</strong><small>An explicit machine turn to this participant. It never reads or changes the shared draft above, and nothing is sent until you dispatch it.</small></header>
    <p className="encounter-addressed-service" role="status" data-service={service?(service.running?"running":"stopped"):"unknown"}>
      {service?(service.running?`Native dispatch service is running (pid ${service.pid}).`:"Native dispatch service is not running — the encounter owner is started by its owner, not by this window."):"Checking the native dispatch service…"}
    </p>
    {selection&&<p className="encounter-addressed-selection">Composed from the selected passage at <code>{selection.sourceRef}</code> — edit it here freely; the shared draft above was never touched.</p>}
    <div className="encounter-addressed-fields">
      <label>Send as<input aria-label="Sender identity" value={sender} onChange={event=>update({sender:event.target.value})} placeholder="sender ref permitted by the participant" autoComplete="off" spellCheck={false}/></label>
      <label>Recipient agent<input aria-label="Recipient agent" value={audience} onChange={event=>update({audience:event.target.value})} placeholder="agent ref the packet addresses" autoComplete="off" spellCheck={false}/></label>
      <label>Participation basis<input aria-label="Expected participation basis" value={basis} onChange={event=>update({basis:event.target.value})} placeholder="the binding revision this turn expects" autoComplete="off" spellCheck={false}/></label>
      <label>Shared source refs<input aria-label="Shared source refs" value={sourceRefs} onChange={event=>update({sourceRefs:event.target.value})} placeholder="comma-separated refs the participant may receive" autoComplete="off" spellCheck={false}/></label>
    </div>
    <textarea aria-label="Addressed request text" disabled={disabled||running} value={text} onChange={event=>update({text:event.target.value})} rows={3} placeholder="The explicit bounded request…"/>
    <div className="encounter-addressed-actions">
      <span className="encounter-addressed-preview">{preview}</span>
      <button className="encounter-addressed-send" disabled={disabled||running||!text.trim()||!sender.trim()||!audience.trim()||!basis.trim()} onClick={submit}>Dispatch addressed turn</button>
    </div>
    {dispatch.kind==="running"&&<p className="encounter-addressed-state" role="status" data-phase={dispatch.phase}>Delivery <code>{dispatch.ref}</code> — {dispatch.phase==="preparing"?"committing to the owner…":`phase: ${dispatch.phase}`}</p>}
    {dispatch.kind==="settled"&&<div className="encounter-addressed-state" role="status" data-phase={dispatch.record.phase}>
      <p>{dispatch.duplicate?"This delivery was already held by the owner — the durable receipt is shown again, nothing was resent.":<>Delivery <code>{dispatch.ref}</code> settled.</>} Phase: <strong>{dispatch.record.phase}</strong>.</p>
      {TERMINAL_NOTE[dispatch.record.phase]&&<p>{TERMINAL_NOTE[dispatch.record.phase]}</p>}
      {dispatch.record.detail&&<p>Owner detail: {dispatch.record.detail}</p>}
    </div>}
    {dispatch.kind==="refused"&&<p className="encounter-addressed-refusal" role="alert">The owner refused this turn: {dispatch.error}</p>}
    {history.length>0&&<details className="encounter-addressed-history"><summary>Deliveries this view has dispatched ({history.length})</summary><ul>{history.map(entry=><li key={entry.ref}><code>{entry.ref}</code> — {entry.record.phase}{entry.duplicate?" (duplicate read)":''}</li>)}</ul></details>}
    <details className="encounter-addressed-group">
      <summary>Addressed group</summary>
      <p>One packet, several explicitly named recipients. The owner admits the whole group before anything is dispatched; every recipient receives an independent durable result, and the fanout is never atomic. The packet above (sender, shared source refs, text) is what every recipient receives.</p>
      <label>Group recipients — one per line: agent session + expected basis<textarea aria-label="Group recipients" disabled={disabled||running} value={recipientsLines} onChange={event=>setRecipientsLines(event.target.value)} rows={3} placeholder={"agent-session/… rev/1\nagent-session/… rev/2"} spellCheck={false}/></label>
      <label>Group audience — the agent refs the group must agree on exactly<input aria-label="Group audience" disabled={disabled||running} value={groupAudienceField} onChange={event=>setGroupAudienceField(event.target.value)} placeholder="comma-separated agent refs" autoComplete="off" spellCheck={false}/></label>
      <div className="encounter-addressed-actions">
        <span className="encounter-addressed-preview">{parsedRecipients.length||"no"} recipient{parsedRecipients.length===1?"":"s"} · audience {groupAudienceRefs.length||"none"}</span>
        <button className="encounter-addressed-group-send" disabled={!groupReady()||!onGroupSend} onClick={submitGroup}>Dispatch to the group</button>
      </div>
      {group&&<div className="encounter-addressed-group-state" data-ref={group.ref}>
        {group.rows.map(row=><p key={row.agentSession} className="encounter-addressed-group-row" data-phase={row.error?"refused":row.phase}><code>{row.agentSession}</code> — {row.error??(row.duplicate?"already held by the owner — durable receipt, nothing resent":`phase: ${row.phase}`)}</p>)}
        <p>Group delivery <code>{group.ref}</code> — individually durable dispatch; no automatic replay of uncertain recipients.</p>
      </div>}
    </details>
  </section>;
}
