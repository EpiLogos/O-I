/**
 * The Status face of the agent-work gradient (owner commission 2026-09-22,
 * dossier docs/experience/HARNESS-SETTINGS-RESEARCH-2026-09-22.md §3.3 —
 * Grok's Status → Preview → Takeover levels): when the panel is pinned or
 * full the panel itself is the presentation; when it is collapsed the frame
 * carries a presence dot and a state line instead, and re-opens the panel on
 * demand. Every state here is an OBSERVED encounter fact — the same agent-cue
 * law as DESKTOP-LANGUAGE.md "Current desktop grammar": TurnInFlight is
 * working, a newly observed completion is arrival, a consent request needs
 * the person, a pending local operation is presence, otherwise idle. No
 * invented activity, no animation without a real state change.
 */
import {useEffect,useRef} from "react";
import {useEncounterSession,type EncounterSessionBinding,type EncounterSessionState} from "../encounter/session";

export type AgentPresenceState="reading"|"working"|"stopping"|"attention"|"arrived"|"updating"|"idle"|"disconnected";

export interface AgentPresence {
  key:string;
  state:AgentPresenceState;
  /** The plain state line the frame shows beside the dot. */
  label:string;
}

const LABEL:Record<AgentPresenceState,string>={
  reading:"Reading…",
  working:"Working",
  stopping:"Stopping",
  attention:"Needs you",
  arrived:"Arrived",
  updating:"Updating…",
  idle:"Idle",
  disconnected:"Disconnected",
};

/** The last observed `completed` block id, or undefined when none is on the
 * page. A NEW id observed while the panel is hidden is an arrival; the same
 * id replayed by a re-read is not (old transcript completion never replays
 * arrival). */
const lastCompletedOf=(state:EncounterSessionState|undefined):number|undefined=>{
  const blocks=state?.reading?.blocks;
  if(!blocks)return undefined;
  for(let index=blocks.length-1;index>=0;index--){if(blocks[index].kind==="completed")return blocks[index].id;}
  return undefined;
};

/** Pure derivation from the one shared session observation. `panelOpen` is
 * the gradient's own fact: while the panel is presented (Preview/Takeover)
 * completions are consumed as seen, so arrival means "finished while you
 * were away", never a replay of what is already on screen. */
export function agentPresenceOf(state:EncounterSessionState|undefined,panelOpen:boolean,seenCompleted:{current:number|undefined}):AgentPresence|undefined{
  if(!state)return undefined;
  const completed=lastCompletedOf(state);
  if(panelOpen&&completed!==undefined)seenCompleted.current=completed;
  let presence:AgentPresenceState;
  if(state.reading?.permissions?.length)presence="attention";
  else if(state.status?.state==="TurnInFlight")presence="working";
  else if(state.status?.state==="InterruptRequested")presence="stopping";
  else if(state.pending||state.busy)presence="updating";
  else if(!state.status&&!state.reading)presence="reading";
  else if(!completed||completed===(seenCompleted.current??completed))presence=state.status?.state==="Disconnected"||state.status?.error?"disconnected":"idle";
  else presence="arrived";
  return {key:state.key,state:presence,label:LABEL[presence]};
}

/** The frame's subscription to the shared observer: one more subscriber on
 * the SAME session (never a second poll loop), so presence stays live while
 * the panel is collapsed. */
export function useAgentPresence(binding:EncounterSessionBinding|undefined,panelOpen:boolean):AgentPresence|undefined{
  const session=useEncounterSession(binding);
  const seenCompleted=useRef<number|undefined>(undefined);
  const presence=agentPresenceOf(session?.state,panelOpen,seenCompleted);
  const stateKey=session?.state.key;
  const seen=seenCompleted;
  useEffect(()=>{seen.current=undefined;},[stateKey]);
  return presence;
}
