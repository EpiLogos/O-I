import {useEffect,useRef} from "react";
import type {SurfaceBinding} from "../surface/types";
import {EncounterView} from "./EncounterView";
import {expressionReadingOf,nowRefsOf,taskBasisWithoutNow,useEncounterSession,type EncounterExpressionReading} from "./session";
import {useKernel} from "../kernel/KernelProvider";
import {agentName,censusConnections,useCensus,type CensusReading} from "../agency/census";
import type {ConnectionFacts} from "../agent/chat/harness";
import {refusalWords} from "../shared/Refusal";
export type {EncounterExpressionReading} from "./session";

/** A conversation's route choices (O-I #1003): the census's agents a person can talk to, each carrying AIKit's facts for it when its
 * providers name it — the choices the chat offers (AgentChat). AIKit adds detail to a choice, never a choice of its own. Beside them, the
 * conversation's own provider where its status names one the census does not (a mode's body), so the conversation can be connected to
 * what it was opened with and reconnected after an owner restart; it is this conversation's binding, never a list of agents. A
 * conversation another world's owner holds (`hosted`) is connected there, and offers none. With none, why, in the census's words: each
 * agent with why it cannot be talked to, or why there is no agent to ask. Pure. */
export function conversationRoutes(census:CensusReading,providers:readonly ConnectionFacts[],own?:{readonly provider?:string;readonly hosted?:string}):{routes:ConnectionFacts[];why?:string} {
 if(own?.hosted)return {routes:[],why:`This conversation is held by the owner of ${own.hosted}, which connects it: it is not connected from here.`};
 const routes=censusConnections(census,providers);
 const bound=own?.provider&&!routes.some(route=>route.id===own.provider)?providers.find(provider=>provider.id===own.provider):undefined;
 if(bound)routes.push({...bound,label:`${bound.label} (this conversation's own)`});
 if(routes.length)return {routes};
 if(census.state==="reading")return {routes,why:"Reading the agents on this machine…"};
 if(census.state==="unavailable")return {routes,why:refusalWords("No agent here can be talked to: the agents on this machine could not be read.",census.why)};
 if(!census.agents.length)return {routes,why:"No agent here can be talked to: Actuation detects no agent harness on this machine."};
 // One reason the census gives for several agents (AIKit unread, say) is said once, with their names.
 const named=new Map<string,string[]>();
 for(const agent of census.agents){
  const why=(agent.why??(agent.starts?"AIKit opens no conversation with it":"it does not start")).trim().replace(/\.+$/,"");
  named.set(why,[...(named.get(why)??[]),agentName(agent)]);
 }
 return {routes,why:`No agent here can be talked to. ${[...named].map(([why,names])=>`${names.join(", ")}: ${why}.`).join(" ")}`};
}

/** One presenter of an encounter: the transcript, the composer and (in the
 * tab shape) the encounter's own planes. Ephemeral input buffering only —
 * every accepted edit and message is AIKit-owned.
 *
 * The observer is not here. Polling, the draft compare-and-swap machine and
 * every owner action live in the shared session store (`session.ts`), keyed by
 * project + agent-session ref, so a centre tab and the accompanying panel
 * showing the same session share one network observer and one draft. */
export function EncounterSurface({binding,onView,presentation="tab",onExpression,concealed=false,sourceWorldRef}:{binding:SurfaceBinding;onView:(view:NonNullable<SurfaceBinding["view"]>)=>void;presentation?:"tab"|"side"|"full";onExpression?:(reading:EncounterExpressionReading)=>void;concealed?:boolean;sourceWorldRef?:string}) {
 const session=useEncounterSession(binding.project!==undefined&&binding.ref?{project:binding.project,ref:binding.ref,space:binding.encounter?.space,sourceWorldRef}:undefined);
 // Who this conversation can be connected to is the census's to say (O-I #1003), read as the chat reads it.
 const kernel=useKernel();
 const census=useCensus(kernel.transport);
 const state=session?.state;
 const expression=useRef(onExpression);expression.current=onExpression;
 useEffect(()=>{expression.current?.(expressionReadingOf(state));},[state?.status,state?.reading,state?.pending]);
 if(!session||!state)return <section hidden={concealed} className="encounter" data-presentation={presentation} aria-label="Encounter"><p className="encounter-unbound oi-note" role="status">This conversation names no project or session ref, so there is nothing to read.</p></section>;
 const {actions}=session;
 const routes=conversationRoutes(census,state.providers,{provider:state.status?.provider?.id??state.reading?.connection?.provider?.id,hosted:sourceWorldRef});
 return <><EncounterView concealed={concealed} presentation={presentation} plane={binding.view?.encounterPlane??"Conversation"} onPlane={encounterPlane=>onView({encounterPlane})} title={binding.title} onPermission={(id,decision)=>void actions.permission(id,decision)} reading={state.reading} status={state.status} draft={state.draft} pending={state.busy} error={state.error} providers={routes.routes} routesWhy={routes.why} onProvider={provider=>void actions.connect(provider)} onDraft={actions.change} onSend={()=>void actions.send()} onCancel={actions.cancel} onEarlier={actions.earlier} onLatest={actions.latest} paged={state.before!==undefined} readJournal={actions.readJournal} space={state.space??binding.encounter?.space}
  nowRefs={nowRefsOf(state)}
  taskBasisWithoutNow={taskBasisWithoutNow(state)}
  resume={state.resume} onReconnect={provider=>void actions.reconnect(provider)}
  a2a={state.a2a} onA2aSeed={actions.seedA2a} onA2aSend={(seed,fields)=>void actions.sendA2a(seed,fields)}
 />{state.draftFailed&&!concealed&&<button className="encounter-recover oi-action" onClick={()=>void actions.recover()}>Apply my typing to the current shared draft</button>}{state.reconnected&&!concealed&&<p className="encounter-reconnected" role="status">Reconnected to the recorded native session <code>{state.reconnected}</code> — nothing was replaced or silently created.</p>}</>;
}
