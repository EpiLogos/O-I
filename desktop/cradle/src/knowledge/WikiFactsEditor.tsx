import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {KernelTransportStatus} from '../kernel/types';
import {TimePlaceFields} from './ParticipationFacts';
import {factsKey,factsRecorded,inspectFacts,prepareFacts,saveFacts,type FactsBasis,type FactsCheckpoint} from './wikiFacts';
import {newRef} from './construction';
import type {TimePlaceValues} from './ParticipationFacts';
import type {TechnePlaceFacet} from '../techne/contract';
import type {PlaceDraft} from '../../expressions-app/vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring';
import './wikiConstruction.css';
const OpenFacts=createContext<((reference:string,onSaved?:()=>void)=>void)|undefined>(undefined);
const message=(error:unknown)=>error instanceof Error?error.message:String(error);

/** Lane-4 T17b/T17c: the route a constellation open hands the time/place editor: the map's draft when the map offered one.
 * It stays on this module map rather than the construction frame: the frame is layout state persisted to localStorage
 * (surface/persist.ts), so a draft there would survive reloads and could be consumed only by a layout write outside the editor.
 * A route is keyed by its subject, expires, and is consumed only after the owner's read of that subject succeeds, so a
 * failed read keeps it for the retry. Never saved. A later open of the same subject replaces it. */
export const CONSTELLATION_ROUTE_TTL_MS=10*60*1000;
export interface ConstellationRoute {subject:string;draft?:PlaceDraft;offered_at:number}
const constellationRoutes=new Map<string,ConstellationRoute>();
/** The constellation a time/place editor opened through, so its save answer can return to whoever opened it. */
export interface PlaceRoute {frame_ref:string;place_ref?:string}
const isFresh=(route:ConstellationRoute,now:number)=>now-route.offered_at<=CONSTELLATION_ROUTE_TTL_MS;
export function offerConstellationRoute(frameRef:string,draft?:PlaceDraft,now:number=Date.now()):void{
 for(const [subject,route] of constellationRoutes)if(!isFresh(route,now))constellationRoutes.delete(subject);
 constellationRoutes.set(frameRef,{subject:frameRef,draft:draft?structuredClone(draft):undefined,offered_at:now});
}
/** The fresh route offered for exactly this subject, or nothing. Expired entries are released here. Never consumes. */
export function peekConstellationRoute(subject:string,now:number=Date.now()):ConstellationRoute|undefined{
 const route=constellationRoutes.get(subject);
 if(!route)return undefined;
 if(isFresh(route,now))return route;
 constellationRoutes.delete(subject);
 return undefined;
}
/** The route a successful owner read of `basisRef` answers: only the route offered for that same subject, while fresh.
 * A basis of any other subject takes nothing, so a draft never reaches a different constellation or node. Pure of the map's writes. */
export function routeReadFor(subject:string,basisRef:string,now:number=Date.now()):ConstellationRoute|undefined{
 const route=peekConstellationRoute(subject,now);
 return route&&route.subject===basisRef?route:undefined;
}
/** Consumed only after the owner has read the route's own subject. */
export function consumeConstellationRoute(subject:string):void{constellationRoutes.delete(subject);}
/** The subject's editor left: its unconsumed route is released and can never apply later. */
export function dropConstellationRoute(subject:string):void{constellationRoutes.delete(subject);}
const coordinateLabel=(lat:number,lon:number)=>`${lat.toFixed(5)}, ${lon.toFixed(5)}`;
/** The place facet's geometry and precision start from the map's draft. The source basis is left empty: it stays required. Pure. */
export function applyPlaceDraft(values:TimePlaceValues,draft:PlaceDraft):{values:TimePlaceValues;notice:string}{
 const places=values.places??[],at=[draft.lon,draft.lat];
 const moved=draft.from?` moved from ${coordinateLabel(draft.from.lat,draft.from.lon)}`:'';
 const notice=`Draft from the map: ${draft.precision} point at ${coordinateLabel(draft.lat,draft.lon)}${moved}. Not saved. Choose and read an evidence source for this place, then Save time and place.`;
 const index=draft.place_ref?places.findIndex(fact=>fact.place_ref===draft.place_ref):-1;
 if(index>=0){
  const fact=places[index];
  if(fact.geometry?.type==='polygon')return {values,notice:'The saved region keeps its polygon, so the map draft was not applied.'};
  // A moved position is new evidence: its previous basis is not carried over, so the person chooses one again.
  const next=places.map((row,i)=>i===index?{...row,geometry:{type:'point',coordinates:at},precision:draft.precision,source_ref:undefined} as TechnePlaceFacet:row);
  return {values:{...values,places:next},notice};
 }
 // A move names a marker this constellation does not hold: there is nothing to move, so nothing is drafted.
 if(draft.from&&draft.place_ref)return {values,notice:'The moved place is not in this constellation, so the map draft was not applied.'};
 const fact={place_ref:draft.place_ref??newRef('wiki:place'),precision:draft.precision,identity:{names:[{name:''}]},geometry:{type:'point',coordinates:at}} as TechnePlaceFacet;
 return {values:{...values,places:[...places,fact]},notice};
}
const reportRoute=(route:PlaceRoute|undefined,outcome:{kind:'saved'}|{kind:'refused';reason:string})=>{if(route&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('oi:constellation-result',{detail:{target:route,...outcome}}));};
/** A routed save answers the map exactly once: a refusal when the save did not complete, a saved answer when it did.
 * A failure after the owner has saved (the local confirm) reports to the editor only, never a second answer. */
