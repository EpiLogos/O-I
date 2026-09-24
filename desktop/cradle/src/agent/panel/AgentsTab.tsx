import {useMemo,useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {useKernel} from "../../kernel/KernelProvider";
import {isGuardian,type RosterAgent,type RosterReading} from "../../agency/roster";
import {openIntent,openObject} from "../objects/registry";
import {populationAperture,rowMatches,type PositionRow} from "../../contributions/factory/inhabitation/model";
import {usePopulation} from "../../contributions/factory/inhabitation/reads";
import {Avatar,type PanelPresence} from "./AvatarMenu";

/**
 * The Agents tab — who is here (10-SIDEBARS §4.5, Amendment A7; contract
 * WORLD-INHABITATION-V1 §4). In Base, Expressions and Technè the tab lists the
 * **Positions** of the World in scope and who occupies each one, from the
 * owner's population reading (`aikit gateway who`) alone — the same aperture
 * model and store Factory reads (contributions/factory/inhabitation), with no
 * run selected, so there is no "On this run" section. A row shows the
 * Position's name and handle, its occupancy as the owner states it (● only
 * for occupied+active, never drawn present for an unknown) and its current
 * work; clicking it opens the Position's page (§4.7). A failed read is one
 * named line with the owner's words and Retry, never an empty roster.
 *
 * Agent **profiles** stay reachable as secondary detail: a collapsed "Agent
 * profiles" section under the Positions. The avatar menu (§4.1) — not this
 * tab — is where the accompanying chat agent is chosen from those profiles;
 * that path is untouched, so choosing who you talk to still works.
 */
export function AgentsTab({project,roster,boundRef,boundPresence,assignment,onMessage}:{project:string|undefined;roster:RosterReading;
 /** The agent answering the open conversation, when its binding names one. */
 boundRef?:string;boundPresence?:PanelPresence;assignment?:string;
 onMessage?:(agent:RosterAgent)=>void}) {
 const kernel=useKernel();
 const {state,retry}=usePopulation(kernel.transport,project);
 const [query,setQuery]=useState("");
 const aperture=useMemo(()=>populationAperture(state?.read),[state?.read]);
 const reading=!state||(state.status==="reading"&&!state.read);
 const filter=(rows:PositionRow[])=>rows.filter(row=>rowMatches(row,query));
 const world=filter(aperture.world),inherited=filter(aperture.inherited);
 const total=aperture.world.length+aperture.inherited.length;

 const openPosition=(position:PositionRow,event?:{altKey:boolean})=>openObject({kind:"position",ref:position.positionRef,title:position.name,...(project?{project}:{})},event?openIntent(event):{});
 const row=(position:PositionRow)=><li key={position.positionRef} className="agents-row agents-pos-row" data-position={position.positionRef} data-occupancy={position.occupancy.state} data-work={position.work.outcome}>
  <button type="button" className="agents-row-open" title={position.occupancy.attention?`Attention: ${position.occupancy.attention}`:"Open this Position's page — ⌥-click pops it out"} onClick={event=>openPosition(position,event)}>
   <Avatar agent={{name:position.handle?.replace(/^@/,"")??position.name}} size="md"/>
   <span className="agents-row-text">
    <span className="agents-row-name">{position.name}{position.handle&&position.handle!==position.name&&<small className="agents-pos-handle"> {position.handle}</small>}</span>
    <span className="agents-pos-occupancy" data-occupancy-words><span className="agents-pos-mark" data-mark={position.occupancy.mark} aria-hidden="true">{position.occupancy.mark}</span> {position.occupancy.words}{position.occupancy.agent?` · ${position.occupancy.agent}`:""}{position.occupancy.workcell?` · ${position.occupancy.workcell}`:""}</span>
    <span className="agents-pos-work" data-work-words data-attention={position.work.attention?"true":undefined}>{position.work.attention?"? ":""}{position.work.words}</span>
    {position.definition!=="present"&&<small className="agents-pos-definition" data-definition={position.definition}>? Position definition {position.definition}</small>}
   </span>
  </button>
  {position.undelivered!==null&&position.undelivered>0&&<span className="agents-undelivered" data-undelivered={position.undelivered} title={`${position.undelivered} undelivered message${position.undelivered===1?"":"s"}`}>{position.undelivered}</span>}
 </li>;
 const section=(label:string,rows:PositionRow[])=>rows.length>0&&<section key={label} className="agents-section" aria-label={label}><h3>{label}</h3><ul>{rows.map(row)}</ul></section>;

 return <div className="agent-plane panel-agents" data-plane="Agents" data-agents-tab data-population-state={reading?"reading":aperture.state}>
  <div className="agents-head">
   <input className="oi-input agents-search" type="search" aria-label="Search Positions" placeholder="Search Positions" value={query} onChange={event=>setQuery(event.target.value)}/>
  </div>
  {reading&&<p className="agents-empty" role="status" data-empty="reading">Reading who is here…</p>}
  {!reading&&aperture.state==="unavailable"&&<p className="agents-empty" role="alert" data-population-absence>Couldn&apos;t read who is here — {aperture.reason} <small>({aperture.source})</small>. <button type="button" className="oi-action" onClick={retry}>Retry</button></p>}
  {section("In this world",world)}
  {section("Inherited",inherited)}
  {!reading&&aperture.state==="read"&&total===0&&<p className="agents-empty" data-population-empty>No Positions in this world yet.</p>}
  {query&&total>0&&!world.length&&!inherited.length&&<p className="agents-empty" data-population-search-empty>No Positions match &ldquo;{query.trim()}&rdquo;. <button type="button" className="oi-action" onClick={()=>setQuery("")}>Clear</button></p>}
  {aperture.warnings.length>0&&<section className="agents-notes" aria-label="Owner warnings" data-population-warnings>{aperture.warnings.map((warning,index)=><p key={index} className="agents-note">{warning}</p>)}</section>}
  {aperture.absences.length>0&&<section className="agents-notes" aria-label="Not read" data-population-absences>{aperture.absences.map((absence,index)=><p key={index} className="agents-note">{absence.facet?`${absence.facet.replace(/_/g," ")}: `:""}{absence.reason??"not read"}{absence.source?` (${absence.source})`:""}</p>)}</section>}
  <AgentProfiles roster={roster} boundRef={boundRef} boundPresence={boundPresence} assignment={assignment} onMessage={onMessage}/>
 </div>;
}

/** Secondary detail: the agent profile roster the avatar menu chooses from,
 * kept reachable but no longer the primary list (§4.5). Clicking a profile
 * opens its page (§4.7); Message chooses it as the accompanying chat agent —
 * the same action the avatar menu performs. */
function AgentProfiles({roster,boundRef,boundPresence,assignment,onMessage}:{roster:RosterReading;boundRef?:string;boundPresence?:PanelPresence;assignment?:string;onMessage?:(agent:RosterAgent)=>void}) {
 const [query,setQuery]=useState("");
 const needle=query.trim().toLowerCase();
 const matches=needle?roster.agents.filter(agent=>`${agent.name} ${agent.purpose??""} ${agent.ref}`.toLowerCase().includes(needle)):roster.agents;
 const working=matches.filter(agent=>!isGuardian(agent));
 const guardians=matches.filter(isGuardian);
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
 return <details className="agents-profiles" data-agent-profiles>
  <summary className="agents-profiles-summary">Agent profiles</summary>
  {roster.state==="error"&&<p className="agents-empty" role="alert" data-empty="error">Couldn&apos;t load agents. <button type="button" className="oi-action" onClick={roster.retry}>Retry</button></p>}
  {roster.state==="reading"&&!roster.agents.length&&<p className="agents-empty" role="status" data-empty="reading">Reading agents…</p>}
  {roster.state==="ready"&&!roster.agents.length&&<p className="agents-empty" data-empty="none">Create an agent to work with. <button type="button" className="oi-action" onClick={()=>window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{}}))}>New agent…</button></p>}
  {roster.agents.length>2&&<label className="agents-profiles-search"><input className="oi-input" type="search" aria-label="Search agent profiles" placeholder="Search agent profiles" value={query} onChange={event=>setQuery(event.target.value)}/></label>}
  {needle&&roster.agents.length>0&&!matches.length&&<p className="agents-empty" data-empty="search">No agents match &ldquo;{query.trim()}&rdquo;. <button type="button" className="oi-action" onClick={()=>setQuery("")}>Clear</button></p>}
  {working.length>0&&<section className="agents-section" aria-label="Working with you"><h3>Working with you</h3><ul>{working.map(row)}</ul></section>}
  {guardians.length>0&&<section className="agents-section" aria-label="Guardians"><h3>Guardians</h3><ul>{guardians.map(row)}</ul></section>}
 </details>;
}
