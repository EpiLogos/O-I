/**
 * A projected world constituent as its own Being/Thing page
 * (SHARED-FIELD-DESKTOP §0.1): the selected Agent Position, Workcell,
 * practice or activity is the primary material, with its typed relations
 * as the ways onward and its World one step away — not the whole World
 * page standing in for the subject that was chosen.
 */
import type {HostedEntry,HostedRelation} from "../knowledge/shared-field";
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {EncounterSurface} from "../encounter/EncounterSurface";
import {PreparedContextView} from "../context/PreparedContextView";
import type {SurfaceBinding} from "../surface/types";
// @ts-ignore -- language-neutral reading over the hosted contracts.
import {constituentReading} from "./constituent.mjs";
// @ts-ignore -- the same admitted native subjects supply display names.
import {subjectLabel,subjectKind} from "../../../../shared-field/presentation-text.mjs";

interface Reading {role:"being"|"thing";kind:string;ref:string;title:string;standing:string;world_ref:string;facts:{label:string;value:string}[];groups:{title:string;items:{ref:string;label:string;kind:string;note?:string}[]}[];session?:{ref:string;project:string;sourceWorldRef:string}}

export function constituentOf(entry:HostedEntry,relations:HostedRelation[],entries:HostedEntry[],activityLiveness:unknown[]=[]):Reading|null {
  return constituentReading(entry,relations,entries,{activity_liveness:activityLiveness,now_ms:Date.now()}) as Reading|null;
}

export function ConstituentEncounter({reading,worldLabel,onOpenRef}:{reading:Reading;worldLabel?:string;onOpenRef:(ref:string)=>void}) {
  const {transport}=useKernel();
  const [binding,setBinding]=useState<SurfaceBinding>();
  const [error,setError]=useState<string>();
  const [opening,setOpening]=useState(false);
  const epoch=useRef(0);
  useEffect(()=>{epoch.current+=1;setBinding(undefined);setError(undefined);setOpening(false);},[reading.ref,reading.session?.ref,reading.session?.project,reading.session?.sourceWorldRef]);
  const openSession=async()=>{
    if(!reading.session)return;
    const started=epoch.current;
    setOpening(true);setError(undefined);
    try{
      const session=reading.session;
      const reply=await kernelOp(transport,{op:"hosted_native",source_world_ref:session.sourceWorldRef,request:{op:"encounter",project:session.project,request:{action:"view",agent_session:session.ref}}});
      if(started!==epoch.current)return;
      if(reply.error||reply.outcome?.result!=="encounter_reading")throw Error(reply.error??"The native session owner is unavailable");
      if((reply.outcome.data as {agent_session?:string}).agent_session!==session.ref)throw Error("The native owner answered for another session");
      setBinding({id:`shared-native:${reading.ref}`,kind:"encounter",ref:session.ref,project:session.project,title:reading.title});
    }catch(cause){if(started===epoch.current)setError(String(cause instanceof Error?cause.message:cause));}
    finally{if(started===epoch.current)setOpening(false);}
  };
  const sourceLabels=new Set(["Identity","Definition","Definition revision","Native session","Agent","Source revision","Role","Workcell","Practice","Native owner","Run","Custody","Disclosure","Repertoire","Offer details"]);
  const facts=reading.facts.filter(row=>!sourceLabels.has(row.label));
  return <article className="world-presentation world-constituent" data-liveness={(reading as {liveness?:string}).liveness} data-constituent-role={reading.role} data-constituent-kind={reading.kind} data-subject-ref={reading.ref}>
    <header className="world-presentation__masthead"><div>
      <div className="world-component__eyebrow">{subjectKind(reading.kind)}</div>
      <h1>{subjectLabel(reading,"Unnamed subject")}</h1>
      <button type="button" className="world-constituent__world" onClick={()=>onOpenRef(reading.world_ref)}>in {subjectLabel(worldLabel,"its shared world")}</button>
    </div></header>
    <section className="world-region"><div className="world-region__components">
      <article className="world-component world-component--text">
        <dl className="world-component__meta">{facts.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      </article>
      {reading.groups.map(group=><section key={group.title} className="world-component world-component--collection" data-relation-group={group.title}>
        <h3>{group.title}</h3>
        <div className="world-component__collection">{group.items.map(item=><button type="button" key={item.ref} data-ref={item.ref} data-kind={item.kind} onClick={()=>onOpenRef(item.ref)}><strong>{subjectLabel(item)}</strong>{item.note&&<span>{item.note}</span>}</button>)}</div>
      </section>)}
      <details><summary>Source details</summary><dl className="world-component__meta">{reading.facts.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><pre>{JSON.stringify(reading,null,2)}</pre></details>
      {reading.session&&<section className="world-component world-component--text">
        <button type="button" disabled={opening} onClick={()=>void openSession()}>{opening?"Opening…":"Open native session"}</button>
        {error&&<p role="alert">{error}</p>}
        {binding&&<>
          <EncounterSurface binding={binding} sourceWorldRef={reading.session.sourceWorldRef} onView={view=>setBinding(value=>value?{...value,view:{...value.view,...view}}:value)}/>
          <details><summary>Selections for this session</summary><PreparedContextView project={reading.session.project} session={reading.session.ref} sourceWorldRef={reading.session.sourceWorldRef}/></details>
        </>}
      </section>}
    </div></section>
  </article>;
}