export async function settleRoutedSave<T>(route:PlaceRoute|undefined,save:()=>Promise<T>,onSaved:(value:T)=>void,onError:(reason:string)=>void):Promise<void>{
 let value:T;
 try{value=await save();}
 catch(cause){const reason=message(cause);reportRoute(route,{kind:'refused',reason});onError(reason);return;}
 reportRoute(route,{kind:'saved'});
 try{onSaved(value);}catch(cause){onError(message(cause));}
}
/** `routed` is the construction request a map route opened the panel with. That request auto-opens this editor once,
 * when the panel is idle, and only for the subject the route names (the lookup is by the button's own reference). */
export function WikiFactsButton({reference,disabled=false,onSaved,routed}:{reference:string;disabled?:boolean;onSaved?:()=>void;routed?:string}){
 const open=useContext(OpenFacts);
 const autoOpened=useRef<string>();
 useEffect(()=>{
  if(!routed||disabled||!open||autoOpened.current===routed)return;
  autoOpened.current=routed;
  if(peekConstellationRoute(reference))open(reference,onSaved);
 },[routed,disabled,open,reference]);
 return open?<button type="button" className="oi-action" disabled={disabled} onClick={()=>open(reference,onSaved)}>Edit time and place</button>:null;
}
/** The existing knowledge surface retains drafts. Closing this panel only
 * releases its presentation, never the captured native operation or inputs. */
