/** M2′ Relation Field — the non-chronological projection switch beside the
 * existing Chronology (vendored `TimelineSurface`, kept unchanged and
 * mounted separately). Authority: `.wayfinder/maps/techne-expression-mode.md`
 * §16 M2′, QL-MEF #215 refinement receipt (M2′ Relation Field model).
 *
 * This view reads the SAME native reading Chronology reads (no second store,
 * no re-keyed relation, no minted member): it projects
 * `desktop/cradle/src/techne/m0m5/timeline/relations.ts`'s pure
 * `relationField`/`edgesForProjection`/`arcLayout` over `reading.whole.relations`
 * onto a compact arc, and groups the field's members into a "Dated" / "Undated"
 * lane pair from `RelationEdge.temporal` — never a fabricated date.
 *
 * Split deliberately: the layout/filter functions below are pure (no React,
 * no DOM) so `relation-field.test.mjs` proves projection selection, the
 * undated lane and standing preservation without mounting anything; the
 * `RelationFieldView` component is the thin renderer over them.
 *
 * Erasable-TypeScript-compatible logic, JSX component on top.
 */
import React,{useMemo,useState} from 'react';
import type {TechneReading} from '../../../src/techne/contract';
import {
 relationField,edgesForProjection,projectionAvailability,arcLayout,transformationCycles,phasesFromFacets,
 type RelationEdge,type RelationField,type RelationProjectionMode,type ArcEdge,type PhaseBand,
} from '../../../src/techne/m0m5/timeline/relations';
import {lanesFromReading,type TimelineLane} from '../../../src/techne/m0m5/timeline/lanes';
import {STANDING_LEGEND,type StandingVisual} from '../../../src/techne/m0m5/timeline/standing';
import './relationFieldView.css';

// ---------------------------------------------------------------------------
// Pure layout/filter engine — no React, no DOM. Tested directly.
// ---------------------------------------------------------------------------

/** The relation-field projections this view offers, i.e. every
 * `RelationProjectionMode` except "timeline" — chronology stays the existing
 * `TimelineSurface`, never duplicated here. */
export type RelationFieldMode=Exclude<RelationProjectionMode,'timeline'>;
export const RELATION_FIELD_MODES:readonly RelationFieldMode[]=['relations','cause','echo','opposition','phase','activity'];
const MODE_LABEL:Record<RelationFieldMode,string>={relations:'All relations',cause:'Causal / dependency',echo:'Recurrence / echo',opposition:'Opposition / transformation',phase:'Phase / cycle',activity:'Activity'};

/** A participant is "Dated" when at least one edge of the WHOLE field (not
 * just the current projection's filtered edges) resolves a dated temporal
 * qualification touching it — so a member's lane never flips as the person
 * switches projections. Never invents a date for an undated member; it only
 * decides which lane an honestly-undated member is shown in. */
export function datedParticipants(field:RelationField):ReadonlySet<string>{
 const dated=new Set<string>();
 for(const edge of field.edges){
  if(edge.temporal.state!=='dated')continue;
  dated.add(edge.from_ref);dated.add(edge.to_ref);
 }
 return dated;
}

/** Presentation-only standing filter. An empty/full set means "no filter" —
 * this never mutates or hides data, only which already-computed edges the
 * surface currently draws. */
export function filterEdgesByStanding(edges:readonly RelationEdge[],standings:ReadonlySet<StandingVisual>):RelationEdge[]{
 if(standings.size===0||standings.size>=STANDING_LEGEND.length)return [...edges];
 return edges.filter(edge=>standings.has(edge.standing_visual));
}

export interface RelationFieldLaneNode{ref:string;x:number;lane:'dated'|'undated'}

export interface RelationFieldArcLayout{
 mode:RelationFieldMode;
 /** The edges actually drawn, after family projection + standing filter.
  * Distinct native relations sharing endpoints stay distinct entries — this
  * is a straight map over `edgesForProjection`, nothing is deduplicated by
  * (from_ref,to_ref). */
 edges:RelationEdge[];
 nodes:RelationFieldLaneNode[];
 arcs:ArcEdge[];
 width:number;
}

/** The arc/lane layout for one relation-projection mode ("relations", "cause",
 * "echo" or "opposition" — the edge-shaped families). Pure geometry: every
 * distinct participant of the FILTERED edge set appears once, positioned by
 * `arcLayout` and assigned to the Dated or Undated lane from the whole
 * field's own temporal resolution. */
