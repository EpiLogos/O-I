import {useEffect,useState} from "react";
import {kernelOp} from "../kernel/bridge";
import type {ActionDispatch,KernelOp} from "../kernel/types";
import {useKernel} from "../kernel/KernelProvider";
import type {NowReading} from "./now";

/** A Central NOW reading is owner data, including optional current placement.
 * The action dispatch carries the exact owner operation and keeps the
 * renderer from inventing a second NOW reader for placement-aware reads. */
async function readNow(transport:Parameters<typeof kernelOp>[0],project:string|null,nowRef:string):Promise<NowReading> {
 const operation={
  op:"invoke_action" as const,
  project,
  invocation:{
   action:"central.now.read",
   target_ref:nowRef,
   input:{project,now_ref:nowRef,with_placement:true},
  },
 } as KernelOp;
 const response=await kernelOp(transport,operation);
 if(response.error)throw new Error(response.error);
 const outcome=response.outcome;
 if(!outcome||outcome.result!=="action_dispatched")throw new Error("Central NOW reading is unavailable");
 const dispatch=outcome.dispatch;
 if(dispatch.state==="invoked"){
  if(dispatch.owner_operation!=="central.now.read")throw new Error(`Unexpected owner operation ${dispatch.owner_operation}`);
  return dispatch.data as NowReading;
 }
 throw new Error(actionRefusal(dispatch));
}
function actionRefusal(dispatch:Exclude<ActionDispatch,{state:"invoked"}>):string {
 switch(dispatch.state){
  case "owner_refused":return dispatch.message;
  case "owner_unavailable":return dispatch.detail;
  case "unsupported_action":return dispatch.detail;
  case "malformed_ref":return dispatch.detail;
  case "unknown_owner":return `Unknown owner for action ${dispatch.action}`;
 }
}
/** The NOW relations one record discloses (queue cell 1). The record names a
 * `now_ref`; this reads that exact NOW through the owner
 * (`central.now.read`) and renders the owner's relations verbatim —
 * identity, lifecycle, obligations, archive, placement, task, purpose,
 * participants, sources and continuations. Register follows the record:
 * the root register is the explicit null. A refused read renders the OWNER'S
 * refusal verbatim, never a desktop-fabricated absence. Read-only: nothing
 * here allocates, re-enters or mutates a clearing. */
export function NowRelations({nowRef,project}:{nowRef:string;project:string|null}) {
 const kernel=useKernel();
 const [reading,setReading]=useState<NowReading>();
 const [refusal,setRefusal]=useState<string>();
 useEffect(()=>{
  let live=true;
  setReading(undefined);setRefusal(undefined);
  readNow(kernel.transport,project,nowRef)
   .then(value=>{if(live){setReading(value);setRefusal(undefined);}})
   .catch(reason=>{if(live){setRefusal(String(reason));setReading(undefined);}});
  return()=>{live=false;};
 },[nowRef,project,kernel.transport]);
 if(refusal)return <div className="now-relations now-relations-refused" data-owner-refusal={refusal} role="status">
   <strong>NOW</strong><p>The owner refused the read: {refusal}</p>
 </div>;
 if(!reading)return <p className="now-relations now-relations-loading" role="status" aria-busy="true">Reading the NOW the owner named…</p>;
 const record=reading.record;
 const placementIncluded=reading.placement_included===true;
 const writableDestination=typeof reading.writable_destination==="string"?reading.writable_destination:undefined;
 const policy=reading.policy&&typeof reading.policy==="object"?reading.policy as Record<string,unknown>:undefined;
 const policyRevision=policy&&typeof policy.revision==="string"?policy.revision:undefined;
 return <div className="now-relations" data-now-reading={reading.schema} data-now-ref={record.now_ref}>
  <strong>NOW</strong>
  <dl>
   <dt>Ref</dt><dd><code>{record.now_ref}</code></dd>
   <dt>Task</dt><dd><code>{record.task_ref}</code> — {record.purpose}</dd>
   <dt>Lifecycle</dt><dd data-now-lifecycle={record.lifecycle}>{record.lifecycle} · rev {typeof reading.revision==="string"?reading.revision:reading.revision?.revision}</dd>
   <dt>Obligations</dt><dd data-now-obligations={JSON.stringify(record.obligations)}>{record.obligations.length?record.obligations.map(ref=><code key={ref}>{ref}</code>):"none recorded"}</dd>
   <dt>Archive</dt><dd data-now-archive-ref={record.archive_ref??""}>{record.archive_ref?<code>{record.archive_ref}</code>:"none recorded"}</dd>
   <dt>Placement</dt><dd data-now-placement={placementIncluded?"included":"not-included"}>{placementIncluded?"included":"not included in this reading"}{writableDestination&&<> · <code data-now-destination={writableDestination}>{writableDestination}</code></>}{policyRevision&&<> · policy rev <code data-now-policy-revision={policyRevision}>{policyRevision}</code></>}</dd>
   <dt>Participants</dt><dd data-now-participants={JSON.stringify(record.participant_refs)}>{record.participant_refs.join(", ")||"none recorded"}</dd>
   <dt>Sources</dt><dd data-now-sources={JSON.stringify(record.source_refs)}>{record.source_refs.map(ref=><code key={ref}>{ref}</code>)}{record.source_refs.length?"":"none recorded"}</dd>
   <dt>Continuations</dt><dd data-now-continuations={JSON.stringify(record.continuation_refs)}>{record.continuation_refs.join(", ")||"none recorded"}</dd>
  </dl>
 </div>;
}
