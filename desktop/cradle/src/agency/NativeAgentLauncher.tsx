import {useEffect,useMemo,useState,useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {EncounterRow} from "../encounter/EncounterList";
import {agentController} from "./nativeAgentClient";
import type {NativeAgentController,NativePrepared,NativeReview} from "./nativeAgent";
import {openAgentSetup} from "./agentSetup";

const label=(review:NativeReview)=>review.profile.name||review.profile.purpose?.split("\n")[0].slice(0,90)||"Unnamed Agent";

/** The roster is the ordinary entry. Creation and technical source details
 * are deliberate disclosures over the same native owner/controller. */
export function NativeAgentLauncher({project,onChoose,controller:injected}:{project?:string;onChoose?:(row:EncounterRow)=>Promise<void>|void;controller?:NativeAgentController}) {
 const kernel=useKernel();
 const controller=useMemo(()=>injected??agentController(kernel.transport,project),[injected,kernel.transport,project]);
 const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
 const [opening,setOpening]=useState(false);const [openError,setOpenError]=useState<string>();
 const [creating,setCreating]=useState(false);const [skillQuery,setSkillQuery]=useState("");
 const refresh=async()=>{await controller.refresh();if(creating||state.review)await controller.refreshReadiness(creating);};
 useEffect(()=>{void controller.refresh();},[controller]);
 const choose=async(prepared:NativePrepared)=>{
  if(opening)return;setOpening(true);setOpenError(undefined);
  const row:EncounterRow={ref:prepared.agent_session,space:prepared.space,project:project??"",title:state.review?label(state.review):"Agent conversation"};
  try {
   if(onChoose)await onChoose(row);
   else window.dispatchEvent(new CustomEvent("oi:agent-session-prepared",{detail:row}));
  }catch(error){setOpenError(String(error));}finally{setOpening(false);}
 };
 const select=(ref:string)=>{setCreating(false);void controller.select(ref);void controller.refreshReadiness(false);};
 const create=()=>{controller.edit({});setCreating(true);void controller.refreshReadiness();};
 const {draft,review,prepared}=state;
 const skills=state.skills?.filter(skill=>`${skill.name} ${skill.description}`.toLocaleLowerCase().includes(skillQuery.toLocaleLowerCase()));
 return <section className="oi-section native-agent-launcher" aria-label="Agents" aria-busy={state.busy||opening}>
  <header className="oi-panel-head"><strong>Agents in {project||"Central"}</strong><button type="button" className="oi-action" disabled={state.busy} onClick={()=>void refresh()}>Refresh</button></header>
  {!review&&!creating&&<>
   {state.profiles.length>0?<div role="group" aria-label="Agent roster">{state.profiles.map(item=><button key={item.profile.ref} type="button" className="oi-row" disabled={state.busy||!!state.unknown} onClick={()=>select(item.profile.ref)}>
    <span>{label(item)}</span><span className="oi-note">{item.accepted?"Accepted":"Draft"}</span>
   </button>)}</div>:!state.busy&&!state.error&&<p className="oi-note">No Agent definitions in this project yet.</p>}
   <button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={create}>New Agent</button>
  </>}
  {creating&&!review&&<fieldset disabled={state.busy||!!state.unknown}>
   <label className="oi-field">Name<input className="oi-input" aria-label="Agent name" value={draft.name} maxLength={256} onChange={e=>controller.edit({name:e.target.value})}/></label>
   <label className="oi-field">Purpose<textarea className="oi-input" aria-label="Agent purpose" rows={3} maxLength={16384} value={draft.purpose} onChange={e=>controller.edit({purpose:e.target.value})}/></label>
   <label className="oi-field"><input type="checkbox" checked={draft.scopeConfirmed} disabled={!state.scopeRef} onChange={e=>controller.edit({scopeConfirmed:e.target.checked})}/> Create this Agent in {project||"Central"}.</label>
   <details><summary>Skills · {draft.skillRefs.length} selected</summary>
    <input className="oi-input" type="search" aria-label="Find Skills" placeholder="Find a Skill…" value={skillQuery} onChange={e=>setSkillQuery(e.target.value)}/>
    <fieldset disabled={state.readinessPending} aria-label="Agent Skills">
     {skills?.map(skill=><label key={skill.ref} className="oi-field"><input type="checkbox" aria-label={`Skill ${skill.name}`} checked={draft.skillRefs.includes(skill.ref)} disabled={!skill.eligible&&!draft.skillRefs.includes(skill.ref)} onChange={e=>controller.edit({skillRefs:e.target.checked?[...draft.skillRefs,skill.ref]:draft.skillRefs.filter(ref=>ref!==skill.ref)})}/>{skill.name}<small>{skill.description}{!skill.eligible&&` — unavailable: ${skill.reason_code??"not currently eligible"}`}</small></label>)}
     {draft.skillRefs.filter(ref=>!state.skills?.some(row=>row.ref===ref)).map(ref=><label key={ref}><input type="checkbox" checked onChange={()=>controller.edit({skillRefs:draft.skillRefs.filter(r=>r!==ref)})}/>Unavailable selection: {ref}</label>)}
    </fieldset>
   </details>
   <div className="oi-action-group"><button type="button" className="oi-action" onClick={()=>void controller.propose()} disabled={!draft.name||!draft.purpose||!draft.scopeConfirmed}>Review Agent</button><button type="button" className="oi-action" onClick={()=>setCreating(false)}>Back to Agents</button></div>
  </fieldset>}
  {review&&<section aria-label="Agent definition">
   <h3>{label(review)}</h3>
   <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{review.profile.intent_provenance?.intent_expression??review.profile.purpose}</p>
   <p className="oi-note">{review.accepted?"Accepted definition":"Draft — review before accepting"}</p>
   <details><summary>Source and scope</summary><p>Scope <code>{review.scope_ref}</code></p><p>Source <code>{review.profile.ref}</code> · revision <code>{review.profile.revision}</code></p><p><code>{review.content_digest}</code></p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(review.profile,null,2)}</pre><p>Preparation checks the selected Skill content and delivers it to this session. Child sessions require separate admission. Preparing a session grants no execution authority.</p></details>
   {!review.accepted&&<button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>void controller.accept()}>Accept this definition</button>}
   {review.accepted&&!prepared&&<button type="button" className="oi-action" disabled={state.busy||!!state.unknown||state.world?.world_readiness.ready!==true} onClick={()=>void controller.prepare()}>Prepare conversation</button>}
   <button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>{controller.edit({});setCreating(false);}}>Back to Agents</button>
  </section>}
  {prepared&&<section aria-label="Prepared Agent conversation"><button type="button" className="oi-action" disabled={opening} onClick={()=>void choose(prepared)}>Open conversation</button><details><summary>Session details</summary><p><code>{prepared.agent_session}</code></p><p><code>{prepared.space}</code></p></details></section>}
  {state.world?.world_readiness.ready===false&&<p className="oi-note" role="status">{state.world.world_readiness.reason}</p>}
  {state.readinessError&&<p className="oi-note" role="status">{state.readinessError}</p>}
  {state.world?.world_readiness.ready===false&&<button className="oi-action" onClick={()=>openAgentSetup({project,destination:{owner:"central",topic:"world",nativeAction:state.world?.world_readiness.action},reason:state.world?.world_readiness.reason??"Review project setup",refresh})}>Review project setup</button>}
  {(state.error||openError)&&<p className="oi-refusal" role="alert">{state.error??openError}</p>}
  {state.unknown&&<button type="button" className="oi-action" disabled={state.busy} onClick={()=>void controller.recover()}>Check original outcome</button>}
  <button type="button" className="oi-action" onClick={()=>openAgentSetup({project,destination:review&&!review.accepted?{owner:"central",topic:"acceptance",nativeAction:"agent-profile.accept"}:{owner:"ai-kit",topic:"harness"},reason:state.error??openError??"Agent, harness or credential setup",refresh})}>Agent and harness settings</button>
 </section>;
}
