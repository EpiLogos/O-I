import {useCallback, useEffect, useRef, useState} from "react"
import {useKernel} from "../../kernel/KernelProvider"
import {listFactoryAttemptTasks} from "./attempt-task"
import {BuildSurface} from "./BuildSurface"
import {developmentRead} from "./development"
import {FactoryRunList, FactorySelectedRunSummary} from "./run-list"
import {journeyReading, projectReading, runReading, type JourneyReading, type ProjectReading, type RunReading} from "./run-reading"
import type {FactoryBuildView} from "./types"

/** Persist only explicit Factory owner inputs. A Project name is never a substitute for its canonical ref. */
export interface FactoryLocator { statePath: string; projectRef?: string; centralProjectRef?: string; runRef?: string; telemetryRef?: string }
interface BuildSnapshot {contract: string; view: FactoryBuildView}
type HandoffAvailability={kind:"idle"}|{kind:"checking"}|{kind:"empty"}|{kind:"available";taskRefs:string[]}|{kind:"unavailable";detail:string}
interface CentralProjectLinkReading {contract: string; link: {factoryProjectRef: string; centralProjectRef: string}; project: ProjectReading}

function buildReading(value: unknown): value is BuildSnapshot {
 const reading=value as Partial<BuildSnapshot>|undefined
 return reading?.contract==="factory.build-view/v1" && typeof reading.view==="object" && reading.view!==null
}
function centralProjectLinkReading(value: unknown): value is CentralProjectLinkReading {
 const reading=value as Partial<CentralProjectLinkReading>|undefined
 return reading?.contract==="factory.central-project-link-reading/v1" && typeof reading.link?.factoryProjectRef==="string" && typeof reading.link?.centralProjectRef==="string" && projectReading(reading.project)
}

