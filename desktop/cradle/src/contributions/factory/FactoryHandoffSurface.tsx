import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {ReturnedDocumentCallbacks} from "../../returns";
import {FactoryAttemptHandoffDocument} from "./FactoryAttemptHandoffDocument";
import {listFactoryAttemptTasks,readFactoryAttemptTask,type FactoryAttemptTaskListReading,type FactoryAttemptTaskReading} from "./attempt-task";
import {createFactoryHandoffReviewSnapshot,factoryHandoffReview,type FactoryHandoffReviewSnapshot} from "./factory-review-snapshot";
import "./factory-handoff-surface.css";

type Review={revision:number;snapshot?:FactoryHandoffReviewSnapshot;snapshotUnavailable?:string};
interface Props {statePath:string;runRef:string;expectedRevision?:number;snapshot?:FactoryHandoffReviewSnapshot;snapshotUnavailable?:string;onReviewAccepted?:(review:Review)=>void|Promise<void>;callbacks?:ReturnedDocumentCallbacks}

/** Owner task readings are retained presentation material. Only explicit task
 * selection or Refresh replaces them; a remount restores their exact basis. */
export function FactoryHandoffSurface({statePath,runRef,expectedRevision,snapshot,snapshotUnavailable,onReviewAccepted,callbacks}:Props) {
  const kernel=useKernel();
  const [tasks,setTasks]=useState<FactoryAttemptTaskListReading>();
  const [selected,setSelected]=useState<string>();
  const [reading,setReading]=useState<FactoryAttemptTaskReading>();
  const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const generation=useRef(0),selectedRef=useRef<string>();
  const inputs=useRef({expectedRevision,snapshot,snapshotUnavailable,onReviewAccepted});
  inputs.current={expectedRevision,snapshot,snapshotUnavailable,onReviewAccepted};

  const select=useCallback(async(taskRef:string)=>{
    const request=++generation.current;
    setError(undefined);setBusy(true);
    try {
      const value=await readFactoryAttemptTask(kernel.transport,statePath,runRef,taskRef);
      if(generation.current!==request)return;
      const captured=createFactoryHandoffReviewSnapshot(value,{statePath,runRef});
      let notice=captured?undefined:"This Factory handoff remains visible here, but exceeds the retained presentation limit. Refresh explicitly after reopening to read current Factory state.";
      try { await inputs.current.onReviewAccepted?.({revision:value.revision,snapshot:captured,snapshotUnavailable:notice}); }
      catch(reason) { notice=`This handoff is visible here, but its reviewed basis could not be saved: ${message(reason)}`; }
      if(generation.current!==request)return;
      selectedRef.current=taskRef;setSelected(taskRef);setReading(value);setError(notice);
    } catch(reason) { if(generation.current===request)setError(`Factory handoff read unavailable: ${message(reason)}`); }
    finally { if(generation.current===request)setBusy(false); }
  },[kernel.transport,runRef,statePath]);

  const refresh=useCallback(async()=>{
    const request=++generation.current;
    setError(undefined);setBusy(true);
    try {
      const value=await listFactoryAttemptTasks(kernel.transport,statePath,runRef);
      if(generation.current!==request)return;
      setTasks(value);
      const held=selectedRef.current;
      if(held) {
        if(value.taskRefs.includes(held))await select(held);
        else setError("The current Factory task list no longer contains the reviewed task. Its retained document remains visible; select another task explicitly.");
      } else if(value.taskRefs.length===1)await select(value.taskRefs[0]);
    } catch(reason) { if(generation.current===request)setError(`Factory handoff read unavailable: ${message(reason)}`); }
    finally { if(generation.current===request)setBusy(false); }
  },[kernel.transport,runRef,select,statePath]);

  useEffect(()=>{
    generation.current+=1;
    selectedRef.current=undefined;setSelected(undefined);setReading(undefined);setTasks(undefined);setError(undefined);setBusy(false);
    const held=inputs.current;
    const retained=held.snapshot?factoryHandoffReview(held.snapshot,{statePath,runRef}):undefined;
    if(retained&&(held.expectedRevision===undefined||retained.revision===held.expectedRevision)) {
      selectedRef.current=retained.taskRef;setSelected(retained.taskRef);setReading(retained);
    } else if(held.snapshot||held.snapshotUnavailable) {
      setError(held.snapshotUnavailable??"The retained Factory handoff cannot be restored for this revision. Refresh explicitly to read current Factory state.");
    } else void refresh();
    return ()=>{generation.current+=1;};
  },[statePath,runRef,refresh]);

  return <section className="factory-handoff-surface" aria-label="Factory handoff">
    <div><button type="button" onClick={()=>void refresh()} disabled={busy}>Refresh retained tasks</button></div>
    {error&&<p className="factory-handoff-error" role="alert">{error}</p>}
    {busy&&!reading&&<p className="factory-handoff-standing" role="status">Reading retained Factory handoff.</p>}
    {tasks?.taskRefs.length===0&&!reading&&<section className="factory-handoff-empty" aria-label="No retained Factory handoff"><p>No retained Factory handoff for this Run.</p></section>}
    {tasks&&(tasks.taskRefs.length>1||Boolean(selected&&tasks.taskRefs.length&&!tasks.taskRefs.includes(selected)))&&<nav className="factory-handoff-task-list" aria-label="Retained Factory tasks"><span>Retained tasks</span>{tasks.taskRefs.map(taskRef=><button key={taskRef} type="button" disabled={busy} aria-pressed={selected===taskRef} onClick={()=>void select(taskRef)}><code>{taskRef}</code></button>)}</nav>}
    {reading&&<FactoryAttemptHandoffDocument reading={reading} callbacks={callbacks}/>}
  </section>;
}
function message(reason:unknown) { return reason instanceof Error&&reason.message?reason.message:String(reason); }
