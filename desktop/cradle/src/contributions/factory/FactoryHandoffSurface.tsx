import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {ReturnedDocumentCallbacks} from "../../returns";
import {FactoryAttemptHandoffDocument} from "./FactoryAttemptHandoffDocument";
import {listFactoryAttemptTasks,readFactoryAttemptTask,type FactoryAttemptTaskListReading,type FactoryAttemptTaskReading} from "./attempt-task";
import "./factory-handoff-surface.css";

/** A small owner-read adapter: Factory task records supply the shared Handoff
 * documents; the Surface only chooses one exact retained task to read. */
export function FactoryHandoffSurface({statePath,runRef,callbacks}:{statePath:string;runRef:string;callbacks?:ReturnedDocumentCallbacks}) {
  const kernel=useKernel();
  const [tasks,setTasks]=useState<FactoryAttemptTaskListReading>();
  const [selected,setSelected]=useState<string>();
  const [reading,setReading]=useState<FactoryAttemptTaskReading>();
  const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const [refreshToken,setRefreshToken]=useState(0);
  const generation=useRef(0);
  const current=(request:number)=>generation.current===request;

  const select=useCallback((taskRef:string)=>{
    const request=++generation.current;
    setSelected(taskRef);setReading(undefined);setError(undefined);setBusy(true);
    void readFactoryAttemptTask(kernel.transport,statePath,runRef,taskRef).then(value=>{if(current(request))setReading(value);}).catch(reason=>{if(current(request))setError(`Factory handoff read unavailable: ${message(reason)}`);}).finally(()=>{if(current(request))setBusy(false);});
  },[kernel.transport,runRef,statePath]);

  const refresh=useCallback(()=>setRefreshToken(value=>value+1),[]);

  useEffect(()=>{
    const request=++generation.current;
    setTasks(undefined);setSelected(undefined);setReading(undefined);setError(undefined);setBusy(true);
    void listFactoryAttemptTasks(kernel.transport,statePath,runRef).then(value=>{
      if(!current(request))return;
      setTasks(value);
      if(value.taskRefs.length===1)select(value.taskRefs[0]);
    }).catch(reason=>{if(current(request))setError(`Factory handoff read unavailable: ${message(reason)}`);}).finally(()=>{if(current(request))setBusy(false);});
    return ()=>{generation.current++;};
  },[kernel.transport,refreshToken,runRef,select,statePath]);

  return <section className="factory-handoff-surface" aria-label="Factory handoff">
    {error&&<p className="factory-handoff-error" role="alert">{error}</p>}
    {busy&&!tasks&&<p className="factory-handoff-standing" role="status">Reading retained Factory handoff.</p>}
    {tasks?.taskRefs.length===0&&<section className="factory-handoff-empty" aria-label="No retained Factory handoff"><p>No retained Factory handoff for this Run.</p><button type="button" onClick={refresh} disabled={busy}>Refresh retained tasks</button></section>}
    {tasks&&tasks.taskRefs.length>1&&<nav className="factory-handoff-task-list" aria-label="Retained Factory tasks"><span>Retained tasks</span>{tasks.taskRefs.map(taskRef=><button key={taskRef} type="button" disabled={busy} aria-pressed={selected===taskRef} onClick={()=>select(taskRef)}><code>{taskRef}</code></button>)}</nav>}
    {tasks?.taskRefs.length===1&&error&&<p className="factory-handoff-retry"><button type="button" disabled={busy} onClick={()=>select(tasks.taskRefs[0])}>Retry retained task</button></p>}
    {reading&&<FactoryAttemptHandoffDocument reading={reading} callbacks={callbacks}/>}
  </section>;
}
function message(reason:unknown) { return reason instanceof Error&&reason.message?reason.message:String(reason); }
