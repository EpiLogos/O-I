/** M4′ place-reading panel (W1–W5) — for the selected located member, shows
 * place identity, relation type, hierarchy, validity, precision, uncertainty
 * and source standing over the m0m5 Place models (`../../../src/techne/m0m5/
 * place/*`), never over an invented coordinate. Mythic standing is styled
 * distinctly and is never presented as factual (world.ts's own
 * `relationStandingClass`, preserved verbatim). Filters (W2) are
 * presentation-only. Time/place editing (W3) opens the same native
 * constellation route "Edit constellation" already uses — this panel never
 * writes a coordinate itself. Unavailable reference-frame legs (W4) are
 * shown with their exact reason, never hidden. A disclosed TRAVELLED_TO
 * chain renders as a presentation-only ordering (W5) — no route identity is
 * minted here, matching `routeModel`'s own note. */
import React,{useEffect,useState} from 'react';
import {techneConstellationRequest,type TechneConstellationRequest} from './kernelExpressions.js';
import type {TechnePlaceFacet,TechneReading} from '../../../src/techne/contract';
import {depthChain,placeRelations,routeModel,worldState,type DepthState} from '../../../src/techne/m0m5/place/world';
import {placeState,renderStreetModel} from '../../../src/techne/m0m5/place/modes';
import {equirectBounds,projectEquirect,DEFAULT_CAMERA} from '../../../src/techne/m0m5/place/project';
import {
 filteredFacets,filteredReading,placeFilterOptions,toggleFilterMembership,
 type PlaceFilterState,
} from './placeReading.js';
import './placeFacetsPanel.css';

/** W3 — opens the SAME native constellation-authoring route "Edit
 * constellation" (researchInstruments.tsx's `ConstellationAction`) uses;
 * this panel never edits place/time locally. */
function EditPlaceTimeAction({request,onError}:{request:Omit<TechneConstellationRequest,'operation'>;onError:(message:string)=>void}){
 const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false);
 const key=JSON.stringify(request);
 useEffect(()=>{
  let live=true;setAvailable(false);
  void techneConstellationRequest({...request,operation:'inspect'}).then(()=>{if(live)setAvailable(true);}).catch(()=>{});
  return()=>{live=false;};
 },[key]);
 if(!available)return null;
 return <button className="place-facets-edit" disabled={busy} onClick={()=>{
  setBusy(true);
  void techneConstellationRequest({...request,operation:'open'}).catch(error=>onError(error instanceof Error?error.message:String(error))).finally(()=>setBusy(false));
 }}>Edit place/time</button>;
}

function depthLabel(depth:DepthState['depth']):string{
 switch(depth){
  case 'm1-harmonic':return 'M1 harmonic/phase';
  case 'm2-planetary':return 'M2 planetary/correspondential';
  case 'm3-world-clock':return 'M3 world-clock';
  case 'm4-nara-earthbody':return 'M4 EarthBody/Nara';
 }
}

/** A small, presentation-only polyline over the reading's own TRAVELLED_TO
 * stops — no route identity is minted (routeModel's own note, carried
 * verbatim beneath the drawing). The stop order and point positions are
 * read straight from the facets that produced the route; nothing is
 * interpolated or invented for stops the reading leaves unlocated. */
