import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {useExpressionStage} from "../stage/ExpressionStage";
import {expressionConfig} from "../expression/engineProjection";
import {sharedField, type SharedFieldReading} from "../knowledge/shared-field";
import {KNOWLEDGE_EXPRESSION_LIMIT, projectProvidedLocalWhole, validateParticipation, type LocalMember, type LocalWhole, type OwnerParticipation, type ProjectionOutcome} from "../knowledge/expressionProjection";
import type {ReadingRef} from "../expression/types";
// @ts-ignore -- renderer-neutral contract, tested under shared-field.
import {createKnowledgeEncounter} from "../../../../shared-field/knowledge-encounter.mjs";

type Provenance = {kind:string; ref:string; source_system:string; revision?:string};
type Node = {ref:string; kind:string; world_ref:string; label:string; summary?:string; revision?:string; availability?:string; meta?:{ql?:OwnerParticipation}; provenance:Provenance[]};
type Edge = {relation_ref?:string; from:string; to:string; relation:string; origin:string; direction?:string; provenance:Provenance[]};
type Encounter = {state:"available"|"degraded"; focus:string; resource:Node; detail?:string; nodes:Node[]; edges:Edge[]; truncated?:boolean; presentations:string[]; actions:string[]};
type Mode = "graph"|"tree"|"list"|"page"|"expression";
const MAX_PINS = KNOWLEDGE_EXPRESSION_LIMIT - 1;
const key = (world:string, kind:string) => `oi-cradle.knowledge.${encodeURIComponent(world)}.${kind}.v2`;
function stored<T>(name:string, fallback:T):T {try{return JSON.parse(localStorage.getItem(name)??"null")??fallback;}catch{return fallback;}}
function remember(name:string,value:unknown){try{localStorage.setItem(name,JSON.stringify(value));}catch{/* View state is still usable without storage. */}}
function relationLabel(value:string){const parts=value.split(/[/.]/).filter(Boolean);return (parts[parts.length-1]??value).replace(/-/g," ");}
function initialPins(world:string){const value=stored<unknown>(key(world,"pins"),[]);return Array.isArray(value)?[...new Set(value.filter((ref):ref is string=>typeof ref==="string"&&ref.length>0))].slice(-MAX_PINS):[];}
const readingRef = (row:Provenance):ReadingRef => ({ref:row.ref,revision:row.revision??"revision-unavailable",availability:row.revision?"available":"unavailable"});

