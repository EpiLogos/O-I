/** Shared time is read from the host's DisclosureSession. This renderer holds
 * input drafts and acknowledged snapshots only; it owns no session or clock. */
import React,{useEffect,useRef,useState} from 'react';
import {validateSession,type TechneReading} from '../../../src/techne/contract';
import {timeAxis,type SharedTimeWindow} from '../../../src/techne/m0m5/timeline/timeAxis';
import type {NativeTimeWindowBasis,NativeTimeWindowReply,NativeTimeWindowRequest} from '../../../../../packages/expressions-boundary/src/timeWindow';
import {techneTimeWindowRequest} from './kernelExpressions.js';
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

export async function readSharedTimeWindow(basis:NativeTimeWindowBasis,reading:TechneReading,instrument:'timeline'|'place',current:()=>boolean):Promise<NativeTimeWindowReply> {
 if(!current())throw Error('The originating time instrument is no longer presented');
 const reply=await techneTimeWindowRequest({...basis,reading_ref:reading.reading_ref,instrument,operation:'read'});
 if(!current())throw Error('The originating time instrument changed while reading');
 return qualifyTimeWindowReply(reply,basis,reading,instrument);
}

export function SharedTimeWindowControls({basis,reading,instrument,acknowledged,draft,current,onAcknowledged,onError,unavailableReason}:{
 basis:NativeTimeWindowBasis;reading:TechneReading;instrument:'timeline'|'place';
 acknowledged:NativeTimeWindowReply|null;draft:SharedTimeDraft;
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
  void techneTimeWindowRequest(request).then(raw=>{
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
 return <div className="shared-time-window">
  <button ref={toggle} type="button" aria-expanded={open} title={`Shared Timeline and Places bounds${declared?`: ${declared.from??'open'} — ${declared.to??'open'}`:''}${outside?`; ${outside} dated facets outside`:''}`} onClick={()=>setOpen(value=>!value)}>
   Time{declared?' · bounded':''}{draft.captured?' *':''}
  </button>
  <div ref={panel} popover="manual" className="shared-time-window-popover" hidden={!open} role="group" aria-label="Shared time window" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
   if(event.key==='Enter'&&!busy){event.preventDefault();write({from:draft.from||null,to:draft.to||null})}
  }}>
   <label>From<input type="text" placeholder="Open" value={draft.from} disabled={busy||!acknowledged} onChange={event=>edit('from',event.target.value)}/></label>
   <label>To<input type="text" placeholder="Open" value={draft.to} disabled={busy||!acknowledged} onChange={event=>edit('to',event.target.value)}/></label>
   <button type="button" disabled={busy||!acknowledged} onClick={()=>write({from:draft.from||null,to:draft.to||null})}>{busy?'Applying…':'Apply'}</button>
   <button type="button" disabled={busy||!acknowledged} onClick={()=>write(null)}>Clear</button>
   {draft.captured&&<button type="button" disabled={busy} onClick={()=>{draft.captured=null;draft.from=declared?.from??'';draft.to=declared?.to??'';setFault(undefined);redraw(value=>value+1)}}>Cancel draft</button>}
   <button type="button" disabled={busy} onClick={refresh} title="Explicitly place this admitted source and Scene in the native time session; any typed draft is retained">Refresh time context</button>
   {!acknowledged&&<span role="status">{unavailableReason??'Shared time unavailable'}</span>}
   {fault&&<span role="alert">{fault}</span>}
  </div>
 </div>;
}
