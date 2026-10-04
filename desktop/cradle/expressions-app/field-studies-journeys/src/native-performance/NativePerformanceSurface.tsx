import {NativeTakeControls} from './NativeTakeControls.js';
import type {NativeTakePort} from './nativeTake.js';
import {NativeAcousticControls} from './NativeAcousticControls.js';
import type {NativeAcousticEditPort} from './acousticEdit.js';
import {NativePhysicalControls} from './NativePhysicalControls.js';
import type {NativePhysicalEditPort} from './physicalEdit.js';
import type {NativePhysicalDisplayPort} from './physicalDisplay.js';
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NativePerformanceClient,type PerformanceClientState} from './client.js';
import type {NativeParameter,NativePerformanceExchange,NativePerformanceReading,NativeOutputCalibrationState} from './protocol.js';
import './nativePerformance.css';
import {NativeScoreEditor} from './NativeScoreEditor.js';
import type {NativeScorePort} from './scoreProtocol.js';
import {NativeMidiInput} from './midi.js';
const keyboardCodes=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyF','KeyT','KeyG','KeyY','KeyH','KeyU','KeyJ'];
function textFocus(target:EventTarget|null){return target instanceof HTMLElement&&(target.isContentEditable||!!target.closest('input,textarea,select,[role="textbox"]'));}
function ParameterControl({parameter,client,report}:{parameter:NativeParameter;client:NativePerformanceClient;report:(error:unknown)=>void}){
 const [draft,setDraft]=useState(parameter.baseline),editing=useRef(false),submitted=useRef(parameter.baseline);
 useEffect(()=>{if(!editing.current)setDraft(parameter.baseline);},[parameter.baseline]);
 const allowed=parameter.capabilities.includes('set')&&!parameter.unavailable_reason;
 const update=(value:number)=>{if(!Number.isFinite(value))return;editing.current=true;setDraft(value);if(value!==submitted.current){submitted.current=value;void client.parameter(parameter.target_ref,'set',value).catch(report);}};
 const commit=()=>{editing.current=false;if(draft!==submitted.current){submitted.current=draft;void client.parameter(parameter.target_ref,'set',draft).catch(report);}};
 return <section className="performance-parameter" data-performance-target={parameter.target_ref}>
  <label><span>{parameter.label}</span><input type="range" min={parameter.minimum} max={parameter.maximum} step="any" value={draft} disabled={!allowed} onFocus={()=>{editing.current=true;}} onChange={e=>update(e.currentTarget.valueAsNumber)} onPointerUp={commit} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))commit();}} onBlur={commit}/></label>
  <div className="performance-value"><label>Base <input type="number" min={parameter.minimum} max={parameter.maximum} step="any" value={draft} disabled={!allowed} onFocus={()=>{editing.current=true;}} onChange={e=>update(e.currentTarget.valueAsNumber)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();}} aria-label={`${parameter.label} baseline`}/></label><output data-performance-effective={parameter.target_ref}>Effective {parameter.effective.toPrecision(5)} {parameter.unit}</output></div>
  <div className="performance-actions">{(['undo','clear','learn'] as const).map(action=><button key={action} disabled={!parameter.capabilities.includes(action)||!!parameter.unavailable_reason} onClick={()=>void client.parameter(parameter.target_ref,action).catch(report)}>{action}</button>)}</div>
  <details><summary>Target and modulation</summary><dl><dt>Scope</dt><dd>{parameter.scope}</dd><dt>Owner</dt><dd>{parameter.native_owner}</dd><dt>Action</dt><dd>{parameter.action_ref}</dd><dt>Target</dt><dd>{parameter.target_ref}</dd><dt>Range</dt><dd>{parameter.minimum}–{parameter.maximum} {parameter.unit}</dd><dt>Smoothing</dt><dd>{parameter.smoothing_samples} native samples</dd><dt>Route</dt><dd>{parameter.route_ref??'Manual baseline'}</dd></dl></details>
  {parameter.unavailable_reason&&<p role="status">{parameter.unavailable_reason}</p>}
 </section>;
}
function DevicePanel({reading,client,report}:{reading:NativePerformanceReading;client:NativePerformanceClient;report:(error:unknown)=>void}){
 const [selected,setSelected]=useState(0),[buffer,setBuffer]=useState<128|256>(128);
 const d=reading.device,allowed=(operation:Parameters<NativePerformanceClient['supports']>[0])=>client.supports(operation);
 return <details className="performance-device" open={d.state==='failed'||d.state==='lost'}><summary>Audio output · {d.state}</summary>
  <label>Output<select value={selected} onChange={e=>setSelected(Number(e.currentTarget.value))} disabled={d.state==='running'}><option value={0}>Existing system default</option>{reading.devices.map(device=><option key={device.id} value={device.id} disabled={!device.alive||!device.output_channels}>{device.name}{device.default_output?' · default':''}</option>)}</select></label>
  <label>Buffer<select value={buffer} onChange={e=>setBuffer(Number(e.currentTarget.value) as 128|256)} disabled={d.state==='running'}><option value={128}>128 samples</option><option value={256}>256 samples</option></select></label>
  <div className="performance-actions"><button disabled={!allowed('performance-device-enumerate')} onClick={()=>void client.device({operation:'performance-device-enumerate'}).catch(report)}>Refresh outputs</button><button disabled={!allowed('performance-device-open')||d.state==='running'} onClick={()=>void client.device({operation:'performance-device-open',device_id:selected,sample_rate:48000,buffer_frames:buffer}).catch(report)}>Open at 48 kHz</button><button data-performance="device-start" disabled={!allowed('performance-device-start')||d.state!=='prepared'} onClick={()=>void client.device({operation:'performance-device-start'}).catch(report)}>Start output</button><button data-performance="device-stop" disabled={!allowed('performance-device-stop')||d.state!=='running'} onClick={()=>void client.device({operation:'performance-device-stop'}).catch(report)}>Stop output</button><button disabled={!allowed('performance-device-recover')} onClick={()=>void client.device({operation:'performance-device-recover'}).catch(report)}>Recover output</button><button disabled={!allowed('performance-device-close')||d.state==='running'} onClick={()=>void client.device({operation:'performance-device-close'}).catch(report)}>Close output</button></div>
  <p>{d.backend} · client {d.client_rate} Hz · hardware {d.hardware_rate} Hz · {d.buffer_frames} samples{d.sample_rate_conversion?' · rate conversion active':''}</p>
  <p>Reported output pipeline {d.reported_output_latency_ms.toFixed(2)} ms · physical latency {d.physical_latency_measurement}</p>
  <p>Callbacks {d.callbacks} · failures {d.callback_failures} · overloads {d.overload_notifications} · underruns {d.underruns??'measurement unavailable'} · capture drops {d.capture_drops}</p>
  {d.error&&<p role="alert">{d.error}</p>}
 </details>;
}
function PhysicalDisplayControl({owner,client,report}:{owner:NativePhysicalDisplayPort;client:NativePerformanceClient;report:(error:unknown)=>void}){
 const [state,setState]=useState(()=>owner.snapshot()),[pending,setPending]=useState(false);
 useEffect(()=>client.subscribe(()=>setState(owner.snapshot())),[client,owner]);
 const change=(value:number)=>{if(pending)return;setPending(true);void owner.setMagnification(value).then(setState).catch(report).finally(()=>setPending(false));};
 return <section className="performance-physical-display" data-display-policy={state?.policy_ref??''}><label>Show body displacement ×{state?.magnification??1}<input data-performance="display-magnification" aria-label="Display displacement magnification" type="range" min={0} max={5} step={0.1} value={Math.log10(state?.magnification??1)} disabled={pending||!state?.rest_available} onChange={e=>change(10**e.currentTarget.valueAsNumber)}/></label><button disabled={pending||!state?.rest_available} onClick={()=>change(1)}>Actual scale</button><button disabled={pending||!state?.rest_available} onClick={()=>change(10000)}>Show movement ×10000</button><output data-performance="native-displacement">{state?.native_max_displacement_metres===null||state?.native_max_displacement_metres===undefined?'Native displacement unavailable':`Largest native displacement ${state.native_max_displacement_metres.toExponential(5)} m`}</output><p>Display magnifies movement from the same native rest nodes. Sound and saved physical values remain at actual scale.</p></section>;
}
export function NativePerformanceSurface({client,visible,score,display,physical,acoustic,takes,calibration}:{client:NativePerformanceClient;visible:boolean;score:NativeScorePort;display:NativePhysicalDisplayPort;physical:NativePhysicalEditPort;acoustic:NativeAcousticEditPort;takes:NativeTakePort;calibration?:()=>NativeOutputCalibrationState|null}){
 const [state,setState]=useState<PerformanceClientState>(client.state),[error,setError]=useState<string|null>(null),[layout,setLayout]=useState<'janko'|'piano'>('janko'),[,midiChanged]=useState(0);
 const midi=useRef<NativeMidiInput|null>(null);
 const pointers=useRef(new Map<number,string>()),keys=useRef(new Map<string,string>());
 const sustainHeld=useRef(false),firstReading=useRef(false);
 const report=(value:unknown)=>setError(value instanceof Error?value.message:String(value));
 const releaseAll=(reason:string)=>{pointers.current.clear();keys.current.clear();sustainHeld.current=false;midi.current?.panic();void client.panic(reason).catch(report);};
 useEffect(()=>{const input=new NativeMidiInput(client,()=>midiChanged(value=>value+1),report);midi.current=input;return()=>{input.dispose();midi.current=null;};},[client]);
 useEffect(()=>client.subscribe(()=>{const next=client.state;setState(next);if(!firstReading.current&&next.reading?.available&&!next.reason){firstReading.current=true;setError(null);}}),[client]);
 useEffect(()=>{void client.inspect().catch(report);},[client]);
 useEffect(()=>{
  const blur=()=>releaseAll('native musical input lost window focus');
  const focus=(e:FocusEvent)=>{if(textFocus(e.target)&&(pointers.current.size||keys.current.size||client.state.pressed.size))releaseAll('native musical input entered a text control');};
  const visibility=()=>{if(document.hidden)releaseAll('native musical input surface hidden');};
  window.addEventListener('blur',blur);document.addEventListener('focusin',focus);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('blur',blur);document.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);};
 },[client]);
 useEffect(()=>{if(!visible&&(pointers.current.size||keys.current.size||client.state.reading?.sustain))releaseAll('native musical view hidden');},[visible,client]);
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{if(!visible||e.repeat||e.altKey||e.ctrlKey||e.metaKey||textFocus(e.target)||e.target instanceof HTMLElement&&!!e.target.closest('[data-performance-key]'))return;if(e.code==='Space'){e.preventDefault();sustainHeld.current=true;void client.sustain(true).catch(report);return;}const at=keyboardCodes.indexOf(e.code);if(at<0||keys.current.has(e.code))return;e.preventDefault();try{const press=client.press(at%2,Math.floor(at/2));keys.current.set(e.code,press.input_ref);void press.acknowledged.catch(report);}catch(error){report(error);}};
  const up=(e:KeyboardEvent)=>{if(e.code==='Space'&&sustainHeld.current){sustainHeld.current=false;e.preventDefault();void client.sustain(false).catch(report);}const token=keys.current.get(e.code);if(token){keys.current.delete(e.code);e.preventDefault();void client.release(token).catch(report);}};
  window.addEventListener('keydown',down,true);window.addEventListener('keyup',up,true);return()=>{window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);};
 },[client,visible]);
 const calibrated=calibration?.(),reading=state.reading,playable=client.supports('performance-gesture')&&reading?.device.state==='running';
 const pointerDown=(e:React.PointerEvent<HTMLButtonElement>,row:number,column:number)=>{if(e.button!==0||!playable)return;e.preventDefault();try{const press=client.press(row,column,e.pointerType==='pen'&&e.pressure>0?e.pressure:1);pointers.current.set(e.pointerId,press.input_ref);e.currentTarget.setPointerCapture(e.pointerId);void press.acknowledged.catch(report);}catch(error){report(error);}};
 const pointerUp=(e:React.PointerEvent<HTMLButtonElement>)=>{const token=pointers.current.get(e.pointerId);if(!token)return;pointers.current.delete(e.pointerId);void client.release(token).catch(report);};
 const accessibleDown=(e:React.KeyboardEvent<HTMLButtonElement>,row:number,column:number)=>{if(!playable||e.repeat||!['Enter',' '].includes(e.key))return;e.preventDefault();const id=`button:${row}:${column}`;if(keys.current.has(id))return;try{const press=client.press(row,column);keys.current.set(id,press.input_ref);void press.acknowledged.catch(report);}catch(error){report(error);}};
 const accessibleUp=(row:number,column:number)=>{const id=`button:${row}:${column}`,token=keys.current.get(id);if(token){keys.current.delete(id);void client.release(token).catch(report);}};
 return <section className="native-performance" hidden={!visible} aria-label="Native musical performance" data-performance-session={reading?.session_ref??''} data-performance-cursor={reading?.samples_elapsed??''} aria-busy={state.pending>0}>
  <header><div><h2>Play this body</h2><p>The selected source and physical body remain in this Expression.</p></div><button data-performance="panic" onClick={()=>releaseAll('explicit all notes off')}>All notes off</button><button onClick={()=>void client.inspect().catch(report)}>Read native state</button></header>
  {(error||state.reason)&&<p className="performance-notice" role="status">{error??state.reason}</p>}
  {!reading&&<p>The retained native owner has not admitted a musical session.</p>}
  {reading&&<>
   {calibrated?.declaration.required&&<p data-performance="native-output-calibration" data-calibration-stage={calibrated.stage}>{calibrated.stage==='applied'?'Instrument calibration applied by the native callback.':'Instrument calibration queued for the native callback.'} Current effective Force {calibrated.effective_force_newtons===null?'unavailable':`${calibrated.effective_force_newtons.toPrecision(5)} N`}.</p>}
   <PhysicalDisplayControl owner={display} client={client} report={report}/>
   <NativeTakeControls owner={takes} client={client} report={report}/>
   <NativeScoreEditor owner={score} report={report}/>
   <NativePhysicalControls owner={physical} client={client} report={report}/>
   <NativeAcousticControls owner={acoustic} client={client} report={report}/>
   <div className="performance-meter"><meter min={0} max={1} value={reading.peak_linear} aria-label="Native output peak"/><span>{reading.active_voices}/24 voices · {reading.active_touches}/96 touches · clipping samples {reading.clipping_samples}</span><span>Body {reading.physical.body_revision} · sample {reading.samples_elapsed}</span></div>
   <div className="performance-workspace"><div className="performance-controls">{(['excitation','material','boundary','modulation','receiving','mixer'] as const).map(group=><details key={group} open={group==='excitation'}><summary>{group}</summary>{reading.parameters.filter(p=>p.group===group).map(p=><ParameterControl key={p.target_ref} parameter={p} client={client} report={report}/>)}</details>)}</div><DevicePanel reading={reading} client={client} report={report}/></div>
   <div className="performance-keyboard-header"><label>Keyboard<select value={layout} onChange={e=>{releaseAll('keyboard view changed');setLayout(e.currentTarget.value as 'janko'|'piano');}}><option value="janko">Jankó · six rows</option><option value="piano">Piano view</option></select></label><label>Transpose<select data-performance="transpose" value={reading.transpose} disabled={!client.supports('performance-transpose')} onChange={e=>void client.transpose(Number(e.currentTarget.value)).catch(report)}>{Array.from({length:12},(_,i)=><option key={i} value={i}>{i===0?'Original':`+${i} semitones`}</option>)}</select></label><button data-performance="sustain" aria-pressed={reading.sustain} disabled={!client.supports('performance-sustain')} onClick={()=>void client.sustain(!reading.sustain).catch(report)}>Sustain</button><span>Six rows · three independent touches per note</span></div>
   <div className={`performance-janko layout-${layout}`} role="group" aria-label={layout==='janko'?'Jankó six-row keyboard':'Piano keyboard using the same native catalog'}>{Array.from({length:layout==='janko'?6:1},(_,row)=><div className={`performance-key-row family-${row%2}`} key={row} data-performance-row={row}>{reading.keys.filter(k=>layout==='janko'?k.row===row:k.row<2).sort((a,b)=>layout==='janko'?a.column-b.column:a.register_octave*12+a.pitch_class-b.register_octave*12-b.pitch_class).map(k=><button key={`${k.row}:${k.column}`} data-performance-key={`${k.row}:${k.column}`} data-piano-accidental={[1,3,6,8,10].includes(k.pitch_class)} data-native-key={k.key} data-native-pitch={k.pitch_class} data-native-register={k.register_octave} data-native-coordinate={k.coordinate} aria-label={`${k.label}, row ${row+1}, ${k.available?`source ${k.coordinate}${k.face?' conjugate':' direct'}`:k.reason}`} title={k.available?undefined:k.reason??undefined} aria-pressed={state.pressed.has(`${k.row}:${k.column}`)} disabled={!playable||!k.available} data-source-available={k.available} onKeyDown={e=>accessibleDown(e,k.row,k.column)} onKeyUp={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();accessibleUp(k.row,k.column);}}} onBlur={()=>accessibleUp(k.row,k.column)} onPointerDown={e=>pointerDown(e,k.row,k.column)} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp} onPointerMove={e=>{const token=pointers.current.get(e.pointerId);if(token&&e.pointerType==='pen')void client.pressure(token,e.pressure).catch(report);}}><span>{k.label}</span><small>{k.available&&k.hertz!==null?`${k.hertz.toFixed(2)} Hz`:'Unassigned'}</small></button>)}</div>)}</div>
   <details className="performance-midi"><summary>MIDI input · {midi.current?.selected?'connected':'off'}</summary><button disabled={!midi.current?.available} onClick={()=>void midi.current?.request().catch(report)}>Connect MIDI input</button><label>Input<select value={midi.current?.selected??''} onChange={e=>{try{midi.current?.select(e.currentTarget.value);}catch(error){report(error);}}}><option value="">Off</option>{midi.current?.inputs.map(input=><option key={input.id} value={input.id} disabled={!input.connected}>{input.name}</option>)}</select></label><label>Centre note<input type="number" min={0} max={127} value={midi.current?.centreNote??60} onChange={e=>{try{midi.current?.setCentre(e.currentTarget.valueAsNumber);}catch(error){report(error);}}}/></label><p>Centre note addresses the current native catalog. Velocity, note release, pressure and sustain reach its actual owner.</p></details>
   {!playable&&<p role="status">{reading.reason??reading.device.error??'Open and start the native audio output to play.'}</p>}
   <details className="performance-source"><summary>Source and physical state</summary><dl><dt>Event</dt><dd>{reading.scope.event_ref}</dd><dt>Subject</dt><dd>{reading.scope.subject_ref}</dd><dt>M1 / M2</dt><dd>{reading.scope.m1_revision} / {reading.scope.m2_generation}</dd><dt>Preparation</dt><dd>{reading.scope.preparation_ref}</dd><dt>Body state</dt><dd>{reading.scope.state_ref}</dd><dt>Excitation policy</dt><dd>{reading.excitation.policy_ref} · {reading.excitation.standing}</dd><dt>Physical energy</dt><dd>{reading.physical.energy_joules.toPrecision(5)} J</dd><dt>Visible nodes</dt><dd>{reading.physical.node_ids.length}, copied at sample {reading.physical.samples_elapsed}</dd></dl></details>
  </>}
 </section>;
}
/** Host keeps the existing scene/agent panes. Closing waits for actual native
 * panic acknowledgement; the musical surface never owns or closes the field. */
export function mountNativePerformance(element:HTMLElement,owner:NativePerformanceExchange,score:NativeScorePort,display:NativePhysicalDisplayPort,physical:NativePhysicalEditPort,acoustic:NativeAcousticEditPort,takes:NativeTakePort){
 const root=createRoot(element),client=new NativePerformanceClient(owner);
 let visible=true;const draw=()=>root.render(<NativePerformanceSurface client={client} visible={visible} score={score} display={display} physical={physical} acoustic={acoustic} takes={takes} calibration={owner.outputCalibration}/>);draw();
 return{client,setVisible(next:boolean){visible=next;draw();},async close(){try{await client.close();}finally{root.unmount();}}};
}
