import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {SurfaceBinding} from "../../surface/types";
import {emitExpressionCue} from "../../stage/cues";
import {listFactoryAttemptTasks} from "./attempt-task";
import {developmentRead} from "./development";
import {projectReading,runReading,type RunReading} from "./run-reading";
import type {FactoryMaterialSelection} from "./types";

interface LiveMaterial extends FactoryMaterialSelection {version:string}
interface ObservedRun {key:string;revision:string;runRevision:number;reading:RunReading;material:LiveMaterial[];changed:boolean;unseen:string[]}
interface LiveReading {binding?:SurfaceBinding;observation?:ObservedRun;error?:string;acknowledge:(key:string,revision:string,subjectRef?:string)=>void}
const Context=createContext<LiveReading>({acknowledge:()=>{}});
const integer=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const object=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
export const factoryLiveKey=(statePath:string,runRef:string,centralProjectRef?:string)=>JSON.stringify([statePath,runRef,centralProjectRef??""]);
function materialFrom(reading:RunReading):LiveMaterial[] {
 const value=reading as unknown as Record<string,unknown>;
 return (["candidates","evidence"] as const).flatMap(kind=>{
  const entries=value[kind],field=kind==="candidates"?"candidateRef":"evidenceRef";
  if(!Array.isArray(entries))throw new Error(`Factory Run has no ${kind} collection.`);
  return entries.map((row:unknown)=>{
   if(!object(row)||row.runRef!==reading.runRef||typeof row[field]!=="string"||typeof row.label!=="string"||(kind==="candidates"&&!integer(row.revision)))throw new Error(`Factory returned incompatible ${kind} for this Run.`);
   return {subjectRef:row[field] as string,label:row.label,version:JSON.stringify(row)};
  });
 });
}

/** Selected-composition read projection. Poll only native revision indexes;
 * changed revisions read the Run, never trajectory or artifact bodies. This
 * ephemeral reading neither persists owner state nor admits any Action. */
export function FactoryLiveProvider({binding,children}:{binding?:SurfaceBinding;children:ReactNode}) {
 const kernel=useKernel(),path=binding?.view?.factory?.statePath,run=binding?.view?.factory?.runRef;
 const centralRef=binding?.view?.factory?.centralProjectRef??binding?.ref;
 const key=path&&run&&centralRef?factoryLiveKey(path,run,centralRef):undefined;
 const [observed,setObserved]=useState<ObservedRun>(),[failure,setFailure]=useState<{key:string;detail:string}>();
 const acknowledge=useCallback((key:string,revision:string,subjectRef?:string)=>setObserved(current=>current?.key===key&&current.revision===revision?{...current,changed:subjectRef?current.changed:false,unseen:subjectRef?current.unseen.filter(ref=>ref!==subjectRef):current.unseen}:current),[]);
 useEffect(()=>{
  if(!path||!run||!key||!centralRef){setObserved(undefined);setFailure(undefined);return;}
  let live=true,inFlight=false,timer:ReturnType<typeof setTimeout>|undefined,failures=0,last:ObservedRun|undefined;
  const schedule=()=>{if(live)timer=setTimeout(()=>void poll(),Math.min(5000*2**failures,60000));};
  const poll=async()=>{
   if(!live||inFlight)return;
   if(document.visibilityState!=="visible"){schedule();return;}
   inFlight=true;
   try {
    const index=await listFactoryAttemptTasks(kernel.transport,path,run);
    if(!live)return;
    if(!integer(index.runRevision)||(index.revision!==undefined&&!integer(index.revision))||(index.topologyRevision!==undefined&&!integer(index.topologyRevision))||(index.sourceCurrent!==undefined&&typeof index.sourceCurrent!=="boolean"))throw new Error("Factory returned incompatible revisions for live updates.");
    const linked=await developmentRead(kernel.transport,path,"central-project-link-read",centralRef);
    if(!live)return;
    if(!object(linked)||linked.contract!=="factory.central-project-link-reading/v1"||!object(linked.link)||linked.link.centralProjectRef!==centralRef||linked.link.factoryProjectRef!==index.projectRef)throw new Error("Factory returned a different Central Project link for live updates.");
    const project=linked.project;
    if(!projectReading(project)||project.projectRef!==index.projectRef)throw new Error("Factory returned a different Project for live updates.");
    const detail=project as unknown as Record<string,unknown>;
    if(!object(detail.provenance)||!integer(detail.provenance.factoryStateRevision)||!integer(detail.projectRevision))throw new Error("Factory has not disclosed Project revisions for live updates.");
    const journeys=project.journeys.filter(journey=>journey.runRefs.includes(run));
    if(journeys.some(journey=>!integer(journey.revision)))throw new Error("Factory has not disclosed the selected Journey revision.");
    const revision=JSON.stringify([index.revision,index.runRevision,index.topologyRevision,index.sourceCurrent,index.taskRefs,detail.provenance.factoryStateRevision,detail.projectRevision,journeys.map(journey=>[journey.journeyRef,journey.revision])]);
    if(last?.revision!==revision){
     const reading=await developmentRead(kernel.transport,path,"run",run);
     if(!live)return;
     if(!runReading(reading)||reading.runRef!==run||reading.projectRef!==index.projectRef||!integer((reading as unknown as Record<string,unknown>).revision))throw new Error("Factory returned an incompatible live Run reading.");
     const runDetail=reading as unknown as {revision:number;runMap:{topologyRevision?:number}};
     if(runDetail.revision!==index.runRevision||(index.topologyRevision!==undefined&&runDetail.runMap.topologyRevision!==index.topologyRevision))throw new Error("Factory changed during the live read. Waiting for a compatible Run revision.");
     const material=materialFrom(reading),before=new Map(last?.material.map(item=>[item.subjectRef,item.version]));
     const arrived=last?material.filter(item=>before.get(item.subjectRef)!==item.version).map(item=>item.subjectRef):[];
     const next={key,revision,runRevision:(reading as unknown as {revision:number}).revision,reading,material,changed:!!last,unseen:arrived};
     setObserved(current=>({...next,changed:next.changed||Boolean(current?.key===key&&current.changed),unseen:[...new Set([...(current?.key===key?current.unseen:[]),...arrived])].filter(ref=>material.some(item=>item.subjectRef===ref))}));
     if(arrived.length)emitExpressionCue({kind:"attention",label:arrived.length===1?"New Factory material":"New Factory materials"});
     last=next;
    }
    failures=0;setFailure(current=>current?.key===key?undefined:current);
   }catch(reason){if(live){failures=Math.min(failures+1,4);setFailure({key,detail:String(reason)});}}
   finally{inFlight=false;schedule();}
  };
  const visible=()=>{if(document.visibilityState==="visible"){clearTimeout(timer);void poll();}};
  document.addEventListener("visibilitychange",visible);void poll();
  return()=>{live=false;clearTimeout(timer);document.removeEventListener("visibilitychange",visible);};
 },[path,run,centralRef,key,kernel.transport]);
 const observation=observed?.key===key?observed:undefined,error=failure&&failure.key===key?failure.detail:undefined;
 return <Context.Provider value={{binding,observation,error,acknowledge}}>{children}</Context.Provider>;
}
export function useFactoryLive(){return useContext(Context);}

