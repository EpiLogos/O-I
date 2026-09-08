import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import "./flow.css";
export function FreshSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const [project,setProject]=useState(binding.project??"");
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string>();
 useEffect(()=>{const done=(event:Event)=>{const detail=(event as CustomEvent<{id:string;error?:string}>).detail;if(detail.id===binding.id){setBusy(false);setError(detail.error);}};window.addEventListener("oi:fresh-result",done);return()=>window.removeEventListener("oi:fresh-result",done);},[binding.id]);
 const choose=(kind:string)=>{if(busy)return;setBusy(true);setError(undefined);window.dispatchEvent(new CustomEvent("oi:fresh-choice",{detail:{id:binding.id,kind,project:project||undefined}}));};
 return <section className="fresh-surface" aria-label="Fresh canvas"><div><h2>What would you like to work on?</h2><label>Project <select aria-label="New tab project" value={project} onChange={e=>setProject(e.target.value)}><option value="">Choose a project</option>{kernel.snapshot.navigator?.root?.work.projects.map(p=><option key={p.path} value={p.name}>{p.name}</option>)}</select></label><button disabled={busy} onClick={()=>choose("flow")}>Write in Flow.md</button><button disabled={busy} onClick={()=>choose("search")}>Search your world</button><button disabled={busy} onClick={()=>choose("terminal")}>Open terminal</button><button disabled={busy} onClick={()=>choose("browser")}>Browse the web</button>{error&&<p role="alert">{error}</p>}<p className="fresh-provenance">Flow writing is an ordinary file in the project’s Central NOW field. Nothing is sent to an agent until you choose to send it.</p></div></section>;
}
