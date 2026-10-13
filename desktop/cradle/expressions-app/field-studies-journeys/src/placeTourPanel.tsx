/** Lane-4 T25–T26 — the Places tour panel: record the camera the map shows as stops, play the tour as flights, and read
 * each stop's journey binding. Presentational: the host owns the session and the map; this panel owns only its two input
 * fields. A journey binding is shown as the journey's own ref and its state, never as a journey-owned surface. */
import {useState} from 'react';
import type {PlaceTourBindingState, PlaceTourRecord} from './placeTours.js';
import type {PlaceTourSession} from './placeTourSession.js';
import './placeTourPanel.css';

export interface PlaceTourPanelProps {
 sceneOpen:boolean;
 session:PlaceTourSession;
 playing:boolean;
 /** One entry per stop, in order: the journey's current read of that stop's binding. */
 bindings:readonly PlaceTourBindingState[];
 onToggleRecording:()=>void;
 onAddStop:(caption:string,holdSeconds:number)=>void;
 onRemoveStop:(index:number)=>void;
 onPlay:()=>void;
 onStop:()=>void;
 onClear:()=>void;
}

function bindingLine(state:PlaceTourBindingState|undefined):string|null{
 if(!state||state.state==='none')return null;
 if(state.state==='bound')return `Bound to journey beat ${state.binding.scene_ref}`;
 return `Journey beat ${state.binding.scene_ref} is gone: ${state.reason}`;
}

export function PlaceTourPanel(props:PlaceTourPanelProps){
 const [caption,setCaption]=useState('');
 const [hold,setHold]=useState('2');
 const {session}=props;
 const stops:PlaceTourRecord['stops']=session.record.stops;
 return <section className="place-tour-panel" aria-label="Place tours" data-testid="place-tours">
  <header className="place-tour-head">
   <h3>Tour</h3>
   <button type="button" aria-pressed={session.recording} disabled={!props.sceneOpen} onClick={props.onToggleRecording}>
    {session.recording?'Stop recording':'Record tour'}
   </button>
  </header>
  {session.recording&&<div className="place-tour-add" role="group" aria-label="Add a stop">
   <label>Caption<input value={caption} maxLength={280} placeholder="Optional caption" onChange={event=>setCaption(event.target.value)}/></label>
   <label>Hold (s)<input type="number" min={0} max={60} step={0.5} value={hold} onChange={event=>setHold(event.target.value)}/></label>
   <button type="button" onClick={()=>{props.onAddStop(caption,Number(hold));setCaption('');}}>Add stop here</button>
  </div>}
  {stops.length===0
   ?<p className="place-tour-empty">{session.recording?'Move the map to the view you want, then add a stop.':'No stops recorded in this session.'}</p>
   :<ol className="place-tour-stops" data-testid="place-tour-stops">
    {stops.map((stop,index)=>{
     const line=bindingLine(props.bindings[index]);
     return <li key={index} data-stop={index} data-bound={props.bindings[index]?.state??'none'}>
      <span className="place-tour-stop-title">{stop.caption??`Stop ${index+1}`}</span>
      <span className="place-tour-stop-meta">{`${stop.viewport.y.toFixed(2)}, ${stop.viewport.x.toFixed(2)} · zoom ${stop.viewport.zoom.toFixed(1)} · hold ${(stop.hold_ms/1000).toFixed(1)} s`}</span>
      {stop.place_ref&&<span className="place-tour-stop-place">{`Place ${stop.place_ref}`}</span>}
      {line&&<span className="place-tour-stop-binding">{line}</span>}
      <button type="button" aria-label={`Remove stop ${index+1}`} disabled={props.playing} onClick={()=>props.onRemoveStop(index)}>Remove</button>
     </li>;
    })}
   </ol>}
  <footer className="place-tour-actions">
   {props.playing
    ?<button type="button" onClick={props.onStop}>Stop tour</button>
    :<button type="button" disabled={stops.length===0||!props.sceneOpen} onClick={props.onPlay}>Play tour</button>}
   <button type="button" disabled={stops.length===0} onClick={props.onClear}>Clear tour</button>
  </footer>
 </section>;
}
