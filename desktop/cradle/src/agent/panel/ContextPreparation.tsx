import {useEffect,useRef,useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {usePacket} from "../../context/packetSlice";
import {SituationView} from "../../context/SituationView";
import {PreparedContextView} from "../../context/PreparedContextView";
import {ActiveContext,type ActiveContextTab} from "../../expressions/ActiveContext";
import {useKernel} from "../../kernel/KernelProvider";

/** The count the strip's Context control carries: the packet as the World
 * Model holds it (packetSlice.ts usePacket; O-I ticket 1005) — the slice
 * PreparedContextView holds, and the edits announced over it. */
function usePreparedCount(project?:string,session?:string):{count?:number;error?:string} {
  const {transport}=useKernel();
  const packet=usePacket(transport,project||undefined,session);
  return packet?.context?{count:packet.context.items.length}:packet?.error?{error:packet.error}:{};
}

export interface ContextPreparationProps {
  project?:string;
  session?:string;
  /** The side pane's live tabs (the active material lanes). */
  tabs?:ActiveContextTab[];
  onActivateTab?:(id:string)=>void;
}

/** The approved study's compact Context control, carried by the material
 * strip: one button reading the real prepared count, opening the selection
 * and preparation disclosures — present situation, the native prepared
 * context (inspect, include/remove, expressions, saved sets), and the
 * active material lanes. The material canvas above keeps its full room. */
export function ContextPreparationButton({project,session,tabs,onActivateTab}:ContextPreparationProps) {
  const {count,error}=usePreparedCount(project,session);
  const [open,setOpen]=useState(false);
  const hostRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:MouseEvent)=>{if(!hostRef.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);}};
    document.addEventListener("mousedown",outside);
    document.addEventListener("keydown",escape,true);
    return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape,true);};
  },[open]);
  return <div className="context-prep-host" ref={hostRef}>
    <button type="button" className="context-prep" aria-haspopup="menu" aria-expanded={open} aria-label="Choose and prepare context"
      title="Context — selection and preparation" data-attention={error?"true":undefined} onClick={()=>setOpen(value=>!value)}>
      <Glyph name="context" size={12}/><span className="context-prep-label">Context</span>
      <span className="context-prep-count">{count===undefined&&error?"!":count??0}</span>
    </button>
    {open&&<div className="oi-menu context-prep-pop" role="group" aria-label="Context selection and preparation">
      <div className="context-prep-scroll">
        <SituationView/>
        <PreparedContextView project={project} session={session}/>
        <ActiveContext tabs={tabs} onActivate={id=>{onActivateTab?.(id);setOpen(false);}}/>
      </div>
    </div>}
  </div>;
}
