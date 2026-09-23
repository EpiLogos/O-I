/**
 * THE AGENT ROSTER — the agents available in a scope, from real identities
 * only (10-SIDEBARS §4.1 avatar menu, §4.5 Agents tab). The read is Central's
 * accepted Agent sources through the kernel's `agent_definition` roster
 * (`agent-profile.roster`, central.agent-profile-roster/v1): each profile's
 * agent ref, name, purpose, role and whether it has been accepted to work.
 * Nothing is hardcoded and nothing is invented: a failed read is an error
 * the surface names, never an empty roster.
 *
 *   readRoster(transport, project?) → RosterAgent[]   (project undefined = Central)
 *   useAgentRoster(project?) → {state, agents, error, retry}
 *   isGuardian(agent) — the GUARDIANS section (roles ending "-guardian")
 */
import {useCallback,useEffect,useState,useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {KernelTransportStatus} from "../kernel/types";
import {nativeAgentOwner} from "./nativeAgentClient";

export interface RosterAgent {
 /** The agent's identity (`agent/central-guardian`, `agent:expressed-…`). */
 ref:string;
 /** The Central profile that defines it. */
 profileRef:string;
 revision?:string;
 name:string;
 purpose?:string;
 role?:string;
 /** Accepted by the person: it may be prepared to work. */
 accepted:boolean;
 scopeRef?:string;
 skillRefs:string[];
 governanceRefs:string[];
 worldRef?:string;
}
export const isGuardian=(agent:Pick<RosterAgent,"role">)=>/(^|-)guardian$/.test(agent.role??"");

/** Words from an agent ref when the profile carries no name:
 *  `agent/central-guardian` → "Central Guardian"; an expressed id stays plain. */
export function nameFromRef(ref:string):string {
 const tail=ref.split(/[/:]/).pop()??ref;
 if(/^expressed-[0-9a-f]+$/i.test(tail))return "Unnamed agent";
 return tail.split(/[-_]/).filter(Boolean).map(word=>word==="aikit"?"AIKit":word==="oi"?"O:I":word==="ql"?"QL":word[0].toUpperCase()+word.slice(1)).join(" ");
}

type Obj=Record<string,unknown>;
const obj=(value:unknown):value is Obj=>!!value&&typeof value==="object"&&!Array.isArray(value);
const str=(value:unknown)=>typeof value==="string"&&value.trim()?value:undefined;
const strings=(value:unknown)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];

export function rosterFromReading(value:unknown):RosterAgent[] {
 if(!obj(value)||value.schema!=="central.agent-profile-roster/v1"||!Array.isArray(value.profiles))throw new Error("Central returned an agent roster this desktop cannot read.");
 const agents:RosterAgent[]=[];
 for(const entry of value.profiles){
  if(!obj(entry)||!obj(entry.profile))continue;
  const profile=entry.profile;
  const ref=str(profile.agent_ref),profileRef=str(profile.ref);
  if(!ref||!profileRef)continue;
  agents.push({
   ref,profileRef,revision:str(profile.revision),
   name:str(profile.name)??nameFromRef(ref),
   purpose:str(profile.purpose),role:str(profile.role),
   accepted:entry.accepted===true,scopeRef:str(value.scope_ref),
   skillRefs:strings(profile.skill_refs),governanceRefs:strings(profile.governance_refs),worldRef:str(profile.world_ref),
  });
 }
 return agents;
}

/** The agents available in a scope: the personal (Central root) roster, which
 *  is available everywhere, plus the scoped project's own register. */
export async function readRoster(transport:KernelTransportStatus,project?:string):Promise<RosterAgent[]> {
 const root=rosterFromReading(await nativeAgentOwner(transport,undefined)({action:"roster"}));
 if(!project)return root;
 const own=rosterFromReading(await nativeAgentOwner(transport,project)({action:"roster"}));
 const seen=new Set(own.map(agent=>agent.ref));
 return [...own,...root.filter(agent=>!seen.has(agent.ref))];
}

export interface RosterReading {state:"reading"|"ready"|"error";agents:RosterAgent[];error?:string;retry:()=>void}

// One shared reading per scope: the avatar menu and the Agents tab show the same roster.
interface Held {agents:RosterAgent[];state:"reading"|"ready"|"error";error?:string;listeners:Set<()=>void>;inflight?:Promise<void>}
const held=new Map<string,Held>();
function entry(key:string):Held {let value=held.get(key);if(!value){value={agents:[],state:"reading",listeners:new Set()};held.set(key,value);}return value;}

export function useAgentRoster(project?:string):RosterReading {
 const kernel=useKernel();
 const key=`${kernel.transport.kind}:${project??""}`;
 const current=entry(key);
 const [,force]=useState(0);
 const subscribe=useCallback((listener:()=>void)=>{current.listeners.add(listener);return()=>{current.listeners.delete(listener);};},[current]);
 useSyncExternalStore(subscribe,()=>`${current.state}:${current.agents.length}:${current.error??""}`);
 const load=useCallback(()=>{
  if(current.inflight)return;
  current.state=current.agents.length?current.state:"reading";
  current.inflight=readRoster(kernel.transport,project)
   .then(agents=>{current.agents=agents;current.state="ready";current.error=undefined;})
   .catch(error=>{current.state="error";current.error=error instanceof Error?error.message:String(error);})
   .finally(()=>{current.inflight=undefined;for(const listener of [...current.listeners])listener();force(value=>value+1);});
 },[current,kernel.transport,project]);
 useEffect(()=>{load();},[load]);
 return {state:current.state,agents:current.agents,error:current.error,retry:load};
}
