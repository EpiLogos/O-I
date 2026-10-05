import React,{useEffect,useState} from 'react';
import type {NativeScorePlaybackPort} from './playback.js';
export function NativeScorePlaybackControls({owner,report}:{owner:NativeScorePlaybackPort;report:(error:unknown)=>void}){
 const [snapshot,setSnapshot]=useState(()=>owner.snapshot()),[busy,setBusy]=useState(false),[from,setFrom]=useState('0'),[to,setTo]=useState(''),[cut,setCut]=useState('');
 useEffect(()=>owner.subscribe(()=>setSnapshot(owner.snapshot())),[owner]);
 useEffect(()=>{setFrom('0');setTo(snapshot?.duration_samples??'');setCut('');},[snapshot?.expression_ref,snapshot?.scene_ref]);
 const run=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);try{await action();}catch(error){report(error);}finally{setBusy(false);setSnapshot(owner.snapshot());}};
 if(!snapshot)return <p role="status">Prepare this body's retained score before playing it.</p>;
 return <section className="performance-score-playback" aria-label="Play retained score" data-performance="score-playback" aria-busy={busy}>
  <h3>Play score</h3>
  <label>From sample<input data-performance="score-from" inputMode="numeric" value={from} onChange={e=>setFrom(e.currentTarget.value)} disabled={busy||snapshot.device_started}/></label>
  <label>To sample<input data-performance="score-to" inputMode="numeric" value={to} placeholder={snapshot.duration_samples} onChange={e=>setTo(e.currentTarget.value)} disabled={busy||snapshot.device_started}/></label>
  <label>Retained stopped cut<select data-performance="score-cut" value={cut} onChange={e=>setCut(e.currentTarget.value)} disabled={busy||snapshot.device_started}><option value="">Choose the cut to reconstruct</option>{snapshot.checkpoints.map(c=><option key={c.checkpoint_ref} value={c.index} disabled={!c.stopped}>{c.checkpoint_ref} · sample {c.sample}</option>)}</select></label>
  <button data-performance="play-score" disabled={busy||!snapshot.available||snapshot.running||cut===''} onClick={()=>void run(()=>owner.play({from_sample:from,to_sample:to||snapshot.duration_samples,checkpoint_index:Number(cut)}))}>Play selected range</button>
  <button data-performance="play-whole-score" disabled={busy||!snapshot.available||snapshot.running||cut===''} onClick={()=>void run(()=>owner.play({from_sample:'0',to_sample:snapshot.duration_samples,checkpoint_index:Number(cut)}))}>Play whole score</button>
  <button data-performance="export-score-wav" disabled={busy||!snapshot.can_export||snapshot.running||cut===''} onClick={()=>void run(()=>owner.render({from_sample:from,to_sample:to||snapshot.duration_samples,checkpoint_index:Number(cut)}))}>Export WAV</button>
  <button data-performance="stop-score" disabled={busy||!snapshot.device_started} onClick={()=>void run(()=>owner.stop())}>Stop score</button>
  {snapshot.export_file&&<p data-performance="score-export-file">WAV saved: {snapshot.export_file}. Keep the native Expression project for its editable physical score.</p>}
  <p data-performance="score-playback-status" role="status">{snapshot.reason??(snapshot.first_current_pending?'Audio output started; waiting for its first native sound and body response.':snapshot.running?'Native output is running the admitted score programme.':'The retained score is stopped.')}</p>
 </section>;
}
