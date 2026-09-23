import {useEffect,useRef,useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {isGuardian,type RosterAgent,type RosterReading} from "../../agency/roster";
import {openIntent,openObject} from "../objects/registry";
import {Avatar,type PanelPresence} from "./AvatarMenu";

/**
 * The Agents tab (10-SIDEBARS §4.5): the roster of real identities only —
 * WORKING WITH YOU, then GUARDIANS — with a search icon and one + (New agent…,
 * the Agency surface's own creation route). A row shows avatar, name, one
 * purpose line, the current assignment only when real, and a state mark;
 * Message and … reveal on hover. Clicking a row opens the agent's page (§4.7).
 * The three honest empties are distinct: "Create an agent to work with." /
 * "Couldn't load agents." + Retry / "No agents match "x"." + Clear.
 */
export function AgentsTab({roster,boundRef,boundPresence,assignment,onMessage}:{roster:RosterReading;
 /** The agent answering the open conversation, when its binding names one. */
 boundRef?:string;boundPresence?:PanelPresence;assignment?:string;
 onMessage?:(agent:RosterAgent)=>void}) {
 const [searching,setSearching]=useState(false);
 const [query,setQuery]=useState("");
 const [menu,setMenu]=useState(false);
 const field=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(searching)field.current?.focus();},[searching]);
 const needle=query.trim().toLowerCase();
 const matches=needle?roster.agents.filter(agent=>`${agent.name} ${agent.purpose??""} ${agent.ref}`.toLowerCase().includes(needle)):roster.agents;
 const working=matches.filter(agent=>!isGuardian(agent));
 const guardians=matches.filter(isGuardian);
 const clear=()=>{setQuery("");setSearching(false);};
 const mark=(agent:RosterAgent):{presence?:PanelPresence;title:string}=>{
  if(agent.ref===boundRef&&boundPresence)return {presence:boundPresence,title:boundPresence==="working"?"Working in this conversation":boundPresence==="attention"?"Needs you":boundPresence==="unavailable"?"Unavailable":"In this conversation"};
  return agent.accepted?{presence:"idle",title:"Accepted — ready to work"}:{presence:"unavailable",title:"Not accepted yet — it cannot start work until you accept it"};
 };
 const row=(agent:RosterAgent)=>{const state=mark(agent);return <li key={agent.ref} className="agents-row" data-agent-ref={agent.ref}>
  <button type="button" className="agents-row-open" title="Open this agent's page — ⌥-click pops it out" onClick={event=>openObject({kind:"agent",ref:agent.ref,title:agent.name},openIntent(event))}>
   <Avatar agent={agent} size="md"/>
   <span className="agents-row-text"><span className="agents-row-name">{agent.name}</span>{agent.purpose&&<span className="agents-row-purpose">{agent.purpose}</span>}{agent.ref===boundRef&&assignment&&<span className="agents-row-assignment">{assignment}</span>}</span>
  </button>
  <span className="agents-row-tools">
   {onMessage&&agent.accepted&&<button type="button" className="oi-tool" aria-label={`Message ${agent.name}`} title="Message" onClick={()=>onMessage(agent)}><Glyph name="chat" size={12}/></button>}
   <button type="button" className="oi-tool" aria-label={`${agent.name}: more`} title="Pop out its page" onClick={()=>openObject({kind:"agent",ref:agent.ref,title:agent.name},{popOut:true})}><Glyph name="more" size={12}/></button>
  </span>
  <span className="agents-row-mark" data-presence={state.presence} title={state.title} aria-label={state.title}>{state.presence==="attention"?"!":state.presence==="unavailable"?"×":""}</span>
 </li>;};
 return <div className="agent-plane panel-agents" data-plane="Agents">
  <div className="agents-head">
   {searching&&<input ref={field} className="oi-input agents-search" type="search" aria-label="Search agents" placeholder="Search agents" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Escape")clear();}}/>}
   {!searching&&<button type="button" className="oi-tool" aria-label="Search agents" onClick={()=>setSearching(true)}><Glyph name="search" size={13}/></button>}
   <div className="agents-create">
    <button type="button" className="oi-tool" aria-label="New agent" aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(value=>!value)}><Glyph name="plus" size={13}/></button>
    {menu&&<div className="oi-menu agents-create-menu" role="menu"><button type="button" role="menuitem" className="oi-menu-item" onClick={()=>{setMenu(false);window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{}}));}}>New agent…</button></div>}
   </div>
  </div>
  {roster.state==="error"&&<p className="agents-empty" role="alert" data-empty="error">Couldn&apos;t load agents. <button type="button" className="oi-action" onClick={roster.retry}>Retry</button></p>}
  {roster.state==="reading"&&!roster.agents.length&&<p className="agents-empty" role="status" data-empty="reading">Reading agents…</p>}
  {roster.state==="ready"&&!roster.agents.length&&<p className="agents-empty" data-empty="none">Create an agent to work with. <button type="button" className="oi-action" onClick={()=>window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{}}))}>New agent…</button></p>}
  {needle&&roster.agents.length>0&&!matches.length&&<p className="agents-empty" data-empty="search">No agents match &ldquo;{query.trim()}&rdquo;. <button type="button" className="oi-action" onClick={clear}>Clear</button></p>}
  {working.length>0&&<section className="agents-section" aria-label="Working with you"><h3>Working with you</h3><ul>{working.map(row)}</ul></section>}
  {guardians.length>0&&<section className="agents-section" aria-label="Guardians"><h3>Guardians</h3><ul>{guardians.map(row)}</ul></section>}
 </div>;
}
