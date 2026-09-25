import {useEffect,useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {ProfileDocumentWire} from "../../kernel/types";
import {Glyph} from "../../workspace/Glyph";

/**
 * Who the person is talking to: the active AIKit profile, shown as an image
 * and a name. The listing is the real one (`profile_list`, the engine `oi
 * profile` drives); the image is the profile's own when its document carries
 * one (`image` / `avatar` / `icon`, a URL or data URI) and a monogram until
 * the profile integration supplies it. This is a display slot, not a picker:
 * choosing a profile stays with Settings → Configuration.
 */
export interface AgentIdentityReading {name:string;ref?:string;description?:string;image?:string;state:"read"|"none"|"reading"|"unavailable"}

/** One `profile_list` read per window, shared by every presenter: each read
 *  is an owner process through the one kernel seam, so the panel and the
 *  chat never queue two of them (or several on remount) ahead of boot. */
let identityRead:{transport:unknown;promise:Promise<Awaited<ReturnType<ReturnType<typeof useKernel>["apply"]>>>}|undefined;
export function useAgentIdentity(fallbackName="World",read=true):AgentIdentityReading {
  const kernel=useKernel();
  const [reading,setReading]=useState<AgentIdentityReading>({name:fallbackName,state:read?"reading":"none"});
  useEffect(()=>{
    // Boot first: the window stays inert until the kernel's first state
    // settles, so an owner read here must never queue ahead of it.
    if(!read||!kernel.stateSettled)return;
    let live=true;
    if(!identityRead||identityRead.transport!==kernel.transport)identityRead={transport:kernel.transport,promise:kernel.apply({op:"profile_list"})};
    const pending=identityRead.promise;
    pending.then(outcome=>{
      if(!live)return;
      if(outcome?.result!=="profile_listing"){setReading({name:fallbackName,state:"unavailable"});return;}
      const active=outcome.profiles.find(profile=>profile.profile_ref===outcome.active_profile_ref);
      if(!active){setReading({name:fallbackName,state:"none"});return;}
      setReading({name:active.title?.trim()||fallbackName||"World",ref:active.profile_ref,description:active.description??undefined,image:imageOf(active),state:"read"});
    }).catch(()=>{if(identityRead?.promise===pending)identityRead=undefined;if(live)setReading({name:fallbackName,state:"unavailable"});});
    return()=>{live=false;};
  },[kernel.transport,kernel.stateSettled,fallbackName,read]);
  return reading;
}

const imageOf=(profile:ProfileDocumentWire):string|undefined=>{
  for(const key of ["image","avatar","icon"]){const value=profile[key];if(typeof value==="string"&&value.trim())return value;}
  return undefined;
};

export function AgentIdentity({identity,situating}:{identity:AgentIdentityReading;situating:string}) {
  const monogram=identity.name.split(/[\s·/-]+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()??"").join("")||"A";
  return <div className="agent-identity" data-state={identity.state} data-profile-ref={identity.ref} title={identity.description??undefined}>
    <span className="agent-identity-image" aria-hidden="true">{identity.image?<img src={identity.image} alt=""/>:identity.state==="read"?monogram:<Glyph name="agent" size={13}/>}</span>
    <span className="agent-identity-text">
      <strong className="agent-identity-name">{identity.name}</strong>
      <small className="agent-identity-line">{identity.state==="reading"?"Reading the profile…":identity.state==="none"?`${situating} · no active profile`:identity.state==="unavailable"?situating:situating}</small>
    </span>
  </div>;
}
