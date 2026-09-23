/**
 * The agent's page (10-SIDEBARS §4.5, §4.7): opened from the Agents tab and
 * the avatar menu's "Agent details". Read from Central's roster each time the
 * page mounts (agency/roster.ts) — labelled fields first, then Skills · Setup
 * · Activity. Nothing is invented: an absent fact says it is absent.
 */
import {registerObjectKind} from "./registry";
import {readRoster,isGuardian} from "../../agency/roster";

registerObjectKind({
 kind:"agent",label:"Agent",glyph:"agent",
 read:async(object,{transport})=>{
  const agents=await readRoster(transport,object.project);
  const agent=agents.find(entry=>entry.ref===object.ref);
  if(!agent)throw new Error(`Central's roster in this scope names no agent ${object.ref}.`);
  return {
   kindLabel:isGuardian(agent)?"Guardian":"Agent",
   title:agent.name,
   state:agent.accepted?"Accepted — it can be prepared to work":"Not accepted yet — it cannot start work until you accept it",
   fields:[
    {label:"Purpose",value:agent.purpose??"Its profile states no purpose."},
    {label:"Role",value:agent.role?agent.role.replace(/-/g," "):"No role recorded"},
    {label:"Identity",value:agent.ref},
    {label:"Profile",value:`${agent.profileRef}${agent.revision?` · revision ${agent.revision}`:""}`},
    {label:"Scope",value:agent.scopeRef??"Central"},
   ],
   relations:agent.governanceRefs.map(ref=>({label:"Governed by",text:ref})),
   content:<>
    <h2>Skills</h2>
    {agent.skillRefs.length?<ul className="object-list">{agent.skillRefs.map(ref=><li key={ref}>{ref}</li>)}</ul>:<p className="object-text">Its profile names no skills.</p>}
    <h2>Setup</h2>
    <p className="object-text">{agent.accepted?"Accepted in Central. Its sessions are prepared through AIKit when a conversation opens with it.":"Review and accept its profile in Agency before it can work."} {agent.worldRef?`World: ${agent.worldRef}.`:""}</p>
    <p><button type="button" className="oi-action" onClick={()=>window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{project:object.project}}))}>Open in Agency</button></p>
    <h2>Activity</h2>
    <p className="object-text">Its activity shows in a conversation's Activity tab while that conversation runs with it.</p>
   </>,
  };
 },
});
