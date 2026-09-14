import {useCallback, useEffect, useRef, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {ReturnedDocumentCallbacks} from "../../returns";
import {FactoryAttemptHandoffDocument} from "./FactoryAttemptHandoffDocument";
import {listFactoryAttemptTasks, readFactoryAttemptTask, type FactoryAttemptTaskReading} from "./attempt-task";

/** Loads only Factory's retained attempt relations for one explicit Run. The
 * optional callbacks are supplied by an existing material/native host; opaque
 * Factory artifact refs never become paths or host targets in this surface. */
export function FactoryHandoffSurface({statePath,runRef,callbacks}:{statePath:string;runRef:string;callbacks?:ReturnedDocumentCallbacks}) {
  const kernel=useKernel();
  const [taskRefs,setTaskRefs]=useState<string[]>();
  const [selected,setSelected]=useState<string>();
  const [reading,setReading]=useState<FactoryAttemptTaskReading>();
  const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const generation=useRef(0);

  const select=useCallback((taskRef:string)=>{
    const current=++generation.current;
    setSelected(taskRef);setReading(undefined);setError(undefined);setBusy(true);
    void readFactoryAttemptTask(kernel.transport,statePath,runRef,taskRef).then(value=>{
      if(generation.current===current)setReading(value);
    }).catch(reason=>{
      if(generation.current===current)setError(String(reason));
    }).finally(()=>{
      if(generation.current===current)setBusy(false);
    });
  },[kernel.transport,runRef,statePath]);

  useEffect(()=>{
    const current=++generation.current;
    setTaskRefs(undefined);setSelected(undefined);setReading(undefined);setError(undefined);setBusy(true);
    void listFactoryAttemptTasks(kernel.transport,statePath,runRef).then(value=>{
      if(generation.current!==current)return;
      setTaskRefs(value.taskRefs);
      if(value.taskRefs.length===1)select(value.taskRefs[0]);
    }).catch(reason=>{
      if(generation.current===current)setError(String(reason));
    }).finally(()=>{
      if(generation.current===current)setBusy(false);
    });
    return ()=>{generation.current++;};
  },[kernel.transport,runRef,select,statePath]);

  return <section className="factory-handoff-surface" aria-label="Factory handoff">
    {!reading&&<header><h1>Handoff</h1></header>}
    {error&&<p role="alert">Factory handoff read unavailable: {error}</p>}
    {busy&&!taskRefs&&<p>Reading retained Factory attempts.</p>}
    {taskRefs?.length===0&&<p>Factory has retained no attempt handoff for this Run.</p>}
    {taskRefs?.length===1&&error&&<p><button type="button" disabled={busy} onClick={()=>select(taskRefs[0])}>Retry retained task</button></p>}
    {taskRefs&&taskRefs.length>1&&<nav aria-label="Retained Factory tasks"><p>Select a retained task.</p>{taskRefs.map(taskRef=><button key={taskRef} type="button" disabled={busy} aria-pressed={selected===taskRef} onClick={()=>select(taskRef)}><code>{taskRef}</code></button>)}</nav>}
    {reading&&<FactoryAttemptHandoffDocument reading={reading} callbacks={callbacks}/>}
  </section>;
}
