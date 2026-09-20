import {useEffect,useMemo,useState,useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {EncounterRow} from "../encounter/EncounterList";
import {agentController} from "./nativeAgentClient";
import type {NativeAgentController,NativePrepared} from "./nativeAgent";
import {openAgentSetup} from "./agentSetup";

/** Native source creation and session selection in the existing Agent surface.
 * `controller` is a test/embed seam; production always uses the kernel owner. */
export function NativeAgentLauncher({project,onChoose,controller:injected}:{project?:string;onChoose?:(row:EncounterRow)=>Promise<void>|void;controller?:NativeAgentController}) {
 const kernel=useKernel();
 const controller=useMemo(()=>injected??agentController(kernel.transport,project),[injected,kernel.transport,project]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const [opening,setOpening]=useState(false);const [openError,setOpenError]=useState<string>();
 useEffect(()=>{void controller.refresh();},[controller]);
 const choose=async(prepared:NativePrepared)=>{
  if(opening)return;setOpening(true);setOpenError(undefined);
  const row:EncounterRow={ref:prepared.agent_session,space:prepared.space,project:project??"",title:state.review?.profile.name??state.review?.profile.purpose??prepared.agent_ref};
  try {
   if(onChoose)await onChoose(row);
   else window.dispatchEvent(new CustomEvent("oi:agent-session-prepared",{detail:row}));
  }catch(error){setOpenError(String(error));}finally{setOpening(false);}
 };
 const {draft,review,prepared}=state;
 return <section className="oi-section native-agent-launcher" aria-label="Native Agent creation" aria-busy={state.busy||opening}>
  <header className="oi-panel-head"><strong>Agents in {project??"Central root"}</strong><button type="button" className="oi-action" disabled={state.busy} onClick={()=>void controller.refresh()}>Read native roster</button></header>
  <p className="oi-note">A reusable Agent is an accepted native definition. Temporary task roles and runtime sessions stay separate. Preparing a session neither starts a harness nor grants execution authority.</p>
  {state.profiles.length>0&&<div role="group" aria-label="Native Agent roster">{state.profiles.map(item=><button key={item.profile.ref} type="button" className="oi-row" disabled={state.busy||state.unknown==="prepare"} onClick={()=>void controller.select(item.profile.ref)}>
   <span>{item.profile.name??item.profile.agent_ref}</span><span className="oi-note">{item.accepted?"Accepted definition":"Proposal — not accepted"}</span>
  </button>)}</div>}
  {!review&&<fieldset disabled={state.busy||!!state.unknown}>
   <label className="oi-field">Agent name<input className="oi-input" aria-label="Agent name" value={draft.name} maxLength={256} onChange={e=>controller.edit({name:e.target.value})}/></label>
   <label className="oi-field">Human purpose<textarea className="oi-input" aria-label="Human purpose" rows={3} maxLength={16384} value={draft.purpose} onChange={e=>controller.edit({purpose:e.target.value})}/></label>
   <label className="oi-field"><input type="checkbox" checked={draft.scopeConfirmed} disabled={!state.scopeRef} onChange={e=>controller.edit({scopeConfirmed:e.target.checked})}/> I choose the disclosed native scope <code>{state.scopeRef??"not yet available"}</code> for this Agent.</label>
   {draft.skillRefs.length>0&&<p className="oi-note">Selected native Skills: {draft.skillRefs.join(", ")}</p>}
   <button type="button" className="oi-action" onClick={()=>void controller.propose()} disabled={!draft.name||!draft.purpose||!draft.scopeConfirmed}>Create native proposal</button>
  </fieldset>}
  {review&&<section aria-label="Review native Agent source">
   <h3>{review.profile.name??review.profile.agent_ref}</h3>
   <pre className="oi-note" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{review.profile.intent_provenance?.intent_expression??review.profile.purpose}</pre>
   <p className="oi-note">Scope <code>{review.scope_ref}</code> · source <code>{review.profile.ref}</code> · revision <code>{review.profile.revision}</code></p>
   <details><summary>Exact source basis and delivery limits</summary><p><code>{review.content_digest}</code></p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(review.profile,null,2)}</pre><p>Selected Skill content is checked and delivered to the native parent session. Child activation requires its own admission and is not implied.</p></details>
   {review.accepted?<p role="status">Accepted by the native human-authority path and read back from the roster.</p>:<p role="status">This is a stored proposal, not an accepted Agent and not permission to execute.</p>}
   {!review.accepted&&<button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>void controller.accept()}>Accept this exact Agent definition</button>}
   {review.accepted&&!prepared&&<button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>void controller.prepare()}>Prepare Direct session</button>}
   <button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>controller.edit({})}>Back to held draft</button>
  </section>}
  {prepared&&<section aria-label="Prepared native session"><p role="status">Native AgentSession attached. No provider has been started by preparation.</p><p className="oi-note"><code>{prepared.agent_session}</code><br/><code>{prepared.space}</code></p><button type="button" className="oi-action" disabled={opening} onClick={()=>void choose(prepared)}>Open conversation and choose harness</button></section>}
  {(state.error||openError)&&<p className="oi-refusal" role="alert">{state.error??openError}</p>}
  {state.unknown&&<button type="button" className="oi-action" disabled={state.busy} onClick={()=>void controller.recover()}>Inspect original outcome — no replay</button>}
  <button type="button" className="oi-action" onClick={()=>openAgentSetup({project,reason:state.error??openError??"Agent, harness or credential setup",refresh:()=>controller.refresh()})}>Open native Agent/session setup</button>
 </section>;
}
