import {useCallback, useEffect, useRef, useState} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {developmentRead} from "./development";
import {listFactoryAttemptTasks} from "./attempt-task";
import {BuildSurface} from "./BuildSurface";
import type {FactoryBuildView} from "./types";

/** Persist only explicit Factory owner inputs. A Project name is never a
 * substitute for its canonical ref. */
export interface FactoryLocator {
  statePath: string;
  /** Factory-internal ref returned by the owner link; never inferred from Central. */
  projectRef?: string;
  centralProjectRef?: string;
  runRef?: string;
  telemetryRef?: string;
}

interface JourneySummary {journeyRef: string; frontier?: string; status?: string; runRefs?: string[]}
interface ProjectReading {contract: string; projectRef: string; journeys: JourneySummary[]}
interface JourneyReading {contract: string; journeyRef: string; frontier?: string; status?: string; runRefs: string[]}
interface RunReading {contract: string; runRef: string; projectRef: string}
interface BuildSnapshot {contract: string; view: FactoryBuildView}
type HandoffAvailability={kind:"idle"}|{kind:"checking"}|{kind:"empty"}|{kind:"available";taskRefs:string[]}|{kind:"unavailable";detail:string};
interface CentralProjectLinkReading {contract: string; link: {factoryProjectRef: string; centralProjectRef: string}; project: ProjectReading}

function projectReading(value: unknown): value is ProjectReading {
  const reading=value as Partial<ProjectReading>|undefined;
  return reading?.contract==="factory.project-reading/v1" && typeof reading.projectRef==="string" && Array.isArray(reading.journeys);
}
function journeyReading(value: unknown): value is JourneyReading {
  const reading=value as Partial<JourneyReading>|undefined;
  return reading?.contract==="factory.journey-reading/v1" && typeof reading.journeyRef==="string" && Array.isArray(reading.runRefs);
}
function runReading(value: unknown): value is RunReading {
  const reading=value as Partial<RunReading>|undefined;
  return reading?.contract==="factory.run-reading/v1" && typeof reading.runRef==="string" && typeof reading.projectRef==="string";
}
function buildReading(value: unknown): value is BuildSnapshot {
  const reading=value as Partial<BuildSnapshot>|undefined;
  return reading?.contract==="factory.build-view/v1" && typeof reading.view==="object" && reading.view!==null;
}
function centralProjectLinkReading(value: unknown): value is CentralProjectLinkReading {
 const reading=value as Partial<CentralProjectLinkReading>|undefined;
 return reading?.contract==="factory.central-project-link-reading/v1" && typeof reading.link?.factoryProjectRef==="string" && typeof reading.link?.centralProjectRef==="string" && projectReading(reading.project);
}

/** Centre-plane Runs/Build reader. It never polls, guesses a Project ref, or
 * creates a second Factory execution model. */
