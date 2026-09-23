import {useEffect,useRef,useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {isGuardian,type RosterAgent,type RosterReading} from "../../agency/roster";
import {ShieldMark} from "../chat/ComposerChips";
import {openObject} from "../objects/registry";

/**
 * The avatar menu (10-SIDEBARS §4.1, amendment A3): a tiny avatar at the
 * start of the panel's one top row, its presence as a badge on its corner —
 * idle ○, working ● (breathing only while a turn is actually in flight),
 * needs you !, unavailable × — and, while Bypass permissions is on, a small
 * shield. Its menu lists the agents available in the current scope from the
 * real roster (agency/roster.ts), then
 * Agent details and New agent… (the Agency surface's own creation route).
 */
export type PanelPresence="idle"|"working"|"attention"|"unavailable";
export interface PanelAgent {name:string;ref?:string;image?:string;purpose?:string;
 /** The agent answering this conversation is known from its session binding. */
 bound?:boolean}

export const monogramOf=(name:string)=>{const parts=name.split(/[\s·/:-]+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts[1][0]:name.slice(0,2)).replace(/^./,letter=>letter.toUpperCase()).replace(/(?<=^.)./,letter=>letter.toLowerCase())||"A";};

export function Avatar({agent,size="sm"}:{agent:{name:string;image?:string};size?:"sm"|"md"}) {
 return <span className="panel-avatar" data-size={size} aria-hidden="true">{agent.image?<img src={agent.image} alt=""/>:monogramOf(agent.name)}</span>;
}

export function AvatarMenu({agent,presence,bypass,roster,onChoose,chosenRef,onOpen}:{
 agent:PanelAgent;presence:PanelPresence;bypass?:boolean;roster:RosterReading;
 onChoose:(agent:RosterAgent)=>void;chosenRef?:string;
 /** The menu opened: the roster is wanted now. */
 onOpen?:()=>void;
}) {
 const [open,setOpen]=useState(false);
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:MouseEvent)=>{if(!host.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);}};
  document.addEventListener("mousedown",outside);document.addEventListener("keydown",escape,true);
  return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape,true);};
 },[open]);
 const presenceWords:Record<PanelPresence,string>={idle:"idle",working:"working",attention:"needs you",unavailable:"unavailable"};
 const working=roster.agents.filter(entry=>!isGuardian(entry));
 const guardians=roster.agents.filter(isGuardian);
 const row=(entry:RosterAgent)=><button key={entry.ref} type="button" role="menuitemradio" aria-checked={entry.ref===chosenRef} className="avatar-menu-row" title={entry.purpose} onClick={()=>{setOpen(false);onChoose(entry);}}>
  <Avatar agent={entry}/><span className="avatar-menu-name">{entry.name}</span>{!entry.accepted&&<span className="avatar-menu-note">not accepted</span>}{entry.ref===chosenRef&&<Glyph name="check" size={11}/>}
 </button>;
 return <div className="avatar-menu" ref={host}>
  <button type="button" className="avatar-menu-open" data-presence={presence} data-bypass={bypass?"true":undefined} aria-haspopup="menu" aria-expanded={open}
   aria-label={`${agent.name} — ${presenceWords[presence]}${bypass?", Bypass permissions on":""}. Choose the accompanying agent`} title={`${agent.name} · ${presenceWords[presence]}`} onClick={()=>{if(!open)onOpen?.();setOpen(value=>!value);}}>
   <Avatar agent={agent}/>
   <span className="panel-presence" data-presence={presence} aria-hidden="true">{presence==="attention"?"!":presence==="unavailable"?"×":""}</span>
   {bypass&&<span className="panel-shield" aria-hidden="true"><ShieldMark size={9}/></span>}
   <Glyph name="down" size={9}/>
  </button>
  {open&&<div className="oi-menu avatar-menu-list" role="menu" aria-label="Agents in this scope">
   {roster.state==="reading"&&!roster.agents.length&&<p className="avatar-menu-note-line" role="status">Reading agents…</p>}
   {roster.state==="error"&&<p className="avatar-menu-note-line" role="alert">Couldn&apos;t load agents. <button type="button" className="oi-action" onClick={roster.retry}>Retry</button></p>}
   {working.length>0&&<><p className="avatar-menu-section">Working with you</p>{working.map(row)}</>}
   {guardians.length>0&&<><p className="avatar-menu-section">Guardians</p>{guardians.map(row)}</>}
   {roster.state==="ready"&&!roster.agents.length&&<p className="avatar-menu-note-line">No agents in this scope yet.</p>}
   <div className="avatar-menu-rule" aria-hidden="true"/>
   <button type="button" role="menuitem" className="oi-menu-item" disabled={!agent.ref} title={agent.ref?undefined:"This conversation names no agent identity yet"} onClick={()=>{setOpen(false);if(agent.ref)openObject({kind:"agent",ref:agent.ref,title:agent.name});}}>Agent details</button>
   <button type="button" role="menuitem" className="oi-menu-item" onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent("oi:open-agency",{detail:{}}));}}>New agent…</button>
  </div>}
 </div>;
}