export function KnowledgeEncounter({opened,page,onOpenRef}:{opened:unknown;page:ReactNode;onOpenRef:(ref:string)=>void}) {
  const {transport}=useKernel();
  const stage=useExpressionStage();
  // A new object can represent the same reading after opening source depth.
  // Its contents, not its React object identity, delimit an Expression request.
  const readingKey=JSON.stringify(opened);
  const encounter=useMemo(()=>createKnowledgeEncounter(JSON.parse(readingKey)) as Encounter,[readingKey]);
  const world=encounter.resource.world_ref;
  const [mode,setMode]=useState<Mode>(encounter.state==="available"?"graph":"page");
  const [pins,setPins]=useState<string[]>(()=>initialPins(world));
  const [heldLocus,setHeldLocus]=useState<string|null>(()=>stored(key(world,"held"),null));
  const follow=heldLocus===null;
  const [retained,setRetained]=useState<Node[]>([]);
  const [expressionOutcome,setExpressionOutcome]=useState<ProjectionOutcome>();
  const [expressionBusy,setExpressionBusy]=useState(false);
  const [expressionError,setExpressionError]=useState("");
  const expressionHost=useRef<HTMLDivElement>(null);
  const mountId=useId();
  const epoch=useRef(0);
  const activeProjection=useRef<AbortController|null>(null);
  const focus=encounter.nodes.find(node=>node.ref===encounter.focus)??encounter.resource;
  const retainedRefs=JSON.stringify([...new Set([...(heldLocus?[heldLocus]:[]),...pins])].slice(0,MAX_PINS));
  useEffect(()=>{
    let current=true;
    setRetained([]);
    const refs=(JSON.parse(retainedRefs) as string[]).filter(ref=>!encounter.nodes.some(node=>node.ref===ref));
    // Pins store only semantic addresses. Every mounted reading comes from
    // the existing admission-filtered owner client, never a persisted graph.
    void Promise.all(refs.map(async ref=>{
      try{const value=await sharedField<SharedFieldReading>(transport,{kind:"read",ref});return value.state==="hosted"&&value.entry.ref===ref&&value.entry.world_ref===world?value.entry as unknown as Node:null;}catch{return null;}
    })).then(values=>{if(current)setRetained(values.filter((node):node is Node=>node!==null));});
    return()=>{current=false;};
  },[readingKey,retainedRefs,transport,world]);
  const display=useMemo<Encounter>(()=>({...encounter,nodes:[...encounter.nodes,...retained.filter(node=>!encounter.nodes.some(item=>item.ref===node.ref))]}),[encounter,retained]);
  const selectedMode=encounter.presentations.includes(mode)?mode:"page";
  const visualLocus=heldLocus&&display.nodes.some(node=>node.ref===heldLocus)?heldLocus:encounter.focus;
  const open=(ref:string)=>{const node=display.nodes.find(item=>item.ref===ref);if(node&&node.availability!=="unavailable")onOpenRef(ref);};
  const neighbours=encounter.edges.filter(edge=>edge.from===encounter.focus||edge.to===encounter.focus).map(edge=>({edge,ref:edge.from===encounter.focus?edge.to:edge.from}));
  const whole=useMemo<LocalWhole>(()=>{
    const admitted=[focus,...pins.map(ref=>display.nodes.find(node=>node.ref===ref)),...display.nodes].filter((node):node is Node=>!!node&&node.availability!=="unavailable").filter((node,index,all)=>all.findIndex(item=>item.ref===node.ref)===index).slice(0,KNOWLEDGE_EXPRESSION_LIMIT);
    const members:LocalMember[]=admitted.map(node=>{
      const provenance=[...node.provenance,...encounter.edges.filter(edge=>edge.from===node.ref||edge.to===node.ref).flatMap(edge=>edge.provenance)];
      const sources=provenance.map(readingRef).filter((row,index,all)=>all.findIndex(item=>item.ref===row.ref&&item.revision===row.revision)===index);
      return {node:{ref:node.ref,label:node.label,kind:node.kind as "wiki-node",native_owner:node.provenance[0]?.source_system??"shared-field",provenance:{source:node.provenance[0]?.kind??"projection",revision:node.revision,detail:node.provenance.map(row=>row.ref)},actions:[]},reading:{resource:node.ref,provider:node.provenance[0]?.source_system??"shared-field",revision:node.revision,authority:node.provenance[0]?.kind??"projection",evidence:node.provenance.map(row=>row.ref),why_selected:node.ref===encounter.focus?"locus":pins.includes(node.ref)?"pinned subject":"typed relation",content:node.summary??node.label},sources};
    });
    const refs=new Set(admitted.map(node=>node.ref));
    const edges=encounter.edges.filter(edge=>refs.has(edge.from)&&refs.has(edge.to));
    const ownerRelations=edges.flatMap(edge=>{
      // Only the explicit canonical relation ref may become a native binding.
      // A matching owner provenance row supplies its revision. Coordinates,
      // endpoint pairs and SpaceTimeDB row identifiers never create a ref.
      const source=edge.provenance.find(row=>row.ref===edge.relation_ref&&row.revision);
      return edge.relation_ref&&source?[{from:edge.from,to:edge.to,relation:readingRef(source),provenance:edge.provenance.map(readingRef)}]:[];
    });
    return {locus:encounter.focus,members,edges,ownerRelations,truncated:Boolean(encounter.truncated)||admitted.length<display.nodes.length,warnings:[],pinned:pins.filter(ref=>refs.has(ref)),grammar:validateParticipation(focus.meta?.ql,members),relationBindingsUnavailable:edges.length-ownerRelations.length};
  },[encounter,display,pins,focus]);
  useEffect(()=>{epoch.current++;activeProjection.current?.abort();setExpressionOutcome(undefined);setExpressionBusy(false);setExpressionError("");return()=>{epoch.current++;activeProjection.current?.abort();};},[readingKey]);
  // The stage exists only while this specific Surface shows Expression.
  // Navigating, changing modes, or replacing a reading releases its GPU locus.
  useLayoutEffect(()=>{
    if(selectedMode!=="expression"||expressionOutcome?.state!=="ready")return;
    setExpressionError("");
    let active:ReturnType<typeof stage.present>=null;
    try {
      active=stage.present({id:`explore-knowledge-expression:${mountId}`,plane:"overlay",recipe:"",config:expressionConfig(expressionOutcome.document),appearance:"host",sceneRef:expressionOutcome.document.selection.scene_ref});
      // Opening or initial engine admission can defer this request. The
      // stage availability update retries it; only an actual failure is an error.
      if(!active){if(stage.error)setExpressionError(stage.error);return;}
      active.setContainer(expressionHost.current);
    } catch(error) {
      active?.release();
      setExpressionError(error instanceof Error?error.message:String(error));
      return;
    }
    return()=>active?.release();
  },[selectedMode,expressionOutcome,stage,mountId]);
  const changeMode=(next:Mode)=>{epoch.current++;activeProjection.current?.abort();setExpressionBusy(false);setMode(next);};
  const express=async()=>{
    activeProjection.current?.abort();
    const controller=new AbortController();activeProjection.current=controller;
    const request=++epoch.current;
    setExpressionBusy(true);setExpressionError("");
    try{
      const outcome=await projectProvidedLocalWhole(transport,`explore:${world}:${encounter.focus}`,focus.label,whole,controller.signal);
      if(request!==epoch.current)return;
      if(outcome.state!=="ready")throw new Error(outcome.state==="unavailable"?outcome.detail:"The Expression revision changed; project again.");
      setExpressionOutcome(outcome);setMode("expression");
    }catch(error){if(request===epoch.current)setExpressionError(String(error instanceof Error?error.message:error));}
    finally{if(request===epoch.current)setExpressionBusy(false);}
  };
  const togglePin=()=>setPins(current=>{const next=current.includes(encounter.focus)?current.filter(ref=>ref!==encounter.focus):[...current,encounter.focus].slice(-MAX_PINS);remember(key(world,"pins"),next);return next;});
  return <section className="knowledge-encounter" aria-label="Projected knowledge local whole" data-knowledge-state={encounter.state} data-focus-ref={encounter.focus} data-node-count={encounter.nodes.length} data-relation-count={encounter.edges.length}>
    <header className="knowledge-encounter__header"><div><span>Wiki / local whole</span><h1>{focus.label}</h1><code>{encounter.focus}{focus.revision?` @ ${focus.revision}`:""}</code></div><div className="knowledge-encounter__travel" role="group" aria-label="Knowledge travel"><button type="button" aria-pressed={pins.includes(encounter.focus)} onClick={togglePin}>{pins.includes(encounter.focus)?"Pinned":"Pin"}</button><button type="button" aria-pressed={follow} onClick={()=>{const next=follow?encounter.focus:null;remember(key(world,"held"),next);setHeldLocus(next);}}>{follow?"Following locus":"Follow locus"}</button></div></header>
    {encounter.state==="degraded"&&<div className="knowledge-encounter__degraded" role="status"><strong>Relations unavailable</strong><p>{encounter.detail}</p><p>The projected page and exact source identity remain available.</p></div>}
    <nav className="knowledge-encounter__modes" aria-label="Knowledge presentation">{(["graph","tree","list","page"] as Mode[]).map(candidate=><button key={candidate} type="button" aria-pressed={selectedMode===candidate} disabled={!encounter.presentations.includes(candidate)} onClick={()=>changeMode(candidate)}>{candidate}</button>)}<button type="button" aria-pressed={selectedMode==="expression"} disabled={encounter.state!=="available"||expressionBusy} onClick={()=>void express()}>{expressionBusy?"Expressing…":"Expression"}</button></nav>
    {pins.length>0&&<div className="knowledge-encounter__pins" aria-label="Pinned knowledge subjects">{pins.map(ref=><button key={ref} type="button" disabled={!display.nodes.some(node=>node.ref===ref&&node.availability!=="unavailable")} title={display.nodes.some(node=>node.ref===ref)?ref:"Pinned subject is unavailable in the current owner reading"} onClick={()=>open(ref)}>{ref}</button>)}</div>}
    {selectedMode==="graph"&&<Graph encounter={display} visualLocus={visualLocus} onOpen={open}/>}
    {selectedMode==="tree"&&<div className="knowledge-encounter__tree"><article><span>Focus</span><strong>{focus.label}</strong><code>{focus.ref}</code></article><ol>{neighbours.map(({edge,ref},index)=>{const node=encounter.nodes.find(item=>item.ref===ref)!;return <li key={`${edge.from}:${edge.relation}:${edge.to}:${index}`}><button type="button" disabled={node.availability==="unavailable"} onClick={()=>open(ref)}><small>{relationLabel(edge.relation)} · {edge.origin}</small><strong>{node.label}</strong><code>{node.ref}</code></button></li>;})}</ol></div>}
    {selectedMode==="list"&&<ol className="knowledge-encounter__list">{display.nodes.map(node=><li key={node.ref}><button type="button" disabled={node.availability==="unavailable"} aria-current={node.ref===encounter.focus?"true":undefined} onClick={()=>open(node.ref)}><span>{node.kind}</span><strong>{node.label}</strong><code>{node.ref}{node.revision?` @ ${node.revision}`:""}</code></button></li>)}</ol>}
    {selectedMode==="page"&&<div className="knowledge-encounter__page" data-knowledge-presentation="page">{page}</div>}
    <div ref={expressionHost} className="knowledge-encounter__expression" data-active={selectedMode==="expression"&&expressionOutcome?.state==="ready"}/>
    {selectedMode==="expression"&&expressionOutcome?.state==="ready"&&<div role="status"><p>{expressionOutcome.whole.members.length} subjects · {expressionOutcome.whole.edges.length} typed relations · Expression r{expressionOutcome.document.revision}</p>{expressionOutcome.whole.truncated&&<p>Expression shows at most {KNOWLEDGE_EXPRESSION_LIMIT} subjects, including your pins.</p>}{expressionOutcome.whole.relationBindingsUnavailable>0&&<p>{expressionOutcome.whole.relationBindingsUnavailable} relations have no disclosed identity and revision; their evidence remains in the source view.</p>}</div>}
    {selectedMode==="expression"&&expressionOutcome?.state==="ready"&&<nav className="knowledge-encounter__subjects" aria-label="Subjects in this Expression">{expressionOutcome.whole.members.map(member=><button type="button" key={member.node.ref} aria-current={member.node.ref===encounter.focus?"true":undefined} onClick={()=>open(member.node.ref)} title={member.node.ref}>{member.node.label}</button>)}</nav>}
    {expressionError&&<p role="alert">{expressionError}</p>}
    <footer><span>{encounter.nodes.length} subjects · {encounter.edges.length} typed relations{encounter.truncated?" · bounded at owner budget":""}</span><span>Navigation: {encounter.actions.length?encounter.actions.join(" · "):"none disclosed"} · Native Actions: none disclosed</span></footer>
  </section>;
}