export function FactoryRunsSurface({locator,boundProjectRef,project:projectName,onOpenWorkingSurface,onLocator,onOpenHandoff}:{onOpenHandoff:(statePath:string,runRef:string)=>Promise<void>;locator?:FactoryLocator;boundProjectRef?:string;project?:string;onOpenWorkingSurface:(selection:import("../../encounter/working-surface").WorkingSurfaceSelection)=>Promise<void>;onLocator:(value:FactoryLocator)=>void}) {
 const kernel=useKernel();
 const [statePath,setStatePath]=useState(locator?.statePath??"");
 const [projectRef,setProjectRef]=useState(locator?.centralProjectRef??boundProjectRef??"");
 const [project,setProject]=useState<ProjectReading>();
 const [journeys,setJourneys]=useState<Record<string,JourneyReading|undefined>>({});
 const [selectedRunReading,setSelectedRunReading]=useState<RunReading>();
 const [build,setBuild]=useState<BuildSnapshot>();
 const [handoff,setHandoff]=useState<HandoffAvailability>({kind:"idle"});
 const [selectedRun,setSelectedRun]=useState(locator?.runRef);
 const [requestedRun,setRequestedRun]=useState(locator?.runRef??"");
 const [error,setError]=useState<string>();
 const [busy,setBusy]=useState(false);
 const request=useRef(0);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 const current=useCallback((generation:number)=>mounted.current&&request.current===generation,[]);

 const readBuild=useCallback(async(path:string,ref:string,runRef:string,generation:number)=>{
  if(!current(generation))return;
  const snapshot=await developmentRead(kernel.transport,path,"build",runRef);
  if(!current(generation))return;
  if(!buildReading(snapshot)||snapshot.view.project.projectRef!==ref||snapshot.view.run.runRef!==runRef)throw new Error("Factory returned a Build view for a different Project or Run");
  setBuild(snapshot);
 },[current,kernel.transport]);

 const readHandoffAvailability=useCallback(async(path:string,runRef:string,generation:number)=>{
  if(!current(generation))return;
  setHandoff({kind:"checking"});
  try {const reading=await listFactoryAttemptTasks(kernel.transport,path,runRef);
   if(!current(generation))return;
   setHandoff(reading.taskRefs.length>0?{kind:"available",taskRefs:reading.taskRefs}:{kind:"empty"});
  } catch(reason) {if(current(generation))setHandoff({kind:"unavailable",detail:String(reason)});}
 },[current,kernel.transport]);

 const readRun=useCallback(async(path:string,ref:string,runRef:string,generation:number)=>{
  if(!current(generation))return;
  setBusy(true);setError(undefined);setSelectedRun(runRef);setSelectedRunReading(undefined);setBuild(undefined);setHandoff({kind:"idle"});
  try{const reading=await developmentRead(kernel.transport,path,"run",runRef);
   if(!current(generation))return;
   if(!runReading(reading)||reading.runRef!==runRef||reading.projectRef!==ref)throw new Error("Factory returned an incompatible Run reading");
   setSelectedRunReading(reading);
   const [buildOutcome]=await Promise.allSettled([
    readBuild(path,ref,runRef,generation),
    readHandoffAvailability(path,runRef,generation),
   ]);
   if(buildOutcome.status==="rejected")throw buildOutcome.reason;
  }catch(reason){if(current(generation))setError(String(reason));}
  finally{if(current(generation))setBusy(false);}
 },[current,kernel.transport,readBuild,readHandoffAvailability]);

 const readJourney=useCallback(async(path:string,journeyRef:string,generation:number)=>{
  if(!current(generation))return undefined;
  setBusy(true);setError(undefined);
  try{const reading=await developmentRead(kernel.transport,path,"journey",journeyRef);
   if(!current(generation))return undefined;
   if(!journeyReading(reading)||reading.journeyRef!==journeyRef)throw new Error("Factory returned an incompatible Journey reading");
   setJourneys(existing=>({...existing,[journeyRef]:reading}));
   return reading;
  }catch(reason){if(current(generation))setError(String(reason));return undefined;}
  finally{if(current(generation))setBusy(false);}
 },[current,kernel.transport]);

 const readProject=useCallback(async(path:string,ref:string,runRef:string|undefined,generation:number)=>{
  if(!current(generation))return;
  setBusy(true);setError(undefined);
  try{const reading=await developmentRead(kernel.transport,path,"project",ref);
   if(!current(generation))return;
   if(!projectReading(reading)||reading.projectRef!==ref)throw new Error("Factory returned an incompatible Project reading");
   setProject(reading);
   if(!runRef)return;
   for(const journey of reading.journeys){
    const runs=journey.runRefs??[];
    const detail: JourneyReading|undefined=runs.includes(runRef)?undefined:await readJourney(path,journey.journeyRef,generation);
    if(!current(generation))return;
    if((detail?.runRefs??runs).includes(runRef)){await readRun(path,ref,runRef,generation);return;}
   }
   if(current(generation))await readRun(path,ref,runRef,generation);
  }catch(reason){if(current(generation))setError(String(reason));}
  finally{if(current(generation))setBusy(false);}
 },[current,kernel.transport,readJourney,readRun]);

 const readCentralProject=useCallback(async(path:string,centralRef:string,runRef:string|undefined,generation:number)=>{
  if(!current(generation))return;
  setBusy(true);setError(undefined);
  try { const reading=await developmentRead(kernel.transport,path,"central-project-link-read",centralRef);
   if(!current(generation))return;
   if(!centralProjectLinkReading(reading)||reading.link.centralProjectRef!==centralRef||reading.project.projectRef!==reading.link.factoryProjectRef) throw new Error("Factory returned an incompatible Central Project link reading");
   await readProject(path,reading.link.factoryProjectRef,runRef,generation);
  } catch(reason) { if(current(generation))setError(String(reason)); }
  finally { if(current(generation))setBusy(false); }
 },[current,kernel.transport,readProject]);

 const locatorKey=[locator?.statePath??"",locator?.centralProjectRef??"",locator?.runRef??""].join("\u0000");
 useEffect(()=>{
  const generation=++request.current;
  const path=locator?.statePath??"",ref=locator?.centralProjectRef??boundProjectRef??"",run=locator?.runRef;
  setStatePath(path);setProjectRef(ref);setSelectedRun(run);setRequestedRun(run??"");setProject(undefined);setJourneys({});setSelectedRunReading(undefined);setBuild(undefined);setHandoff({kind:"idle"});setError(undefined);setBusy(false);
  if(path&&ref)void readCentralProject(path,ref,run,generation);
 },[locatorKey,boundProjectRef,readCentralProject]);

 const connect=()=>{
  const path=statePath.trim(),ref=projectRef.trim();if(!path||!ref)return;
  onLocator({statePath:path,centralProjectRef:ref,...(requestedRun.trim()?{runRef:requestedRun.trim()}:{})});
 };
 const selectRun=(runRef:string)=>{
  const centralRef=locator?.centralProjectRef??boundProjectRef;
  if(!locator?.statePath||!centralRef)return;
  onLocator({statePath:locator.statePath,centralProjectRef:centralRef,runRef});
 };
 const openJourney=(journeyRef:string)=>{
  if(!locator?.statePath)return;
  const generation=request.current;
  void readJourney(locator.statePath,journeyRef,generation);
 };
 const listed=project?.journeys??[];
 const sourceControl=<details className="factory-source-picker"><summary>{locator?"Factory source":"Connect Factory source"}</summary><form onSubmit={event=>{event.preventDefault();connect();}}>
   <label>Developmental state path<input value={statePath} onChange={event=>setStatePath(event.target.value)} required spellCheck={false} autoComplete="off"/></label>
   <label>Central Project ref<input value={projectRef} onChange={event=>setProjectRef(event.target.value)} required placeholder="project:…" spellCheck={false} autoComplete="off"/></label>
   <label>Run ref (optional)<input value={requestedRun} onChange={event=>setRequestedRun(event.target.value)} spellCheck={false} autoComplete="off"/></label>
   <button type="submit" disabled={busy}>Read Runs</button>
  </form></details>;
 const retryHandoff=()=>{if(locator?.statePath&&selectedRun)void readHandoffAvailability(locator.statePath,selectedRun,request.current);};
 const handoffControl=handoff.kind==="available"&&locator?.statePath&&selectedRun?<button type="button" onClick={()=>void onOpenHandoff(locator.statePath,selectedRun).catch(reason=>setError(String(reason)))}>Open handoff</button>:handoff.kind==="checking"?<span className="factory-handoff-standing" role="status">Checking retained handoff…</span>:handoff.kind==="empty"?<span className="factory-handoff-standing">No retained handoff</span>:handoff.kind==="unavailable"?<span className="factory-handoff-standing" role="status">Retained handoff unavailable: {handoff.detail}<button type="button" onClick={retryHandoff}>Retry</button></span>:null;
 return <section className="factory-runs" aria-label="Factory Runs and Build">
  {!build&&<header className="factory-runs-heading"><h1>Runs</h1>{sourceControl}</header>}
  {error&&<p className="factory-owner-refusal" role="alert">Factory read unavailable: {error}</p>}
  {!locator&&<p className="factory-runs-empty">Choose a Factory source and Project ref.</p>}
  {locator&&!project&&!error&&<p className="factory-runs-empty">No Runs are loaded.</p>}
  {project&&<div className="factory-runs-layout"><aside className="factory-run-list" aria-label="Factory Journeys and Runs">
   <div className="factory-run-list-heading"><strong>{project.projectRef}</strong><span>{listed.length} Journeys</span></div>
   {listed.length===0&&<p>No Journeys are published for this Project.</p>}
   {listed.map(journey=>{const detail=journeys[journey.journeyRef],runs=detail?.runRefs??journey.runRefs??[];return <section key={journey.journeyRef} className="factory-journey-row">
    <div><code>{journey.journeyRef}</code>{(detail?.frontier??journey.frontier)&&<span>{detail?.frontier??journey.frontier}</span>}{(detail?.status??journey.status)&&<small>{detail?.status??journey.status}</small>}</div>
    {!detail&&<button type="button" disabled={busy} onClick={()=>openJourney(journey.journeyRef)}>Read Journey</button>}
    {detail&&runs.length===0&&<p>No Runs are named by this Journey.</p>}
    {runs.map(runRef=><button key={runRef} type="button" className={selectedRun===runRef?"is-selected":""} disabled={busy} onClick={()=>selectRun(runRef)}><code>{runRef}</code></button>)}
   </section>;})}
  </aside><div className="factory-build-centre">{build?<BuildSurface view={build.view} headerControls={<div className="factory-build-controls">{sourceControl}{handoffControl}</div>} onOpenWorkingSurface={projectName?selection=>onOpenWorkingSurface({...selection,project:projectName}):undefined}/>:selectedRunReading?<p className="factory-runs-empty">The selected Run is loaded; Factory has not returned its Build view.</p>:<p className="factory-runs-empty">Select a published Run.</p>}</div></div>}
  {project&&selectedRunReading&&!build&&handoffControl&&<div className="factory-runs-control-row">{handoffControl}</div>}
 </section>;
}
