import {useEffect,useState} from "react";
import type {NativeModelState} from "./nativeModel";

export interface NativeModelActions {refresh():Promise<void>;select(model:string,effort?:string):Promise<void>}
/** Ordinary controls over producer discovery, with no universal roster or Auto policy. */
export function NativeModelControls({state,actions,disabled=false}:{state:NativeModelState;actions:NativeModelActions;disabled?:boolean}){
 const [model,setModel]=useState("");const [effort,setEffort]=useState<string>();const [query,setQuery]=useState("");
 const observation=state.reading?.model_observation;
 useEffect(()=>{setModel(observation?.current_model_id??"");setEffort(observation?.reasoning_effort?.currentValue);},[observation]);
 useEffect(()=>{if(state.phase==="unread")void actions.refresh();},[actions,state.phase]);
 const choices=observation?.available_models.filter(option=>option.modelId===model||`${option.name} ${option.modelId}`.toLowerCase().includes(query.trim().toLowerCase()))??[];
 const busy=state.phase==="reading"||state.phase==="selecting";
 const writable=state.phase==="ready"&&state.reading?.model_controls?.model_selection===true&&!disabled;
 return <section aria-label="Harness model configuration">
  <span className="oi-eyebrow">Harness model</span>
  <p className="oi-note">Choose from the models offered by this conversation’s harness.</p>
  {observation&&<>
   {observation.available_models.length>12&&<label className="oi-field">Find model<input className="oi-input" type="search" aria-label="Find harness model" value={query} onChange={event=>setQuery(event.target.value)}/></label>}
   <label className="oi-field">Model<select className="oi-input" aria-label="Harness model" value={model} disabled={!writable||busy} onChange={event=>setModel(event.target.value)}>
    {!observation.available_models.some(option=>option.modelId===model)&&<option value={model}>{model} · reported current model</option>}
    {choices.map(option=><option key={option.modelId} value={option.modelId} disabled={!!state.reading?.pinned_model_id&&option.modelId!==state.reading.pinned_model_id}>{option.name}</option>)}
   </select></label>
   {observation.reasoning_effort&&<label className="oi-field">Reasoning effort<select className="oi-input" aria-label="Harness reasoning effort" value={effort} disabled={!writable||busy||!state.reading?.model_controls?.reasoning_effort_selection} onChange={event=>setEffort(event.target.value)}>{observation.reasoning_effort.options.map(option=><option key={option.value} value={option.value}>{option.name}</option>)}</select></label>}
   {state.reading?.pinned_model_id&&<details><summary>Model fixed by its source</summary><p className="oi-note">{state.reading.pinned_model_id}</p></details>}
  </>}
  {state.reading&&!state.reading.model_controls?.model_selection&&<p className="oi-note">{state.reading.model_controls?.reason??"The installed owner has not advertised a confirmed in-session selector. This view is read-only."}</p>}
  {state.error&&<p className="oi-refusal" role="alert">{state.error}</p>}
  {state.confirmed&&<p className="oi-note" role="status">Model updated for this conversation.</p>}
  <div className="oi-action-group">
   <button type="button" className="oi-action" disabled={busy} onClick={()=>void actions.refresh()}>{busy?state.phase==="reading"?"Reading…":"Selecting…":"Read native configuration"}</button>
   {state.reading?.model_controls?.model_selection&&<button type="button" className="oi-action" disabled={!writable||busy||!model} onClick={()=>void actions.select(model,state.reading?.model_controls?.reasoning_effort_selection?effort:undefined)}>Apply to this session</button>}
  </div>
 </section>;
}
