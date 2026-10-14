/** Shared time is read from the host's DisclosureSession. This renderer holds
 * input drafts and acknowledged snapshots only; it owns no session or clock. */
import React,{useEffect,useRef,useState} from 'react';
import {validateSession,type DisclosureTraversalHop,type TechneReading} from '../../../src/techne/contract';
import {timeAxis,type SharedTimeWindow} from '../../../src/techne/m0m5/timeline/timeAxis';
import {sceneTitle} from '../../../src/techne/m0m5/journey/beats';
import type {NativeTimeWindowBasis,NativeTimeWindowReply,NativeTimeWindowRequest} from '../../../../../packages/expressions-boundary/src/timeWindow';
import {techneTimeWindowRequest} from './kernelExpressions.js';
import {SHARED_TIME_NUDGE,windowLabel} from '../../../src/techne/session';
import './sharedTimeWindow.css';

export interface SharedTimeDraft {
 from:string;to:string;
 /** Capture the acknowledged target when typing starts. */
 captured:NativeTimeWindowReply|null;
}

export function qualifyTimeWindowReply(raw:unknown,basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place'):NativeTimeWindowReply {
 const value=raw as NativeTimeWindowReply;
 if(!value||value.schema!=='oi.native-time-window/v1'||value.instrument!==instrument
  ||value.reading_ref!==reading.reading_ref||value.basis?.expression_ref!==basis.expression_ref
  ||value.basis?.revision!==basis.revision||value.basis?.scene_ref!==basis.scene_ref
  ||!validateSession(value.session).valid||value.session.subject_ref!==reading.subject.subject_ref
  ||value.session.reading_ref!==reading.reading_ref||value.session.instrument!==instrument
  ||value.session.expression_focus_ref!==basis.expression_ref||value.session.scene_focus_ref!==basis.scene_ref
  ||value.session.selection.subject_ref!==reading.subject.subject_ref||value.session.selection.reading_ref!==reading.reading_ref
  ||value.session.selection.instrument!==instrument
  ||(value.session.selection.snapshot_revision??null)!==(reading.snapshot?.revision??null)
  ||JSON.stringify(value.axis)!==JSON.stringify(timeAxis(reading,value.session.time_window))) {
  throw Error('The host time reading does not address this source and Scene; retained bounds were not changed');
 }
 return structuredClone(value);
}

/** T-FRAME-TIME-PUSH. The host's nudge says only that the session's shared window changed; it carries no value. The frame
 * re-reads through its own read and moves its view when what it reads differs from what it holds. This frame's own writes
 * are tracked: while one is in flight a nudge waits for it, and a read that began before a write settled is never adopted. */
let ownWritesInFlight=0;
let writeGeneration=0;
const writeSettled=new Set<()=>void>();

/** Track one of this frame's own shared-time writes, so the echo of that write is reconciled once and never re-rendered. */
export function trackOwnSharedTimeWrite<T>(write:Promise<T>):Promise<T>{
 ownWritesInFlight++;writeGeneration++;
 const settle=()=>{ownWritesInFlight--;writeGeneration++;for(const listener of [...writeSettled])listener();};
 return write.then(value=>{settle();return value},error=>{settle();throw error});
}

/** The same session window and selection: the sole comparison a nudge's re-read is held to (never a value from the nudge). */
export function sameSharedTime(a:NativeTimeWindowReply,b:NativeTimeWindowReply):boolean{
 return a.session.session_ref===b.session.session_ref
  &&JSON.stringify(a.session.time_window??null)===JSON.stringify(b.session.time_window??null)
  &&JSON.stringify(a.session.selection)===JSON.stringify(b.session.selection);
}

export interface SharedTimeFollow {basis:NativeTimeWindowBasis;reading:TechneReading;instrument:'timeline'|'place';
 /** The lens is still presented for this reading (the guard the presentation read uses). */
 current:()=>boolean;
 /** The window this frame holds: its last acknowledged reply, or null before the presentation read. */
 held:()=>NativeTimeWindowReply|null;
 /** The lens's existing refresh path: called with the re-read reply only when it differs from the held one. */
 refresh:(reply:NativeTimeWindowReply)=>void;
}

