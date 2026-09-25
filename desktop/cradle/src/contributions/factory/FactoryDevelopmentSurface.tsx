import {IconTabStrip} from "../../workspace/primitives/IconTabStrip";
import {CanvasHUD} from "../../workspace/primitives/CanvasHost";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {scrollWithin} from "../../shared/scrollWithin";
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import {handToPanelInspect} from "../../agent/planes/panelInspect";
import {buildSnapshot,developmentRead,workcellStatus,type WorkcellStatus} from "./development";
import {BuildSurface} from "./BuildSurface";
import {factoryBuildFixture} from "./fixtures/factory-build";
import type {FactoryBuildView} from "./types";
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
/** The kernel carries the owner's snapshot document (contract + provenance +
 * view); the desk renders the view inside it. */
function buildViewOf(value:unknown):FactoryBuildView|undefined {
 if(isBuildView(value))return value;
 const document=value as {view?:unknown}|undefined;
 return isBuildView(document?.view)?document.view as FactoryBuildView:undefined;
}
const SECTIONS=[{id:"build",label:"Build view"},{id:"conversations",label:"Conversations"},{id:"development",label:"Development"},{id:"placement",label:"Placement"}] as const;
type SectionId=typeof SECTIONS[number]["id"];

/** Dev-only testing default: one seeded specimen at a stable path, so the
 * desk can be seen and tested by hand without typing refs. The local
 * Workcell is already bootstrapped; nothing here is a production default. */
const TESTING_SPECIMEN={statePath:"/Users/admin/.local/state/oi/testing/factory-desk-provider.json",projectRef:"project:01ARZ3NDEKTSV4RRFFQ69G5FAW",runRef:"run:01ARZ3NDEKTSV4RRFFQ69G5FAA"} as const;

/** Factory's centre work surface: the project's agent conversations and the
 * owner's development work, as navigable sections of one scroll region.
 *
 * Development (the 6D consumer, queue cell 3 + cell B): Factory's own
 * developmental reads as first-class rows — the project read discloses the
 * journey registry, each journey row expands through the owner's journey read,
 * its runRefs render as run rows, and each run row expands into the Trajectory
 * presentation: chronological execution rows in owner order, expandable
 * detail, verbatim fields, and the execution-telemetry read whose
 * unavailability renders in the owner's own words. The build view rides the
 * re-pinned `build snapshot <state> <project-ref> <run-ref>` grammar. The
 * developmental state path has no owner-side disclosure on this cut, so it is
 * operator-typed fallback until the owner composes one; no Factory or Workcell
 * read runs before the explicit act. Factory owns developmental Journey/Run;
 * Workcell owns placement; Actuation owns activity — the desktop resolves the
 * native chain, never the old label.
 *
 * Conversations: the project's attached encounters through the one
 * EncounterList. Opening one is the composition root's act (`onOpenEncounter`
 * opens it as an ordinary centre tab); without it the list is read-only.
 *
 * Activity, Context, Inspect and returned material belong to the accompanying
 * panel in this mode and are not drawn here. A journey, run or execution is
 * handed to the panel's Inspect plane through the `oi:panel-inspect` window
 * event (see src/agent/planes/panelInspect.ts — AgentLayer listens). */
