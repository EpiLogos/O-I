/** A targeted repair excursion. This holds callbacks/navigation only, never
 * credentials or an Agent registry. Existing native setup owns all writes. */
export const AGENT_SETUP_EVENT="oi:agent-setup-target";
export interface AgentSetupTarget {project?:string;reason:string;refresh:()=>Promise<unknown>|void;returnTo?:()=>void}
let target:AgentSetupTarget|undefined;
const listeners=new Set<()=>void>();
export const agentSetupSnapshot=()=>target;
export function subscribeAgentSetup(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function announce(){for(const listener of listeners)listener();}
export function openAgentSetup(next:AgentSetupTarget){
 target=next;announce();
 window.dispatchEvent(new CustomEvent("oi:open-settings",{detail:{agentSetup:true}}));
 window.dispatchEvent(new CustomEvent(AGENT_SETUP_EVENT));
}
export async function returnFromAgentSetup(){
 const current=target;if(!current)return;
 // A refresh re-reads readiness only; it never retries creation, acceptance,
 // provider connection, permission or a turn with an unknown outcome.
 await current.refresh();
 if(target!==current)return;
 target=undefined;announce();current.returnTo?.();
 window.dispatchEvent(new CustomEvent("oi:agent-setup-return"));
}