/** Follow the host's shared-window nudges for one presented instrument. Returns the teardown. Outside a host frame it does nothing. */
export function followSharedTimeNudges(follow:SharedTimeFollow):()=>void{
 if(typeof window==='undefined'||window.parent===window)return()=>{};
 let live=true,reading=false,pending=false;
 const reconcile=async():Promise<void>=>{
  if(!live)return;
  if(reading||ownWritesInFlight>0){pending=true;return;}
  if(!follow.current())return;
  const held=follow.held();
  if(!held)return;
  reading=true;pending=false;
  const issued=writeGeneration;
  try{
   const reply=await readSharedTimeWindow(follow.basis,follow.reading,follow.instrument,follow.current);
   if(!live)return;
   if(issued!==writeGeneration){pending=true;return;}
   const now=follow.held();
   // The echo of this frame's own write reads back the window it holds: nothing changed, nothing re-renders, nothing is written.
   if(!now||sameSharedTime(now,reply))return;
   follow.refresh(reply);
  }catch{
   // A refused re-read keeps the held window; the presentation read reports the refusal to the reader.
  }finally{
   reading=false;
   if(pending&&live){pending=false;void reconcile();}
  }
 };
 // A settled write reconciles on the next turn, after its writer has acknowledged the reply it holds.
 const settled=()=>{if(pending&&live)setTimeout(()=>void reconcile(),0);};
 writeSettled.add(settled);
 const onMessage=(event:MessageEvent)=>{
  if(!live||event.source!==window.parent||!event.data||typeof event.data!=='object')return;
  const data=event.data as {v?:unknown;kind?:unknown};
  if(data.v!==1||data.kind!==SHARED_TIME_NUDGE)return;
  void reconcile();
 };
 window.addEventListener('message',onMessage);
 return()=>{live=false;writeSettled.delete(settled);window.removeEventListener('message',onMessage);};
}

/** Lane-4 T14: the setter the docked Places time control shares with the popover. It writes the acknowledged session's window against that session (compare-and-set), and returns the qualified reply. */
export async function writeSharedTimeWindow(basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place',acknowledged:NativeTimeWindowReply,window:SharedTimeWindow|null):Promise<NativeTimeWindowReply> {
 if(acknowledged.basis.expression_ref!==basis.expression_ref||acknowledged.basis.scene_ref!==basis.scene_ref
  ||acknowledged.basis.revision!==basis.revision||acknowledged.reading_ref!==reading.reading_ref) {
  throw Error('This time window belongs to an earlier native source or Scene; it was not changed');
 }
 const request:NativeTimeWindowRequest={...basis,operation:'set',reading_ref:reading.reading_ref,instrument,
  expected_session_ref:acknowledged.session.session_ref,expected_selection:acknowledged.session.selection,expected_window:acknowledged.axis.window,window};
 return qualifyTimeWindowReply(await trackOwnSharedTimeWrite(techneTimeWindowRequest(request)),basis,reading,instrument);
}

/** Lane-5 T10/T11: the Journey's crossing rides the same owner compare-and-set as the time writes. Every request carries the
 * acknowledged session's identity whole, never a partial one, and is refused by name when the acknowledged reply belongs to
 * another native Scene or source. Pure: no channel, so the request shapes are testable as they are sent. */
