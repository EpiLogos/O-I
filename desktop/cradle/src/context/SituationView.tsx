import {MODE_CURATION} from "../workspace/mode";
import {useSituation} from "./SituationContext";

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
    <header><strong>Present</strong><small>{MODE_CURATION[situation.workspace.mode].label} · {situation.workspace.name}</small></header>
    <div className="situation-primary">
      <span>{situation.subject?.title??situation.focus?.title??"Workspace"}</span>
      <small>{situation.workspace.project??"Central"}{resident ? " · " + resident + " resident" : ""}</small>
    </div>
    {current&&<button type="button" className="situation-place" disabled={!current.location} onClick={()=>open(current)} title={current.path??current.ref??current.title}>
      <span>{current.title}</span><small>{current.path??current.ref}</small>
    </button>}
    {recent.length>0&&<details className="situation-depth"><summary>Recent places · {recent.length}</summary><ul>{recent.map(place=><li key={place.key}><button type="button" className="oi-action" disabled={!place.location} onClick={()=>open(place)}>{place.title}</button><small>{place.path}</small></li>)}</ul></details>}
    {enabled.length>0&&<details className="situation-depth"><summary>Surface capabilities · {enabled.length}</summary><ul>{enabled.map(action=><li key={action.action_ref}><span>{action.title}</span><code>{action.action_ref}</code></li>)}</ul><p className="oi-note">These are Cradle presentation actions. Native semantic actions remain owned and disclosed by their product.</p></details>}
    <p className="situation-law">Present here is not automatically prepared for the Agent.</p>
  </section>;
}
