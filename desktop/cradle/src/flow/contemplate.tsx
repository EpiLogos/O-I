import {useState} from "react";
import {kernelOp} from "../kernel/bridge";
import {useKernel} from "../kernel/KernelProvider";
import type {ActionDispatch,ChangedSinceReading,KernelTransportStatus} from "../kernel/types";
import "./flow.css";

/** W1.4/W1.5 flow cognition, the desktop half. The owner operations are
 * live (`aikit flow preflight|contemplate|changed-since`, reached through
 * the kernel's typed `action:contemplate-flow` dispatch and the
 * `flow_changed_since` compose); this surface only renders their answers
 * verbatim. Contemplate is NEVER auto-invoked: the preflight disclosure
 * comes first, execution needs a second explicit act, and the what-changed
 * read exists only once a preflight record (the owner-held thought) exists.
 * On grounds whose owner store does not resolve the Flow's knowledge node,
 * the owner's own refusal is the disclosure — rendered, never paraphrased. */

export async function contemplateFlow(transport:KernelTransportStatus,project:string|null,flowRef:string,execute?:Record<string,unknown>):Promise<ActionDispatch>{
 const response=await kernelOp(transport,{op:"invoke_action",...(project?{project}:{}),invocation:{action:"action:contemplate-flow",target_ref:flowRef,...(execute?{input:{execute}}:{})}});
 if(response.outcome?.result==="action_dispatched")return response.outcome.dispatch;
 throw new Error(response.error??"the kernel returned no dispatch outcome");
}

export async function changedSince(transport:KernelTransportStatus,project:string|null,thought:Record<string,unknown>):Promise<ChangedSinceReading>{
 const response=await kernelOp(transport,{op:"flow_changed_since",...(project?{project}:{}),thought});
 if(response.outcome?.result==="flow_changed_since")return response.outcome.reading;
 throw new Error(response.error??"the kernel returned no changed-since reading");
}

type Phase="idle"|"preflight"|"execute"|"changed";
export function FlowCognition({project,flowRef}:{project:string|null;flowRef:string}){
 const kernel=useKernel();
 const [thought,setThought]=useState<Record<string,unknown>|null>(null);
 const [disclosure,setDisclosure]=useState<ActionDispatch|null>(null);
 const [execution,setExecution]=useState<ActionDispatch|null>(null);
 const [changed,setChanged]=useState<ChangedSinceReading|null>(null);
 const [error,setError]=useState<string>();
 const [busy,setBusy]=useState<Phase|"">("");
 const preflight=async()=>{setBusy("preflight");setError(undefined);setExecution(null);setChanged(null);
  try{
   const answer=await contemplateFlow(kernel.transport,project,flowRef);
   setDisclosure(answer);
   if(answer.state==="invoked")setThought((answer.data??{}) as Record<string,unknown>);
  }catch(reason){setError(String(reason));}finally{setBusy("");}};
 const execute=async()=>{if(!thought)return;setBusy("execute");setError(undefined);
  try{setExecution(await contemplateFlow(kernel.transport,project,flowRef,thought));}catch(reason){setError(String(reason));}finally{setBusy("");}};
 const readChanged=async()=>{if(!thought)return;setBusy("changed");setError(undefined);
  try{setChanged(await changedSince(kernel.transport,project,thought));}catch(reason){setError(String(reason));}finally{setBusy("");}};
 const overall=!disclosure?"idle":execution?"executed":disclosure.state==="invoked"?"disclosed":"refused";
 return <div className="flow-cognition" data-contemplate-state={overall}>
  <details>
   <summary>Contemplate · what changed</summary>
   <p className="flow-cognition-law">Contemplate is never auto-invoked: the owner&apos;s preflight comes first, execution needs a second explicit act, and nothing reads or sends on save, open or attach.</p>
   {error&&<p role="alert" className="flow-error">{error}</p>}
   {!disclosure&&<button type="button" data-action="contemplate.preflight" disabled={busy!==""} title="Ask the owner for the deterministic Contemplate preflight — exactly what would be read and touched. Inert: it records nothing and executes nothing." onClick={()=>void preflight()}>{busy==="preflight"?"Asking the owner…":"Contemplate this Flow"}</button>}
   {disclosure&&<PreflightAnswer answer={disclosure}/>}
   {disclosure?.state==="invoked"&&<div className="flow-cognition-execute">
     <button type="button" data-action="contemplate.execute" disabled={busy!==""} title="One explicit Contemplate: the preflight record goes back to the owner, record-gated. The owner still answers for itself — unavailable stays unavailable." onClick={()=>void execute()}>{busy==="execute"?"Contemplating…":"Execute Contemplate"}</button>
     <p className="flow-cognition-law">Execution re-sends the preflight record verbatim to the owner&apos;s record-gated aperture; without a host executor the owner answers unavailable, and that answer is the result.</p>
   </div>}
   {execution&&<ExecutionAnswer answer={execution}/>}
   {thought&&<div className="flow-changed" data-changed-state={changed?changed.aikit.state:"pending"}>
     <p className="flow-changed-title">What changed since this thought</p>
     {!changed&&<button type="button" data-action="changed-since.read" disabled={busy!==""} onClick={()=>void readChanged()}>{busy==="changed"?"Reading…":"Read changes"}</button>}
     {changed&&<ChangedReading reading={changed}/>}
   </div>}
  </details>
 </div>;
}

