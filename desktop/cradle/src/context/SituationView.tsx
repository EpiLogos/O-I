import {MODE_CURATION} from "../workspace/mode";
import {useSituation} from "./SituationContext";
import {useSyncExternalStore} from "react";
import {fieldContextLines} from "../field/fieldHost";
import {fieldContextKept,setFieldContextKept,subscribeFieldContextKept} from "./fieldContext";
import {RawDisclosure} from "../shared/contributionPresentation";
// @ts-ignore -- names from the composed reading, without changing its identity.
import {subjectLabel} from "../../../../shared-field/presentation-text.mjs";

export function SituationView() {
  const situation=useSituation();
  if(!situation)return null;
  const current=situation.currentPlace;
  const recent=situation.places.filter(place=>place.presence==="recent").slice(0,4);
  const resident=situation.surfaces.filter(surface=>surface.presence==="resident"||surface.presence==="detached").length;
  const enabled=situation.capabilities.presentation.filter(action=>action.enabled);
  const open=(place:typeof current)=>{
    if(!place?.location)return;
    window.dispatchEvent(new CustomEvent("oi:panel-open-subject",{detail:{subject:{ref:place.ref,title:place.title,location:place.location}}}));
  };
  return <section className="situation-reading" aria-label="Present situation" data-schema={situation.schema}>
    <header><strong>Present</strong><small>{MODE_CURATION[situation.workspace.mode].label} · {subjectLabel(situation.workspace,"Unnamed workspace")}</small></header>
    <div className="situation-primary">
      <span>{subjectLabel(situation.subject,subjectLabel(situation.focus,"Workspace"))}</span>
      <small>{situation.workspace.project??"Central"}{resident ? " · " + resident + " resident" : ""}</small>
    </div>
    {current&&<button type="button" className="situation-place" disabled={!current.location} onClick={()=>open(current)} data-place-ref={current.ref} data-place-path={current.path} title={subjectLabel(current,"Unnamed place")}>
      <span>{subjectLabel(current,"Unnamed place")}</span><small>{current.kind==="knowledge"?"Knowledge page":current.kind==="directory"?"Folder":"File"}{current.project&&` · ${current.project}`}</small>
    </button>}
    {recent.length>0&&<details className="situation-depth"><summary>Recent places · {recent.length}</summary><ul>{recent.map((place,index)=><li key={place.key}><button type="button" className="oi-action" disabled={!place.location} onClick={()=>open(place)}>{subjectLabel(place,`Unnamed place ${index+1}`)}</button><small>{place.path}</small></li>)}</ul></details>}
    {enabled.length>0&&<details className="situation-depth"><summary>Surface capabilities · {enabled.length}</summary><ul>{enabled.map(action=><li key={action.action_ref}><span>{action.title}</span><code>{action.action_ref}</code></li>)}</ul><p className="oi-note">These are Cradle presentation actions. Native semantic actions remain owned and disclosed by their product.</p></details>}
    {situation.field&&<FieldPresent reading={situation.field}/>}
    <p className="situation-law">Present here is not automatically prepared for the Agent.</p>
    <RawDisclosure value={situation} label="Inspect exact situation and sources"/>
  </section>;
}

/** The field's present encounter, as the companion's next turn would name it — with the one switch that decides whether it is
 * prepared for the turn at all. Present here is not prepared; "keep current" is the person's explicit choice. */
function FieldPresent({reading}:{reading:NonNullable<ReturnType<typeof useSituation>>["field"] & object}){
  const kept=useSyncExternalStore(subscribeFieldContextKept,fieldContextKept,fieldContextKept);
  return <section className="situation-field" aria-label="Field encounter" data-field-generation={reading.generation}>
    <ul>{fieldContextLines(reading).map(line=><li key={line}><small>{line}</small></li>)}</ul>
    <label className="oi-note"><input type="checkbox" checked={kept} onChange={e=>setFieldContextKept(e.target.checked)}/> Keep this encounter in the Agent's prepared context, current at each turn</label>
  </section>;
}
