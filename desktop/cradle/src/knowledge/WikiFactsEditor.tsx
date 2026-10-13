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

/** Lane-4 T17b: the route a constellation open hands the time/place editor: the map's draft when the map offered one.
 * Held in memory until that editor opens; never saved. A later constellation open replaces it. */
const constellationRoutes=new Map<string,{draft?:PlaceDraft}>();
/** The constellation a time/place editor opened through, so its save answer can return to whoever opened it. */
export interface PlaceRoute {frame_ref:string;place_ref?:string}
export function offerConstellationRoute(frameRef:string,draft?:PlaceDraft):void{constellationRoutes.set(frameRef,{draft});}
export function takeConstellationRoute(frameRef:string):{draft?:PlaceDraft}|undefined{const offered=constellationRoutes.get(frameRef);constellationRoutes.delete(frameRef);return offered;}
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
const reportRoute=(route:PlaceRoute|undefined,outcome:{kind:'saved'}|{kind:'refused';reason:string})=>{if(route)window.dispatchEvent(new CustomEvent('oi:constellation-result',{detail:{target:route,...outcome}}));};
export function WikiFactsButton({reference,disabled=false,onSaved}:{reference:string;disabled?:boolean;onSaved?:()=>void}){
 const open=useContext(OpenFacts);
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
 useEffect(()=>()=>{ticket.current++;},[]);
 const close=()=>{ticket.current++;target.current=undefined;route.current=undefined;setSelected(undefined);setBusy('');setObserved(undefined);returnFocus.current?.isConnected&&returnFocus.current.focus();};
 const open=async(reference:string,callback?:()=>void)=>{
  const id=++ticket.current;target.current=reference;returnFocus.current=document.activeElement as HTMLElement|null;notify.current=callback;setError('');setNotice('');setObserved(undefined);
  const offeredRoute=takeConstellationRoute(reference),offered=offeredRoute?.draft;
  route.current=offeredRoute?{frame_ref:reference,place_ref:offered?.place_ref}:undefined;
  const retained=Object.entries(current.current).find(([,item])=>item.basis.target.ref===reference);
  if(retained){
   if(offered&&retained[1].pending)setNotice('A pending time and place save is retained, so the map draft was not applied. Inspect it first.');
   else if(offered){const seeded=applyPlaceDraft(retained[1].draft,offered);onCheckpoint(retained[0],{...retained[1],draft:structuredClone(seeded.values)});setNotice(seeded.notice);}
   setBusy('');setSelected(retained[0]);return;}
  setBusy('Reading native facts…');setSelected('loading');
  try{const basis=await inspectFacts(transport,project,reference);if(id!==ticket.current)return;const key=factsKey(basis.target);const seeded=offered?applyPlaceDraft(basis.values,offered):undefined;onCheckpoint(key,{basis,draft:structuredClone(seeded?seeded.values:basis.values)});if(seeded)setNotice(seeded.notice);setSelected(key);}
  catch(cause){if(id===ticket.current)setError(message(cause));}
  finally{if(id===ticket.current)setBusy('');}
 };
 const store=(value:FactsCheckpoint)=>{if(!selected||!held)return false;try{onCheckpoint(selected,value);return true;}catch(cause){setError(`Inputs could not be retained: ${message(cause)}`);return false;}};
 const confirm=(basis:FactsBasis)=>{
  if(!selected)return;onCheckpoint(selected,{basis,draft:structuredClone(basis.values)});setObserved(undefined);setNotice(`Saved and read back · revision ${basis.revision}.`);onSaved();notify.current?.();
 };
 const save=async()=>{
  if(!held||!selected)return;const id=++ticket.current,routed=route.current;setBusy('Saving native facts…');setError('');setNotice('');
  try{const pending=structuredClone(prepareFacts(held)),checkpoint={...held,pending};onCheckpoint(selected,checkpoint);const basis=await saveFacts(transport,project,checkpoint);if(id===ticket.current)confirm(basis);reportRoute(routed,{kind:'saved'});}
  catch(cause){reportRoute(routed,{kind:'refused',reason:message(cause)});if(id===ticket.current)setError(message(cause));}
  finally{if(id===ticket.current)setBusy('');}
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