function Graph({encounter,visualLocus,onOpen}:{encounter:Encounter;visualLocus:string;onOpen:(ref:string)=>void}) {
  const positioned=encounter.nodes.map(node=>{if(node.ref===visualLocus)return {...node,x:400,y:215};const others=Math.max(1,encounter.nodes.length-1),slot=encounter.nodes.filter(item=>item.ref!==visualLocus).findIndex(item=>item.ref===node.ref),angle=(Math.PI*2*slot)/others-Math.PI/2;return {...node,x:400+Math.cos(angle)*260,y:215+Math.sin(angle)*145};});
  const byRef=new Map(positioned.map(node=>[node.ref,node]));
  return <svg className="knowledge-encounter__graph" viewBox="0 0 800 430" role="img" aria-label="Bounded typed knowledge constellation" data-visual-locus={visualLocus}>{encounter.edges.map((edge,index)=>{const from=byRef.get(edge.from),to=byRef.get(edge.to);return from&&to?<g key={`${edge.from}:${edge.relation}:${edge.to}:${index}`}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y}/><text x={(from.x+to.x)/2} y={(from.y+to.y)/2-6}>{relationLabel(edge.relation)}</text><title>{edge.relation} · {edge.origin} · {edge.provenance.map(row=>`${row.ref}@${row.revision??"unrevisioned"}`).join(", ")}</title></g>:null;})}{positioned.map(node=><g key={node.ref} className={`${node.ref===encounter.focus?"is-focus":""}${node.availability==="unavailable"?" is-unavailable":""}`} data-knowledge-ref={node.ref} transform={`translate(${node.x},${node.y})`} role="button" aria-disabled={node.availability==="unavailable"} tabIndex={node.availability==="unavailable"?-1:0} onClick={()=>onOpen(node.ref)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onOpen(node.ref);}}}><circle r={node.ref===encounter.focus?34:22}/><text y={node.ref===encounter.focus?52:39}>{node.label}</text><title>{node.ref}{node.revision?` @ ${node.revision}`:""}{node.availability==="unavailable"?" · unavailable":""}</title></g>)}</svg>;
}
