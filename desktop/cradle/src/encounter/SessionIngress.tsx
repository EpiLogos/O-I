import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {AgentAccompanying} from "../agent/AgentLayer";
import {EncounterList,type EncounterRow} from "./EncounterList";
import {encounter,type EncounterReading} from "./client";
import "./session-observatory.css";

export function SessionIngress({project,selected,onOpen}:{project?:string;selected?:AgentAccompanying;onOpen:(row:EncounterRow)=>Promise<void>}) {
  const kernel=useKernel();const [state,setState]=useState<string>();
  const [opened,setOpened]=useState(false);
  const [error,setError]=useState<string>();
  useEffect(()=>{
    let live=true;let timer:ReturnType<typeof setTimeout>;setState(undefined);
    if(!selected)return;
    const read=async()=>{
      if(document.visibilityState!=="visible"){if(live)timer=setTimeout(read,2000);return;}
      try {
        const view=await encounter<EncounterReading>(kernel.transport,selected.project,{action:"view",agent_session:selected.ref});
        if(live)setState(view.connection?.error?"Failed":view.permissions?.length?"Needs you":view.connection?.state==="TurnInFlight"?"Working":view.connection?.state==="InterruptRequested"?"Stopping":view.connection?.resident?"Ready":"Disconnected");
      } catch {if(live)setState("Unavailable");}
      if(live)timer=setTimeout(read,2000);
    };void read();return()=>{live=false;clearTimeout(timer);};
  },[selected?.ref,selected?.project,kernel.transport]);
  if(!project&&!selected)return null;
  return <div className="session-ingress"><details open={opened} onToggle={event=>setOpened(event.currentTarget.open)}><summary aria-label="Active sessions">{state??"Sessions"}</summary><div className="session-ingress-menu">
    {selected&&<button onClick={()=>void onOpen({...selected,title:"Session Observatory"}).then(()=>setOpened(false)).catch(reason=>setError(String(reason)))}>Open current session</button>}
    {opened&&(project??selected?.project)&&<EncounterList project={(project??selected?.project)!} activeRef={selected?.ref} onOpen={async row=>{await onOpen(row);setOpened(false);}}/>}
    {error&&<p role="alert">{error}</p>}
  </div></details></div>;
}