export function arcLayoutForMode(field:RelationField,mode:'relations'|'cause'|'echo'|'opposition',width:number,standingFilter:ReadonlySet<StandingVisual>=new Set()):RelationFieldArcLayout{
 const projected=edgesForProjection(field.edges,mode);
 const edges=filterEdgesByStanding(projected,standingFilter);
 const refs=[...new Set(edges.flatMap(edge=>[edge.from_ref,edge.to_ref]))];
 const dated=datedParticipants(field);
 const laid=arcLayout(refs,edges,width);
 const nodes:RelationFieldLaneNode[]=laid.nodes.map(node=>({ref:node.ref,x:node.x,lane:dated.has(node.ref)?'dated':'undated'}));
 // arcLayout's own controlY only encodes distance/alternation, assuming both
 // endpoints share one baseline. This lane view has two baselines (Dated /
 // Undated), so the SVG renderer (ArcPanel) recomputes each curve from
 // (fromX,fromLane)→(toX,toLane) itself; `laid.edges` is kept verbatim here
 // only so a consumer can confirm every filtered edge got exactly one arc.
 return {mode,edges,nodes,arcs:laid.edges,width};
}

export interface RelationFieldPhaseLayout{
 mode:'phase';
 bands:PhaseBand[];
 cycles:RelationEdge[][];
}
/** The phase/cycle projection: honest validity bands (`kind:"valid"` temporal
 * facets — open-ended stays open, nothing invented) alongside transformation
 * cycles walked over the opposition/transformation family's own directions. */
export function phaseLayout(reading:TechneReading,field:RelationField):RelationFieldPhaseLayout{
 return {mode:'phase',bands:phasesFromFacets(reading.temporal??[]),cycles:transformationCycles(field.edges)};
}

export interface RelationFieldActivityLayout{
 mode:'activity';
 lanes:TimelineLane[];
}
/** The activity projection reuses the EXISTING continuity-lane model
 * (`lanes.ts`) over the same reading's `temporal[]` — no second grouping. */
