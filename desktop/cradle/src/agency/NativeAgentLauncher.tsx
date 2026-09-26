import {useEffect,useMemo,useState,useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {EncounterRow} from "../encounter/EncounterList";
import {agentController} from "./nativeAgentClient";
import type {NativeAgentController,NativePrepared} from "./nativeAgent";
import {openAgentSetup} from "./agentSetup";
import {LiveHumanAgentCard} from "./HumanAgentCard";

/** Native source creation and session selection in the existing Agent surface.
 * `controller` is a test/embed seam; production always uses the kernel owner. */
export function NativeAgentLauncher({project,onChoose,controller:injected}:{project?:string;onChoose?:(row:EncounterRow)=>Promise<void>|void;controller?:NativeAgentController}) {
	const kernel=useKernel();
	const controller=useMemo(()=>injected??agentController(kernel.transport,project),[injected,kernel.transport,project]);
	const state=useSyncExternalStore(controller.subscribe,controller.snapshot);
	const [opening,setOpening]=useState(false);const [openError,setOpenError]=useState<string>();
	const refresh=async()=>{await controller.refresh();await controller.refreshReadiness();};
	useEffect(()=>{void refresh();},[controller]);
	const choose=async(prepared:NativePrepared)=>{
		if(opening)return;setOpening(true);setOpenError(undefined);
		const row:EncounterRow={ref:prepared.agent_session,space:prepared.space,project:project??"",title:state.review?.profile.name??state.review?.profile.purpose??prepared.agent_ref};
		try {
			if(onChoose)await onChoose(row);
			else window.dispatchEvent(new CustomEvent("oi:agent-session-prepared",{detail:row}));
		}catch(error){setOpenError(String(error));}finally{setOpening(false);}
	};
	const {draft,review,prepared,compound}=state;
	const repertoireFirst=!!state.skillSets&&state.skillSets.length>0;
	return <section className="oi-section native-agent-launcher" aria-label="Native Agent creation" aria-busy={state.busy||opening}>
		<header className="oi-panel-head"><strong>Agents in {project??"Central root"}</strong><button type="button" className="oi-action" disabled={state.busy} onClick={()=>void refresh()}>Read native roster</button></header>
		<p className="oi-note">A reusable Agent is an accepted native definition. Temporary task roles and runtime sessions stay separate. Preparing a session neither starts a harness nor grants execution authority.</p>
		{state.profiles.length>0&&<div role="group" aria-label="Native Agent roster">{state.profiles.map(item=><button key={item.profile.ref} type="button" className="oi-row" disabled={state.busy||state.unknown==="prepare"} onClick={()=>void controller.select(item.profile.ref)}>
			<span>{item.profile.name??item.profile.agent_ref}</span><span className="oi-note">{item.accepted?"Accepted definition":"Proposal — not accepted"}</span>
		</button>)}</div>}
		{!review&&<fieldset disabled={state.busy||!!state.unknown}>
			<label className="oi-field">Agent name<input className="oi-input" aria-label="Agent name" value={draft.name} maxLength={256} onChange={e=>controller.edit({name:e.target.value})}/></label>
			<label className="oi-field">Human purpose<textarea className="oi-input" aria-label="Human purpose" rows={3} maxLength={16384} value={draft.purpose} onChange={e=>controller.edit({purpose:e.target.value})}/></label>
			<label className="oi-field"><input type="checkbox" checked={draft.scopeConfirmed} disabled={!state.scopeRef} onChange={e=>controller.edit({scopeConfirmed:e.target.checked})}/> I choose the disclosed native scope <code>{state.scopeRef??"not yet available"}</code> for this Agent.</label>
			{repertoireFirst&&<fieldset className="oi-section" disabled={state.readinessPending} aria-label="Native SkillSets">
				<legend>Repertoire — choose a SkillSet first</legend>
				{state.skillSets!.map(set=><label key={set.name} className="oi-field">
					<input type="checkbox" aria-label={`SkillSet ${set.name}`} checked={draft.skillSetRefs.includes(set.name)} disabled={state.busy||!!state.unknown} onChange={e=>void controller.toggleSkillSet(set.name,e.target.checked)}/>
					{" "}{set.name} <span className="oi-note">{set.summary?`${set.summary} · `:""}{set.projected}/{set.members} project here{set.withheld>0?` · ${set.withheld} withheld`:""} · source {set.provenance}</span>
				</label>)}
				{state.skillSetDetail&&<details><summary>Nested membership and withheld members — {state.skillSetDetail.name}</summary>
					<ul className="agency-candidate-list" aria-label="SkillSet members">
						{state.skillSetDetail.children.map(child=><li key={child.ref} className="oi-row"><span>{child.name}</span><span className="oi-note">nested set · {child.members} members{child.attached_by?` · attached by ${child.attached_by}`:""}</span></li>)}
						{state.skillSetDetail.projected.map(capability=><li key={capability} className="oi-row"><code className="oi-ref">{capability}</code><span className="oi-note">projects here</span></li>)}
						{state.skillSetDetail.withheld.map(entry=><li key={entry.capability} className="oi-row"><code className="oi-ref">{entry.capability}</code><span className="oi-note" data-attention="true">withheld — {entry.reason}</span></li>)}
					</ul>
					<p className="oi-note">A set is a request; this reply is the owner&apos;s own resolution. Withheld members are carried by the set but do not project into this scope.</p>
				</details>}
				<p className="oi-note">Individual Skill exceptions stay possible after a SkillSet choice; discovery is not activation.</p>
			</fieldset>}
			<fieldset className="oi-section" disabled={state.readinessPending} aria-label={repertoireFirst?"Native effective Skills — individual exceptions":"Native effective Skills"}>
				<legend>{repertoireFirst?"Individual Skill exceptions":"Skills for this Agent"}</legend>
				{state.skills?.length===0&&<p className="oi-note">No native Skills are currently disclosed for this scope.</p>}
				{state.skills?.map(skill=><label key={skill.ref} className="oi-field"><input type="checkbox" aria-label={`Skill ${skill.name}`} checked={draft.skillRefs.includes(skill.ref)} disabled={!skill.eligible&&!draft.skillRefs.includes(skill.ref)} onChange={e=>controller.edit({skillRefs:e.target.checked?[...draft.skillRefs,skill.ref]:draft.skillRefs.filter(ref=>ref!==skill.ref)})}/>{skill.name} <span className="oi-note">{skill.description}{!skill.eligible&&` — unavailable: ${skill.reason_code??"native eligibility not established"}`}</span></label>)}
				{draft.skillRefs.filter(ref=>!state.skills?.some(row=>row.ref===ref)).map(ref=><label key={ref}><input type="checkbox" checked onChange={()=>controller.edit({skillRefs:draft.skillRefs.filter(r=>r!==ref)})}/>Unavailable selection: {ref}</label>)}
				<p className="oi-note">Exact effective bytes are checked at preparation and sent to the parent session. Brokered children require separate admission.</p>
			</fieldset>
			<button type="button" className="oi-action" onClick={()=>void controller.propose()} disabled={!draft.name||!draft.purpose||!draft.scopeConfirmed}>Create native proposal</button>
			<button type="button" className="oi-action oi-action-primary" onClick={()=>void controller.saveAndStart()} disabled={!draft.name||!draft.purpose||!draft.scopeConfirmed}>Save and start Direct work</button>
			<p className="oi-note">Save and start runs the native save (CAS), acceptance, world-readiness check and session preparation in order, then opens the conversation. Each stage&apos;s real outcome is shown; a failure after the save keeps the source and names the failing stage.</p>
		</fieldset>}
		{review&&<section aria-label="Review native Agent source">
			<h3>{review.profile.name??review.profile.agent_ref}</h3>
			<pre className="oi-note" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{review.profile.intent_provenance?.intent_expression??review.profile.purpose}</pre>
			<p className="oi-note">Scope <code>{review.scope_ref}</code> · source <code>{review.profile.ref}</code> · revision <code>{review.profile.revision}</code></p>
			{review.profile.skill_set_refs&&review.profile.skill_set_refs.length>0&&<p className="oi-note">SkillSets: {review.profile.skill_set_refs.join(", ")}</p>}
			<details><summary>Show raw — exact source basis and delivery limits</summary><p><code>{review.content_digest}</code></p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(review.profile,null,2)}</pre><p>Selected Skill content is checked and delivered to the native parent session. Child activation requires its own admission and is not implied.</p></details>
			{review.accepted&&<LiveHumanAgentCard agentRef={review.profile.agent_ref} worldRef={review.scope_ref} standing={prepared?"prepared":"accepted"}
				actions={[prepared
					?{label:"Open conversation and choose harness",run:()=>void choose(prepared)}
					:{label:"Save and start Direct work",run:()=>void controller.saveAndStart()}]}/>}
			{review.accepted?<p role="status">Accepted by the native human-authority path and read back from the roster.</p>:<p role="status">This is a stored proposal, not an accepted Agent and not permission to execute.</p>}
			{!review.accepted&&<button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>void controller.accept()}>Accept this exact Agent definition</button>}
			{review.accepted&&!prepared&&<button type="button" className="oi-action" disabled={state.busy||!!state.unknown||state.world?.world_readiness.ready!==true} onClick={()=>void controller.prepare()}>Prepare Direct session</button>}
			{!prepared&&<button type="button" className="oi-action oi-action-primary" disabled={state.busy||!!state.unknown} onClick={()=>void controller.saveAndStart()}>Save and start Direct work</button>}
			<button type="button" className="oi-action" disabled={state.busy||!!state.unknown} onClick={()=>controller.edit({})}>Back to held draft</button>
		</section>}
		{compound&&<div role="status" aria-label="Save and start stage outcomes" className="oi-note">
			{(["propose","accept","readiness","prepare"] as const).map(stage=><span key={stage} data-stage={stage} data-stage-outcome={compound[stage]} style={{marginInlineEnd:"0.75em"}}>{stage}: {compound[stage]}</span>)}
		</div>}
		{prepared&&<section aria-label="Prepared native session"><p role="status">Native AgentSession attached. No provider has been started by preparation.</p><p className="oi-note"><code>{prepared.agent_session}</code><br/><code>{prepared.space}</code></p><button type="button" className="oi-action" disabled={opening} onClick={()=>void choose(prepared)}>Open conversation and choose harness</button></section>}
		{state.world&&<p className="oi-note" role="status">{state.world.world_readiness.ready?`Native World: ${state.world.world_readiness.world_ref}`:state.world.world_readiness.reason??"A native World declaration is required before session preparation."}</p>}
		{state.readinessError&&<p className="oi-note" role="status">{state.readinessError}</p>}
		{state.world?.world_readiness.ready===false&&<button className="oi-action" onClick={()=>openAgentSetup({project,destination:{owner:"central",topic:"world",nativeAction:state.world?.world_readiness.action},reason:state.world?.world_readiness.reason??"Review the native World declaration",refresh})}>Review native World setup</button>}
		{(state.error||openError)&&<p className="oi-refusal" role="alert">{state.error??openError}</p>}
		{state.unknown&&<button type="button" className="oi-action" disabled={state.busy} onClick={()=>void controller.recover()}>Inspect original outcome — no replay</button>}
		<button type="button" className="oi-action" onClick={()=>openAgentSetup({project,destination:review&&!review.accepted?{owner:"central",topic:"acceptance",nativeAction:"agent-profile.accept"}:{owner:"ai-kit",topic:"harness"},reason:state.error??openError??"Agent, harness or credential setup",refresh})}>Open native Agent/session setup</button>
	</section>;
}