const sameAcknowledgedSource=(basis:NativeTimeWindowBasis,reading:TechneReading,acknowledged:NativeTimeWindowReply)=>{
 if(acknowledged.basis.expression_ref!==basis.expression_ref||acknowledged.basis.scene_ref!==basis.scene_ref
  ||acknowledged.basis.revision!==basis.revision||acknowledged.reading_ref!==reading.reading_ref) {
  throw Error('This Journey belongs to an earlier native source or Scene; it was not changed');
 }
};
/** The refresh that places the presented Scene as the Journey's explicit ground before a crossing. It keeps the session's trail. */
export function journeyRefreshRequest(basis:NativeTimeWindowBasis,reading:TechneReading):NativeTimeWindowRequest {
 return {...basis,operation:'refresh',reading_ref:reading.reading_ref,instrument:'journey'};
}
export function journeyCrossingRequest(basis:NativeTimeWindowBasis,reading:TechneReading,acknowledged:NativeTimeWindowReply,sceneRef:string):NativeTimeWindowRequest {
 sameAcknowledgedSource(basis,reading,acknowledged);
 return {...basis,operation:'cross',reading_ref:reading.reading_ref,instrument:'journey',
  expected_session_ref:acknowledged.session.session_ref,expected_selection:acknowledged.session.selection,expected_window:acknowledged.axis.window,target_scene_ref:sceneRef};
}
export function journeyReturnRequest(basis:NativeTimeWindowBasis,reading:TechneReading,acknowledged:NativeTimeWindowReply):NativeTimeWindowRequest {
 sameAcknowledgedSource(basis,reading,acknowledged);
 return {...basis,operation:'return',reading_ref:reading.reading_ref,instrument:'expressions',
  expected_session_ref:acknowledged.session.session_ref,expected_selection:acknowledged.session.selection,expected_window:acknowledged.axis.window};
}
/** A crossing reply addresses this Journey's source and Scene. Its session rests on the journey or on the Expression reading. */
export function qualifyJourneyReply(raw:unknown,basis:NativeTimeWindowBasis,reading:TechneReading):NativeTimeWindowReply{
 const value=raw as NativeTimeWindowReply;
 if(!value||value.schema!=='oi.native-time-window/v1'
  ||value.basis?.expression_ref!==basis.expression_ref||value.basis?.revision!==basis.revision||value.basis?.scene_ref!==basis.scene_ref
  ||value.reading_ref!==reading.reading_ref||!validateSession(value.session).valid
  ||value.session.subject_ref!==reading.subject.subject_ref||value.session.reading_ref!==reading.reading_ref
  ||(value.session.instrument!=='journey'&&value.session.instrument!=='expressions')||value.session.selection.instrument!==value.session.instrument
  ||JSON.stringify(value.axis)!==JSON.stringify(timeAxis(reading,value.session.time_window))) {
  throw Error('The host time reading does not address this source and Scene; retained bounds were not changed');
 }
 return structuredClone(value);
}
/** One plain status line for a return: nothing when the beat was restored; the lost beat named by its title otherwise. Never an index. */
export function journeyReturnNotice(reply:{crossing?:NativeTimeWindowReply['crossing']}):string|null{
 const crossing=reply.crossing;
 if(!crossing||crossing.operation!=='return'||crossing.scene_ref)return null;
 if(crossing.lost_ref)return `The beat "${sceneTitle(crossing.lost_ref)}" is no longer in this Journey, so nothing was restored.`;
 return 'Nothing was crossed from this Journey, so no beat was restored.';
}
/** Lane-5 T10: enter the presented beat's Scene from the Journey. The explicit ground is placed first, then the crossing is written
 * against that acknowledged session. The reply names the Scene the owner entered. */
export async function writeJourneyCrossing(basis:NativeTimeWindowBasis,reading:TechneReading,sceneRef:string):Promise<NativeTimeWindowReply>{
 const ground=qualifyJourneyReply(await trackOwnSharedTimeWrite(techneTimeWindowRequest(journeyRefreshRequest(basis,reading))),basis,reading);
 const reply=qualifyJourneyReply(await trackOwnSharedTimeWrite(techneTimeWindowRequest(journeyCrossingRequest(basis,reading,ground,sceneRef))),basis,reading);
 if(reply.crossing?.operation!=='cross'||reply.crossing.scene_ref!==sceneRef)throw Error('The Journey crossing did not enter the Scene it named; nothing was changed');
 return reply;
}
/** Lane-5 T11: return from the Expression reading to the beat the crossing entered, by ref. The acknowledged crossing reply is the compare-and-set. */
export async function writeJourneyReturn(basis:NativeTimeWindowBasis,reading:TechneReading,acknowledged:NativeTimeWindowReply):Promise<NativeTimeWindowReply>{
 const reply=qualifyJourneyReply(await trackOwnSharedTimeWrite(techneTimeWindowRequest(journeyReturnRequest(basis,reading,acknowledged))),basis,reading);
 if(reply.crossing?.operation!=='return')throw Error('The Journey return did not come back from a crossing; nothing was changed');
 return reply;
}

