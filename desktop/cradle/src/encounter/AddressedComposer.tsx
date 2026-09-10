import {useState} from "react";
import type {AddressedTurn,DeliveryRecord} from "./client";

/** Explicit addressed work: a machine turn the sender composes and commits,
 * carried by the owner's addressed dispatch — never the shared human draft.
 * Recipient, sender identity and participation basis are owner-validated at
 * commit; a refusal here is the owner's own structured answer, shown verbatim. */
export interface AddressedFields {sender:string;audience:string;basis:string;sourceRefs:string;text:string}
export type DispatchState =
  | {kind:"idle"}
  | {kind:"running";ref:string;phase:string}
  | {kind:"settled";ref:string;record:DeliveryRecord;duplicate:boolean}
  | {kind:"refused";ref:string;error:string};
export interface DeliveryHistoryEntry {ref:string;record:DeliveryRecord;duplicate:boolean}
export const ACTIVE_PHASES=["dispatching","submitted","uncertain"];
const TERMINAL_NOTE:Record<string,string>={
  returned:"Provider turn completed — observed by the native host. This is not task success and no recognition is implied.",
  failed:"The provider turn failed.",
  cancelled:"The turn was cancelled.",
  "reconciled-no-replay":"Correlated with reviewed owner evidence; never replayed.",
};
export function AddressedComposer({disabled,dispatch,history,service,onDispatchFields,onSend}:{disabled:boolean;dispatch:DispatchState;history:DeliveryHistoryEntry[];service?:{running:boolean;pid?:number;detail?:string};onDispatchFields?:(fields:AddressedFields)=>void;onSend:(turn:AddressedTurn,fields:AddressedFields)=>void}) {
  const [sender,setSender]=useState("");const [audience,setAudience]=useState("");
  const [basis,setBasis]=useState("");const [sourceRefs,setSourceRefs]=useState("");
  const [text,setText]=useState("");
  const running=dispatch.kind==="running";
  const update=(patch:Partial<AddressedFields>)=>{const next={sender,audience,basis,sourceRefs,text,...patch};onDispatchFields?.(next);setSender(next.sender);setAudience(next.audience);setBasis(next.basis);setSourceRefs(next.sourceRefs);setText(next.text);};
  const submit=()=>{if(running||disabled||!text.trim()||!sender.trim()||!audience.trim()||!basis.trim())return;
    onSend({delivery_ref:"",sender:sender.trim(),expected_binding_revision:basis.trim(),
      packet:{text,source_refs:sourceRefs.split(/[\s,]+/).filter(Boolean),audience:[audience.trim()]}},{sender,audience,basis,sourceRefs,text});};
  const preview=`${sender.trim()||"—"} → ${audience.trim()||"—"} · basis ${basis.trim()||"—"} · ${sourceRefs.split(/[\s,]+/).filter(Boolean).length||"no"} source ref${sourceRefs.split(/[\s,]+/).filter(Boolean).length===1?"":"s"}`;
  return <section className="encounter-addressed" aria-label="Addressed request">
    <header><strong>Addressed request</strong><small>An explicit machine turn to this participant. It never reads or changes the shared draft above, and nothing is sent until you dispatch it.</small></header>
    <p className="encounter-addressed-service" role="status" data-service={service?(service.running?"running":"stopped"):"unknown"}>
      {service?(service.running?`Native dispatch service is running (pid ${service.pid}).`:"Native dispatch service is not running — the encounter owner is started by its owner, not by this window."):"Checking the native dispatch service…"}
    </p>
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
  </section>;
}
