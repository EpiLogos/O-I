import {useSyncExternalStore} from "react";
import type {SelectionCandidate} from "./selectionModel";
/** Transient selection/view state only. Native prepared records remain in AIKit. */
export interface PreviewState {candidate?:SelectionCandidate;title?:string;error?:string;busy?:boolean;notice?:string}
let current:PreviewState={};const listeners=new Set<()=>void>();
export function setContextPreview(next:PreviewState){current=next;listeners.forEach(fn=>fn());}
export function getContextPreview(){return current;}
export function useContextPreview(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getContextPreview,getContextPreview);}
export function addPreviewToContext(){const candidate=current.candidate;if(candidate)window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:candidate}));}
