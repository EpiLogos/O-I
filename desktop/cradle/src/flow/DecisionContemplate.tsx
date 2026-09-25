import {useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {OBSERVER_ID} from "../visuals/ParticleExpression";
import type {DecisionEpisode,DecisionPreflight,DecisionProposal,DecisionReceipt} from "../kernel/types";
import {authoriseDecisionEpisode,decisionReservation,executeDecision,prepareDecision,revokeDecisionEpisode} from "./decisionClient";

const initial={credential:"",model:"",source:"",inputRate:"",outputRate:"0",inputTokens:"16000",outputTokens:"1000",budget:"10000",seconds:"300",receiving:true,recovery:true};
const money=(value:number)=>`$${(value/1_000_000).toFixed(6)}`;
function answerWords(value:unknown):string{
 if(!value||typeof value!=="object")return "No usable answer";
 const row=value as Record<string,unknown>;
 if(row.type==="choice")return String(row.choice??"No choice").replaceAll("-"," ");
 if(row.type==="noul")return typeof row.noul==="number"?`${Math.round(row.noul*100)}% support`:"No assessment";
 if(row.type==="score")return `Score ${String(row.score)}`;
 return "Unrecognised answer";
}
/** A deliberate preflight → native permission → one consideration. Nothing is
 * sent on open, save, attach, or merely revealing this disclosure. */
export function DecisionContemplate({project}:{project:string|null}){
 const {transport}=useKernel();
 const [form,setForm]=useState(initial),[preflight,setPreflight]=useState<DecisionPreflight|null>(null),[episode,setEpisode]=useState<DecisionEpisode|null>(null),[receipt,setReceipt]=useState<DecisionReceipt|null>(null),[busy,setBusy]=useState(""),[error,setError]=useState<string|null>(null);
 const edit=(key:keyof typeof initial,value:string|boolean)=>{setForm(previous=>({...previous,[key]:value}));setPreflight(null);setReceipt(null);setError(null);};
 const act=async(label:string,run:()=>Promise<void>)=>{setBusy(label);setError(null);try{await run();}catch(reason){setError(String(reason));}finally{setBusy("");}};
 const prepare=()=>act("Reading current basis…",async()=>{
  setPreflight(null);setReceipt(null);
  const inputTokens=Number(form.inputTokens),outputTokens=Number(form.outputTokens),inputRate=Number(form.inputRate),outputRate=Number(form.outputRate),budget=Number(form.budget);
  const reservation=decisionReservation(inputTokens,outputTokens,inputRate,outputRate);
  if(!form.model.trim()||!form.source.trim()||!form.credential.trim()||!form.inputRate.trim())throw Error("Enter the stored credential reference, concrete model version, and published tariff source and rates.");
  if(reservation>budget)throw Error(`This attempt needs a ${money(reservation)} reservation, above the episode cap.`);
  const proposal:DecisionProposal={project,observer_id:form.recovery?OBSERVER_ID:null,sites:[...(form.receiving?["receiving.review-priority"]:[]),...(form.recovery?["workspace.recovery-suggestion"]:[])],credential_ref:form.credential.trim(),limits:{timeout_ms:30000,max_attempts:1,max_total_reserved_microusd:budget,tariff:{model_version:form.model.trim(),source:form.source.trim(),max_input_tokens_per_attempt:inputTokens,max_output_tokens_per_attempt:outputTokens,input_microusd_per_million_tokens:inputRate,output_microusd_per_million_tokens:outputRate}},episode_budget_microusd:budget,episode_seconds:Number(form.seconds)};
  setPreflight(await prepareDecision(transport,proposal));
 });
 return <details className="flow-decision" data-decision-state={receipt?.outcome??(episode?"authorised":preflight?"preflight":"idle")}>
  <summary>Consider the inbox and workspace</summary>
  <p>Ask for an advisory reading of the current inbox counts and workspace arrangement. Document text, drafts, commands and URLs are excluded. No review, inclusion or recovery is applied.</p>
  <fieldset disabled={!!busy||!!episode}>
   <legend>One bounded episode</legend>
   <label><input type="checkbox" checked={form.receiving} onChange={event=>edit("receiving",event.target.checked)}/> Inbox priority</label>
   <label><input type="checkbox" checked={form.recovery} onChange={event=>edit("recovery",event.target.checked)}/> Workspace recovery suggestion</label>
   <label>Stored credential reference<input value={form.credential} onChange={event=>edit("credential",event.target.value)} autoComplete="off" placeholder="Native secret reference"/></label>
   <label>Concrete Jev model version<input value={form.model} onChange={event=>edit("model",event.target.value)} autoComplete="off"/></label>
   <label>Published tariff source<input value={form.source} onChange={event=>edit("source",event.target.value)} autoComplete="off"/></label>
   <div className="flow-decision-numbers">
    {([ ["inputRate","Input rate (micro-US dollars / million tokens)"],["outputRate","Output rate (micro-US dollars / million tokens)"],["inputTokens","Maximum input tokens"],["outputTokens","Maximum output tokens"],["budget","Episode cap (micro-US dollars)"],["seconds","Episode expiry (seconds)"]] as const).map(([key,label])=><label key={key}>{label}<input type="number" min={key==="outputRate"?0:1} step="1" value={form[key]} onChange={event=>edit(key,event.target.value)}/></label>)}
   </div>
   <p>One attempt per consideration, at most 30 seconds. The kernel reserves the bounded cost before sending. Uncertain provider charges remain reserved.</p>
  </fieldset>
  {error&&<p role="alert" className="flow-error">{error}</p>}
  <div className="oi-tool-row">
   <button disabled={!!busy} onClick={()=>void prepare()}>Read current basis</button>
   {preflight&&!episode&&<button disabled={!!busy||transport.kind!=="tauri"} onClick={()=>void act("Waiting for native confirmation…",async()=>setEpisode(await authoriseDecisionEpisode(transport,preflight)))}>Allow bounded episode…</button>}
   {preflight&&episode&&<button disabled={!!busy} onClick={()=>void act("Considering…",async()=>setReceipt(await executeDecision(transport,preflight,episode)))}>Consider once</button>}
   {episode&&<button disabled={!!busy} onClick={()=>void act("Ending episode…",async()=>{await revokeDecisionEpisode(transport,episode);setEpisode(null);setPreflight(null);})}>End episode</button>}
  </div>
  {busy&&<p role="status">{busy}</p>}
  {preflight&&<div><p>{Object.keys(preflight.questions).length} questions share one disclosed basis. Cap {money(preflight.proposal.episode_budget_microusd)}. Permission expires after {preflight.proposal.episode_seconds} seconds; it ends on app restart.</p><details><summary>Review exact inputs and questions</summary><pre>{JSON.stringify({inputs:preflight.basis.inputs,questions:preflight.questions},null,2)}</pre></details></div>}
  {episode&&<p>Episode allowed until {new Date(episode.expires_at_unix_seconds*1000).toLocaleTimeString()}. Each new consideration checks its live scope, expiry and remaining budget.</p>}
  {receipt&&<section aria-label="Decision reading"><p>{receipt.outcome==="cached"?"The basis is unchanged; this is the previous reading, with no new provider call.":receipt.outcome==="completed"?"Advisory reading received.":receipt.reason??"No complete advisory reading was returned."}</p>{receipt.answers&&<ul>{Object.entries(receipt.answers).map(([name,answer])=><li key={name}>{name.startsWith("receiving.")?"Inbox":name.startsWith("workspace.")?"Workspace":name}: {answerWords(answer)}</li>)}</ul>}<p>Known cost {money(receipt.cost_microusd)}{receipt.unknown_reserved_microusd>0?`; ${money(receipt.unknown_reserved_microusd)} remains reserved because the charge is uncertain.`:"."}</p><details><summary>Show decision receipt</summary><pre>{JSON.stringify(receipt,null,2)}</pre></details></section>}
 </details>;
}
