import React,{useEffect,useRef,useState} from 'react';
import type {InstrumentBasis} from '../../../src/nara/instrumentProtocol';
import type {M3Gesture,M3Operation,NativeM3Reading} from '../../../src/nara/nativeM3';
import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
import {naraInstrumentRequest} from './kernelExpressions';

/** Gestures go to the native transactional owner. Hiding this view never
 * advances a clock, resets a form or writes a personal reading. */
export function NaraM3({basis,selectionKey,current,disabled,onCurrent,onPresent,presented}:{
 basis:InstrumentBasis|null;selectionKey:string;current:NativeCurrentReading|null;
 disabled:boolean;onCurrent:(value:NativeCurrentReading)=>void;
 onPresent:(reading:NativeM3Reading|null)=>void;presented:boolean;
}){
 const [reading,setReading]=useState<NativeM3Reading|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [opening,setOpening]=useState({address:'',pose:'',aperture:'',matrix_axis:'',clock_steps:'',rna:''});
 const [activity,setActivity]=useState(false),[action,setAction]=useState<M3Operation['operation']>('select-form'),[operand,setOperand]=useState('');
 const [angles,setAngles]=useState(['','','']),[velocities,setVelocities]=useState(['','','']);
 const epoch=useRef(0),pending=useRef(false),live=useRef(true);
 const event=current?.context?.event_ref??null,key=JSON.stringify([selectionKey,event]);
 useEffect(()=>{live.current=true;epoch.current++;setReading(null);setError('');setBusy(false);return()=>{live.current=false;epoch.current++;};},[key]);
 const integer=(value:string,label:string,signed=false)=>{
  if(!/^-?\d+$/.test(value))throw Error(`Enter ${label}.`);
  const n=Number(value);if(!Number.isSafeInteger(n)||(!signed&&n<0))throw Error(`Enter a valid ${label}.`);return n;
 };
 const run=async(request:M3Gesture)=>{
  if(!basis||pending.current||disabled)return;
  pending.current=true;setBusy(true);setError('');const at=epoch.current;
  try{
   const result=await naraInstrumentRequest({operation:'m3',basis,role:'nara',request});
   if(!live.current||at!==epoch.current)return;
   if(result.schema!=='oi.m3-reception-context/v1'||result.expression_ref!==basis.expression_ref||result.identity_revision!==basis.source.revision||result.event_ref!==event)throw Error('The native form belongs to another occasion.');
   setReading(result);
   if(presented)onPresent(result.status==='available'?result:null);
   if(request.operation==='apply'||request.operation==='select_activity_policy'){
    const updated=await naraInstrumentRequest({operation:'current_read',basis,role:'nara'});
    if(!live.current||at!==epoch.current)return;
    if(updated.schema!=='oi.nara-personal-current-context/v1'||updated.context?.event_ref!==event)throw Error('The current occasion changed while operating the form.');
    onCurrent(updated);
   }
  }catch(e){if(live.current&&at===epoch.current)setError(e instanceof Error?e.message:String(e));}
  finally{pending.current=false;if(live.current&&at===epoch.current)setBusy(false);}
 };
 const open=()=>{try{
  if(!opening.rna)throw Error('Choose DNA or RNA.');
  void run({operation:'open',selections:{address:integer(opening.address,'form address'),pose:integer(opening.pose,'lawful pose'),aperture:integer(opening.aperture,'static aperture'),matrix_axis:integer(opening.matrix_axis,'matrix axis'),clock_steps:integer(opening.clock_steps,'opening clock step'),rna:opening.rna==='rna'},...(activity?{activity_policy:'historical-personal-frame-sprite-v1' as const}:{})});
 }catch(e){setError(e instanceof Error?e.message:String(e));}};
 const apply=()=>{try{
  if(!reading?.state)throw Error('Read or open the native form first.');
  let operation:M3Operation;
  switch(action){
   case 'reciprocal-aperture':operation={operation:action};break;
   case 'transcribe':if(operand!=='dna'&&operand!=='rna')throw Error('Choose DNA or RNA.');operation={operation:action,rna:operand==='rna'};break;
   case 'cast-creases':operation={operation:action,angles_deg10:angles.map(v=>integer(v,'crease angle in tenths of a degree',true)) as [number,number,number],velocities_deg10:velocities.map(v=>integer(v,'crease velocity in tenths of a degree per tick',true)) as [number,number,number]};break;
   case 'select-form':operation={operation:action,address:integer(operand,'form address')};break;
   case 'change-line':operation={operation:action,line:integer(operand,'line index')};break;
   case 'apply-matrix':operation={operation:action,family:integer(operand,'matrix family')};break;
   case 'set-pose':operation={operation:action,pose:integer(operand,'lawful pose')};break;
   case 'set-aperture':operation={operation:action,aperture:integer(operand,'static aperture')};break;
   case 'advance-clock':operation={operation:action,steps:integer(operand,'clock advance')};break;
  }
  void run({operation:'apply',expected_generation:reading.state.identity.profile_generation,operations:[operation]});
 }catch(e){setError(e instanceof Error?e.message:String(e));}};
 const state=reading?.state;
 const choose=(label:string,field:keyof typeof opening,options:{value:string;label:string}[])=> <label className="nara-personal-input"><span>{label}</span><select value={opening[field]} onChange={e=>setOpening({...opening,[field]:e.target.value})}><option value="">Choose…</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
 const indexes=(count:number)=>Array.from({length:count},(_,i)=>({value:String(i),label:String(i)}));
 return <section aria-label="Native form and clock"><h2>Form and clock</h2><p>Explore the native form, transcription and clock for this person and dated occasion. Each change is an explicit operation on one retained generation.</p>
  {!event&&<p>Read a dated sky in Composition before opening the form.</p>}
  <fieldset disabled={disabled||busy||!basis||!event}><button onClick={()=>void run({operation:'read'})}>Read current form</button>
   {!state&&<><div className="nara-input-pair">{choose('Opening form address','address',indexes(64))}{choose('Opening pose','pose',indexes(8))}{choose('Opening static aperture','aperture',indexes(16))}{choose('Opening matrix axis','matrix_axis',[{value:'0',label:'i · Complementary'},{value:'1',label:'j · Moving / resting'},{value:'2',label:'k · Same quality'}])}
   <label className="nara-personal-input"><span>Opening clock step</span><input type="number" min="0" step="1" value={opening.clock_steps} onChange={e=>setOpening({...opening,clock_steps:e.target.value})}/></label>{choose('Opening transcription','rna',[{value:'dna',label:'DNA'},{value:'rna',label:'RNA'}])}</div>
   <label><input type="checkbox" checked={activity} onChange={e=>setActivity(e.target.checked)}/> Let successful form operations contribute to activity</label>
   <p>This optional historical Sprite policy turns each successful command into an ordered native activity packet. It uses the current coordinate, resulting transcription and elapsed time; it does not infer an emotion or change the natal reading.</p><button onClick={open}>Open this native form</button></>}
   {state&&<><p>{state.transcription.sequence} · {state.transcription.rna?'RNA':'DNA'} · {state.tarot.rank} of {state.tarot.suit}</p>
    <dl><dt>Form address / pose</dt><dd>{state.form.address} / {state.form.pose} ({state.form.state_count} lawful poses)</dd><dt>Clock</dt><dd>{state.clock.steps} steps · {state.clock.degree360}° · sheet {Math.floor(state.clock.degree720/360)+1}</dd><dt>Aperture</dt><dd>{state.aperture.index} · {state.aperture.division_deg10/10}° · ground phase {state.aperture.fibonacci_phase60}/60</dd></dl>
    <label className="nara-personal-input"><span>Form operation</span><select value={action} onChange={e=>{setAction(e.target.value as M3Operation['operation']);setOperand('');}}>{[['select-form','Select form'],['change-line','Change line'],['apply-matrix','Apply matrix'],['set-pose','Select lawful pose'],['set-aperture','Select static aperture'],['reciprocal-aperture','Reciprocal aperture'],['advance-clock','Advance clock'],['transcribe','Transcribe DNA / RNA'],['cast-creases','Receive crease telemetry']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {action==='transcribe'?<label className="nara-personal-input"><span>Transcription</span><select value={operand} onChange={e=>setOperand(e.target.value)}><option value="">Choose…</option><option value="dna">DNA</option><option value="rna">RNA</option></select></label>:action==='cast-creases'?<div>{[0,1,2].map(i=><div className="nara-input-pair" key={i}><label>Site {i+1} angle · 0.1°<input type="number" value={angles[i]} onChange={e=>setAngles(angles.map((v,j)=>i===j?e.target.value:v))}/></label><label>Site {i+1} velocity · 0.1°/tick<input type="number" value={velocities[i]} onChange={e=>setVelocities(velocities.map((v,j)=>i===j?e.target.value:v))}/></label></div>)}</div>:action!=='reciprocal-aperture'&&<label className="nara-personal-input"><span>{action==='select-form'?'Form address · 0–63':action==='change-line'?'Line index · 0–5':action==='apply-matrix'?'Matrix family · 0 i, 1 j, 2 k':action==='set-pose'?`Pose · 0–${state.form.state_count-1}`:action==='set-aperture'?'Static aperture · 0–15':'Clock steps to advance'}</span><input type="number" min="0" step="1" value={operand} onChange={e=>setOperand(e.target.value)}/></label>}
    <button onClick={apply}>Apply native operation</button>
    {!reading?.activity_policy&&<details><summary>Include subsequent operations in activity</summary><p>The historical Sprite policy receives only successful operations after you enable it. Previous form changes remain in their original receipts and are not added retroactively.</p><button onClick={()=>{if(reading?.revision)void run({operation:'select_activity_policy',expected_generation:state.identity.profile_generation,expected_revision:reading.revision,activity_policy:'historical-personal-frame-sprite-v1'});}}>Enable activity for subsequent operations</button></details>}
    <button onClick={()=>onPresent(reading)}>Present native hinge on selected formation</button>
    <p>The two native unit segments meet at their shared hinge. Your formation keeps its placement and scale. This is the native pair geometry, not a simulated folded sheet or a pose inferred from its ordinal.</p>
   </>}
  </fieldset>
  {presented&&<button onClick={()=>onPresent(null)}>Restore authored formation</button>}
  {busy&&<p role="status">Reading the native form…</p>}{error&&<p role="alert">{error}</p>}
  {reading?.status==='absent'&&<p>No form is open for this exact encounter.</p>}
  {reading?.receipts?.length? <p role="status">{reading.receipts.at(-1)!.status} · generation {state?.identity.profile_generation}</p>:null}
  {reading&&<details className="nara-personal-depth"><summary>Form sources, clock and ordered receipts</summary><p>The native form remains distinct from the personal constitution. Its orientation seed is not a physical pose. The sixteen static selectors sit within the native eighteen-lens field, with the ground and void retained in the reading.</p><pre>{JSON.stringify(reading,null,2)}</pre></details>}
 </section>;
}