export function WikiFactsProvider({transport,project,checkpoints,onCheckpoint,onSaved,children}:{transport:KernelTransportStatus;project?:string;checkpoints:Record<string,FactsCheckpoint>;onCheckpoint:(key:string,value:FactsCheckpoint)=>void;onSaved:()=>void;children:ReactNode}){
 const [selected,setSelected]=useState<string>(),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[observed,setObserved]=useState<FactsBasis>();
 const current=useRef(checkpoints);current.current=checkpoints;
 const target=useRef<string>(),ticket=useRef(0),returnFocus=useRef<HTMLElement|null>(null),notify=useRef<(()=>void)|undefined>(),route=useRef<PlaceRoute|undefined>(undefined);
 const panel=useRef<HTMLElement|null>(null);
 const held=selected?checkpoints[selected]:undefined;
 useEffect(()=>{if(selected)panel.current?.querySelector<HTMLButtonElement>('[data-facts-close]')?.focus();},[selected]);
 // The frame leaving releases its unconsumed map route: it is never applied after the editor is gone.
 useEffect(()=>()=>{ticket.current++;if(target.current)dropConstellationRoute(target.current);},[]);
 const close=()=>{ticket.current++;if(target.current)dropConstellationRoute(target.current);target.current=undefined;route.current=undefined;setSelected(undefined);setBusy('');setObserved(undefined);returnFocus.current?.isConnected&&returnFocus.current.focus();};
 const open=async(reference:string,callback?:()=>void)=>{
  const id=++ticket.current;target.current=reference;returnFocus.current=document.activeElement as HTMLElement|null;notify.current=callback;setError('');setNotice('');setObserved(undefined);
  route.current=undefined;
  const retained=Object.entries(current.current).find(([,item])=>item.basis.target.ref===reference);
  if(retained){
   // Nothing is read here, so this subject's route is answered now; a withheld draft keeps its route for a later open.
   const live=routeReadFor(reference,reference),offered=live?.draft;
   if(offered&&retained[1].pending)setNotice('A pending time and place save is retained, so the map draft was not applied. Inspect it first.');
   else{
    if(offered){const seeded=applyPlaceDraft(retained[1].draft,offered);onCheckpoint(retained[0],{...retained[1],draft:structuredClone(seeded.values)});setNotice(seeded.notice);}
    if(live){consumeConstellationRoute(reference);route.current={frame_ref:reference,place_ref:offered?.place_ref};}
   }
   setBusy('');setSelected(retained[0]);return;}
  setBusy('Reading native facts…');setSelected('loading');
  try{const basis=await inspectFacts(transport,project,reference);if(id!==ticket.current)return;const key=factsKey(basis.target);
   // A failed read never reaches this line, so its route and draft stay for the retry. A read of another subject takes nothing.
   const live=routeReadFor(reference,basis.target.ref),offered=live?.draft;const seeded=offered?applyPlaceDraft(basis.values,offered):undefined;
   onCheckpoint(key,{basis,draft:structuredClone(seeded?seeded.values:basis.values)});
   if(live){consumeConstellationRoute(reference);route.current={frame_ref:reference,place_ref:offered?.place_ref};}
   if(seeded)setNotice(seeded.notice);setSelected(key);}
  catch(cause){if(id===ticket.current)setError(message(cause));}
  finally{if(id===ticket.current)setBusy('');}
 };
 const store=(value:FactsCheckpoint)=>{if(!selected||!held)return false;try{onCheckpoint(selected,value);return true;}catch(cause){setError(`Inputs could not be retained: ${message(cause)}`);return false;}};
 const confirm=(basis:FactsBasis)=>{
  if(!selected)return;onCheckpoint(selected,{basis,draft:structuredClone(basis.values)});setObserved(undefined);setNotice(`Saved and read back · revision ${basis.revision}.`);onSaved();notify.current?.();
 };
 const save=async()=>{
  if(!held||!selected)return;const id=++ticket.current,routed=route.current,key=selected;setBusy('Saving native facts…');setError('');setNotice('');
  await settleRoutedSave(routed,async()=>{const pending=structuredClone(prepareFacts(held)),checkpoint={...held,pending};onCheckpoint(key,checkpoint);return saveFacts(transport,project,checkpoint);},
   // Once the map has heard its route saved, the route is spent: a later save in this editor is the person's own edit.
   basis=>{if(routed&&route.current===routed)route.current=undefined;if(id===ticket.current)confirm(basis);},
   reason=>{if(id===ticket.current)setError(reason);});
  if(id===ticket.current)setBusy('');
 };
 const inspect=async()=>{
  if(!held)return;const id=++ticket.current;setBusy('Reading saved state…');setError('');
  try{const fresh=await inspectFacts(transport,project,held.basis.target.ref);if(id!==ticket.current)return;if(fresh.source_ref!==held.basis.source_ref)throw Error('The native register identity changed; the retained inputs have not been rebased.');
   setObserved(fresh);
   setNotice(`Native revision ${fresh.revision}: ${fresh.values.temporal?.length??0} time facts and ${fresh.values.places?.length??0} place facts. ${held.pending?(factsRecorded(fresh,held.pending)?'A matching recorded result is visible. Retry the exact save so the owner can verify its operation identity and source continuity.':'The retained proposal is not confirmed.'):'Your inputs are retained.'}`);
  }catch(cause){if(id===ticket.current)setError(message(cause));}finally{if(id===ticket.current)setBusy('');}
 };
 const rebase=()=>{if(!held||!observed)return;if(!store({basis:observed,draft:held.draft}))return;setObserved(undefined);setNotice('Current native revision adopted explicitly. Your inputs are kept; saving creates a new operation.');};
 return <OpenFacts.Provider value={(reference,callback)=>void open(reference,callback)}>{children}{selected&&<section ref={panel} className="wiki-construction oi-sidecar" role="dialog" aria-modal="false" aria-label="Edit native time and place" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
  <header><h2>Time and place{held?held.basis.target.kind==='node'?' · this node':' · this whole constellation':''}</h2><button type="button" className="oi-tool" data-facts-close aria-label="Close time and place editor" onClick={close}>×</button></header>
  <p>Closing keeps these inputs and any pending save. Only Save changes the native Wiki.</p>
  {held&&<><p>{held.basis.title} · saved revision {held.basis.revision}</p><fieldset disabled={!!busy||!!held.pending}><TimePlaceFields identity={factsKey(held.basis.target)} value={held.draft} basis={held.basis.values} transport={transport} summary="Time and place values" description={held.basis.target.kind==='node'?'These facts belong to this native node wherever it is read. Participation facts remain separate.':'These facts belong to the whole native frame. They do not change its members or their participation facts.'} onChange={draft=>{if(store({...held,draft})){setError('');setNotice('');}}}/></fieldset>
   <div className="wiki-construction-toolbar"><button className="oi-action" disabled={!!busy} onClick={()=>void save()}>{held.pending?'Retry exact save':'Save time and place'}</button><button className="oi-action" disabled={!!busy} onClick={()=>void inspect()}>Inspect saved state</button></div>
   {held.pending&&<p>The exact pending operation is retained. Inspect before changing or retrying it.</p>}
   {observed&&(!held.pending||!observed.operations[held.pending.operation_ref])&&<button className="oi-action" disabled={!!busy} onClick={rebase}>Use current revision, keep my inputs</button>}
  </>}
  {busy&&<p role="status">{busy}</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>}</OpenFacts.Provider>;
}
