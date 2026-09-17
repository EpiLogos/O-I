import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import "./flow.css";
import {WelcomePrompt} from "./WelcomePrompt";
import {DOCUMENT_FORMS} from "./documentForms";
export function FreshSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const [project,setProject]=useState(binding.project??"");
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string>();
 useEffect(()=>{const done=(event:Event)=>{const detail=(event as CustomEvent<{id:string;error?:string}>).detail;if(detail.id===binding.id){setBusy(false);setError(detail.error);}};window.addEventListener("oi:fresh-result",done);return()=>window.removeEventListener("oi:fresh-result",done);},[binding.id]);
 const choose=(kind:string)=>{if(busy)return;setBusy(true);setError(undefined);window.dispatchEvent(new CustomEvent("oi:fresh-choice",{detail:{id:binding.id,kind,project:project||undefined}}));};
 return <section className="fresh-surface" aria-label="Fresh canvas"><div><WelcomePrompt paused={busy}/><label>Project <select aria-label="New tab project" value={project} onChange={e=>setProject(e.target.value)}><option value="">Choose a project</option>{kernel.snapshot.navigator?.root?.work.projects.map(p=><option key={p.path} value={p.name}>{p.name}</option>)}</select></label><nav className="fresh-docforms" aria-label="Open a document form">{DOCUMENT_FORMS.map(form=><button key={form.kind} disabled={busy} title={`Open the ${form.label} document form (${form.hint})`} onClick={()=>choose(form.kind)}><b>{form.label}</b><span>{form.hint}</span></button>)}</nav><button disabled={busy} onClick={()=>choose("flow")}>Write</button><button disabled={busy} onClick={()=>choose("search")}>Search</button><button disabled={busy} onClick={()=>choose("terminal")}>Terminal</button>{error&&<p role="alert">{error}</p>}</div></section>;
}
