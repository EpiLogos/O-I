import {useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {nowRefsOf,useEncounterSession} from "../../encounter/session";
import {deskSnapshot,type DeskAccompanying,type WorkScopeStop} from "./deskTypes";
import "./desk.css";
import type {TrajectoryDeskState} from "./TrajectoryPlane";
import type {ClaimsDeskState} from "./ClaimsEvidencePlane";
import type {ResultsDeskState} from "./ResultsPlane";

/** The compact readable work scope: Day → NOW → task/session → selected act
 * → … built only from refs the session state actually carries (task basis,
 * NOW refs, the session ref, the act/claim/result a sibling plane holds
 * selected — read non-reactively from their own desk state buckets). A
 * missing level is omitted, not faked: there is no owner operation here that
 * discloses a bound Day for a session, so no Day crumb is ever invented.
 * Trajectory and Results render this at their top. */
export function WorkScope({accompanying,onJump}:{accompanying?:DeskAccompanying;onJump?:(stop:WorkScopeStop)=>void}) {
 const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
 const [stack,setStack]=useState<WorkScopeStop[]>([]);
 if(!accompanying||!session)return <nav className="desk-scope" aria-label="Work scope"><span className="desk-scope-empty">No accompanying session.</span></nav>;
 const {state}=session;
 const stops:WorkScopeStop[]=[];
 // NOW — the session's own disclosed NOW refs (an addressed delivery's
 // now_ref, or the task's allocated now_ref). First one only: this is a
 // breadcrumb, not a listing (Context/Inspect hold the full set).
 const now=nowRefsOf(state)[0];
 if(now)stops.push({level:"now",label:"NOW",ref:now.ref});
 // Task/session — the task basis this session actually carries.
 const taskRef=state.task?.request?.central?.task_ref;
 if(taskRef)stops.push({level:"task",label:state.task?.request?.central?.purpose??"Task",ref:taskRef});
 else stops.push({level:"task",label:"Session",ref:state.agentSession});
 // Selected act — Trajectory's own held selection, read non-reactively so a
 // WorkScope in a different plane never subscribes to Trajectory's churn.
 const trajectory=deskSnapshot<TrajectoryDeskState>("trajectory",accompanying.ref);
 if(trajectory?.selectedId!==undefined)stops.push({level:"act",label:`Act · block ${trajectory.selectedId}`,ref:`${accompanying.ref}#${trajectory.selectedId}`});
 // Claim — Claims & evidence's own held selection.
 const claims=deskSnapshot<ClaimsDeskState>("claims",accompanying.ref);
 if(claims?.selectedClaimRef)stops.push({level:"claim",label:"Claim",ref:claims.selectedClaimRef});
 // Result — Results' own held selection.
 const results=deskSnapshot<ResultsDeskState>("results",accompanying.ref);
 if(results?.selectedRef)stops.push({level:"result",label:results.selectedLabel??"Result",ref:results.selectedRef});

 const jump=(stop:WorkScopeStop)=>{setStack(list=>[...list,stop]);onJump?.(stop);};
 const back=()=>setStack(list=>{
  if(list.length<=1)return [];
  const next=list.slice(0,-1);
  onJump?.(next[next.length-1]);
  return next;
 });
 return <nav className="desk-scope" aria-label="Work scope">
  {stack.length>1&&<button type="button" className="oi-tool desk-scope-back" aria-label="Back to the previous stop" onClick={back}><Glyph name="back" size={11}/></button>}
  {stops.length===0&&<span className="desk-scope-empty">No scope refs are disclosed for this session yet.</span>}
  {stops.map((stop,index)=><span key={`${stop.level}-${index}`} className="desk-scope-item">
   {index>0&&<span className="desk-scope-sep" aria-hidden="true">/</span>}
   <button type="button" className="desk-scope-crumb" onClick={()=>jump(stop)}>
    <span className="oi-eyebrow">{stop.label}</span>
    {stop.ref&&<code>{stop.ref.length>18?`${stop.ref.slice(0,17)}…`:stop.ref}</code>}
   </button>
  </span>)}
 </nav>;
}
