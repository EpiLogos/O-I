import {useState,useSyncExternalStore} from "react";
import {agentSetupSnapshot,returnFromAgentSetup,subscribeAgentSetup} from "./agentSetup";
export function AgentSetupReturn(){
 const target=useSyncExternalStore(subscribeAgentSetup,agentSetupSnapshot);const [busy,setBusy]=useState(false);const [error,setError]=useState<string>();
 if(!target)return null;
 return <section className="oi-section" aria-label="Agent session repair"><strong>Repair Agent/session setup · {target.project??"Central root"}</strong><p className="oi-note">{target.reason}</p><p className="oi-note">The Agent form and conversation draft remain held. Use the native owner's secure credential setup; credential material is never entered into this conversation or stored by this excursion.</p><button className="oi-action" disabled={busy} onClick={()=>{setBusy(true);void returnFromAgentSetup().catch(error=>setError(String(error))).finally(()=>setBusy(false));}}>Return to preserved composer and re-read readiness</button>{error&&<p role="alert">{error}</p>}</section>;
}