export function activityLayout(reading:TechneReading):RelationFieldActivityLayout{
 return {mode:'activity',lanes:lanesFromReading(reading)};
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export interface RelationFieldViewProps{
 reading:TechneReading;
 width?:number;
 initialMode?:RelationFieldMode;
 /** Selecting a relation routes through the SAME native selection path as
  * Canvas (`host.select(sceneId,null,bindingRef)`). Only called for a
  * relation carrying a native `relation_ref` (never for a derived,
  * position-based id — there is no native ref to select). */
 onSelectRelation?:(edge:RelationEdge)=>void;
 /** Opening a member routes through `host.inspectSubject(ref)` — the same
  * native object Canvas opens. */
 onOpenMember?:(ref:string)=>void;
}

const LANE_Y={dated:56,undated:150};

export function RelationFieldView({reading,width=720,initialMode='relations',onSelectRelation,onOpenMember}:RelationFieldViewProps){
 const [mode,setMode]=useState<RelationFieldMode>(initialMode);
 const [standingFilter,setStandingFilter]=useState<ReadonlySet<StandingVisual>>(new Set());
 const [selected,setSelected]=useState<RelationEdge|null>(null);
 const field=useMemo(()=>relationField(reading),[reading]);
 const availability=useMemo(()=>projectionAvailability(reading),[reading]);
 const dated=useMemo(()=>datedParticipants(field),[field]);

 const toggleStanding=(visual:StandingVisual)=>{
  setStandingFilter(prev=>{
   const next=new Set(prev.size===0?STANDING_LEGEND.map(l=>l.visual):prev);
   if(next.has(visual))next.delete(visual);else next.add(visual);
   return next;
  });
 };
 const clearStandingFilter=()=>setStandingFilter(new Set());

 const selectEdge=(edge:RelationEdge)=>{
  setSelected(edge);
  if(!edge.derived_id)onSelectRelation?.(edge);
 };

 const availabilityFor=(m:RelationFieldMode)=>availability.find(a=>a.mode===m);

 const body=(()=>{
  if(mode==='phase'){
   const layout=phaseLayout(reading,field);
   return <PhasePanel layout={layout} onSelectEdge={selectEdge} selected={selected}/>;
  }
  if(mode==='activity'){
   return <ActivityPanel layout={activityLayout(reading)}/>;
  }
  const layout=arcLayoutForMode(field,mode,width,standingFilter);
  return <ArcPanel layout={layout} onSelectEdge={selectEdge} onOpenMember={onOpenMember} selected={selected}/>;
 })();

 return <div className="relation-field-view">
  <div className="relation-field-modes" role="tablist" aria-label="Relation projection">
   {RELATION_FIELD_MODES.map(m=>{
    const a=availabilityFor(m);
    return <button key={m} type="button" role="tab" aria-selected={mode===m} aria-pressed={mode===m}
     disabled={a?!a.available:false} title={a?.reason??undefined}
     onClick={()=>{setMode(m);setSelected(null);}}>{MODE_LABEL[m]}{a?.count?` · ${a.count}`:''}</button>;
   })}
  </div>
  <div className="relation-field-filters" aria-label="Standing filter">
   <span className="relation-field-filters-label">Standing</span>
   {STANDING_LEGEND.map(entry=><button key={entry.visual} type="button" title={entry.description}
    className={`relation-field-standing-chip relation-field-standing-${entry.visual}`}
    aria-pressed={standingFilter.size===0||standingFilter.has(entry.visual)}
    onClick={()=>toggleStanding(entry.visual)}>{entry.label}</button>)}
   {standingFilter.size>0&&<button type="button" onClick={clearStandingFilter}>Clear</button>}
  </div>
  <div className="relation-field-body">{body}</div>
  {selected&&<RelationDetail edge={selected} onOpenMember={onOpenMember} onClose={()=>setSelected(null)}/>}
  <p className="relation-field-note">{dated.size} dated member{dated.size===1?'':'s'} · {field.participants.length-dated.size} undated — nothing here invents a date.</p>
 </div>;
}

function ArcPanel({layout,onSelectEdge,onOpenMember,selected}:{layout:RelationFieldArcLayout;onSelectEdge:(edge:RelationEdge)=>void;onOpenMember?:(ref:string)=>void;selected:RelationEdge|null}){
 if(!layout.edges.length)return <p className="relation-field-empty">No relations in this projection (after the current standing filter).</p>;
 const xOf=new Map(layout.nodes.map(n=>[n.ref,n]));
 const height=Math.max(LANE_Y.undated+40,200);
 return <svg className="relation-field-arc" viewBox={`0 0 ${layout.width} ${height}`} role="img" aria-label={`${MODE_LABEL[layout.mode]} relation field`}>
  <line x1={0} y1={LANE_Y.dated} x2={layout.width} y2={LANE_Y.dated} className="relation-field-lane-line"/>
  <line x1={0} y1={LANE_Y.undated} x2={layout.width} y2={LANE_Y.undated} className="relation-field-lane-line"/>
  <text x={4} y={LANE_Y.dated-8} className="relation-field-lane-label">Dated</text>
  <text x={4} y={LANE_Y.undated-8} className="relation-field-lane-label">Undated</text>
  {layout.edges.map(edge=>{
   const from=xOf.get(edge.from_ref),to=xOf.get(edge.to_ref);
   if(!from||!to)return null;
   const fromY=LANE_Y[from.lane],toY=LANE_Y[to.lane];
   const midX=(from.x+to.x)/2,lift=Math.min(80,Math.max(24,Math.abs(to.x-from.x)*0.28));
   const controlY=Math.min(fromY,toY)-lift;
   const d=`M ${from.x} ${fromY} Q ${midX} ${controlY} ${to.x} ${toY}`;
   const isSelected=selected?.id===edge.id;
   return <path key={edge.id} d={d} tabIndex={0} role="button"
    aria-label={`${edge.relation}: ${edge.from_ref} to ${edge.to_ref}, ${edge.standing_visual}${edge.temporal.state==='dated'?', dated':edge.temporal.state==='unresolved'?', unresolved date':''}`}
    className={`relation-field-edge relation-field-standing-${edge.standing_visual}${isSelected?' relation-field-edge-selected':''}`}
    onClick={()=>onSelectEdge(edge)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelectEdge(edge);}}}/>;
  })}
  {layout.nodes.map(node=><g key={node.ref} className="relation-field-node" transform={`translate(${node.x},${LANE_Y[node.lane]})`}>
   <circle r={5} tabIndex={0} role="button" aria-label={`Open ${node.ref}`}
    onClick={()=>onOpenMember?.(node.ref)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpenMember?.(node.ref);}}}/>
  </g>)}
 </svg>;
}