/** Lane-2 T20: one trail step recorded on the shared session through the owner's compare-and-set, the same route as the time
 * writes. The hop's subject and selection must be the acknowledged session's; the reply is the session the mount keeps. */
export async function writeSharedTraversalHop(basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place',acknowledged:NativeTimeWindowReply,hop:DisclosureTraversalHop):Promise<NativeTimeWindowReply> {
 if(acknowledged.basis.expression_ref!==basis.expression_ref||acknowledged.basis.scene_ref!==basis.scene_ref
  ||acknowledged.basis.revision!==basis.revision||acknowledged.reading_ref!==reading.reading_ref) {
  throw Error('This trail belongs to an earlier native source or Scene; it was not changed');
 }
 if(hop.subject_ref!==acknowledged.session.subject_ref||hop.selection_ref!==acknowledged.session.selection.selection_ref) {
  throw Error('This trail step is not the shared session\'s subject and selection; it was not recorded');
 }
 const request:NativeTimeWindowRequest={...basis,operation:'traversal',reading_ref:reading.reading_ref,instrument,
  expected_session_ref:acknowledged.session.session_ref,expected_selection:acknowledged.session.selection,expected_window:acknowledged.axis.window,hop};
 return qualifyTimeWindowReply(await trackOwnSharedTimeWrite(techneTimeWindowRequest(request)),basis,reading,instrument);
}

export async function readSharedTimeWindow(basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place',current:()=>boolean):Promise<NativeTimeWindowReply> {
 if(!current())throw Error('The originating time instrument is no longer presented');
 const reply=await techneTimeWindowRequest({...basis,reading_ref:reading.reading_ref,instrument,operation:'read'});
 if(!current())throw Error('The originating time instrument changed while reading');
 return qualifyTimeWindowReply(reply,basis,reading,instrument);
}

/** T17: the explicit disclosure act of the Timeline (M2′). The window is the session's own, set only by this act, never by zoom or pan. */
export const TIMELINE_ACT_LABEL='Read over this window';

