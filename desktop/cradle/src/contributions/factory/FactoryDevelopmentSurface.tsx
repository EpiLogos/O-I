import {useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {developmentRead,workcellStatus,type WorkcellStatus} from "./development";
/** The first 6D consumer (queue cell 3): Factory's own developmental reads
 * (Journey/Run/unit family) and Workcell's placement status, rendered
 * verbatim. The developmental state path has no owner-side disclosure on
 * this cut, so it is operator-typed fallback until the owner composes one;
 * nothing reads before the explicit act, and the owner's refusals render in
 * the owner's own words. Factory owns developmental Journey/Run; Workcell
 * owns placement; Actuation owns activity — the desktop resolves the native
 * chain, never the old label. */
export function FactoryDevelopmentSurface() {
 const kernel=useKernel();
 const [statePath,setStatePath]=useState("");
 const [projectRef,setProjectRef]=useState("");
 const [project,setProject]=useState<unknown>();
 const [units,setUnits]=useState<unknown>();
 const [status,setStatus]=useState<WorkcellStatus>();
 const [statusNote,setStatusNote]=useState<string>();
 const [busy,setBusy]=useState(false);
 const runRead=async(read:"project"|"workflow-units")=>{
  setBusy(true);
  try{
   if(read==="project")setProject(await developmentRead(kernel.transport,statePath.trim(),read,projectRef.trim()||undefined));
   else setUnits(await developmentRead(kernel.transport,statePath.trim(),read));
  }catch(error){
   const refusal=String(error);
   if(read==="project")setProject({__refused:refusal});else setUnits({__refused:refusal});
  }finally{setBusy(false);}
 };
 const loadStatus=async()=>{
  setBusy(true);setStatusNote(undefined);
  try{setStatus(await workcellStatus(kernel.transport));}
  catch(error){setStatus(undefined);setStatusNote(String(error));}
  finally{setBusy(false);}
 };
 return <main className="factory-development" aria-label="Factory development">
  <header className="factory-development-header">
   <h2>Factory development</h2>
   <small>Developmental Journey/Run reads through the owner. The developmental state path is yours to name — the owner composes none for this surface on this cut.</small>
  </header>
  <section className="factory-development-form">
   <label>Developmental state path<input aria-label="Developmental state path" value={statePath} onChange={event=>setStatePath(event.target.value)} placeholder="/absolute/path/to/developmental-state.json" spellCheck={false} autoComplete="off"/></label>
   <label>Project ref<input aria-label="Project ref" value={projectRef} onChange={event=>setProjectRef(event.target.value)} placeholder="project:…" spellCheck={false} autoComplete="off"/></label>
   <div className="factory-development-actions">
    <button disabled={busy||!statePath.trim()} onClick={()=>void runRead("project")}>Read project</button>
    <button disabled={busy||!statePath.trim()} onClick={()=>void runRead("workflow-units")}>Read workflow units</button>
    <button disabled={busy} onClick={()=>void loadStatus()}>Read Workcell status</button>
   </div>
  </section>
  {typeof project==="object"&&project!==null?<DevelopmentReading heading="Project reading" data={project}/>:null}
  {typeof units==="object"&&units!==null?<DevelopmentReading heading="Workflow units" data={units}/>:null}
  <section className="factory-development-status" aria-label="Workcell status">
   <h3>Workcell placement</h3>
   {statusNote&&<p role="alert">{statusNote}</p>}
   {status&&<dl>
    <dt>Workcell</dt><dd><code>{status.workcell_ref}</code></dd>
    <dt>Health</dt><dd data-workcell-health={status.health}>{status.health}</dd>
    <dt>Offers</dt><dd>{status.offers}</dd>
    <dt>Providers</dt><dd>{status.providers}</dd>
    <dt>State root</dt><dd><code>{status.state_root}</code></dd>
   </dl>}
   {!status&&!statusNote&&<p>No placement reading yet — ask explicitly; the desktop never polls placement into existence.</p>}
  </section>
 </main>;
}
function DevelopmentReading({heading,data}:{heading:string;data:unknown}) {
 const refused=(data as {__refused?:string})?.__refused;
 if(refused)return <section className="factory-development-reading" data-reading-refused="true"><h3>{heading}</h3><p role="alert">The owner refused the read: {refused}</p></section>;
 const contract=(data as {contract?:string})?.contract??"";
 return <section className="factory-development-reading" data-contract={contract}><h3>{heading}</h3>
  <pre data-owner-payload={contract}>{JSON.stringify(data,null,1)}</pre>
 </section>;
}
