import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {nowReading,type NowReading} from "./now";
/** The NOW relations one record discloses (queue cell 1). The record names a
 * `now_ref`; this reads that exact NOW through the owner (`central.now.read`)
 * and renders the owner's relations verbatim — identity, lifecycle, task,
 * purpose, participants, sources, continuations. Register follows the record:
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
  nowReading<NowReading>(kernel.transport,project,{kind:"read",now_ref:nowRef})
   .then(value=>{if(live){setReading(value);setRefusal(undefined);}})
   .catch(reason=>{if(live){setRefusal(String(reason));setReading(undefined);}});
  return()=>{live=false;};
 },[nowRef,project,kernel.transport]);
 if(refusal)return <div className="now-relations now-relations-refused" data-owner-refusal={refusal} role="status">
   <strong>NOW</strong><p>The owner refused the read: {refusal}</p>
 </div>;
 if(!reading)return <p className="now-relations now-relations-loading" role="status" aria-busy="true">Reading the NOW the owner named…</p>;
 const record=reading.record;
 return <div className="now-relations" data-now-reading={reading.schema} data-now-ref={record.now_ref}>
  <strong>NOW</strong>
  <dl>
   <dt>Ref</dt><dd><code>{record.now_ref}</code></dd>
   <dt>Task</dt><dd><code>{record.task_ref}</code> — {record.purpose}</dd>
   <dt>Lifecycle</dt><dd data-now-lifecycle={record.lifecycle}>{record.lifecycle} · rev {typeof reading.revision==="string"?reading.revision:reading.revision?.revision}</dd>
   <dt>Participants</dt><dd data-now-participants={JSON.stringify(record.participant_refs)}>{record.participant_refs.join(", ")||"none recorded"}</dd>
   <dt>Sources</dt><dd data-now-sources={JSON.stringify(record.source_refs)}>{record.source_refs.map(ref=><code key={ref}>{ref}</code>)}{record.source_refs.length?"":"none recorded"}</dd>
   <dt>Continuations</dt><dd data-now-continuations={JSON.stringify(record.continuation_refs)}>{record.continuation_refs.join(", ")||"none recorded"}</dd>
  </dl>
 </div>;
}
