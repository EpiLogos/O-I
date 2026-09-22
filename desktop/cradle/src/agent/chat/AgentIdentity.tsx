import {useEffect,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {kernelOp} from "../../kernel/bridge";
import {Glyph} from "../../workspace/Glyph";

/** The selected session's native Agent basis, never the global profile. */
export interface AgentIdentityReading {name:string;ref?:string;description?:string;image?:string;sourceState?:"current"|"changed"|"revoked"|"unavailable";state:"read"|"none"|"reading"|"unavailable"}

export function useAgentIdentity(accompanying:{ref:string;project:string}|undefined,read=true):AgentIdentityReading {
  const kernel=useKernel();
  const [reading,setReading]=useState<AgentIdentityReading>({name:"Conversation",state:"none"});
  const sessionRef=accompanying?.ref, project=accompanying?.project;
  useEffect(()=>{
    if(!read||!sessionRef){setReading({name:"Conversation",state:"none"});return;}
    let live=true;
    setReading({name:"Conversation",state:"reading"});
    void kernelOp(kernel.transport,{op:"agent_definition",project:project || null,request:{action:"session",agent_session:sessionRef}}).then(response=>{
      if(response.error || response.outcome?.result!=="agent_definition_reading") throw new Error(response.error ?? "Session Agent reading unavailable");
      const data=response.outcome.data as {session:null|{agent_ref:string;profile_ref:string;profile_revision:string};profile:null|{name?:string;purpose?:string};source_state?:AgentIdentityReading["sourceState"]};
      if(!live)return;
      if(!data.session){setReading({name:"Conversation",state:"none"});return;}
      setReading({name:data.profile?.name || data.session.agent_ref,ref:data.session.agent_ref,sourceState:data.source_state,
        description:`${data.session.profile_ref} · ${data.session.profile_revision}${data.profile?.purpose ? " · "+data.profile.purpose : ""}`,state:"read"});
    }).catch(error=>{if(live)setReading({name:"Conversation",state:"unavailable",description:String(error)});});
    return()=>{live=false;};
  },[kernel.transport,sessionRef,project,read]);
  return reading;
}

export function AgentIdentity({identity,situating}:{identity:AgentIdentityReading;situating:string}) {
  const monogram=identity.name.split(/[\s·/-]+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()??"").join("")||"A";
  return <div className="agent-identity" data-state={identity.state} data-agent-ref={identity.ref} title={identity.description??identity.ref??undefined}>
    <span className="agent-identity-image" aria-hidden="true">{identity.image?<img src={identity.image} alt=""/>:identity.state==="read"?monogram:<Glyph name="agent" size={13}/>}</span>
    <span className="agent-identity-text">
      <strong className="agent-identity-name">{identity.name}</strong>
      <small className="agent-identity-line">{identity.state==="reading"?"Reading session Agent…":identity.state==="unavailable"?"Session Agent could not be read":identity.sourceState&&identity.sourceState!=="current"?`${situating} · source ${identity.sourceState}; session retains its pinned basis`:situating}</small>
    </span>
  </div>;
}
