import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {nowReading,type NowReading} from "./now";
import "./receiving.css";
/** Exact native record, consequential Returns and originating work. No local
 * reconstruction of missing parent/day/session/Factory identity. */
export function NowRelations({nowRef,project,refresh=0,onOpenSource,onReturn}:{nowRef:string;project:string|null;refresh?:number;onOpenSource?:(ref:string)=>void;onReturn?:(ref:string)=>void}) {
 const kernel=useKernel();
 const [held,setHeld]=useState<{project:string|null;reading:NowReading}>();
 const reading=held?.project===project?held.reading:undefined;
 const [error,setError]=useState<string>();
 const [pending,setPending]=useState(false);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let live=true;setPending(true);setError(undefined);
  nowReading<NowReading>(kernel.transport,project,{kind:"read",now_ref:nowRef})
   .then(value=>{if(live)setHeld({project,reading:value});})
   .catch(reason=>{if(live)setError(String(reason));})
   .finally(()=>{if(live)setPending(false);});
  return()=>{live=false;};
 },[nowRef,project,kernel.transport,refresh,version]);
 const current=reading?.record.now_ref===nowRef?reading:undefined;
 const record=current?.record;
 return <div className="now-relations" data-now-reading={current?.schema} data-now-ref={nowRef} aria-busy={pending}>
  <strong>NOW</strong><button type="button" onClick={()=>setVersion(n=>n+1)} disabled={pending}>Refresh NOW</button>
  {error&&<p className="now-relations-refused" data-owner-refusal={error} role="alert">NOW read failed: {error}{current?" — retained reading is not current success.":""}</p>}
  {!record&&!error&&<p role="status">Reading the exact NOW…</p>}
  {record&&<>
   <dl>
    <dt>Ref / scope</dt><dd><code>{record.now_ref}</code> · {record.scope_ref}</dd>
    <dt>Task</dt><dd><code>{record.task_ref}</code> — {record.purpose}</dd>
    <dt>Lifecycle</dt><dd data-now-lifecycle={record.lifecycle}>{record.lifecycle} · rev {current!.revision.revision}</dd>
    <dt>Participants</dt><dd data-now-participants={JSON.stringify(record.participant_refs)}>{record.participant_refs.join(", ")||"none recorded"}</dd>
    <dt>Sources</dt><dd data-now-sources={JSON.stringify(record.source_refs)}>{record.source_refs.map(ref=>onOpenSource?<button type="button" key={ref} onClick={()=>onOpenSource(ref)}>{ref}</button>:<code key={ref}>{ref}</code>)}{record.source_refs.length?"":"none recorded"}</dd>
    <dt>Continuations</dt><dd data-now-continuations={JSON.stringify(record.continuation_refs)}>{record.continuation_refs.join(", ")||"none recorded"}</dd>
    <dt>Obligations</dt><dd>{record.obligations.join(", ")||"none recorded"}</dd>
    {record.parent_now_ref&&<><dt>Parent NOW</dt><dd>{record.parent_now_ref}</dd></>}
    {record.day_ref&&<><dt>Related human Day</dt><dd>{record.day_ref}</dd></>}
    {record.archive_ref&&<><dt>Archive</dt><dd>{record.archive_ref}</dd></>}
   </dl>
   <div aria-label="Originating work"><strong>Originating work</strong>
    {record.work_refs?.map((work,i)=><p key={`${work.repo}:${work.branch}:${i}`}><code>{work.repo}</code> · {work.branch}{work.worktree_path&&<> · {work.worktree_path}</>}</p>)}
    {!record.work_refs?.length&&<p>No native work-lane references recorded.</p>}
   </div>
   <div aria-label="NOW Returns"><strong>Consequential Returns</strong>
    {current!.returns===undefined?<p>The native owner has not supplied the composed-Returns reading. This is unavailable, not an empty receiving field.</p>:current!.returns.length?current!.returns.map((returned,index)=><div key={`${returned.return_ref}:${index}`} data-return-ref={returned.return_ref}>
     {onReturn?<button type="button" onClick={()=>onReturn(returned.return_ref)}>{returned.return_ref}</button>:<code>{returned.return_ref}</code>}
     <p>{returned.status} · {returned.settled?"settled":"outstanding"}</p>
     <dl>{(["run_ref","session_ref","task_ref","day_ref","source_ref"] as const).map(key=>returned[key]?<div key={key}><dt>{key}</dt><dd>{returned[key]}</dd></div>:null)}</dl>
    </div>):<p>No Returns in this native reading.</p>}
   </div>
  </>}
 </div>;
}
