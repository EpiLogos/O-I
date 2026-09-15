import {useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {buildSnapshot,developmentRead,workcellStatus,type WorkcellStatus} from "./development";
import {BuildSurface} from "./BuildSurface";
import type {ActionInvocation,FactoryBuildView} from "./types";
import "./development.css";

/** The owner's build view is rendered through the owner's own surface
 * (the captured `factory-ui` BuildSurface: semantic / live working world /
 * trajectory depths, Candidates, Claims/Evidence, HumanRequests, Agencies,
 * Executions, session cards, trace waterfall, span detail) inside the
 * host's container grammar. The host checks the contract shape before
 * handing the payload over; anything else stays a verbatim reading. */
function isBuildView(value:unknown):value is FactoryBuildView {
 const v=value as Partial<FactoryBuildView>|null;
 return !!v&&typeof v==="object"&&!!v.project&&typeof v.project.projectRef==="string"&&!!v.run&&typeof v.run.runRef==="string"&&!!v.frontier&&Array.isArray(v.claims)&&Array.isArray(v.evidence)&&Array.isArray(v.candidates)&&Array.isArray(v.humanRequests)&&Array.isArray(v.agencies)&&Array.isArray(v.executions)&&Array.isArray(v.trajectories)&&Array.isArray(v.actions);
}
/** The 6D consumer (queue cell 3 + cell B): Factory's own developmental reads
 * as first-class rows — the project read discloses the journey registry, each
 * journey row expands through the owner's journey read, its runRefs render as
 * run rows, and each run row expands into the Trajectory presentation:
 * chronological execution rows in owner order, expandable detail, verbatim
 * fields, and the execution-telemetry read whose unavailability renders in
 * the owner's own words. The build view rides the re-pinned
 * `build snapshot <state> <project-ref> <run-ref>` grammar. The developmental
 * state path has no owner-side disclosure on this cut, so it is
 * operator-typed fallback until the owner composes one; nothing reads before
 * the explicit act. Factory owns developmental Journey/Run; Workcell owns
 * placement; Actuation owns activity — the desktop resolves the native chain,
 * never the old label. */
export function FactoryDevelopmentSurface() {
 const kernel=useKernel();
 const [statePath,setStatePath]=useState("");
 const [projectRef,setProjectRef]=useState("");
 const [runRefInput,setRunRefInput]=useState("");
 const [project,setProject]=useState<unknown>();
 const [units,setUnits]=useState<unknown>();
 const [buildView,setBuildView]=useState<unknown>();
 const [status,setStatus]=useState<WorkcellStatus>();
 const [statusNote,setStatusNote]=useState<string>();
 const [busy,setBusy]=useState(false);
 // The owner declares its Actions in the build view; this desktop cut has
 // no native Factory Action dispatch, so a request is recorded and refused
 // in the host's words rather than silently dropped or faked as done.
 const [undispatched,setUndispatched]=useState<ActionInvocation>();
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
 const readBuildView=async()=>{
  setBusy(true);
  try{setBuildView(await buildSnapshot(kernel.transport,statePath.trim(),projectRef.trim(),runRefInput.trim()));}
  catch(error){setBuildView({__refused:String(error)});}
  finally{setBusy(false);}
 };
 const loadStatus=async()=>{
  setBusy(true);setStatusNote(undefined);
  try{setStatus(await workcellStatus(kernel.transport));}
  catch(error){setStatus(undefined);setStatusNote(String(error));}
  finally{setBusy(false);}
 };
 const journeys=(project as {journeys?:unknown[]}|undefined)?.journeys;
 return <main className="factory-development" aria-label="Factory development">
  <header className="factory-development-header oi-context-head">
   <div className="oi-context-head-title"><h2>Factory development</h2>
   <small>Developmental Journey/Run reads through the owner. The developmental state path is yours to name — the owner composes none for this surface on this cut.</small></div>
  </header>
  <section className="factory-development-form">
   <label className="oi-field">Developmental state path<input className="oi-input" aria-label="Developmental state path" value={statePath} onChange={event=>setStatePath(event.target.value)} placeholder="/absolute/path/to/developmental-state.json" spellCheck={false} autoComplete="off"/></label>
   <label className="oi-field">Project ref<input className="oi-input" aria-label="Project ref" value={projectRef} onChange={event=>setProjectRef(event.target.value)} placeholder="project:…" spellCheck={false} autoComplete="off"/></label>
   <div className="factory-development-actions oi-action-group">
    <button className="oi-action" disabled={busy||!statePath.trim()} onClick={()=>void runRead("project")}>Read project</button>
    <button className="oi-action" disabled={busy||!statePath.trim()} onClick={()=>void runRead("workflow-units")}>Read workflow units</button>
    <button className="oi-action" disabled={busy} onClick={()=>void loadStatus()}>Read Workcell status</button>
   </div>
  </section>
  {typeof project==="object"&&project!==null?<DevelopmentReading heading="Project reading" data={project}/>:null}
  {Array.isArray(journeys)&&journeys.length?<section className="factory-development-journeys" aria-label="Journey rows">
   <h3>Journeys</h3>
   {journeys.map((entry,i)=><JourneyRow key={i} statePath={statePath.trim()} journey={entry}/>)}
  </section>:null}
  {typeof units==="object"&&units!==null?<DevelopmentReading heading="Workflow units" data={units}/>:null}
  <section className="factory-development-build" aria-label="Build view">
   <h3>Build view</h3>
   <label className="oi-field">Run ref<input className="oi-input" aria-label="Run ref for build view" value={runRefInput} onChange={event=>setRunRefInput(event.target.value)} placeholder="run:…" spellCheck={false} autoComplete="off"/></label>
   <button className="oi-action" disabled={busy||!statePath.trim()||!projectRef.trim()||!runRefInput.trim()} onClick={()=>void readBuildView()}>Read build view</button>
   {isBuildView(buildView)?<div className="factory-build-host" data-actions="undispatched">
    <p className="oi-note">The owner's Actions are listed as declared; this desktop cut has no native Factory Action dispatch, so choosing one records the request and refuses it here.</p>
    {undispatched&&<p role="alert" data-undispatched-action={undispatched.actionRef}>Action {undispatched.actionRef} on {undispatched.subjectRef} was requested; no native dispatch is available on this desktop cut, so nothing was run.</p>}
    <BuildSurface view={buildView} onAction={setUndispatched}/>
    <details className="oi-disclosure"><summary>Owner payload (verbatim)</summary><DevelopmentReading heading="Build view" data={buildView}/></details>
   </div>:typeof buildView==="object"&&buildView!==null?<DevelopmentReading heading="Build view" data={buildView}/>:null}
  </section>
  <section className="factory-development-status" aria-label="Workcell status">
   <h3>Workcell placement</h3>
   {statusNote&&<p role="alert">{statusNote}</p>}
   {status&&<dl className="oi-kv">
    <dt>Workcell</dt><dd><code className="oi-ref">{status.workcell_ref}</code></dd>
    <dt>Health</dt><dd data-workcell-health={status.health}>{status.health}</dd>
    <dt>Offers</dt><dd>{status.offers}</dd>
    <dt>Providers</dt><dd>{status.providers}</dd>
    <dt>State root</dt><dd><code className="oi-ref">{status.state_root}</code></dd>
   </dl>}
   {!status&&!statusNote&&<p className="oi-note">No placement reading yet — ask explicitly; the desktop never polls placement into existence.</p>}
  </section>
 </main>;
}
/** One journey from the owner's registry. Expanding is an explicit act: the
 * journey read runs only on the reader's request and renders the owner's
 * fields verbatim, its runRefs as run rows. */
function JourneyRow({statePath,journey}:{statePath:string;journey:unknown}) {
 const kernel=useKernel();
 const ref=(journey as {journeyRef?:string})?.journeyRef??"";
 const frontier=(journey as {frontier?:string})?.frontier;
 const status=(journey as {status?:string})?.status;
 const revision=(journey as {revision?:unknown})?.revision;
 const runRefs=(journey as {runRefs?:string[]})?.runRefs??[];
 const [reading,setReading]=useState<unknown>();
 const [busy,setBusy]=useState(false);
 const read=async()=>{
  setBusy(true);
  try{setReading(await developmentRead(kernel.transport,statePath,"journey",ref));}
  catch(error){setReading({__refused:String(error)});}
  finally{setBusy(false);}
 };
 return <div className="factory-journey" data-journey-row={ref}>
  <div className="factory-row-head oi-ref-row">
   <code className="factory-row-ref oi-ref">{ref}</code>
   {frontier&&<span className="factory-row-note oi-state">{frontier}</span>}
   {status&&<span className="factory-row-note oi-state" data-journey-status={status}>{status}</span>}
   {revision!==undefined&&<span className="factory-row-note oi-state">rev {String(revision)}</span>}
  </div>
  <details className="oi-disclosure" onToggle={event=>{const next=(event.target as HTMLDetailsElement).open;if(next&&!reading&&!busy)void read();}}>
   <summary>Read journey</summary>
   {Boolean(reading)&&<DevelopmentReading heading={`Journey ${ref}`} data={reading}/>}
   {runRefs.length?runRefs.map(r=><RunRow key={r} statePath={statePath} runRef={r}/>):<p className="factory-row-note oi-note">The owner's journey names no runs.</p>}
  </details>
 </div>;
}
/** One run of a journey. The Trajectory presentation: the owner's executions
 * as chronological rows (owner order, expandable verbatim detail) and the
 * execution-telemetry read — whose unavailability renders in the owner's own
 * words, never as zero or invented observations. */
function RunRow({statePath,runRef}:{statePath:string;runRef:string}) {
 const kernel=useKernel();
 const [reading,setReading]=useState<unknown>();
 const [telemetry,setTelemetry]=useState<unknown>();
 const [busy,setBusy]=useState(false);
 const read=async()=>{
  setBusy(true);
  try{setReading(await developmentRead(kernel.transport,statePath,"run",runRef));}
  catch(error){setReading({__refused:String(error)});}
  finally{setBusy(false);}
 };
 const readTelemetry=async()=>{
  setBusy(true);
  try{setTelemetry(await developmentRead(kernel.transport,statePath,"execution-telemetry",runRef));}
  catch(error){setTelemetry({__refused:String(error)});}
  finally{setBusy(false);}
 };
 const data=reading as {__refused?:string;contract?:string;lifecycle?:unknown;revision?:unknown;executions?:unknown[]}|undefined;
 return <div className="factory-run" data-run-row={runRef}>
  <div className="factory-row-head oi-ref-row">
   <code className="factory-row-ref oi-ref">{runRef}</code>
  </div>
  <details className="oi-disclosure" onToggle={event=>{const next=(event.target as HTMLDetailsElement).open;if(next&&!reading&&!busy)void read();}}>
   <summary>Read run</summary>
   {data?.__refused&&<p role="alert" data-owner-refusal={data.__refused}>The owner refused the read: {data.__refused}</p>}
   {data&&!data.__refused&&<>
    <dl className="factory-run-facts oi-kv">
     <dt>Contract</dt><dd><code className="oi-ref">{data.contract}</code></dd>
     <dt>Lifecycle</dt><dd data-run-lifecycle={typeof data.lifecycle==="string"?data.lifecycle:undefined}>{JSON.stringify(data.lifecycle)}</dd>
     <dt>Revision</dt><dd>{JSON.stringify(data.revision)}</dd>
    </dl>
    <h4>Executions</h4>
    {Array.isArray(data.executions)&&data.executions.length?<ol className="factory-executions">
     {data.executions.map((execution,i)=>{
      const row=execution as {executionRef?:string;status?:string;agencyRef?:string;agentRef?:string;harnessRef?:string};
      return <li key={row.executionRef??i} className="factory-execution" data-execution-row={row.executionRef??String(i)}>
       <div className="factory-row-head oi-ref-row">
        <code className="oi-ref">{row.executionRef}</code>
        {row.status&&<span className="factory-row-note oi-state" data-execution-status={row.status}>{row.status}</span>}
        {row.agencyRef&&<span className="factory-row-note oi-state">{row.agencyRef}</span>}
        {row.harnessRef&&<span className="factory-row-note oi-state">{row.harnessRef}</span>}
       </div>
       <details className="oi-disclosure"><summary>Detail</summary><pre data-owner-payload="execution">{JSON.stringify(execution,null,1)}</pre></details>
      </li>;})}
    </ol>:<p className="factory-row-note oi-note">The owner's run names no executions.</p>}
    <TelemetryRow telemetry={telemetry} busy={busy} onRead={()=>void readTelemetry()}/>
    <details className="oi-disclosure"><summary>Full run reading</summary><DevelopmentReading heading={`Run ${runRef}`} data={reading}/></details>
   </>}
  </details>
 </div>;
}
function TelemetryRow({telemetry,busy,onRead}:{telemetry:unknown;busy:boolean;onRead:()=>void}) {
 const [asked,setAsked]=useState(false);
 const data=telemetry as {__refused?:string}|undefined;
 return <div className="factory-telemetry">
  {!asked?<button className="oi-action" disabled={busy} onClick={()=>{setAsked(true);onRead();}}>Read execution telemetry</button>:null}
  {data?.__refused&&<p role="alert" data-owner-refusal={data.__refused}>The owner refused the telemetry read: {data.__refused}</p>}
  {Boolean(telemetry)&&!data?.__refused&&<p role="status">The owner's telemetry reading rendered beside the run.</p>}
 </div>;
}
function DevelopmentReading({heading,data}:{heading:string;data:unknown}) {
 const refused=(data as {__refused?:string})?.__refused;
 if(refused)return <section className="factory-development-reading" data-reading-refused="true"><h3>{heading}</h3><p role="alert">The owner refused the read: {refused}</p></section>;
 const contract=(data as {contract?:string})?.contract??"";
 return <section className="factory-development-reading" data-contract={contract}><h3>{heading}</h3>
  <pre data-owner-payload={contract}>{JSON.stringify(data,null,1)}</pre>
 </section>;
}
