import {ShieldMark} from "../chat/ComposerChips";

/**
 * Presence face for the right panel top row (10-SIDEBARS §4.1 presence).
 * Agent choice lives in the Agents tab — this control only shows who is
 * present and opens that tab. It is not a second roster picker.
 */
export type PanelPresence="idle"|"working"|"attention"|"unavailable";
export interface PanelAgent {name:string;ref?:string;image?:string;purpose?:string;
 /** The agent answering this conversation is known from its session binding. */
 bound?:boolean}

export const monogramOf=(name:string)=>{const parts=name.split(/[\s·/:-]+/).filter(Boolean);return (parts.length>1?parts[0][0]+parts[1][0]:name.slice(0,2)).replace(/^./,letter=>letter.toUpperCase()).replace(/(?<=^.)./,letter=>letter.toLowerCase())||"A";};

export function Avatar({agent,size="sm"}:{agent:{name:string;image?:string};size?:"sm"|"md"}) {
 return <span className="panel-avatar" data-size={size} aria-hidden="true">{agent.image?<img src={agent.image} alt=""/>:monogramOf(agent.name)}</span>;
}

export function AvatarPresence({agent,presence,bypass,onOpenAgents}:{
 agent:PanelAgent;presence:PanelPresence;bypass?:boolean;
 /** Opens the Agents tab — the only place for roster choice. */
 onOpenAgents?:()=>void;
}) {
 const presenceWords:Record<PanelPresence,string>={idle:"idle",working:"working",attention:"needs you",unavailable:"unavailable"};
 return <div className="avatar-menu">
  <button type="button" className="avatar-menu-open" data-presence={presence} data-bypass={bypass?"true":undefined}
   aria-label={`${agent.name} — ${presenceWords[presence]}${bypass?", Bypass permissions on":""}. Open Agents`} title={`${agent.name} · ${presenceWords[presence]}`} onClick={()=>onOpenAgents?.()}>
   <Avatar agent={agent}/>
   <span className="panel-presence" data-presence={presence} aria-hidden="true">{presence==="attention"?"!":presence==="unavailable"?"×":""}</span>
   {bypass&&<span className="panel-shield" aria-hidden="true"><ShieldMark size={9}/></span>}
  </button>
 </div>;
}