function RouteOverlay({route,facets}:{route:ReturnType<typeof routeModel>;facets:readonly TechnePlaceFacet[]}){
 if(!route)return null;
 const width=240,height=64;
 const bounds=equirectBounds(DEFAULT_CAMERA);
 const byRef=new Map(facets.map(facet=>[facet.place_ref,facet]));
 const points=route.stops.map(stop=>{
  const geometry=byRef.get(stop.place_ref)?.geometry;
  if(!geometry||geometry.type!=='point'||!Array.isArray(geometry.coordinates))return null;
  const [lon,lat]=geometry.coordinates;
  return typeof lon==='number'&&typeof lat==='number'?projectEquirect(lon,lat,bounds,width,height):null;
 }).filter((point):point is {x:number;y:number}=>point!==null);
 return <div className="place-facets-route" aria-label="Movement ordering (presentation only, no route identity minted)">
  {points.length>=2&&<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="place-facets-route-svg">
   <polyline points={points.map(point=>`${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.5}/>
   {points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={2.5}/>)}
  </svg>}
  <ol>
   {route.stops.map((stop,index)=><li key={`${stop.place_ref}-${index}`}>
    <span className="place-facets-route-label">{stop.label??stop.place_ref}</span>
    {stop.ordering_bound&&<span className="place-facets-route-bound"> · {stop.ordering_bound}</span>}
   </li>)}
  </ol>
  <p className="place-facets-route-note">{route.note}</p>
 </div>;
}

export interface PlaceFacetsPanelProps {
 reading:TechneReading|null;
 selectedRef:string|null;
 filter:PlaceFilterState;
 onFilterChange:(next:PlaceFilterState)=>void;
 /** Present only when the reading's subject binds a Scene entity in the
  * current native document (W3). Absent means honestly no edit route. */
 editRequest?:Omit<TechneConstellationRequest,'operation'>;
 onError:(message:string)=>void;
}

export function PlaceFacetsPanel({reading,selectedRef,filter,onFilterChange,editRequest,onError}:PlaceFacetsPanelProps){
 const status=placeState(reading);
 const options=placeFilterOptions(reading);
 const facets=filteredFacets(reading,filter);
 const narrowed=filteredReading(reading,filter);
 const world=worldState(narrowed,{mode:'street',window:filter.window,selectedRef});
 const street=renderStreetModel(facets,{selectedRef,window:filter.window});
 const relations=placeRelations(facets);
 const depths=depthChain(reading);
 const route=routeModel(facets,filter.window);

 const toggleRelation=(value:string)=>onFilterChange({...filter,relations:toggleFilterMembership(filter.relations,options.relations,value)});
 const toggleStanding=(value:'factual'|'mythic'|'owner-vocabulary')=>onFilterChange({...filter,standing:toggleFilterMembership(filter.standing,options.standing,value)});
 const setWindowEdge=(edge:'from'|'to',value:string)=>onFilterChange({...filter,window:{from:filter.window?.from??null,to:filter.window?.to??null,[edge]:value.trim()?value.trim():null}});

 return <section className="place-facets-panel" aria-label="Place reading">
  <header><h3>Place</h3></header>
  {status.status!=='present'&&<p className="place-facets-message" role="status">{status.reason}</p>}

  {(options.relations.length>0||options.standing.length>0)&&<fieldset className="place-facets-filters">
   <legend>Filters (presentation only)</legend>
   {options.relations.length>0&&<div className="place-facets-filter-group">
    <span>Relation</span>
    {options.relations.map(value=><label key={value}><input type="checkbox" checked={!filter.relations||filter.relations.has(value)} onChange={()=>toggleRelation(value)}/>{value}</label>)}
   </div>}
   {options.standing.length>0&&<div className="place-facets-filter-group">
    <span>Standing</span>
    {options.standing.map(value=><label key={value}><input type="checkbox" checked={!filter.standing||filter.standing.has(value)} onChange={()=>toggleStanding(value)}/>{value}</label>)}
   </div>}
   <div className="place-facets-filter-group">
    <span>Valid within</span>
    <label>From<input type="text" placeholder="open" value={filter.window?.from??''} onChange={event=>setWindowEdge('from',event.target.value)}/></label>
    <label>To<input type="text" placeholder="open" value={filter.window?.to??''} onChange={event=>setWindowEdge('to',event.target.value)}/></label>
   </div>
  </fieldset>}

  {!selectedRef&&<p className="place-facets-message" role="status">No place disclosed — select a place on the map to inspect it.</p>}

  {selectedRef&&!street.place&&<p className="place-facets-message" role="status">No place disclosed for this member — either the filter above excludes it, or the reading discloses no place facet for it.</p>}

  {street.place&&world?.selected&&<div className={`place-facets-detail place-standing-${world.selected.standing_class}`}>
   <h4>{street.standing_name??street.place_ref}</h4>
   {world.selected.standing_class==='mythic'&&<p className="place-facets-mythic-note" role="note">Mythic — a disclosed narrative location, never presented as a factual one.</p>}
   <dl>
    <dt>Place ref</dt><dd>{street.place_ref}</dd>
    <dt>Relation</dt><dd>{street.relation??'(relation not disclosed)'} <span className="place-standing-tag">{world.selected.standing_class}</span></dd>
    <dt>Precision</dt><dd>{street.precision} — {street.precision_note}</dd>
    {street.uncertainty&&<><dt>Uncertainty</dt><dd>{street.uncertainty}</dd></>}
    <dt>Validity</dt><dd>{street.valid_from??'open'} — {street.valid_to??'open'}</dd>
    {street.source_ref&&<><dt>Source</dt><dd>{street.source_ref}</dd></>}
    {street.observer_frame&&<><dt>Observer frame</dt><dd>{street.observer_frame}</dd></>}
   </dl>
   {street.hierarchy.length>0&&<div className="place-facets-hierarchy">
    <h5>Hierarchy</h5>
    <ol>{street.hierarchy.map((row,index)=><li key={`${row.place_ref}-${index}`}>
     {row.parent_name??row.place_ref} <span className="place-facets-hierarchy-relation">({row.relation})</span>
     {(row.valid_from||row.valid_to)&&<span className="place-facets-hierarchy-window"> · {row.valid_from??'open'}–{row.valid_to??'open'}</span>}
    </li>)}</ol>
   </div>}
   {editRequest&&<EditPlaceTimeAction request={editRequest} onError={onError}/>}
  </div>}

  {relations.length>1&&<div className="place-facets-relations">
   <h5>All disclosed places</h5>
   <ul>{relations.map(group=><li key={group.relation} className={`place-standing-${group.standingClass}`}>{group.relation} · {group.facets.length}</li>)}</ul>
  </div>}

  <RouteOverlay route={route} facets={facets}/>

  <div className="place-facets-depths">
   <h5>Reference frame</h5>
   <ul>{depths.map(depth=><li key={depth.depth} data-availability={depth.availability}>
    <strong>{depthLabel(depth.depth)}</strong>: {depth.availability==='disclosed'?depth.disclosed.join(', '):(depth.reason??'unavailable')}
   </li>)}</ul>
  </div>
 </section>;
}
