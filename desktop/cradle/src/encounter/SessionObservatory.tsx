import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {EncounterSurface} from "./EncounterSurface";
import {encounter,type EncounterReading} from "./client";
import "./session-observatory.css";
import {SessionModelControl} from "./SessionModelControl";

type Plane="Conversation"|"Activity"|"Context"|"Actions"|"Runtime";
/** Additional presentation of an existing native session, never its owner. */
export function SessionObservatory({binding,onOpenWorkingSurface}: {binding:SurfaceBinding;onOpenWorkingSurface:(selection:import("./working-surface").WorkingSurfaceSelection)=>Promise<void>}) {
  const kernel=useKernel();
  const [plane,setPlane]=useState<Plane>("Conversation");
  const [reading,setReading]=useState<EncounterReading>();
  const [error,setError]=useState<string>();
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if(plane!=="Actions"&&plane!=="Runtime")return;
    let live=true;setReading(undefined);setError(undefined);
    encounter<EncounterReading>(kernel.transport,binding.project!,{action:"view",agent_session:binding.ref!})
      .then(value=>{if(live)setReading(value);}).catch(reason=>{if(live)setError(String(reason));});
    return()=>{live=false;};
  },[plane,binding.ref,binding.project,kernel.transport,revision]);
  const inspection=plane==="Actions"||plane==="Runtime";
  return <section className="session-observatory" aria-label="Session Observatory">
    <nav aria-label="Session Observatory planes">{(["Conversation","Activity","Context","Actions","Runtime"] as const).map(name=><button key={name} aria-pressed={plane===name} onClick={()=>setPlane(name)}>{name}</button>)}</nav>
    <EncounterSurface binding={{...binding,view:{encounterPlane:inspection?"Conversation":plane}}} presentation="side" concealed={inspection} onView={()=>{}}/>
    {inspection&&<div className="session-inspection">
      <button onClick={()=>setRevision(value=>value+1)}>Refresh</button>
      {error&&<p role="alert">{error}</p>}
      {!reading&&!error&&<p role="status">Reading session…</p>}
      {reading&&plane==="Actions"&&<ul>{reading.actions?.map(action=><li key={action.ref}><code>{action.ref}</code><span>{action.enabled?"Available":action.reason??"Unavailable"}</span></li>)}</ul>}
      {reading&&plane==="Runtime"&&<>
        <dl><dt>AgentSession</dt><dd>{reading.agent_session}</dd><dt>SessionSpace</dt><dd>{binding.encounter?.space}</dd><dt>Provider</dt><dd>{reading.connection?.provider?.label??"Not disclosed"}</dd><dt>Connection</dt><dd>{reading.connection?.state??"Not disclosed"}</dd><dt>Native session</dt><dd>{reading.connection?.native_session_id??"Not resident"}</dd><dt>Permission authority</dt><dd>{reading.permission_authority??"Not disclosed"}</dd></dl>
        <SessionModelControl project={binding.project!} agentSession={binding.ref!}/>
        <button disabled={!binding.project||!binding.ref||!binding.encounter?.space} onClick={()=>{setError(undefined);void onOpenWorkingSurface({project:binding.project!,space:binding.encounter!.space,agentSession:binding.ref!}).catch(reason=>setError(String(reason)));}}>Open working Surface</button>
        <details><summary>Native evidence</summary><pre>{JSON.stringify({connection:reading.connection,actions:reading.actions,permission_authority:reading.permission_authority},null,2)}</pre></details>
      </>}
    </div>}
  </section>;
}
