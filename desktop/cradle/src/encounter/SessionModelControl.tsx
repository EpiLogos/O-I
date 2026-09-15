import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {encounter} from "./client";
import "./session-model-control.css";
interface ModelReading {
  agent_session:string;
  native_session_id:string;
  model_observation:null|{reasoning_effort?:{configId:string;currentValue:string;options:{value:string;name:string;description?:string}[]};current_model_id:string;available_models:{modelId:string;name:string;description?:string}[];standing:string};
  standing:string;
}
/** The owner supplies and validates the exact resident provider choices. */
export function SessionModelControl({project,agentSession}:{project:string;agentSession:string}) {
  const kernel=useKernel();
  const [reading,setReading]=useState<ModelReading>();
  const [selected,setSelected]=useState("");
  const [effort,setEffort]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState<string>();
  const [revision,setRevision]=useState(0);
  const generation=useRef(0);
  useEffect(()=>{
    const current=++generation.current;setPending(false);setReading(undefined);setError(undefined);setSelected("");setEffort("");
    void encounter<ModelReading>(kernel.transport,project,{action:"model-read",agent_session:agentSession}).then(value=>{
      if(value.agent_session!==agentSession)throw new Error("The owner returned a different AgentSession");
      if(generation.current===current){setReading(value);setSelected(value.model_observation?.current_model_id??"");setEffort(value.model_observation?.reasoning_effort?.currentValue??"");}
    }).catch(reason=>{if(generation.current===current)setError(String(reason));});
    return()=>{generation.current++;};
  },[kernel.transport,project,agentSession,revision]);
  const apply=async()=>{
    if(pending||!reading||!reading.model_observation?.available_models.some(model=>model.modelId===selected))return;
    const current=generation.current;
    setPending(true);setError(undefined);
    try {
      const confirmed=await encounter<ModelReading>(kernel.transport,project,{action:"model-select",agent_session:agentSession,provider_model_id:selected,...(reading.model_observation?.reasoning_effort?{provider_reasoning_effort:effort}:{})});
      if(confirmed.agent_session!==agentSession||confirmed.native_session_id!==reading.native_session_id||confirmed.model_observation?.current_model_id!==selected||(reading.model_observation?.reasoning_effort&&confirmed.model_observation?.reasoning_effort?.currentValue!==effort))throw new Error("Model selection was not confirmed for this native session. Refresh before trying again.");
      if(generation.current===current)setReading(confirmed);
    } catch(reason){if(generation.current===current)setError(String(reason));}
    finally{if(generation.current===current)setPending(false);}
  };
  const observation=reading?.model_observation;
  return <section className="session-model-control" aria-label="Session model">
    <label>Model {observation?<select aria-label="Session model" value={selected} disabled={pending} onChange={event=>setSelected(event.target.value)}>
      {!observation.available_models.some(model=>model.modelId===observation.current_model_id)&&<option value={observation.current_model_id}>{observation.current_model_id}</option>}
      {observation.available_models.map(model=><option key={model.modelId} value={model.modelId}>{model.name}</option>)}
    </select>:<span>{reading?"Not disclosed by this session":error?"Unavailable":"Reading…"}</span>}</label>
    {observation?.reasoning_effort&&<label>Reasoning <select aria-label="Session reasoning effort" value={effort} disabled={pending} onChange={event=>setEffort(event.target.value)}>{observation.reasoning_effort.options.map(option=><option key={option.value} value={option.value}>{option.name}</option>)}</select></label>}
    {observation&&<button disabled={pending||(selected===observation.current_model_id&&(!observation.reasoning_effort||effort===observation.reasoning_effort.currentValue))} onClick={()=>void apply()}>{pending?"Applying…":"Apply model"}</button>}
    <button disabled={pending} onClick={()=>setRevision(value=>value+1)}>Refresh model</button>
    {error&&<p role="alert">{error}</p>}
    {reading&&<details><summary>Model evidence</summary><pre>{JSON.stringify(reading,null,2)}</pre></details>}
  </section>;
}
