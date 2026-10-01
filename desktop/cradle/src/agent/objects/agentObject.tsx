/**
 * The agent's page (10-SIDEBARS §4.5, §4.7): opened from the Agents tab and
 * the avatar menu's "Agent details". Read from Central's roster each time the
 * page mounts (agency/roster.ts) — labelled fields first, then Skills · Setup
 * · Activity. Nothing is invented: an absent fact says it is absent.
 */
import {registerObjectKind} from "./registry";
import {readRoster,isGuardian} from "../../agency/roster";
import type {RosterAgent} from "../../agency/roster";
import type {ObjectReading,ObjectRef} from "./registry";
import {subjectLabel} from "../../../../../shared-field/presentation-text.mjs";

export function agentReading(agent:RosterAgent,object:ObjectRef):ObjectReading {
 return {
   kindLabel:isGuardian(agent)?"Guardian":"Agent",
   title:subjectLabel(agent,"Unnamed agent"),
   state:agent.accepted?"Accepted — it can be prepared to work":"Not accepted yet — it cannot start work until you accept it",
   fields:[
    {label:"Purpose",value:agent.purpose??"Its profile states no purpose."},
    {label:"Role",value:subjectLabel(agent.role,"No named role recorded").replace(/-/g," ")},
    {label:"Scope",value:object.project??"Personal world"},
   ],
   content:<>
    <h2>Skills</h2>
    <p className="object-text">{agent.skillRefs.length?`${agent.skillRefs.length} ${agent.skillRefs.length===1?"skill is":"skills are"} selected in its native profile. Open Agency to review them.`:"Its profile names no skills."}</p>
    <h2>Setup</h2>
    <p className="object-text">{agent.accepted?"Accepted in Central. Its sessions are prepared through AIKit when a conversation opens with it.":"Review and accept its profile in Agency before it can work."}</p>
    <p><button type="button" className="oi-action" onClick={()=>window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{project:object.project}}))}>Open in Agency</button></p>
    <h2>Activity</h2>
    <p className="object-text">Its activity shows in a conversation's Activity tab while that conversation runs with it.</p>
   </>,
   raw:agent,
 };
}

registerObjectKind({
 kind:"agent",label:"Agent",glyph:"agent",
 read:async(object,{transport})=>{
  const agents=await readRoster(transport,object.project);
  const agent=agents.find(entry=>entry.ref===object.ref);
  if(!agent)throw new Error("Central's roster in this scope no longer names this agent. Reopen it from the current Agency roster.");
  return agentReading(agent,object);
 },
});