export function FactoryDevelopmentSurface({project:projectProp,onOpenEncounter}:{
 /** The project whose conversations are listed. Default: the project the navigator is browsing. */
 project?:string;
 onOpenEncounter?:(row:EncounterRow)=>void|Promise<void>;
}={}) {
 const kernel=useKernel();
 const conversationsProject=projectProp??kernel.snapshot.navigator?.project?.project.name;
 const testingDesk=import.meta.env.DEV;
 const [statePath,setStatePath]=useState(testingDesk?TESTING_SPECIMEN.statePath:"");
 const [projectRef,setProjectRef]=useState(testingDesk?TESTING_SPECIMEN.projectRef:"");
 const [runRefInput,setRunRefInput]=useState(testingDesk?TESTING_SPECIMEN.runRef:"");
 const [project,setProject]=useState<unknown>();
 const [units,setUnits]=useState<unknown>();
 const [buildView,setBuildView]=useState<unknown>();
 const [status,setStatus]=useState<WorkcellStatus>();
 const [statusNote,setStatusNote]=useState<string>();
 const [busy,setBusy]=useState(false);
 const [section,setSection]=useState<SectionId>("build");
 const sections=useRef<Partial<Record<SectionId,HTMLElement|null>>>({});
 // The nav names the section in view. It jumps; it never hides a section, so
 // every control stays reachable in place.
 useEffect(()=>{
  if(typeof IntersectionObserver==="undefined")return;
  const visible=new Set<SectionId>();
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries){const id=(entry.target as HTMLElement).dataset.section as SectionId;if(entry.isIntersecting)visible.add(id);else visible.delete(id);}
   const first=SECTIONS.find(candidate=>visible.has(candidate.id));
   if(first)setSection(first.id);
  },{rootMargin:"-96px 0px -55% 0px"});
  for(const element of Object.values(sections.current))if(element)observer.observe(element);
  return()=>observer.disconnect();
 },[]);
 const jump=(id:SectionId)=>{setSection(id);scrollWithin(sections.current[id],"start");};
 const runRead=async(read:"project"|"workflow-units")=>{
  setBusy(true);
  try{
   if(read==="project"){
    const data=await developmentRead(kernel.transport,statePath.trim(),read,projectRef.trim()||undefined);
    setProject(data);
   }
   else setUnits(await developmentRead(kernel.transport,statePath.trim(),read));
  }catch(error){
   const refusal=String(error);
   if(read==="project")setProject({__refused:refusal});else setUnits({__refused:refusal});
  }finally{setBusy(false);}
 };
 const readBuildView=async()=>{
  setBusy(true);
  try{
   const data=await buildSnapshot(kernel.transport,statePath.trim(),projectRef.trim(),runRefInput.trim());
   setBuildView(data);
  }
  catch(error){setBuildView({__refused:String(error)});}
  finally{setBusy(false);}
 };
 // Dev builds open onto the DSH-shaped fixture desk — the maximal native
 // trajectory from the owner Factory UI package — so the UI can be seen and
 // tested by hand with realistic density, no kernel read required. An
 // explicit "Read build view" replaces it with the owner's served view.
 const loadFixture=import.meta.env.DEV;
 const loadStatus=async()=>{
  setBusy(true);setStatusNote(undefined);
  try{setStatus(await workcellStatus(kernel.transport));}
  catch(error){setStatus(undefined);setStatusNote(String(error));}
  finally{setBusy(false);}
 };
 const journeys=(project as {journeys?:unknown[]}|undefined)?.journeys;
 const section_=(id:SectionId)=>(element:HTMLElement|null)=>{sections.current[id]=element;};
 return <main className="factory-development" aria-label="Factory development" data-busy={busy?"true":undefined}>
  <CanvasHUD className="factory-development-top">
   <header className="factory-development-header oi-context-head">
    <div className="oi-context-head-title"><h2>Factory development</h2>
    <small>Agent conversations and the owner&apos;s developmental reads. Dev builds open onto the seeded testing specimen; production names its own developmental state path.</small></div>
    {busy&&<span className="oi-state" role="status">Reading…</span>}
   </header>
   <IconTabStrip aria-label="Factory sections" items={SECTIONS.map(entry=>({id:entry.id,label:entry.label,icon:"factory"}))} current={section} onSelect={id=>jump(id as SectionId)}/>
  </CanvasHUD>

  <section ref={section_("build")} data-section="build" className="factory-section factory-development-build" aria-label="Build view">
   <header className="oi-panel-head factory-band"><h3 className="oi-panel-head-title">Build view</h3>
    <span className="factory-band-caption">{buildViewOf(buildView)?"read":loadFixture?"fixture":buildView!==undefined?"refused":"not read"}</span>
   </header>
   <div className="factory-panel-body">
    <div className="factory-development-form">
     <div className="factory-field-row">
      <span className="factory-field-label" id="factory-run-ref-label">Run ref</span>
      <input className="oi-input" aria-label="Run ref for build view" value={runRefInput} onChange={event=>setRunRefInput(event.target.value)} placeholder="run:…" spellCheck={false} autoComplete="off"/>
     </div>
     <div className="oi-action-group"><button className="oi-action" disabled={busy||!statePath.trim()||!projectRef.trim()||!runRefInput.trim()} onClick={()=>void readBuildView()}>Read build view</button></div>
    </div>
    {buildView===undefined&&<p className="oi-note">The desk appears once the owner serves the build view; selecting a span hands it to the panel&apos;s Inspect plane.</p>}
    {(() => {
      const served=buildViewOf(buildView);
      const deskView=served??(loadFixture?factoryBuildFixture:undefined);
      if(!deskView)return buildView!==undefined?<DevelopmentReading heading="Build view" data={buildView}/>:<p className="oi-note">The desk appears once the owner serves the build view; selecting a span hands it to the panel&apos;s Inspect plane.</p>;
      return <div className="factory-build-host">
       <BuildSurface view={deskView}/>
       {served&&<details className="oi-disclosure"><summary>Owner payload (verbatim)</summary><DevelopmentReading heading="Build view" data={buildView}/></details>}
      </div>;
    })()}
   </div>
  </section>

  <section ref={section_("conversations")} data-section="conversations" className="factory-section factory-development-conversations" aria-label="Conversations">
   <header className="oi-panel-head factory-band"><h3 className="oi-panel-head-title">Conversations{conversationsProject&&<small>{conversationsProject}</small>}</h3></header>
   <div className="factory-panel-body">
    {conversationsProject
     ? <><EncounterList project={conversationsProject} variant="panel" onOpen={onOpenEncounter?row=>onOpenEncounter(row):undefined}/>
        <p className="oi-note">{onOpenEncounter?"A conversation opens as a centre tab; its Activity, Context and Inspect stay in the accompanying panel.":"Listed read-only: this surface was given no operation that opens a conversation."}</p></>
     : <p className="oi-empty" data-state="no-project">No project is being browsed, so there are no attached conversations to list. Choose a project in the navigator.</p>}
   </div>
  </section>

  <section ref={section_("development")} data-section="development" className="factory-section" aria-label="Development reads">
   <header className="oi-panel-head factory-band"><h3 className="oi-panel-head-title">Development</h3>
    <span className="factory-band-caption">{journeys?`${journeys.length} journey${journeys.length===1?"":"s"}`:project?"read":"not read"}</span>
   </header>
   <div className="factory-panel-body">
    <div className="factory-development-form">
     <div className="factory-field-row">
      <span className="factory-field-label" id="factory-state-path-label">Developmental state path</span>
      <input className="oi-input" aria-label="Developmental state path" value={statePath} onChange={event=>setStatePath(event.target.value)} placeholder="/absolute/path/to/developmental-state.json" spellCheck={false} autoComplete="off"/>
     </div>
     <div className="factory-field-row">
      <span className="factory-field-label" id="factory-project-ref-label">Project ref</span>
      <input className="oi-input" aria-label="Project ref" value={projectRef} onChange={event=>setProjectRef(event.target.value)} placeholder="project:…" spellCheck={false} autoComplete="off"/>
     </div>
     <div className="factory-development-actions oi-action-group">
      <button className="oi-action" disabled={busy||!statePath.trim()} onClick={()=>void runRead("project")}>Read project</button>
      <button className="oi-action" disabled={busy||!statePath.trim()} onClick={()=>void runRead("workflow-units")}>Read workflow units</button>
     </div>
    </div>
    {!project&&!units&&<p className="oi-note" data-state="at-rest">Nothing has been read. Name the state path, then read the project to list its journeys.</p>}
    {typeof project==="object"&&project!==null?<DevelopmentReading heading="Project reading" data={project}/>:null}
    {Array.isArray(journeys)&&journeys.length?<section className="factory-development-journeys" aria-label="Journey rows">
     <header className="oi-panel-head factory-band"><h3 className="oi-panel-head-title">Journeys</h3><span className="factory-band-caption">{journeys.length}</span></header>
     <div className="factory-registry">{journeys.map((entry,i)=><JourneyRow key={i} statePath={statePath.trim()} journey={entry}/>)}</div>
    </section>:Array.isArray(journeys)?<p className="oi-note">The owner&apos;s project reading names no journeys.</p>:null}
    {typeof units==="object"&&units!==null?<DevelopmentReading heading="Workflow units" data={units}/>:null}
   </div>
  </section>

  <section ref={section_("placement")} data-section="placement" className="factory-section factory-development-status" aria-label="Workcell status">
   <header className="oi-panel-head factory-band"><h3 className="oi-panel-head-title">Workcell placement</h3>
    <span className="factory-band-caption" data-attention={statusNote?"true":undefined}>{status?status.health:statusNote?"refused":"not read"}</span>
    <button className="oi-action" disabled={busy} onClick={()=>void loadStatus()}>Read Workcell status</button>
   </header>
   <div className="factory-panel-body">
    {statusNote&&<p role="alert">{statusNote}</p>}
    {status&&<dl className="oi-kv">
     <dt>Workcell</dt><dd><code className="oi-ref">{status.workcell_ref}</code></dd>
     <dt>Health</dt><dd data-workcell-health={status.health}>{status.health}</dd>
     <dt>Offers</dt><dd>{status.offers}</dd>
     <dt>Providers</dt><dd>{status.providers}</dd>
     <dt>State root</dt><dd><code className="oi-ref">{status.state_root}</code></dd>
    </dl>}
    {!status&&!statusNote&&<p className="oi-note">No placement reading yet — ask explicitly; the desktop never polls placement into existence.</p>}
   </div>
  </section>
 </main>;
}
/** Hand one Factory thing to the accompanying panel's Inspect plane — the
 * centre → panel seam (src/agent/planes/panelInspect.ts). The payload is the
 * owner's own reading, verbatim; the panel shows it and adds nothing. */
