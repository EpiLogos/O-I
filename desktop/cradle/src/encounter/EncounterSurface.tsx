import {useEffect,useRef} from "react";
import type {SurfaceBinding} from "../surface/types";
import {AddressedComposer} from "./AddressedComposer";
import {EncounterView} from "./EncounterView";
import {deliveriesOf,expressionReadingOf,nowRefsOf,taskBasisWithoutNow,useEncounterSession,type EncounterExpressionReading} from "./session";
export type {EncounterExpressionReading} from "./session";
/** One presenter of an encounter: the transcript, the composer and (in the
 * tab shape) the encounter's own planes. Ephemeral input buffering only —
 * every accepted edit and message is AIKit-owned.
 *
 * The observer is not here. Polling, the draft compare-and-swap machine and
 * every owner action live in the shared session store (`session.ts`), keyed by
 * project + agent-session ref, so a centre tab and the accompanying panel
 * showing the same session share one network observer and one draft. */
export function EncounterSurface({binding,onView,presentation="tab",onExpression,concealed=false}:{binding:SurfaceBinding;onView:(view:NonNullable<SurfaceBinding["view"]>)=>void;presentation?:"tab"|"side"|"full";onExpression?:(reading:EncounterExpressionReading)=>void;concealed?:boolean}) {
 const session=useEncounterSession(binding.project&&binding.ref?{project:binding.project,ref:binding.ref,space:binding.encounter?.space}:undefined);
 const state=session?.state;
 const expression=useRef(onExpression);expression.current=onExpression;
 useEffect(()=>{expression.current?.(expressionReadingOf(state));},[state?.status,state?.reading,state?.pending]);
 if(!session||!state)return <section hidden={concealed} className="encounter" data-presentation={presentation} aria-label="Encounter"><p className="encounter-unbound oi-note" role="status">This conversation names no project or session ref, so there is nothing to read.</p></section>;
 const {actions}=session;
 return <><EncounterView concealed={concealed} presentation={presentation} plane={binding.view?.encounterPlane??"Conversation"} onPlane={encounterPlane=>onView({encounterPlane})} title={binding.title} onPermission={(id,decision)=>void actions.permission(id,decision)} reading={state.reading} status={state.status} draft={state.draft} pending={state.busy} error={state.error} providers={state.providers} onProvider={provider=>void actions.connect(provider)} onDraft={actions.change} onSend={()=>void actions.send()} onCancel={actions.cancel} onEarlier={actions.earlier} onLatest={actions.latest} paged={state.before!==undefined} readJournal={actions.readJournal} space={state.space??binding.encounter?.space} deliveries={deliveriesOf(state)}
  nowRefs={nowRefsOf(state)}
  taskBasisWithoutNow={taskBasisWithoutNow(state)}
  resume={state.resume} onReconnect={provider=>void actions.reconnect(provider)}
  a2a={state.a2a} onA2aSeed={actions.seedA2a} onA2aSend={(seed,fields)=>void actions.sendA2a(seed,fields)}
  addressed={<AddressedComposer onReconcile={()=>void actions.reconcileAddressed()} disabled={state.status?.state==="Disconnected"} dispatch={state.dispatch} history={state.deliveries} service={state.service} agentSession={binding.ref??undefined} task={state.task??undefined} group={state.group} onGroupSend={(sender,recipients,packet)=>void actions.sendGroup(sender,recipients,packet)} onSend={(turn,fields)=>void actions.sendAddressed(turn,fields)}/>}
 />{state.draftFailed&&!concealed&&<button className="encounter-recover oi-action" onClick={()=>void actions.recover()}>Apply my typing to the current shared draft</button>}{state.reconnected&&!concealed&&<p className="encounter-reconnected" role="status">Reconnected to the recorded native session <code>{state.reconnected}</code> — nothing was replaced or silently created.</p>}</>;
}
