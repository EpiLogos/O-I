import {useEffect, useRef, useState} from 'react';
import type {NativeSceneAction} from '../shell/nativeContent';
import {currentNativeSceneReply, type NativeCompositionViewSource} from '../shell/compositionViews';
import {NativeActPassages} from './NativeActPassages';

/** A face for the existing retained Scene workflow. It owns no clock or material. */
export function NativeSceneTransport({source}: {source: NativeCompositionViewSource}) {
  const latest=useRef(source);latest.current=source;
  const lifetime=useRef({mounted:false,epoch:0});
  useEffect(()=>{const own=++lifetime.current.epoch;lifetime.current.mounted=true;return()=>{if(lifetime.current.epoch===own){lifetime.current.mounted=false;lifetime.current.epoch++}}},[]);
  const [fault,setFault]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const [actsOpen,setActsOpen]=useState(false);
  const identity=source.content?.basis.scene_ref;
  useEffect(()=>{setFault(null)},[identity]);
  const content=source.content,scenes=content?.scenes,playback=content?.playback;
  if(!content||!scenes||!playback)return null;
  const current=scenes.scenes.find(row=>row.scene_ref===content.basis.scene_ref);
  const ready=!!source.actions&&!content.standing.pending&&!busy;
  const settle=async(action:NativeSceneAction)=>{
    if(!source.isPresented()||!source.actions)return;
    const captured=source,epoch=lifetime.current.epoch;
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
  const duration=current?.working?.duration;
  return <section className="native-scene-transport" aria-label="Native Scene transport">
    <div className="native-scene-controls">
      <button disabled={!ready||!current?.material.available} title={playback.scene_playing?'Pause Scene':'Play Scene'} aria-label={playback.scene_playing?'Pause Scene':'Play Scene'} aria-pressed={playback.scene_playing} onClick={()=>void settle({action:playback.scene_playing?'pause':'play'})}>{playback.scene_playing?'Ⅱ':'▷'}</button>
      <select aria-label="Native Scene" value={content.basis.scene_ref} disabled={!ready} onChange={event=>void settle({action:'focus',scene_ref:event.target.value})}>{scenes.scenes.map(row=><option key={row.scene_ref} value={row.scene_ref} disabled={!row.material.available}>{row.title}</option>)}</select>
      <button disabled={!ready||!scenes.timing.saved.available} title="Play the saved Scene sequence" aria-pressed={playback.saved_sequence_playing} onClick={()=>void settle({action:playback.saved_sequence_playing?'stop-saved':'play-saved'})}>Saved</button>
      <output aria-label="Native Scene elapsed time">{playback.scene_elapsed_seconds.toFixed(2)} / {duration?.toFixed(2)??'—'} s</output>
      <button title="Scene clip details" onClick={()=>source.revealDetail('clip','scene')}>Scene ↗</button>
      <button aria-expanded={actsOpen} onClick={()=>setActsOpen(!actsOpen)}>Acts</button>
      <span title={playback.field_paused?'Field paused':'Field running'} aria-label={playback.field_paused?'Field paused':'Field running'} className="native-field-standing">{playback.field_paused?'○':'●'}</span>
    </div>
    {fault&&<p role="alert">{fault}</p>}
    {actsOpen&&<NativeActPassages source={source} close={()=>setActsOpen(false)}/>}
  </section>;
}