function InspectTool({kind,reference,title,payload}:{kind:string;reference:string;title:string;payload:unknown}) {
 return <button className="factory-inspect oi-tool" aria-label={`Inspect ${title} in the panel`} title="Inspect in the panel" onClick={()=>handToPanelInspect({kind,ref:reference,title,payload,source:"Factory development"})}><Glyph name="inspect" size={13}/></button>;
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
   <InspectTool kind="factory-journey" reference={ref} title={`journey ${ref}`} payload={reading&&!(reading as {__refused?:string}).__refused?reading:journey}/>
  </div>
  <details className="oi-disclosure" onToggle={event=>{const next=(event.target as HTMLDetailsElement).open;if(next&&!reading&&!busy)void read();}}>
   <summary>Read journey{busy&&<span className="oi-state" role="status">Reading…</span>}</summary>
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
   {data&&!data.__refused&&<InspectTool kind="factory-run" reference={runRef} title={`run ${runRef}`} payload={reading}/>}
  </div>
  <details className="oi-disclosure" onToggle={event=>{const next=(event.target as HTMLDetailsElement).open;if(next&&!reading&&!busy)void read();}}>
   <summary>Read run{busy&&<span className="oi-state" role="status">Reading…</span>}</summary>
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
        <InspectTool kind="factory-execution" reference={row.executionRef??`${runRef}#${i}`} title={`execution ${row.executionRef??i}`} payload={execution}/>
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
  {asked&&!telemetry&&<p className="oi-note" role="status">Reading execution telemetry…</p>}
  {data?.__refused&&<p role="alert" data-owner-refusal={data.__refused}>The owner refused the telemetry read: {data.__refused}</p>}
  {Boolean(telemetry)&&!data?.__refused&&<p role="status">The owner's telemetry reading rendered beside the run.</p>}
 </div>;
}
function DevelopmentReading({heading,data}:{heading:string;data:unknown}):ReactNode {
 const refused=(data as {__refused?:string})?.__refused;
 if(refused)return <section className="factory-development-reading" data-reading-refused="true"><h3>{heading}</h3><p role="alert">The owner refused the read: {refused}</p></section>;
 const contract=(data as {contract?:string})?.contract??"";
 return <section className="factory-development-reading" data-contract={contract}><h3>{heading}{contract&&<code className="oi-ref">{contract}</code>}</h3>
  <pre data-owner-payload={contract}>{JSON.stringify(data,null,1)}</pre>
 </section>;
}
