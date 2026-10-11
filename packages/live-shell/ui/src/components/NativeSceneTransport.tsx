import {useEffect, useRef, useState} from 'react';
import type {NativeSceneAction} from '../shell/nativeContent';
import {currentNativeSceneReply, type NativeCompositionViewSource} from '../shell/compositionViews';
import {NativeActPassages} from './NativeActPassages';
import {clampSeek, sceneDuration, scrubBlock, scrubRequest, scrubStep} from './nativeScenePlayback';
import './nativeSceneTransport.css';

/** A face for the existing retained Scene workflow. It owns no clock or material. */
/** compact: the header transport bar already carries play, Scene choice, saved sequence, position and times, so only Scene detail and Acts remain here. */
export function NativeSceneTransport({source, compact = false}: {source: NativeCompositionViewSource; compact?: boolean}) {
  const latest=useRef(source);latest.current=source;
  const lifetime=useRef({mounted:false,epoch:0});
  useEffect(()=>{const own=++lifetime.current.epoch;lifetime.current.mounted=true;return()=>{if(lifetime.current.epoch===own){lifetime.current.mounted=false;lifetime.current.epoch++}}},[]);
  const [fault,setFault]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const [actsOpen,setActsOpen]=useState(false);
  // The scrub draft is local presentation until release; it never reaches the owner.
  const [draft,setDraft]=useState<number|null>(null);const draftRef=useRef<number|null>(null);
  const identity=source.content?.basis.scene_ref;
  useEffect(()=>{setFault(null);draftRef.current=null;setDraft(null)},[identity]);
  const content=source.content,scenes=content?.scenes,playback=content?.playback;
  if(!content||!scenes||!playback)return null;
  const current=scenes.scenes.find(row=>row.scene_ref===content.basis.scene_ref);
  const ready=!!source.actions&&!content.standing.pending&&!busy;
  const settle=async(action:NativeSceneAction)=>{
    if(!source.isPresented()||!source.actions)return;
    const captured=source,epoch=lifetime.current.epoch;
    // A request that starts while the scrubber is disabled supersedes any unreleased draft.
    draftRef.current=null;setDraft(null);
    setBusy(true);setFault(null);
    try{
      const reply=await captured.actions!.scene(action);
      if(!lifetime.current.mounted||epoch!==lifetime.current.epoch||!currentNativeSceneReply(captured,latest.current,reply,action))return;
      setFault(reply.ok?null:reply.error);
    }catch(cause){
      const error=cause instanceof Error?cause.message:String(cause);
      if(lifetime.current.mounted&&epoch===lifetime.current.epoch&&currentNativeSceneReply(captured,latest.current,{ok:false,error},action))setFault(error);
    }finally{if(lifetime.current.mounted&&epoch===lifetime.current.epoch)setBusy(false)}
  };
  const duration=sceneDuration(current?.working?.duration);
  const seekBlock=scrubBlock({ready:ready&&!!current?.material.available,materialAvailable:!!current?.material.available,duration,savedSequencePlaying:playback.saved_sequence_playing});
  const shown=duration===null?playback.scene_elapsed_seconds:clampSeek(draft??playback.scene_elapsed_seconds,duration);
  // One released gesture is one seek. An unmoved press sends nothing.
  const commit=()=>{
    const value=draftRef.current;draftRef.current=null;setDraft(null);
    if(value===null||duration===null||seekBlock)return;
    const request=scrubRequest(value,playback.scene_elapsed_seconds,content.basis.scene_ref,duration);
    if(request)void settle(request);
  };
  if(compact)return <section className="native-scene-transport" aria-label="Native Scene transport">
    <div className="native-scene-controls">
      <button title="Scene clip details" onClick={()=>source.revealDetail('clip','scene')}>Scene ↗</button>
      <button aria-expanded={actsOpen} onClick={()=>setActsOpen(!actsOpen)}>Acts</button>
    </div>
    {fault&&<p role="alert">{fault}</p>}
    {actsOpen&&<NativeActPassages source={source} close={()=>setActsOpen(false)}/>}
  </section>;
  return <section className="native-scene-transport" aria-label="Native Scene transport">
    <div className="native-scene-controls">
      <button disabled={!ready||!current?.material.available} title={playback.scene_playing?'Pause Scene':'Play Scene'} aria-label={playback.scene_playing?'Pause Scene':'Play Scene'} aria-pressed={playback.scene_playing} onClick={()=>void settle({action:playback.scene_playing?'pause':'play'})}>{playback.scene_playing?'Ⅱ':'▷'}</button>
      <select aria-label="Native Scene" value={content.basis.scene_ref} disabled={!ready} onChange={event=>void settle({action:'focus',scene_ref:event.target.value})}>{scenes.scenes.map(row=><option key={row.scene_ref} value={row.scene_ref} disabled={!row.material.available}>{row.title}</option>)}</select>
      <button disabled={!ready||!scenes.timing.saved.available} title="Play the saved Scene sequence" aria-pressed={playback.saved_sequence_playing} onClick={()=>void settle({action:playback.saved_sequence_playing?'stop-saved':'play-saved'})}>Saved</button>
      <input type="range" className="native-scene-scrub" aria-label="Scene position" aria-valuetext={duration===null?'No working duration':`${shown.toFixed(2)} of ${duration.toFixed(2)} seconds of Scene time`}
        min={0} max={duration??0} step={0.01} value={shown} disabled={seekBlock!==null}
        title={seekBlock??'Drag, or use arrow keys (Shift for 1 s, Home and End for the ends). Release seeks the working Scene and pauses it.'}
        onChange={event=>{const next=clampSeek(Number(event.target.value),duration??0);draftRef.current=next;setDraft(next)}}
        onPointerUp={commit} onBlur={commit}
        onKeyDown={event=>{if(duration===null)return;const next=scrubStep(draftRef.current??shown,duration,event.key,event.shiftKey);if(next===null)return;event.preventDefault();draftRef.current=next;setDraft(next)}}
        onKeyUp={()=>{if(draftRef.current!==null)commit()}}/>
      <span className="native-scene-time"><small>Scene time</small><output aria-label="Scene time" title="Position within the working Scene">{shown.toFixed(2)} / {duration===null?'—':duration.toFixed(2)} s</output></span>
      <span className="native-expression-time" title="Position across the whole sequence (Expression time)"><small>Expression time</small><output aria-label="Expression time">{playback.expression_time_seconds.toFixed(2)} s</output></span>
      <button title="Scene clip details" onClick={()=>source.revealDetail('clip','scene')}>Scene ↗</button>
      <button aria-expanded={actsOpen} onClick={()=>setActsOpen(!actsOpen)}>Acts</button>
      <span title={playback.field_paused?'Field paused':'Field running'} aria-label={playback.field_paused?'Field paused':'Field running'} className="native-field-standing">{playback.field_paused?'○':'●'}</span>
    </div>
    {fault&&<p role="alert">{fault}</p>}
    {actsOpen&&<NativeActPassages source={source} close={()=>setActsOpen(false)}/>}
  </section>;
}