/** The owner's answer, verbatim — the record on success, the owner's own
 * words on refusal or unavailability. Never paraphrased, never substituted. */
function Verbatim({label,data}:{label:string;data:unknown}){
 return <div className="flow-cognition-answer"><p className="flow-cognition-label">{label}</p><pre data-owner-payload="true">{JSON.stringify(data,null,2)}</pre></div>;
}
function PreflightAnswer({answer}:{answer:ActionDispatch}){
 if(answer.state==="invoked")return <Verbatim label="The owner's preflight — exactly what Contemplate will read and touch:" data={answer.data}/>;
 const detail=answer.state==="owner_refused"?answer.message:answer.state==="owner_unavailable"?answer.detail:answer.state==="malformed_ref"?answer.detail:answer.state==="unsupported_action"?`${answer.owner}: ${answer.detail}`:answer.action;
 return <div className="flow-cognition-answer" role="alert"><p className="flow-cognition-label">The owner answered, and Contemplate cannot proceed here:</p><p className="flow-origin" data-owner-refusal="true">{detail}</p><p className="flow-cognition-law">Contemplate resolves the Flow&apos;s knowledge node through the owner&apos;s store; on grounds whose store does not hold it, this refusal is the honest answer — nothing was read and nothing executed.</p></div>;
}
function ExecutionAnswer({answer}:{answer:ActionDispatch}){
 if(answer.state==="invoked")return <Verbatim label="The owner's Contemplate reading:" data={answer.data}/>;
 const detail=answer.state==="owner_refused"?answer.message:answer.state==="owner_unavailable"?answer.detail:answer.state==="malformed_ref"?answer.detail:answer.state==="unsupported_action"?`${answer.owner}: ${answer.detail}`:answer.action;
 return <div className="flow-cognition-answer" role="alert"><p className="flow-cognition-label">The owner answered the explicit execution:</p><p className="flow-origin" data-owner-refusal="true">{detail}</p></div>;
}
function ChangedReading({reading}:{reading:ChangedSinceReading}){
 return <div className="flow-changed-reading">
  <p className="flow-cognition-label">Change horizon ({reading.horizon.state}{reading.horizon.state==="available"?` · ${reading.horizon.owner_operation}`:reading.horizon.state==="owner_refused"?` · ${reading.horizon.message}`:` · ${reading.horizon.detail}`})</p>
  <p className="flow-cognition-label">Owner read ({reading.aikit.state})</p>
  {reading.aikit.state==="invoked"
    ?<Verbatim label="Changed sources · affected knowledge · unresolved — each with its provenance:" data={reading.aikit.receipt}/>
    :<p className="flow-origin" data-owner-refusal="true">{reading.aikit.state==="owner_refused"?reading.aikit.message:reading.aikit.detail}</p>}
 </div>;
}
