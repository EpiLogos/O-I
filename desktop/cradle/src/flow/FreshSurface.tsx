import {useEffect,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import "./flow.css";
import {Glyph} from "../workspace/Glyph";
import {DOCUMENT_FORMS} from "./documentForms";
import {WelcomePrompt} from "./WelcomePrompt";
import {scopeProject,useScope} from "../workspace/scope";
export function FreshSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const scope=useScope();
 // The new-tab form picker reads the one scope (10-SIDEBARS §3.6 rule 2).
 const [project,setProject]=useState(binding.project??scopeProject(scope)??"");
 const [busy,setBusy]=useState(false);const [error,setError]=useState<string>();
 useEffect(()=>{const done=(event:Event)=>{const detail=(event as CustomEvent<{id:string;error?:string}>).detail;if(detail.id===binding.id){setBusy(false);setError(detail.error);}};window.addEventListener("oi:fresh-result",done);return()=>window.removeEventListener("oi:fresh-result",done);},[binding.id]);
 const choose=(kind:string)=>{if(busy)return;setBusy(true);setError(undefined);window.dispatchEvent(new CustomEvent("oi:fresh-choice",{detail:{id:binding.id,kind,project:project||undefined}}));};
 return <section className="fresh-surface" aria-label="New tab"><div>
  <header className="welcome-prompt"><WelcomePrompt placement="opening"/></header>
  <nav className="rest-actions" aria-label="Start working">
   <button disabled={busy} onClick={()=>choose("flow")}><Glyph name="file" size={13}/><span>Start writing</span></button>
   <button disabled={busy} onClick={()=>choose("search")}><Glyph name="search" size={13}/><span>Search</span></button>
   <button disabled={busy} onClick={()=>choose("library")}><Glyph name="wiki" size={13}/><span>Browse library</span></button>
   <button disabled={busy} onClick={()=>choose("browser")}><Glyph name="explore" size={13}/><span>Open browser</span></button>
   <button disabled={busy} onClick={()=>choose("terminal")}><Glyph name="terminal" size={13}/><span>Open terminal</span></button>
  </nav>
  <details className="fresh-more"><summary>Project and document forms</summary>
   {/* Every form creates a COPY in place under the chosen register's human
     * ground (flow/createInPlace.ts) — never the template itself. */}
   <label>Project <select aria-label="New tab project" value={project} onChange={e=>setProject(e.target.value)}><option value="">Central workspace</option>{kernel.snapshot.navigator?.root?.work.projects.map(p=><option key={p.path} value={p.name}>{p.name}</option>)}</select></label>
   <nav className="fresh-docforms" aria-label="Open a document form">{DOCUMENT_FORMS.filter(form=>(form.kind!=="document-vision"&&form.kind!=="document-mockup")||!!project).map(form=><button key={form.kind} disabled={busy} title={form.hint} onClick={()=>choose(form.kind)}><b>{form.label}</b><span>{form.hint}</span></button>)}</nav>
  </details>
  {busy&&<p role="status">Opening…</p>}{error&&<p role="alert">{error}</p>}
 </div></section>;
}
