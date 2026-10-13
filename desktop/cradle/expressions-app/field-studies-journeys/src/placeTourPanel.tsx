/** Lane-4 T25–T26 — the Places tour panel. Presentational: the host owns the recording session, the saved tours in the
 * Scene and the map. A recording lives here only while it is being recorded; a saved tour is the Scene's own record, and
 * its journey binding is a pair of refs read from the journey's beats on every render, never a copy. */
import {useState} from 'react';
import {resolveTourBindings, type PlaceTourBindingState, type PlaceTourRecord} from './placeTourRecord.js';
import './placeTourPanel.css';

/** One journey beat as the journey reads it: the refs a binding names, and the title the journey shows. */
export interface PlaceTourBeat {expression_ref:string;scene_ref:string;title:string}

export interface PlaceTourPanelProps {
 sceneOpen:boolean;
 recording:boolean;
 /** The stops recorded so far in this session. Held only while recording. */
 draft:PlaceTourRecord;
 /** The Scene's saved tours, by name. */
 saved:Readonly<Record<string,PlaceTourRecord>>;
 /** The journey's own beats, read from the reading. A binding can only name one of these. */
 beats:readonly PlaceTourBeat[];
 playingName:string|null;
 onToggleRecording:()=>void;
 onAddStop:(caption:string,holdSeconds:number)=>void;
 onRemoveStop:(index:number)=>void;
 onSave:(name:string)=>void;
 onPlaySaved:(name:string)=>void;
 onStopPlaying:()=>void;
 onRemoveSaved:(name:string)=>void;
 /** Sets (or, with null, clears) one stop's journey binding of a saved tour: withStopBinding, then a save. */
 onBind:(name:string,index:number,beat:PlaceTourBeat|null)=>void;
}

const bindingKey=(binding:{expression_ref:string;scene_ref:string}|null|undefined):string=>binding?`${binding.expression_ref}\u0000${binding.scene_ref}`:'';

function bindingLine(state:PlaceTourBindingState|undefined):string|null{
 if(!state||state.state==='none')return null;
 if(state.state==='bound')return `Bound to journey beat ${state.binding.scene_ref}`;
 return `Journey beat ${state.binding.scene_ref} is gone: ${state.reason}`;
}

export function PlaceTourPanel(props:PlaceTourPanelProps){
 const [caption,setCaption]=useState('');
 const [hold,setHold]=useState('2');
 const [name,setName]=useState('');
 const savedNames=Object.keys(props.saved);
 return <section className="place-tour-panel" aria-label="Place tours" data-testid="place-tours">
  <header className="place-tour-head">
   <h3>Tours</h3>
   <button type="button" aria-pressed={props.recording} disabled={!props.sceneOpen} onClick={props.onToggleRecording}>
    {props.recording?'Stop recording':'Record tour'}
   </button>
  </header>
  {props.recording&&<>
   <div className="place-tour-add" role="group" aria-label="Add a stop">
    <label>Caption<input value={caption} maxLength={280} placeholder="Optional caption" onChange={event=>setCaption(event.target.value)}/></label>
    <label>Hold (s)<input type="number" min={0} max={60} step={0.5} value={hold} onChange={event=>setHold(event.target.value)}/></label>
    <button type="button" onClick={()=>{props.onAddStop(caption,Number(hold));setCaption('');}}>Add stop here</button>
   </div>
   {props.draft.stops.length===0
    ?<p className="place-tour-empty">Move the map to the view you want, then add a stop.</p>
    :<ol className="place-tour-stops" data-testid="place-tour-draft">
     {props.draft.stops.map((stop,index)=><li key={index}>
      <span className="place-tour-stop-title">{stop.caption??`Stop ${index+1}`}</span>
      <span className="place-tour-stop-meta">{`${stop.viewport.y.toFixed(2)}, ${stop.viewport.x.toFixed(2)} · zoom ${stop.viewport.zoom.toFixed(1)} · hold ${(stop.hold_ms/1000).toFixed(1)} s`}</span>
      <button type="button" aria-label={`Remove stop ${index+1}`} onClick={()=>props.onRemoveStop(index)}>Remove</button>
     </li>)}
    </ol>}
   <form className="place-tour-save" onSubmit={event=>{event.preventDefault();props.onSave(name);}}>
    <label>Tour name<input value={name} maxLength={160} placeholder="Name this tour" onChange={event=>setName(event.target.value)}/></label>
    <button type="submit" disabled={props.draft.stops.length===0}>Save tour</button>
   </form>
  </>}
  {savedNames.length===0
   ?<p className="place-tour-empty">No saved tours in this Scene.</p>
   :<ul className="place-tour-saved" data-testid="place-tour-saved">
    {savedNames.map(tourName=>{
     const tour=props.saved[tourName];
     const states=resolveTourBindings(tour,props.beats);
     return <li key={tourName} data-tour={tourName}>
      <div className="place-tour-saved-head">
       <span className="place-tour-stop-title">{tourName}</span>
       <span className="place-tour-stop-meta">{`${tour.stops.length} stop${tour.stops.length===1?'':'s'}`}</span>
       {props.playingName===tourName
        ?<button type="button" onClick={props.onStopPlaying}>Stop tour</button>
        :<button type="button" disabled={!props.sceneOpen} onClick={()=>props.onPlaySaved(tourName)}>Play tour</button>}
       <button type="button" aria-label={`Remove tour ${tourName}`} onClick={()=>props.onRemoveSaved(tourName)}>Remove</button>
      </div>
      <ol className="place-tour-stops">
       {tour.stops.map((stop,index)=>{
        const state=states[index];
        const line=bindingLine(state);
        return <li key={index} data-stop={index} data-bound={state.state}>
         <span className="place-tour-stop-title">{stop.caption??`Stop ${index+1}`}</span>
         <span className="place-tour-stop-meta">{`${stop.viewport.y.toFixed(2)}, ${stop.viewport.x.toFixed(2)} · zoom ${stop.viewport.zoom.toFixed(1)} · hold ${(stop.hold_ms/1000).toFixed(1)} s`}</span>
         <label className="place-tour-bind">Journey beat
          <select aria-label={`Journey beat for stop ${index+1} of ${tourName}`} value={bindingKey(stop.binding)} onChange={event=>{
           const beat=props.beats.find(candidate=>bindingKey(candidate)===event.target.value)??null;
           props.onBind(tourName,index,beat);
          }}>
           <option value="">Not bound</option>
           {state.state==='unbound'&&<option value={bindingKey(stop.binding)}>{`Gone: ${state.binding.scene_ref}`}</option>}
           {props.beats.map(beat=><option key={bindingKey(beat)} value={bindingKey(beat)}>{beat.title}</option>)}
          </select>
         </label>
         {line&&<span className="place-tour-stop-binding">{line}</span>}
        </li>;
       })}
      </ol>
     </li>;
    })}
   </ul>}
 </section>;
}
