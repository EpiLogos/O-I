import {useState} from "react";
import type {QlDoc} from "./instance";
import {addParticipant,isCurrentFormat,leaveParticipant,upgradeDocument,type PluralParticipant} from "./plural";
import {useAgentRoster,type RosterAgent} from "../agency/roster";

/** Who is in this flow, and the ordinary acts on that: bring someone in,
 * let someone leave. Joining records a participant; it starts nothing and is
 * not authentication — a person picked from the roster is a declared
 * participant until the native owner binds them by acting. */
const initialFor=(name:string,used:Set<string>)=>{
 const letters=[...name.toUpperCase().replace(/[^A-Z]/g,""),..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
 return letters.find(letter=>!used.has(letter))??"?";
};
export function FlowParticipants({doc,project,disabled,onChange}:{doc:QlDoc;project?:string;disabled?:boolean;onChange:(next:QlDoc)=>Promise<void>}){
 const roster=useAgentRoster(project||undefined);
 const [name,setName]=useState("");const [kind,setKind]=useState<"agent"|"person">("agent");const [busy,setBusy]=useState(false);
 const current=isCurrentFormat(doc);
 const participants=(doc.meta.participants??[]) as PluralParticipant[];
 const present=new Set(participants.filter(p=>!p.left).map(p=>p.binding?.ref).filter(Boolean));
 const available=(roster.agents??[]).filter((agent:RosterAgent)=>agent.accepted&&!present.has(agent.ref));
 const used=()=>new Set(participants.filter(p=>!p.left).map(p=>p.initial));
 const commit=async(next:QlDoc)=>{setBusy(true);try{await onChange(next);}finally{setBusy(false);}};
 const bringIn=(agent:RosterAgent)=>commit(addParticipant(doc,{initial:initialFor(agent.name,used()),name:agent.name,kind:"agent",binding:{owner:"central",ref:agent.ref,basis:"declared"}},new Date().toISOString()));
 const addByName=()=>{
  const label=name.trim();if(!label)return;
  void commit(addParticipant(doc,{initial:initialFor(label,used()),name:label,kind,binding:{owner:"document",basis:"unknown"}},new Date().toISOString())).then(()=>setName(""));
 };
 return <details className="flow-participants" data-flow-participants>
  <summary>Participants ({participants.filter(p=>!p.left).length})</summary>
  {!current&&<p className="oi-note flow-upgrade" role="note">This is an earlier form of the flow. It reads and writes as before. Upgrading adds participants, addressing and relations, and keeps every entry.{" "}
   <button type="button" disabled={disabled||busy} onClick={()=>void commit(upgradeDocument(doc,new Date().toISOString()))}>Upgrade to the plural form</button></p>}
  {current&&<>
   <ul className="flow-participant-list" aria-label="Participants">
    {participants.map(p=><li key={p.key??p.initial} data-participant-key={p.key} data-participant-kind={p.kind} data-participant-left={p.left?"true":undefined}>
     <b>{p.name||p.initial}</b> <small>{p.initial} · {p.kind==="agent"?"agent":"person"}{p.role==="observer"?" · observer":""}{p.left?" · left":""}{p.binding?.basis==="verified"?" · attributed":p.binding?.ref?" · declared":""}</small>
     {!p.left&&p.key&&<button type="button" aria-label={`${p.name||p.initial} leaves`} disabled={disabled||busy} onClick={()=>void commit(leaveParticipant(doc,p.key as string,new Date().toISOString()))}>Leave</button>}
    </li>)}
   </ul>
   <div className="flow-bring-in">
    <h4>Bring someone in</h4>
    {roster.state==="error"&&<p role="alert" className="flow-error">{roster.error}</p>}
    {available.length>0&&<ul aria-label="Agents you can bring in">{available.map((agent:RosterAgent)=><li key={agent.ref}><span>{agent.name}</span>{agent.purpose&&<small className="oi-note"> {agent.purpose}</small>} <button type="button" disabled={disabled||busy} onClick={()=>void bringIn(agent)}>Bring in</button></li>)}</ul>}
    {roster.state!=="error"&&available.length===0&&<p className="oi-note">Every accepted agent is already here.</p>}
    <div className="flow-add-by-name"><label>Name <input aria-label="Participant name" value={name} onChange={event=>setName(event.target.value)}/></label> <select aria-label="Participant kind" value={kind} onChange={event=>setKind(event.target.value as "agent"|"person")}><option value="agent">an agent</option><option value="person">a person</option></select> <button type="button" disabled={disabled||busy||!name.trim()} onClick={addByName}>Add</button></div>
    <p className="oi-note">Joining records a participant. It does not start a model or grant access to anything else.</p>
   </div>
  </>}
 </details>;
}
