import {useEffect,useRef,useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {nativeContext,PREPARED_CONTEXT_CHANGED,type PreparedContext} from "../../context/nativeContext";
import {SituationView} from "../../context/SituationView";
import {PreparedContextView} from "../../context/PreparedContextView";
import {ActiveContext,type ActiveContextTab} from "../../expressions/ActiveContext";
import {useKernel} from "../../kernel/KernelProvider";

/** The count the strip's Context control carries: read once per scope, then
 * kept live by the one announcement the prepared-context owner already
 * publishes — never a second standing reader beside PreparedContextView. */
function usePreparedCount(project?:string,session?:string):{count?:number;error?:string} {
  const {transport}=useKernel();
  const [reading,setReading]=useState<{count?:number;error?:string}>({});
  useEffect(()=>{
    if(!project){setReading({});return;}
    let active=true;
    void nativeContext(transport,project,session)
      .then(value=>{if(active)setReading({count:value.items.length});})
      .catch(reason=>{if(active)setReading({error:reason instanceof Error?reason.message:String(reason)});});
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent<{project:string;value:PreparedContext}>).detail;
      if(detail?.project!==project||!detail.value)return;
      if(detail.value.scope.agent_session===(session??null))setReading({count:detail.value.items.length});
    };
    window.addEventListener(PREPARED_CONTEXT_CHANGED,changed);
    return()=>{active=false;window.removeEventListener(PREPARED_CONTEXT_CHANGED,changed);};
  },[project,session,transport]);
  return reading;
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