/** Centre-plane owner reader. It preserves the last compatible read during a failed refresh and never derives refs from labels. */
export function FactoryRunsSurface({locator,boundProjectRef,project:projectName,onOpenWorkingSurface,onLocator,onOpenHandoff}:{onOpenHandoff:(statePath:string,runRef:string)=>Promise<void>;locator?:FactoryLocator;boundProjectRef?:string;project?:string;onOpenWorkingSurface:(selection:import("../../encounter/working-surface").WorkingSurfaceSelection)=>Promise<void>;onLocator:(value:FactoryLocator)=>void}) {
 const kernel=useKernel()
 const [statePath,setStatePath]=useState(locator?.statePath??"")
 const [projectRef,setProjectRef]=useState(locator?.centralProjectRef??boundProjectRef??"")
 const [project,setProject]=useState<ProjectReading>()
 const [journeys,setJourneys]=useState<Record<string,JourneyReading|undefined>>({})
 const [selectedRun,setSelectedRun]=useState<string>()
 const [selectedRunReading,setSelectedRunReading]=useState<RunReading>()
 const [runReadings,setRunReadings]=useState<Record<string,RunReading|undefined>>({})
 const [build,setBuild]=useState<BuildSnapshot>()
 const [pendingRun,setPendingRun]=useState<string>()
 const [handoff,setHandoff]=useState<HandoffAvailability>({kind:"idle"})
 const [requestedRun,setRequestedRun]=useState(locator?.runRef??"")
 const [error,setError]=useState<string>()
 const [busy,setBusy]=useState(false)
 const request=useRef(0), mounted=useRef(true), previousSource=useRef(""), projectReadingRef=useRef<ProjectReading>()
 useEffect(()=>{mounted.current=true; return ()=>{mounted.current=false}},[])
 const current=useCallback((generation:number)=>mounted.current&&request.current===generation,[])

 const readHandoffAvailability=useCallback(async(path:string,runRef:string,generation:number)=>{
  if(!current(generation)) return
  setHandoff({kind:"checking"})
  try {
   const reading=await listFactoryAttemptTasks(kernel.transport,path,runRef)
   if(current(generation)) setHandoff(reading.taskRefs.length?{kind:"available",taskRefs:reading.taskRefs}:{kind:"empty"})
  } catch(reason) { if(current(generation)) setHandoff({kind:"unavailable",detail:String(reason)}) }
 },[current,kernel.transport])

 const readBuild=useCallback(async(path:string,ref:string,runRef:string,generation:number)=>{
  const snapshot=await developmentRead(kernel.transport,path,"build",runRef)
  if(!current(generation)) return
  if(!buildReading(snapshot)||snapshot.view.project.projectRef!==ref||snapshot.view.run.runRef!==runRef) throw new Error("Factory returned a Build view for a different Project or Run")
  setBuild(snapshot)
 },[current,kernel.transport])

 const readRun=useCallback(async(path:string,ref:string,runRef:string,generation:number)=>{
  if(!current(generation)) return
  setPendingRun(runRef); setHandoff({kind:"idle"}); setError(undefined)
  try {
   const reading=await developmentRead(kernel.transport,path,"run",runRef)
   if(!current(generation)) return
   if(!runReading(reading)||reading.runRef!==runRef||reading.projectRef!==ref) throw new Error("Factory returned an incompatible Run reading")
   setSelectedRun(runRef); setSelectedRunReading(reading); setRunReadings(existing=>({...existing,[runRef]:reading}))
   const [buildOutcome]=await Promise.allSettled([readBuild(path,ref,runRef,generation),readHandoffAvailability(path,runRef,generation)])
   if(buildOutcome.status==="rejected") throw buildOutcome.reason
  } catch(reason) { if(current(generation)) setError(String(reason)) }
  finally { if(current(generation)) setPendingRun(undefined) }
 },[current,kernel.transport,readBuild,readHandoffAvailability])

 const readJourney=useCallback(async(path:string,journeyRef:string,expectedProjectRef:string,generation:number)=>{
  const reading=await developmentRead(kernel.transport,path,"journey",journeyRef)
  if(!current(generation)) return undefined
  if(!journeyReading(reading)||reading.journeyRef!==journeyRef||reading.projectRef!==expectedProjectRef) throw new Error("Factory returned an incompatible Journey reading")
  setJourneys(existing=>({...existing,[journeyRef]:reading}))
  return reading
 },[current,kernel.transport])

 const hydrateJourneys=useCallback(async(path:string,reading:ProjectReading,generation:number)=>{
  const outcomes=await Promise.allSettled(reading.journeys.map(journey=>readJourney(path,journey.journeyRef,reading.projectRef,generation)))
  if(!current(generation)) return
  const failed=outcomes.find((outcome):outcome is PromiseRejectedResult=>outcome.status==="rejected")
  if(failed) setError("Some Journey detail could not be refreshed: "+String(failed.reason))
 },[current,readJourney])

 const readProject=useCallback(async(path:string,ref:string,runRef:string|undefined,generation:number)=>{
  if(!current(generation)) return
  setBusy(true); setError(undefined)
  try {
   const reading=await developmentRead(kernel.transport,path,"project",ref)
   if(!current(generation)) return
   if(!projectReading(reading)||reading.projectRef!==ref) throw new Error("Factory returned an incompatible Project reading")
   setProject(reading)
   void hydrateJourneys(path,reading,generation)
   if(runRef) await readRun(path,ref,runRef,generation)
  } catch(reason) { if(current(generation)) setError(String(reason)) }
  finally { if(current(generation)) setBusy(false) }
 },[current,hydrateJourneys,kernel.transport,readRun])

 const readCentralProject=useCallback(async(path:string,centralRef:string,runRef:string|undefined,generation:number)=>{
  setBusy(true); setError(undefined)
  try {
   const reading=await developmentRead(kernel.transport,path,"central-project-link-read",centralRef)
   if(!current(generation)) return
   if(!centralProjectLinkReading(reading)||reading.link.centralProjectRef!==centralRef||reading.project.projectRef!==reading.link.factoryProjectRef) throw new Error("Factory returned an incompatible Central Project link reading")
   await readProject(path,reading.link.factoryProjectRef,runRef,generation)
  } catch(reason) { if(current(generation)) setError(String(reason)) }
  finally { if(current(generation)) setBusy(false) }
 },[current,kernel.transport,readProject])

 const locatorKey=[locator?.statePath??"",locator?.centralProjectRef??"",locator?.runRef??""].join("\u0000")
 useEffect(()=>{
  const generation=++request.current, path=locator?.statePath??"", ref=locator?.centralProjectRef??boundProjectRef??"", run=locator?.runRef
  const sourceIdentity=[path,ref].join("\\u0000"), sourceChanged=previousSource.current!==sourceIdentity
  previousSource.current=sourceIdentity
  setStatePath(path); setProjectRef(ref); setRequestedRun(run??"")
  if(sourceChanged) {
   projectReadingRef.current=undefined
   setProject(undefined); setJourneys({}); setRunReadings({}); setSelectedRun(undefined); setSelectedRunReading(undefined); setBuild(undefined); setPendingRun(undefined); setHandoff({kind:"idle"}); setError(undefined)
   if(path&&ref) void readCentralProject(path,ref,run,generation)
  } else if(path&&ref&&run) {
   const knownProject=projectReadingRef.current
   if(knownProject) void readRun(path,knownProject.projectRef,run,generation)
   else void readCentralProject(path,ref,run,generation)
  }
 },[locatorKey,boundProjectRef,readCentralProject,readRun])

 const refresh=useCallback((path=locator?.statePath??statePath,ref=locator?.centralProjectRef??boundProjectRef??projectRef,run=locator?.runRef??requestedRun)=>{
  const generation=++request.current
  if(path&&ref) void readCentralProject(path,ref,run||undefined,generation)
 },[boundProjectRef,locator?.centralProjectRef,locator?.runRef,locator?.statePath,projectRef,readCentralProject,requestedRun,statePath])
 const connect=()=>{ const path=statePath.trim(),ref=projectRef.trim(),run=requestedRun.trim(); if(path&&ref) { onLocator({statePath:path,centralProjectRef:ref,...(run?{runRef:run}: {})}); refresh(path,ref,run) } }
 const selectRun=(runRef:string)=>{ const centralRef=locator?.centralProjectRef??boundProjectRef; if(locator?.statePath&&centralRef) onLocator({statePath:locator.statePath,centralProjectRef:centralRef,runRef}) }
 const sourceControl=<details className="factory-source-picker"><summary>{locator?"Factory source":"Connect Factory source"}</summary><form onSubmit={event=>{event.preventDefault();connect()}}><label>Developmental state path<input value={statePath} onChange={event=>setStatePath(event.target.value)} required spellCheck={false} autoComplete="off"/></label><label>Central Project ref<input value={projectRef} onChange={event=>setProjectRef(event.target.value)} required placeholder="project:…" spellCheck={false} autoComplete="off"/></label><label>Run ref (optional)<input value={requestedRun} onChange={event=>setRequestedRun(event.target.value)} spellCheck={false} autoComplete="off"/></label><button type="submit" disabled={busy}>Read Runs</button></form></details>
 const retryHandoff=()=>{if(locator?.statePath&&selectedRun) void readHandoffAvailability(locator.statePath,selectedRun,request.current)}
 const handoffControl=handoff.kind==="available"&&locator?.statePath&&selectedRun?<button type="button" onClick={()=>void onOpenHandoff(locator.statePath,selectedRun).catch(reason=>setError(String(reason)))}>Open handoff</button>:handoff.kind==="checking"?<span className="factory-handoff-standing" role="status">Checking retained handoff…</span>:handoff.kind==="empty"?<span className="factory-handoff-standing">No retained handoff</span>:handoff.kind==="unavailable"?<span className="factory-handoff-standing" role="status">Retained handoff unavailable: {handoff.detail}<button type="button" onClick={retryHandoff}>Retry</button></span>:null
 const selectedJourney=selectedRun?Object.values(journeys).find(journey=>journey?.runRefs.includes(selectedRun)):undefined
 const activeBuild=build&&build.view.run.runRef===selectedRun?build:undefined
 const refreshControl=locator?.statePath?<button type="button" onClick={()=>refresh()} disabled={busy}>Refresh</button>:null
 return <section className="factory-runs" aria-label="Factory Runs and Build">
  {!activeBuild&&<header className="factory-runs-heading"><h1>Runs</h1><div className="factory-runs-controls">{sourceControl}{refreshControl}</div></header>}
  {error&&<p className="factory-owner-refusal" role="alert">Factory read unavailable: {error}{locator?.statePath&&<button type="button" onClick={()=>refresh()}>Retry Factory read</button>}</p>}
  {!locator&&<p className="factory-runs-empty">Choose a Factory source and Project ref.</p>}
  {locator&&!project&&!error&&<p className="factory-runs-empty">Loading Factory Runs…</p>}
  {project&&<div className={"factory-runs-layout"+(project.journeys.length===0&&selectedRunReading?" factory-runs-single":"")}>{(project.journeys.length>0||!selectedRunReading)&&<FactoryRunList project={project} journeys={journeys} runReadings={runReadings} selectedRun={selectedRun} pendingRun={pendingRun} onSelectRun={selectRun}/>}<div className="factory-build-centre">{selectedRunReading?<>{activeBuild?<BuildSurface projectLabel={projectName} view={activeBuild.view} runSummary={<FactorySelectedRunSummary reading={selectedRunReading} journey={selectedJourney} compact/>} headerControls={<div className="factory-build-controls">{refreshControl}{sourceControl}{handoffControl}</div>} onOpenWorkingSurface={projectName?selection=>onOpenWorkingSurface({...selection,project:projectName}):undefined}/>:<><FactorySelectedRunSummary reading={selectedRunReading} journey={selectedJourney}/><div className="factory-run-reading-state" role="status">{pendingRun===selectedRun?"Loading Factory Build…":"Factory has not returned its Build view."}{handoffControl&&<div className="factory-runs-control-row">{handoffControl}</div>}</div></>}</>:<p className="factory-runs-empty">Select a published Run.</p>}</div></div>}
 </section>
}
