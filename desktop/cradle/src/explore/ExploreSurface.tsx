/**
 * Explore — the stable global desktop entrance to the open/shared field
 * (SHARED-FIELD-DESKTOP §1–§3, §12), and the ordinary Surface a projected
 * subject or SharedField opens as. One component, two bindings:
 *
 *   kind "explore"       the field at rest: search, a bounded constellation,
 *                        the selected subject as the primary body, back/
 *                        forward, remembered query/selection/history/depth
 *                        (global, workspace-independent view state);
 *   kind "presentation"  one projected subject pinned as its own Surface
 *                        (split/full/detach/re-dock through the frame grammar),
 *                        carrying the same World/Projection/Presentation/
 *                        Expression refs in its binding.
 *
 * Every reading is pulled through the kernel's `shared_field` op from the
 * O:I-owned field client; the renderer holds no target, token or store.
 * Absence and unavailability arrive as explicit readings and render as such;
 * local work is never touched by any of it.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {Glyph} from "../workspace/Glyph";
import {Loading} from "../shared/Loading";
import {isUnavailable,sharedField,slug,type HostedEntry,type HostedParticipant,type HostedField,type SharedFieldReading,type SharedFieldSnapshot,type SharedFieldUnavailable,type SharedFieldWatchResult} from "../knowledge/shared-field";
import {PresentationBody,type DepthState} from "./PresentationBody";
import {BeingEncounter} from "./BeingEncounter";
// @ts-ignore -- language-neutral view-state codec, unit-tested in tests/explore-field.test.mjs.
import {EXPLORE_TRAVEL_KEY,amendVisit,canTravel,currentVisit,decodeExploreTravel,freshExploreTravel,pushVisit,travelBy} from "./travel.mjs";
// @ts-ignore -- language-neutral field reading, unit-tested in tests/explore-field.test.mjs.
import {constellation,fieldReading,searchField,watchStanding,watchTargetKind} from "./field.mjs";
// @ts-ignore -- the owner's Watch contract validates the marker the desktop puts.
import {createWatch} from "../../../../shared-field/watch.mjs";
import "./explore.css";

type Visit={query:string;selected?:string;depth?:DepthState};
type Travel={schema:string;visits:Visit[];index:number};
type Snapshot=SharedFieldSnapshot|SharedFieldUnavailable;
interface FieldView {state:"available"|"unavailable";detail?:string;target?:{name:string;uri:string;database:string};status?:{healthy?:boolean;transport?:{state?:string}};worlds:{world_ref:string;label:string;root:HostedEntry|null;entries:HostedEntry[]}[];beings:{ref:string;label:string;world_ref:string|null;field_ref:string;identity:{kind:string;ref:string};participant:HostedParticipant}[];fields:HostedField[];relations:{from:string;to:string;relation:string;origin:string}[];counts:{entries:number;worlds:number;beings:number}}
type Hit={kind:"entry"|"being"|"field";ref:string;label:string;summary?:string;subject_kind:string;world_ref:string|null;world_label:string};

export interface PresentationMeta {world_ref:string;field_ref?:string;projection_ref?:string;projection_revision?:number;presentation_ref?:string;presentation_revision?:number;expression_ref?:string;expression_revision?:number}
export interface ExploreSurfaceProps {binding:SurfaceBinding;onOpenPresentation?:(ref:string,title:string,meta:PresentationMeta)=>Promise<void>;onOpenExplore?:(select:{ref:string;title?:string})=>Promise<void>}

const TRAVEL_EVENT="oi:explore-navigate";
function loadTravel():Travel {
  try{return decodeExploreTravel(JSON.parse(localStorage.getItem(EXPLORE_TRAVEL_KEY)??"null"));}catch{return freshExploreTravel();}
}
export function saveTravel(travel:Travel):boolean {
  try{localStorage.setItem(EXPLORE_TRAVEL_KEY,JSON.stringify(travel));return true;}catch{return false;}
}
/** Write a selection into the remembered travel and wake any mounted Explore surface — how the rest of the desktop hands Explore a subject. */
export function navigateExplore(select:{ref:string;query?:string}) {
  const travel=loadTravel();
  const current=currentVisit(travel) as Visit;
  saveTravel(current.selected===select.ref?travel:pushVisit(travel,{query:select.query??current.query,selected:select.ref}));
  window.dispatchEvent(new CustomEvent(TRAVEL_EVENT));
}
const KIND_LABEL:Record<string,string>={"central-world":"world","wiki-space":"wiki space","wiki-node":"wiki node","curated-artifact":"artifact","central.document":"document",expression:"expression",contribution:"contribution",participant:"being","shared-field":"field"};
const kindLabel=(kind:string)=>KIND_LABEL[kind]??kind;

