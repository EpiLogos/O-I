import {useEffect, useRef, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {FactoryAttemptHandoffDocument} from "./FactoryAttemptHandoffDocument";
import {listFactoryAttemptTasks, readFactoryAttemptTask, type FactoryAttemptTaskReading} from "./attempt-task";

/** Loads only Factory's retained attempt relations for one explicit Run. */
export function FactoryHandoffSurface({statePath,runRef}:{statePath:string;runRef:string}) {
  const kernel=useKernel();
  const [taskRefs,setTaskRefs]=useState<string[]>();
  const [selected,setSelected]=useState<string>();
  const [reading,setReading]=useState<FactoryAttemptTaskReading>();
  const [error,setError]=useState<string>();
  const [busy,setBusy]=useState(false);
  const generation=useRef(0);

  useEffect(()=>{
    const current=++generation.current;
    setTaskRefs(undefined);setSelected(undefined);setReading(undefined);setError(undefined);setBusy(true);
    void listFactoryAttemptTasks(kernel.transport,statePath,runRef).then(value=>{
      if(generation.current===current)setTaskRefs(value.taskRefs);
    }).catch(reason=>{
      if(generation.current===current)setError(String(reason));
    }).finally(()=>{
      if(generation.current===current)setBusy(false);
    });
    return ()=>{generation.current++;};
  },[kernel.transport,runRef,statePath]);

  const select=(taskRef:string)=>{
    const current=++generation.current;
    setSelected(taskRef);setReading(undefined);setError(undefined);setBusy(true);
    void readFactoryAttemptTask(kernel.transport,statePath,runRef,taskRef).then(value=>{
      if(generation.current===current)setReading(value);
    }).catch(reason=>{
      if(generation.current===current)setError(String(reason));
    }).finally(()=>{
      if(generation.current===current)setBusy(false);
    });
  };

  return <section className="factory-handoff-surface" aria-label="Factory handoff">
    <header><h1>Handoff</h1></header>
    {error&&<p role="alert">Factory handoff read unavailable: {error}</p>}
    {busy&&!taskRefs&&<p>Reading retained Factory attempts.</p>}
    {taskRefs?.length===0&&<p>Factory has retained no attempt handoff for this Run.</p>}
    {taskRefs&&taskRefs.length>0&&<nav aria-label="Retained Factory tasks"><p>Select a retained task.</p>{taskRefs.map(taskRef=><button key={taskRef} type="button" disabled={busy} aria-pressed={selected===taskRef} onClick={()=>select(taskRef)}><code>{taskRef}</code></button>)}</nav>}
    {reading&&<FactoryAttemptHandoffDocument reading={reading}/>}
  </section>;
}
