import {useMemo,useState} from "react";

/** The owner deliberately discloses only identities that are currently admitted
 * for this sender and packet-source set. A Project attachment alone is not a
 * delivery or Agency admission. */
export interface AddressableParticipant {
  agent_session:string;
  agent_ref:string;
  expected_binding_revision:string;
}

/** UI state around the owner-owned read. `ready` with an empty list is the
 * truthful answer that no candidate is currently admitted. */
export type AddressableParticipantsState =
  | {kind:"awaiting-sender"}
  | {kind:"loading"}
  | {kind:"refused";error:string}
  | {kind:"ready";participants:AddressableParticipant[]};

export function AddressedRecipientPicker({disabled,participants,selected,onChange}:{
  disabled:boolean;
  participants:AddressableParticipantsState;
  selected:AddressableParticipant[];
  onChange:(participants:AddressableParticipant[])=>void;
}) {
  const [query,setQuery]=useState("");
  const selectedSessions=new Set(selected.map(participant=>participant.agent_session));
  const visible=useMemo(()=>{
    if(participants.kind!=="ready")return [];
    const needle=query.trim().toLocaleLowerCase();
    return participants.participants.filter(participant=>!needle||participant.agent_ref.toLocaleLowerCase().includes(needle)||participant.agent_session.toLocaleLowerCase().includes(needle));
  },[participants,query]);
  const select=(participant:AddressableParticipant)=>{
    if(selectedSessions.has(participant.agent_session))onChange(selected.filter(row=>row.agent_session!==participant.agent_session));
    else if(selected.length<32)onChange([...selected,participant]);
  };
  return <div className="encounter-addressed-to">
    <label>To:<input aria-label="Find admitted participants" disabled={disabled||participants.kind!=="ready"} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find an admitted participant" autoComplete="off" spellCheck={false}/></label>
    {participants.kind==="awaiting-sender"&&<p role="status">Enter a sender identity to read admitted participants.</p>}
    {participants.kind==="loading"&&<p role="status">Reading currently admitted participants…</p>}
    {participants.kind==="refused"&&<p role="alert">The owner could not read admitted participants: {participants.error}</p>}
    {participants.kind==="ready"&&participants.participants.length===0&&<p role="status">No participant is currently admitted for this addressed delivery.</p>}
    {participants.kind==="ready"&&participants.participants.length>0&&<ul aria-label="Admitted participants">
      {visible.map(participant=>{const chosen=selectedSessions.has(participant.agent_session);return <li key={participant.agent_session}><button type="button" aria-pressed={chosen} disabled={disabled||(!chosen&&selected.length>=32)} onClick={()=>select(participant)}>{chosen?"Remove":"Add"} <code>{participant.agent_ref}</code></button></li>})}
      {visible.length===0&&<li>No admitted participant matches that text.</li>}
    </ul>}
    {selected.length>0&&<p aria-label="Selected recipients">Selected: {selected.map(participant=><code key={participant.agent_session}>{participant.agent_ref}</code>)}</p>}
    {selected.length>=32&&<p role="status">An addressed fanout has at most 32 recipients.</p>}
  </div>;
}
