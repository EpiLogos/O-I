import React,{useEffect,useState} from 'react';
import type {NativePerformanceClient} from './client.js';
import {declaredAcousticDraft,type AuthoredAcousticConfiguration,type NativeAcousticEditPort} from './acousticEdit.js';
const vectors=['source_translation_metres','receiver_position_metres','receiver_forward','source_velocity_metres_per_second','receiver_velocity_metres_per_second'] as const;
const labels=['Source translation (m)','Receiver position (m)','Receiver direction','Source velocity (m/s)','Receiver velocity (m/s)'];
export function NativeAcousticControls({owner,client,report}:{owner:NativeAcousticEditPort;client:NativePerformanceClient;report:(error:unknown)=>void}){
 const [snapshot,setSnapshot]=useState(()=>owner.snapshot()),[draft,setDraft]=useState<AuthoredAcousticConfiguration>(()=>owner.snapshot()?.configuration??declaredAcousticDraft()),[pending,setPending]=useState(false);
 useEffect(()=>client.subscribe(()=>{const actual=owner.snapshot();setSnapshot(actual);if(actual?.configuration&&actual.configuration.revision!==snapshot?.configuration?.revision)setDraft(actual.configuration);}),[client,owner,snapshot?.configuration?.revision]);
 const allowed=!!snapshot?.current&&snapshot.can_declare&&!pending;
 const number=(label:string,value:number,change:(value:number)=>void,min?:number,max?:number,step:number|string='any')=><label>{label}<input type="number" value={value} min={min} max={max} step={step} onChange={event=>{if(Number.isFinite(event.currentTarget.valueAsNumber))change(event.currentTarget.valueAsNumber);}}/></label>;
 const apply=async()=>{if(!allowed)return;setPending(true);try{const configuration={...draft,revision:snapshot!.configuration?snapshot!.configuration.revision+1:draft.revision};await owner.apply(configuration);const actual=owner.snapshot();setSnapshot(actual);if(actual?.configuration)setDraft(actual.configuration);}catch(error){report(error);}finally{setPending(false);}};
 return <details className="performance-body-controls" data-performance="acoustic-edit-controls"><summary>Situated receiving · {snapshot?.configuration?'retained native policy':'declared draft'}</summary>
  <p>Apply stops output and retains source motion, receiving and pickup history with this performance. Start output to continue. Draft values become operative only after the native owner accepts them.</p>
  {snapshot?.reason&&<p role="status">{snapshot.reason}</p>}
  {snapshot&&<fieldset disabled={!allowed}><legend>Source and receiver</legend>
   {vectors.map((key,index)=><React.Fragment key={key}>{draft[key].map((value,axis)=><React.Fragment key={axis}>{number(`${labels[index]} ${['X','Y','Z'][axis]}`,value,n=>setDraft(old=>({...old,[key]:old[key].map((item,i)=>i===axis?n:item) as [number,number,number]})))}</React.Fragment>)}</React.Fragment>)}
   {number('Propagation speed (m/s)',draft.speed_metres_per_second,value=>setDraft(old=>({...old,speed_metres_per_second:value})),50,2000)}
   {number('Minimum distance (m)',draft.minimum_distance_metres,value=>setDraft(old=>({...old,minimum_distance_metres:value})),.001,1000)}
   <label>Directivity<select value={draft.directivity} onChange={event=>setDraft(old=>({...old,directivity:event.currentTarget.value as AuthoredAcousticConfiguration['directivity']}))}><option value="omnidirectional">Omnidirectional</option><option value="cardioid">Cardioid</option></select></label>
   <label><input type="checkbox" checked={draft.propagation_delay} onChange={event=>setDraft(old=>({...old,propagation_delay:event.currentTarget.checked}))}/>Native propagation delay</label>
   {number('Motion duration (s)',draft.span_samples/48000,value=>setDraft(old=>({...old,span_samples:Math.round(value*48000)})),1/48000,60)}
   <label>Policy standing<select value={draft.standing} onChange={event=>setDraft(old=>({...old,standing:event.currentTarget.value as AuthoredAcousticConfiguration['standing']}))}><option value="architecture-model">Declared architectural model</option><option value="reference">Reference</option><option value="tunable-model">Tunable model</option></select></label>
   <details><summary>Authored references</summary>{(['source_ref','source_motion_ref','receiver_motion_ref','policy_ref','policy_revision'] as const).map(key=><label key={key}>{key.replaceAll('_',' ')}<input value={draft[key]} onChange={event=>setDraft(old=>({...old,[key]:event.currentTarget.value}))}/></label>)}</details>
   <button data-performance="acoustic-apply" onClick={()=>void apply()}>{snapshot?.configuration?'Apply receiving change':'Apply declared receiving'}</button>
  </fieldset>}
  {!snapshot&&<p role="status">The actual current native receiving owner is unavailable.</p>}
 </details>;
}
