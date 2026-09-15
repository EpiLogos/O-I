/**
 * Explore's navigation seam, separate from the surface body: the rest of
 * the desktop (Cradle, ShareProjection) hands Explore a subject through
 * these helpers without importing the Explore body (and its presentation
 * renderers) into the startup chunk.
 */
import {EXPLORE_TRAVEL_KEY,currentVisit,decodeExploreTravel,freshExploreTravel,pushVisit} from "./travel.mjs";
import type {DepthState} from "./PresentationBody";

export type Visit={query:string;selected?:string;depth?:DepthState};
export type Travel={schema:string;visits:Visit[];index:number};

export interface PresentationMeta {world_ref:string;field_ref?:string;projection_ref?:string;projection_revision?:number;presentation_ref?:string;presentation_revision?:number;expression_ref?:string;expression_revision?:number}

export const TRAVEL_EVENT="oi:explore-navigate";
export function loadTravel():Travel {
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