/** Quiet existing footer ingress. Only explicit selection creates/focuses a
 * Surface; arrival cannot replace a reviewed reading or move conversation. */
export function FactoryUpdates({onOpenRun,onOpenMaterial}:{onOpenRun:(binding:SurfaceBinding)=>Promise<void>;onOpenMaterial:(binding:SurfaceBinding,selection:FactoryMaterialSelection)=>Promise<void>}) {
 const {binding,observation,error,acknowledge}=useFactoryLive();
 const [open,setOpen]=useState(false),[opening,setOpening]=useState(false),[openError,setOpenError]=useState<string>();
 const generation=useRef(0),key=observation?.key;
 useEffect(()=>{generation.current++;setOpen(false);setOpening(false);setOpenError(undefined);return()=>{generation.current++;};},[key]);
 if(!binding)return null;
 if(!observation)return error?<div className="session-ingress factory-updates"><details><summary aria-label="Factory updates">Run updates unavailable</summary><div className="session-ingress-menu"><p role="status">Live updates unavailable: {error}</p></div></details></div>:null;
 if(!observation.changed&&!observation.material.length&&!error)return null;
 const choose=async(material?:FactoryMaterialSelection)=>{
  const current=++generation.current;setOpening(true);setOpenError(undefined);
  try {
   if(material)await onOpenMaterial(binding,material);else await onOpenRun(binding);
   if(current!==generation.current)return;
   if(material)acknowledge(observation.key,observation.revision,material.subjectRef);setOpen(false);
  }catch(reason){if(current===generation.current)setOpenError(String(reason));}
  finally{if(current===generation.current)setOpening(false);}
 };
 return <div className="session-ingress factory-updates"><details open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary aria-label="Factory updates">{error?"Run updates unavailable":observation.unseen.length?`${observation.unseen.length} new output${observation.unseen.length===1?"":"s"}`:observation.changed?"Run updated":observation.material.length?"Outputs":"Run updates"}</summary><div className="session-ingress-menu">
  <button type="button" disabled={opening} onClick={()=>void choose()}>Open Run</button>
  {observation.material.map(material=><button key={material.subjectRef} type="button" disabled={opening} onClick={()=>void choose(material)}>{material.label}{observation.unseen.includes(material.subjectRef)?" · new":""}</button>)}
  {error&&<p role="status">Live updates unavailable: {error}</p>}{openError&&<p role="alert">{openError}</p>}
 </div></details></div>;
}
