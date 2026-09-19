/**
 * The Factory right-desk planes: shared prop contract, the receiving Claims
 * & Evidence model (no owner Claim/Evidence operation exists yet — Factory
 * #222 / O:I #220 supply it), and one small per-accompanying, per-plane UI
 * state store so a plane's selection, expanded rows and paused-follow flag
 * survive being unmounted and remounted by tab changes, collapse, split and
 * maximise (the panel remounts plane bodies; nothing here is a desktop
 * session store — the transcript and draft stay AIKit-owned in
 * encounter/session.ts, this only holds each plane's own reading position).
 */
import {useCallback,useSyncExternalStore} from "react";

/** The selected canvas subject, exactly as AgentLayer's own AgentSubject
 * narrows it for the desk (see AgentLayer.tsx — this is a structural subset,
 * not a competing type). */
export interface DeskSubject { ref?: string; kind?: string; title: string; project?: string }
/** The bound encounter session identity — the same shape AgentLayer passes
 * as `accompanying` (encounter/session.ts EncounterSessionBinding). */
export interface DeskAccompanying { ref: string; project: string; space: string }
export interface DeskPlaneProps { subject: DeskSubject; accompanying?: DeskAccompanying; onMessage?: (message: string) => void }

/** One stop in the compact work-scope breadcrumb. Only stops a real ref or
 * label backs are ever built — a missing level is omitted, never faked. */
export interface WorkScopeStop { level: "day"|"now"|"task"|"act"|"context"|"claim"|"result"; label: string; ref?: string }

// ---------------------------------------------------------------------------
// Claims & evidence — a receiving model. No native Claim/Evidence/Assessment
// operation exists in kernel/types.ts today (grepped: no "claim" or
// "evidence" op or result). These are presentation types a real source can
// be adapted onto through the registry below; until one registers, the plane
// shows a named unavailable state instead of inventing data.
// ---------------------------------------------------------------------------

export type ClaimsSourceKind="native"|"fixture";
/** What is asserted, about which exact state, by whom, on what basis. */
export interface ClaimRecord {
 ref:string;
 source:ClaimsSourceKind;
 /** The sender's own words — never rewritten into a score. */
 assertion:string;
 subjectRef?:string;
 subjectRevision?:string;
 sender?:string;
 /** The sender's supplied basis: refs, revisions, prior reports. */
 basis?:string[];
 observedAtUnixMs?:number;
}
/** What supports or challenges a claim. */
export interface EvidenceRecord {
 ref:string;
 source:ClaimsSourceKind;
 claimRef:string;
 relation:"supports"|"challenges";
 summary:string;
 originRef?:string;
 observedAtUnixMs?:number;
}
/** The receiver's own judgement — kept visually separate from the sender's
 * assertion throughout the plane; authentication establishes sender identity,
 * never truth. */
export interface AssessmentRecord {
 ref:string;
 source:ClaimsSourceKind;
 claimRef:string;
 assessment:string;
 obligationsOpen?:string[];
 assessedAtUnixMs?:number;
}
export interface ClaimsReading { claims:ClaimRecord[]; evidence:EvidenceRecord[]; assessments:AssessmentRecord[] }
/** An adapter onto a real claims/evidence producer, registered by whatever
 * owns that read (a native reading once one exists, or the dev fixture). */
export interface ClaimsSource { id:string; label:string; kind:ClaimsSourceKind; read(accompanying:DeskAccompanying):Promise<ClaimsReading> }

const claimsRegistry=new Map<string,ClaimsSource>();
export function registerClaimsSource(source:ClaimsSource) { claimsRegistry.set(source.id,source); }
export function unregisterClaimsSource(id:string) { claimsRegistry.delete(id); }
/** The first registered source (native sources, once they exist, take the
 * registry slot ahead of the dev-only fixture — see fixtures.dev.ts). */
export function claimsSource():ClaimsSource|undefined { return [...claimsRegistry.values()][0]; }
export function claimsSources():ClaimsSource[] { return [...claimsRegistry.values()]; }

// ---------------------------------------------------------------------------
// Per-accompanying, per-plane state — plain Map + useSyncExternalStore, no
// localStorage. Keyed `${plane}:${accompanying.ref}` so a plane's held
// selection/expanded set/paused flag/held revision outlives its own unmount.
// ---------------------------------------------------------------------------

type Listener=()=>void;
const deskStore=new Map<string,unknown>();
const deskListeners=new Map<string,Set<Listener>>();
const deskKey=(plane:string,ref:string)=>`${plane}:${ref}`;
function deskSubscribe(key:string,listener:Listener) {
 let set=deskListeners.get(key);
 if(!set){set=new Set();deskListeners.set(key,set);}
 set.add(listener);
 return ()=>{set!.delete(listener);};
}
function deskEmit(key:string) { for(const listener of [...(deskListeners.get(key)??[])])listener(); }
/** Non-reactive read — used where one plane reads another plane's held
 * selection to build a breadcrumb, without subscribing to it. */
export function deskSnapshot<T>(plane:string,ref:string|undefined):T|undefined {
 return ref?deskStore.get(deskKey(plane,ref)) as T|undefined:undefined;
}
export function deskSet<T>(plane:string,ref:string,updater:Partial<T>|((prev:T)=>T),init:T) {
 const key=deskKey(plane,ref);
 const prev=(deskStore.get(key) as T|undefined)??init;
 const next=typeof updater==="function"?(updater as (prev:T)=>T)(prev):{...prev,...updater};
 deskStore.set(key,next);
 deskEmit(key);
}
/** A plane's own held state, keyed by the accompanying session's ref. With no
 * accompanying, the hook still returns `init` (uncontrolled, never stored) —
 * the plane's own "No accompanying session" state renders instead of this. */
export function useDeskState<T>(plane:string,ref:string|undefined,init:T):[T,(updater:Partial<T>|((prev:T)=>T))=>void] {
 const key=ref?deskKey(plane,ref):undefined;
 const subscribe=useCallback((listener:Listener)=>key?deskSubscribe(key,listener):()=>{},[key]);
 const getSnapshot=useCallback(()=>{
  if(!key)return init;
  let value=deskStore.get(key) as T|undefined;
  if(value===undefined){value=init;deskStore.set(key,value);}
  return value;
 },[key,init]);
 const state=useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
 const setState=useCallback((updater:Partial<T>|((prev:T)=>T))=>{if(key)deskSet<T>(plane,key.slice(plane.length+1),updater,init);},[plane,key,init]);
 return [state,setState];
}

/** A stable clip of long verbatim material: bounded to `limit` chars with an
 * explicit "Show all" the caller wires to a toggle. Never a summary — a cut,
 * named as one. */
export function clipped(text:string,limit=4000):{shown:string;truncated:boolean;fullLength:number} {
 if(text.length<=limit)return {shown:text,truncated:false,fullLength:text.length};
 return {shown:text.slice(0,limit),truncated:true,fullLength:text.length};
}