export function ExploreSurface({binding,onOpenPresentation,onOpenExplore}:ExploreSurfaceProps) {
  const {transport}=useKernel();
  const pinned=binding.kind==="presentation";
  const [travel,setTravel]=useState<Travel>(()=>pinned?{...freshExploreTravel(),visits:[{query:"",selected:binding.ref}]}:loadTravel());
  const visit=currentVisit(travel) as Visit;
  const [snapshot,setSnapshot]=useState<Snapshot>();
  const [reading,setReading]=useState<SharedFieldReading>();
  const [busy,setBusy]=useState(false);
  const [readBusy,setReadBusy]=useState(false);
  const [generation,setGeneration]=useState(0);
  const [storageError,setStorageError]=useState<string>();
  const [watchBusy,setWatchBusy]=useState(false);
  const [watchError,setWatchError]=useState<string>();
  const [promoteError,setPromoteError]=useState<string>();
  const [query,setQuery]=useState(visit.query);
  const field=useRef<HTMLDivElement>(null);
  const [extent,setExtent]=useState({width:800,height:360});
  const latest=useRef(travel);latest.current=travel;

  // The remembered travel is global: another surface (or the share path)
  // may hand Explore a subject while this one is mounted.
  useEffect(()=>{
    if(pinned)return;
    const wake=()=>{const next=loadTravel();setTravel(next);setQuery((currentVisit(next) as Visit).query);};
    window.addEventListener(TRAVEL_EVENT,wake);
    return()=>window.removeEventListener(TRAVEL_EVENT,wake);
  },[pinned]);
  useEffect(()=>{if(pinned)return;const timer=setTimeout(()=>{if(!saveTravel(latest.current))setStorageError("Explore view state could not be saved on this device.");},200);return()=>clearTimeout(timer);},[travel,pinned]);

  const refresh=useCallback(()=>{
    let active=true;setBusy(true);
    void sharedField<Snapshot>(transport,{kind:"snapshot"}).then(s=>{if(active)setSnapshot(s);}).catch(e=>{if(active)setSnapshot({state:"unavailable",owner_operation:"shared-field.projection",detail:String(e instanceof Error?e.message:e)});}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[transport]);
  useEffect(()=>refresh(),[refresh,generation]);
  const selected=visit.selected;
  const isEntry=!!selected&&!selected.startsWith("participant:")&&!selected.startsWith("human:")&&!selected.startsWith("oi:field:");
  useEffect(()=>{
    if(!selected||!isEntry){setReading(undefined);return;}
    let active=true;setReadBusy(true);setReading(undefined);setWatchError(undefined);
    void sharedField<SharedFieldReading>(transport,{kind:"read",ref:selected}).then(r=>{if(active)setReading(r);}).catch(e=>{if(active)setReading({state:"unavailable",owner_operation:"shared-field.projection",detail:String(e instanceof Error?e.message:e)});}).finally(()=>{if(active)setReadBusy(false);});
    return()=>{active=false;};
  },[selected,isEntry,transport,generation]);
  useEffect(()=>{if(!field.current)return;const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width>0&&height>0)setExtent({width,height});});observer.observe(field.current);return()=>observer.disconnect();},[selected]);

  const view=useMemo(()=>fieldReading(snapshot) as unknown as FieldView,[snapshot]);
  const hits=useMemo(()=>searchField(snapshot,visit.query) as unknown as Hit[],[snapshot,visit.query]);
  const positions=useMemo(()=>constellation(view,extent) as unknown as Record<string,{x:number;y:number;world?:boolean;being?:boolean}>,[view,extent]);
  const hitRefs=useMemo(()=>new Set(hits.map(hit=>hit.ref)),[hits]);
  const unavailable=snapshot&&isUnavailable(snapshot)?snapshot:undefined;

  const select=(ref:string)=>{setPromoteError(undefined);setTravel(t=>pushVisit(t,{query:(currentVisit(t) as Visit).query,selected:ref,depth:(currentVisit(t) as Visit).depth}));};
  const release=()=>{setTravel(t=>pushVisit(t,{query:(currentVisit(t) as Visit).query}));};
  const move=(delta:number)=>setTravel(t=>travelBy(t,delta));
  const setDepth=(change:DepthState)=>setTravel(t=>amendVisit(t,{depth:{...(currentVisit(t) as Visit).depth,...change}}));
  const commitQuery=(value:string)=>{setQuery(value);setTravel(t=>amendVisit(t,{query:value}));};
  const depth=visit.depth??{};

  const standing=useMemo(()=>watchStanding(reading) as unknown as {available:boolean;watching?:boolean;reason?:string;participant_ref?:string;field_ref?:string;watch?:{watch_ref:string}},[reading]);
  const toggleWatch=async()=>{
    if(!reading||reading.state!=="hosted"||!standing.available||!standing.participant_ref||!standing.field_ref)return;
    setWatchBusy(true);setWatchError(undefined);
    try{
      const watch=createWatch({watch_ref:standing.watch?.watch_ref??`watch:${slug(standing.participant_ref)}:${slug(reading.entry.ref)}`,watcher_participant_ref:standing.participant_ref,field_ref:standing.field_ref,target:{kind:watchTargetKind(reading.entry.kind),ref:reading.entry.ref},state:standing.watching?"paused":"active",created_at:new Date().toISOString(),provenance:{source_system:"o-i",source_revision:reading.entry.revision??String((reading.projections[0]?.projection_revision)??1)}});
      await sharedField<SharedFieldWatchResult>(transport,{kind:"watch",watch});
      setGeneration(n=>n+1);
    }catch(e){setWatchError(String(e instanceof Error?e.message:e));}
    finally{setWatchBusy(false);}
  };
  const promote=async()=>{
    if(!onOpenPresentation||!reading||reading.state!=="hosted")return;
    const projection=reading.projections.find(p=>p.projection_ref===(reading.entry.meta?.projection_ref as string|undefined))??reading.projections[0];
    const presentation=(projection?.representation as {kind:string;payload?:{presentation_ref?:string;revision?:number}}|undefined)?.kind==="oi.world-presentation/v1"?(projection!.representation as {payload:{presentation_ref:string;revision:number}}).payload:undefined;
    const expression=presentation?(projection!.representation as {payload:{regions:{bindings:{portable_renderer?:string;component_ref:string;props:{expression?:{expression_ref:string;expression_revision:number}}}[]}[]}}).payload.regions.flatMap(r=>r.bindings).find(b=>(b.portable_renderer??b.component_ref)==="oi.presentation/expression/v1")?.props.expression:undefined;
    setPromoteError(undefined);
    try{await onOpenPresentation(reading.entry.ref,reading.entry.label,{world_ref:reading.entry.world_ref,field_ref:reading.field_ref??undefined,projection_ref:projection?.projection_ref,projection_revision:projection?.projection_revision,presentation_ref:presentation?.presentation_ref,presentation_revision:presentation?.revision,expression_ref:expression?.expression_ref,expression_revision:expression?.expression_revision});}
    catch(e){setPromoteError(String(e instanceof Error?e.message:e));}
  };

  const selectedHit=selected?hits.find(hit=>hit.ref===selected)??(view.state==="available"?[...view.worlds.flatMap(w=>w.root?[w.root,...w.entries]:w.entries)].filter(e=>e.ref===selected).map(e=>({kind:"entry" as const,ref:e.ref,label:e.label,subject_kind:e.kind,world_ref:e.world_ref,world_label:e.world_ref}))[0]:undefined):undefined;
  const subjectTitle=reading?.state==="hosted"?reading.entry.label:selectedHit?.label??selected;
  const availability=view.state==="available"?{label:view.target?.name??"field",healthy:view.status?.healthy!==false&&view.status?.transport?.state!=="unavailable"}:unavailable?{label:"unavailable",healthy:false}:{label:"reading…",healthy:true};

  const strip=<nav className="explore-strip" aria-label="Explore">
    {!pinned&&<div className="explore-travel"><button type="button" aria-label="Back" title="Back" disabled={!canTravel(travel,-1)} onClick={()=>move(-1)}>←</button><button type="button" aria-label="Forward" title="Forward" disabled={!canTravel(travel,1)} onClick={()=>move(1)}>→</button></div>}
    {!pinned&&<form className="explore-aperture" role="search" onSubmit={e=>{e.preventDefault();commitQuery(query);}}><Glyph name="search" size={13}/><input type="search" aria-label="Search the open field" placeholder="Search worlds, Beings, Things, fields…" value={query} onChange={e=>setQuery(e.target.value)} onBlur={()=>commitQuery(query)} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();setQuery("");commitQuery("");}}}/></form>}
    {selected&&<div className="explore-subject" data-selected-ref={selected}><span className="explore-subject-kind">{kindLabel(reading?.state==="hosted"?reading.entry.kind:selectedHit?.subject_kind??"subject")}</span><strong title={selected}>{subjectTitle}</strong>{!pinned&&<button type="button" aria-label="Return to the field" title="Return to the field" onClick={release}>×</button>}</div>}
    <span className={`explore-availability${availability.healthy?"":" explore-availability--off"}`} data-availability={availability.healthy?"available":"unavailable"} title={unavailable?unavailable.detail:view.state==="available"?`${view.target?.uri}/${view.target?.database}`:undefined}><i aria-hidden="true"/>{availability.label}</span>
    {selected&&isEntry&&<div className="explore-depths" role="group" aria-label="Contextual depth">
      <button type="button" aria-pressed={!!depth.relations} onClick={()=>setDepth({relations:!depth.relations})}>Relations</button>
      <button type="button" aria-pressed={!!depth.source} onClick={()=>setDepth({source:!depth.source})}>Source</button>
      <button type="button" className="explore-watch" aria-pressed={!!standing.watching} disabled={!standing.available||watchBusy} title={standing.available?(standing.watching?"Pause this Watch":"Watch this subject for future availability — not endorsement"):`Watch unavailable: ${standing.reason??"no reading"}`} onClick={()=>void toggleWatch()} data-watch-state={standing.available?(standing.watching?"active":"none"):"unavailable"}>{watchBusy?"Watching…":standing.watching?"Watching":"Watch"}</button>
      {!pinned&&onOpenPresentation&&<button type="button" title="Open this presentation as its own Surface (split, full, detach, re-dock)" onClick={()=>void promote()}>Open as Surface</button>}
      {pinned&&onOpenExplore&&<button type="button" title="Show this subject in the Explore field" onClick={()=>void onOpenExplore({ref:binding.ref!,title:binding.title}).catch(e=>setPromoteError(String(e)))}>Show in Explore</button>}
    </div>}
    <button type="button" className="explore-refresh" aria-label="Refresh the field" title="Refresh" onClick={()=>setGeneration(n=>n+1)}>↻</button>
  </nav>;

  return <section className="explore-surface" aria-label={pinned?"Projected subject":"Explore"} data-explore-mode={pinned?"presentation":"explore"} data-selected-ref={selected??""} data-travel-index={travel.index} data-travel-length={travel.visits.length} aria-busy={busy||readBusy}>
    {(watchError||promoteError||storageError)&&<p role="alert">{watchError??promoteError??storageError}</p>}
    {snapshot&&!isUnavailable(snapshot)&&!!snapshot.relation_errors?.length&&<p role="status" className="explore-muted" data-relations-degraded={snapshot.relation_errors.length}>{snapshot.relation_errors.length} shared relation{snapshot.relation_errors.length===1?" is":"s are"} unavailable because its source record or endpoint could not be validated. Valid subjects remain available; refresh after the source is repaired.</p>}
    {!selected&&<>
      {strip}
      {unavailable&&<div className="explore-unavailable-field" data-field-state="unavailable"><p role="status">The open field is unavailable — {unavailable.detail}</p><p className="explore-muted">Local work is untouched. Watched fields and local Projections stay where they are; the field returns when a hosting target is bound and reachable.</p></div>}
      {busy&&!snapshot&&<Loading label="Reading the open field…" scope="inline"/>}
      {view.state==="available"&&<div className="explore-field" data-field-state="available" data-entries={view.counts.entries} data-worlds={view.counts.worlds} data-beings={view.counts.beings}>
        <div className="explore-constellation" ref={field}>
          <svg viewBox={`0 0 ${extent.width} ${extent.height}`} width={extent.width} height={extent.height} aria-label="Constellation of projected worlds">
            <g className="explore-edges">{view.relations.map((relation,i)=>{const a=positions[relation.from],b=positions[relation.to];return a&&b?<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} data-relation={relation.relation} data-dim={visit.query&&!(hitRefs.has(relation.from)&&hitRefs.has(relation.to))}/>:null;})}</g>
            <g className="explore-nodes">{view.worlds.flatMap(world=>(world.root?[world.root,...world.entries]:world.entries).map(entry=>{const p=positions[entry.ref];if(!p)return null;const dim=!!visit.query&&!hitRefs.has(entry.ref);return <g key={entry.ref} className={`explore-node${p.world?" explore-node--world":""}`} data-explore-ref={entry.ref} data-kind={entry.kind} data-dim={dim} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={dim?-1:0} aria-label={`${entry.label} · ${kindLabel(entry.kind)}`} onClick={()=>select(entry.ref)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(entry.ref);}}}><circle r={p.world?9:4.5}/><text y={p.world?-14:-9}>{entry.label}</text></g>;}))}
            {view.beings.map(being=>{const p=positions[being.ref];return p?<g key={being.ref} className="explore-node explore-node--being" data-explore-ref={being.ref} data-kind="participant" data-dim={!!visit.query&&!hitRefs.has(being.ref)} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${being.label} · being`} onClick={()=>select(being.ref)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(being.ref);}}}><rect x={-5} y={-5} width={10} height={10} rx={2}/><text y={-10}>{being.label}</text></g>:null;})}</g>
          </svg>
        </div>
        <ol className="explore-results" aria-label={visit.query?`Results for ${visit.query}`:"The open field"}>
          {hits.map(hit=><li key={`${hit.kind}:${hit.ref}`} data-explore-ref={hit.ref} data-kind={hit.subject_kind}><button type="button" onClick={()=>select(hit.ref)}><span className="explore-result-kind">{kindLabel(hit.subject_kind)}</span><strong>{hit.label}</strong>{hit.summary&&<span className="explore-result-summary">{hit.summary}</span>}<small>{hit.world_label}</small></button></li>)}
          {!hits.length&&<li className="explore-muted">{visit.query?`Nothing in the field matches “${visit.query}”.`:"The field holds no projected subjects yet."}</li>}
        </ol>
      </div>}
    </>}
    {selected&&isEntry&&(reading?<PresentationBody reading={reading} relations={view.state==="available"?view.relations:[]} onOpenRef={select} depth={depth} onDepth={setDepth} watch={{available:standing.available,watching:standing.watching,reason:standing.reason,busy:watchBusy,error:watchError,onToggle:()=>void toggleWatch()}} strip={strip}/>:<section className="presentation-body" data-presentation-state="reading">{strip}<Loading label="Reading the projected subject…" scope="inline"/></section>)}
    {selected&&!isEntry&&<section className="presentation-body" data-presentation-state="local">{strip}{selected.startsWith("oi:field:")?<FieldBody field_ref={selected} view={view} snapshot={snapshot} onOpenRef={select}/>:snapshot&&!isUnavailable(snapshot)?<BeingEncounter participantRef={selected} snapshot={snapshot} onOpenRef={select}/>:<p role="status" className="explore-absent">The projected Being is unavailable.</p>}</section>}
  </section>;
}

/** A SharedField as an ordinary Surface body: identity, standing, its members, its entries, and the caller's own membership. */
function FieldBody({field_ref,view,snapshot,onOpenRef}:{field_ref:string;view:FieldView;snapshot?:Snapshot;onOpenRef:(ref:string)=>void}) {
  const field=view.state==="available"?view.fields.find(f=>f.field_ref===field_ref):undefined;
  if(!field||!snapshot||isUnavailable(snapshot))return <p role="status" className="explore-absent">The field <code>{field_ref}</code> is not in the caller-visible reading.</p>;
  const members=snapshot.participants.filter(p=>p.field_ref===field_ref);
  const entries=snapshot.entries.filter(e=>snapshot.entry_fields?.[e.ref]===field_ref);
  const mine=snapshot.my_authority.filter(a=>a.field_ref===field_ref&&!a.revoked);
  return <article className="world-presentation world-presentation--field" data-field-ref={field_ref} data-field-visibility={field.visibility} data-membership={mine.length?mine.map(a=>a.role).join(","):"none"}>
    <header className="world-presentation__masthead"><div><div className="world-component__eyebrow">SharedField · {field.kind} · {field.visibility}</div><h1>{field.title??field_ref}</h1></div><div className="world-presentation__revision">{mine.length?`you: ${mine.map(a=>`${a.participant_ref} (${a.role})`).join(", ")}`:"you: no membership"}</div></header>
    <section className="world-region" data-region-role="members"><div className="world-region__label">Participants · {members.length}</div><div className="world-region__components"><div className="world-component__collection">{members.map(p=><button type="button" key={p.participant_ref} onClick={()=>onOpenRef(p.participant_ref)}><strong>{p.presentation?.chosen_name??p.participant_ref}</strong><span>{p.identity.kind} · {p.identity.ref}</span></button>)}</div></div></section>
    <section className="world-region" data-region-role="entries"><div className="world-region__label">Projected subjects · {entries.length}</div><div className="world-region__components"><div className="world-component__collection">{entries.map(e=><button type="button" key={e.ref} onClick={()=>onOpenRef(e.ref)}><strong>{e.label}</strong><span>{kindLabel(e.kind)}</span></button>)}</div></div></section>
    <p className="explore-muted">Join and Request access are not exposed by this desktop's field client yet; membership shown is the client's own authority reading.</p>
  </article>;
}