function PhasePanel({layout,onSelectEdge,selected}:{layout:RelationFieldPhaseLayout;onSelectEdge:(edge:RelationEdge)=>void;selected:RelationEdge|null}){
 const positioned=layout.bands.filter(b=>b.fromMs!==null);
 const min=positioned.length?Math.min(...positioned.map(b=>b.fromMs as number)):0;
 const max=positioned.length?Math.max(...positioned.map(b=>b.toMs??b.fromMs as number)):min+1;
 const span=Math.max(1,max-min);
 return <div className="relation-field-phase">
  {layout.bands.length===0&&layout.cycles.length===0&&<p className="relation-field-empty">No validity intervals and no transformation cycles are disclosed — no phase is fabricated.</p>}
  {layout.bands.length>0&&<div className="relation-field-phase-bands">
   {layout.bands.map(band=><div key={band.id} className="relation-field-phase-band-row" title={band.uncertainty??undefined}>
    <span className="relation-field-phase-band-id">{band.facet_ref??band.id}</span>
    {band.fromMs===null?<span className="relation-field-phase-band-unpositioned">no wall-clock position disclosed</span>:
     <div className="relation-field-phase-band-track"><span className="relation-field-phase-band-fill" style={{left:`${((band.fromMs-min)/span)*100}%`,width:`${Math.max(1,(((band.toMs??max)-band.fromMs)/span)*100)}%`}}/></div>}
    {band.toMs===null&&band.fromMs!==null&&<span className="relation-field-phase-band-open">open-ended</span>}
   </div>)}
  </div>}
  {layout.cycles.length>0&&<div className="relation-field-phase-cycles">
   <h4>Transformation cycles</h4>
   {layout.cycles.map((cycle,index)=><p key={index} className="relation-field-phase-cycle">
    {cycle.map((edge,i)=><span key={edge.id}>
     {i>0&&' → '}
     <button type="button" className={`relation-field-cycle-edge relation-field-standing-${edge.standing_visual}${selected?.id===edge.id?' relation-field-edge-selected':''}`} onClick={()=>onSelectEdge(edge)}>{edge.from_ref} —{edge.relation}→ {edge.to_ref}</button>
    </span>)}
   </p>)}
  </div>}
 </div>;
}

function ActivityPanel({layout}:{layout:RelationFieldActivityLayout}){
 if(!layout.lanes.length)return <p className="relation-field-empty">No DAY / NOW / session / run continuity facets are disclosed.</p>;
 return <div className="relation-field-activity">
  {layout.lanes.map(lane=><div key={lane.id} className="relation-field-activity-lane">
   <span className="relation-field-activity-lane-label">{lane.label}{lane.ref?` · ${lane.ref}`:''}</span>
   <span className="relation-field-activity-lane-count">{lane.items.length} item{lane.items.length===1?'':'s'}</span>
  </div>)}
 </div>;
}

function RelationDetail({edge,onOpenMember,onClose}:{edge:RelationEdge;onOpenMember?:(ref:string)=>void;onClose:()=>void}){
 const standing=STANDING_LEGEND.find(l=>l.visual===edge.standing_visual);
 return <div className="relation-field-detail" role="group" aria-label="Selected relation">
  <header><h4>{edge.relation}</h4><button type="button" onClick={onClose} aria-label="Close relation detail">Close</button></header>
  <p className="relation-field-detail-endpoints">
   <button type="button" onClick={()=>onOpenMember?.(edge.from_ref)}>{edge.from_ref}</button>
   {' → '}
   <button type="button" onClick={()=>onOpenMember?.(edge.to_ref)}>{edge.to_ref}</button>
  </p>
  <dl>
   <dt>Identity</dt><dd>{edge.derived_id?'derived (no native relation_ref disclosed)':edge.id}</dd>
   <dt>Standing</dt><dd className={`relation-field-standing-${edge.standing_visual}`}>{standing?.label}{edge.standing_verbatim?` · "${edge.standing_verbatim}"`:''}</dd>
   <dt>Occurrence</dt><dd>{edge.temporal.state==='dated'?'dated':edge.temporal.state==='trans-temporal'?'trans-temporal (no temporal qualification disclosed)':`unresolved${edge.temporal.problem?` — ${edge.temporal.problem}`:''}`}</dd>
   {edge.source_ref&&<><dt>Source</dt><dd>{edge.source_ref}</dd></>}
   {edge.evidence_refs.length>0&&<><dt>Evidence</dt><dd>{edge.evidence_refs.join(', ')}</dd></>}
   {edge.derivation_ref&&<><dt>Derivation</dt><dd>{edge.derivation_ref}</dd></>}
   {edge.confidence&&<><dt>Confidence</dt><dd>{edge.confidence}</dd></>}
   {edge.origin&&<><dt>Origin</dt><dd>{edge.origin}{edge.origin_ref?` (${edge.origin_ref})`:''}</dd></>}
  </dl>
 </div>;
}