export function SharedTimeWindowControls({basis,reading,instrument,acknowledged,draft,current,onAcknowledged,onError,unavailableReason,applyLabel='Apply'}:{
 basis:NativeTimeWindowBasis;reading:TechneReading;instrument:'timeline'|'place';
 acknowledged:NativeTimeWindowReply|null;draft:SharedTimeDraft;
 /** The verb of the explicit act. Timeline names what it asserts; Places keeps its plain Apply. */
 applyLabel?:string;
 current:()=>boolean;onAcknowledged:(reply:NativeTimeWindowReply)=>void;onError:(message:string)=>void;
 unavailableReason?:string;
}) {
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[fault,setFault]=useState<string>();
 const [,redraw]=useState(0),alive=useRef(true),toggle=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 useEffect(()=>{
  const element=panel.current;
  if(!element)return;
  if(!open){if(element.matches(':popover-open'))element.hidePopover();return;}
  const bounds=toggle.current?.getBoundingClientRect();
  if(bounds){
   const width=Math.min(340,window.innerWidth-16);
   element.style.width=`${width}px`;
   element.style.left=`${Math.max(8,Math.min(window.innerWidth-width-8,bounds.left))}px`;
   element.style.top=`${bounds.bottom+4}px`;
  }
  element.showPopover();
  const boundsAfter=element.getBoundingClientRect();
  if(boundsAfter.bottom>window.innerHeight-8)element.style.top=`${Math.max(8,window.innerHeight-boundsAfter.height-8)}px`;
  element.querySelector<HTMLInputElement>('input')?.focus();
 },[open]);
 const close=()=>{setOpen(false);toggle.current?.focus()};
 const write=(window:SharedTimeWindow|null)=>{
  const captured=draft.captured??acknowledged;
  if(!captured||busy||!current())return;
  if(captured.basis.expression_ref!==basis.expression_ref||captured.basis.scene_ref!==basis.scene_ref
   ||captured.basis.revision!==basis.revision||captured.reading_ref!==reading.reading_ref) {
   const message='This time draft belongs to an earlier native source or Scene; cancel it before editing these bounds';setFault(message);onError(message);return;
  }
  setBusy(true);setFault(undefined);
  const request:NativeTimeWindowRequest={...basis,operation:'set',reading_ref:reading.reading_ref,instrument,
   expected_session_ref:captured.session.session_ref,expected_selection:captured.session.selection,expected_window:captured.axis.window,window};
  void trackOwnSharedTimeWrite(techneTimeWindowRequest(request)).then(raw=>{
   if(!alive.current||!current())return;
   const reply=qualifyTimeWindowReply(raw,basis,reading,instrument);
   draft.captured=null;draft.from=reply.axis.window?.from??'';draft.to=reply.axis.window?.to??'';
   onAcknowledged(reply);redraw(value=>value+1);
  }).catch(error=>{
   if(!alive.current||!current())return;
   const message=error instanceof Error?error.message:String(error);setFault(message);onError(message);
  }).finally(()=>{if(alive.current)setBusy(false)});
 };
 const refresh=()=>{
  if(busy||!current())return;
  setBusy(true);setFault(undefined);
  void techneTimeWindowRequest({...basis,reading_ref:reading.reading_ref,instrument,operation:'refresh'}).then(raw=>{
   if(!alive.current||!current())return;
   const reply=qualifyTimeWindowReply(raw,basis,reading,instrument);
   if(!draft.captured){draft.from=reply.axis.window?.from??'';draft.to=reply.axis.window?.to??'';}
   onAcknowledged(reply);redraw(value=>value+1);
  }).catch(error=>{if(alive.current&&current()){const message=error instanceof Error?error.message:String(error);setFault(message);onError(message);}})
   .finally(()=>{if(alive.current)setBusy(false)});
 };
 const edit=(edge:'from'|'to',value:string)=>{
  if(!draft.captured&&acknowledged)draft.captured=structuredClone(acknowledged);
  draft[edge]=value;redraw(value=>value+1);
 };
 const declared=acknowledged?.axis.window;
 const outside=acknowledged?.axis.events.filter(event=>event.scope.state==='out-of-scope').length??0;
 // The control is labelled with the window it will assert: the typed draft while one is open, else the window the session holds. Null names nothing.
 const asserted=draft.captured?{from:draft.from||null,to:draft.to||null}:(declared??null);
 const named=windowLabel(asserted);
 return <div className="shared-time-window">
  <button ref={toggle} type="button" aria-expanded={open} title={`Shared time window${named?`: ${named}${draft.captured?' (draft, not yet read over)':''}`:' — none set'}${outside?`; ${outside} dated facets outside`:''}`} onClick={()=>setOpen(value=>!value)}>
   Time{named?` · ${named}`:''}{draft.captured?' *':''}
  </button>
  <div ref={panel} popover="manual" className="shared-time-window-popover" hidden={!open} role="group" aria-label="Shared time window" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
   if(event.key==='Enter'&&!busy){event.preventDefault();write({from:draft.from||null,to:draft.to||null})}
  }}>
   <label>From<input type="text" placeholder="Open" value={draft.from} disabled={busy||!acknowledged} onChange={event=>edit('from',event.target.value)}/></label>
   <label>To<input type="text" placeholder="Open" value={draft.to} disabled={busy||!acknowledged} onChange={event=>edit('to',event.target.value)}/></label>
   <button type="button" disabled={busy||!acknowledged} onClick={()=>write({from:draft.from||null,to:draft.to||null})}>{busy?'Applying…':applyLabel}</button>
   <button type="button" disabled={busy||!acknowledged} onClick={()=>write(null)}>Clear</button>
   {draft.captured&&<button type="button" disabled={busy} onClick={()=>{draft.captured=null;draft.from=declared?.from??'';draft.to=declared?.to??'';setFault(undefined);redraw(value=>value+1)}}>Cancel draft</button>}
   <button type="button" disabled={busy} onClick={refresh} title="Explicitly place this admitted source and Scene in the native time session; any typed draft is retained">Refresh time context</button>
   {!acknowledged&&<span role="status">{unavailableReason??'Shared time unavailable'}</span>}
   {fault&&<span role="alert">{fault}</span>}
  </div>
 </div>;
}
