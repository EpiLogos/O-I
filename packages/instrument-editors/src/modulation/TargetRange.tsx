import {useEffect,useRef,useState} from 'react';
import type {AutomationLane} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {automationTarget} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters';
import {sameEditorBasis,type NativeEditorBasis} from '../../../expressions-boundary/src/editor';
import type {InstrumentPresentation} from '../frame/presentation';
import type {ModulationHost} from './ModulationEditor';
import {modulationInputPatch,type ModulationInputs} from './input';
/** Target-owned range over the existing group's source. No independent
 * oscillator or numerical substitution for native effective telemetry. */
export function TargetRange({host,lane,presentation}:{host:ModulationHost;lane:AutomationLane;presentation:InstrumentPresentation}){
 const readingBasisKey=JSON.stringify(host.reading.basis);
 const saved=(presentation.snapshot().view.modulationTargets as Record<string,{basis:NativeEditorBasis;inputs:ModulationInputs;patch:Partial<AutomationLane>}>|undefined)?.[lane.id];
 const [basis,setBasis]=useState(saved?.basis??host.reading.basis),[inputs,setInputs]=useState<ModulationInputs>(saved?.inputs??{}),[patch,setPatch]=useState<Partial<AutomationLane>>(saved?.patch??{}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const mounted=useRef(true),gesture=useRef<'min'|'max'|null>(null);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const dirty=Object.keys(inputs).length>0||Object.keys(patch).length>0,scope=`modulation-target:${lane.id}`,target=automationTarget(host.reading.scene,lane.target);
 if(basis.expression_ref!==host.reading.basis.expression_ref||basis.scene_ref!==host.reading.basis.scene_ref)throw Error('The retained target range belongs to another native Scene.');
 useEffect(()=>{presentation.setDraft(dirty||busy,scope);const current=presentation.snapshot().view;presentation.updateView({...current,modulationTargets:{...(current.modulationTargets as object??{}),[lane.id]:{basis,inputs,patch}}});if(!dirty&&!busy&&!sameEditorBasis(basis,host.reading.basis))setBasis(host.reading.basis);},[basis,inputs,patch,busy,dirty,readingBasisKey,presentation,scope,lane.id]);
 let values={...lane,...patch};let error='';try{values={...values,...modulationInputPatch(patch,inputs)};}catch(reason){error=String(reason);}
 const input=(key:'min'|'max',value:string)=>{if(busy)return;presentation.setDraft(true,scope);setInputs(old=>({...old,[key]:value}));};
 const set=(next:Partial<AutomationLane>)=>{if(busy)return;presentation.setDraft(true,scope);setPatch(old=>({...old,...next}));};
 const cancel=()=>{if(busy)return;setInputs({});setPatch({});setBasis(host.reading.basis);presentation.setDraft(false,scope);};
 const apply=async()=>{if(busy)return;presentation.setDraft(true,scope);setBusy(true);setNotice('');try{
  const requested=modulationInputPatch(patch,inputs);if(Object.keys(requested).some(key=>!['min','max','blend','enabled'].includes(key)))throw Error('A following target may edit its own range, blend and enabled state.');
  const reply=await host.edit(basis,lane.id,requested);if(!mounted.current)return;if(!reply.ok)throw Error(reply.error);
  if(reply.reading.basis.expression_ref!==basis.expression_ref||reply.reading.basis.scene_ref!==basis.scene_ref||reply.reading.basis.revision<basis.revision)throw Error('The native target replied on another or older basis.');
  const actual=reply.reading.scene.automation.find(row=>row.id===lane.id);if(!actual||Object.entries(requested).some(([key,value])=>JSON.stringify(actual[key as keyof AutomationLane])!==JSON.stringify(value)))throw Error('The native target did not confirm this exact range. Input is retained.');
  setInputs({});setPatch({});setBasis(reply.reading.basis);setNotice('Native target range readback confirmed.');
 }catch(reason){if(mounted.current)setNotice(String(reason));}finally{if(mounted.current)setBusy(false);}};
 const point=(value:number)=>target?24+Math.max(0,Math.min(1,(value-target.min)/(target.max-target.min||1)))*432:24;
 const effective=host.reading.observation?.effectiveValues?.[lane.target];
 return <section className="modulation-target-range" aria-label={`Target range ${lane.id}`} aria-busy={busy}>
 {target&&<svg viewBox="0 0 480 56" role="group" aria-label={`${target.label} range`} onPointerMove={event=>{if(!gesture.current||busy)return;const box=event.currentTarget.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*480;input(gesture.current,String(target.min+Math.max(0,Math.min(1,(x-24)/432))*(target.max-target.min)));}} onPointerUp={event=>{gesture.current=null;event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{gesture.current=null;}}>
 <path d="M24 28H456" stroke="#70757b"/><path d={`M${point(values.min)} 28H${point(values.max)}`} stroke="#ffbe00" strokeWidth="5"/>
 {(['min','max'] as const).map(key=><circle key={key} cx={point(values[key])} cy={28} r={7} fill="#ffbe00" tabIndex={0} role="slider" aria-label={`${lane.id} ${key} handle`} aria-valuenow={values[key]} aria-valuemin={target.min} aria-valuemax={target.max} onPointerDown={event=>{if(busy)return;event.preventDefault();gesture.current=key;event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);}} onKeyDown={event=>{if(busy||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();input(key,String(Math.max(target.min,Math.min(target.max,values[key]+(event.key==='ArrowRight'?1:-1)*(target.step??.01)))));}}/>)}
 {typeof effective==='number'&&Number.isFinite(effective)&&<path d={`M${point(effective)} 14v28`} stroke="#f3f4f5"/>}<text x="24" y="52">{target.min}</text><text x="430" y="52">{target.max}</text></svg>}
 <div className="instrument-toolbar">{(['min','max'] as const).map(key=><label key={key}>{key==='min'?'Low / From':'High / To'}<input aria-label={`${lane.id} ${key}`} inputMode="decimal" disabled={busy} value={inputs[key]??String(values[key])} onChange={event=>input(key,event.target.value)}/></label>)}<label>Blend<select aria-label={`${lane.id} blend`} disabled={busy} value={values.blend} onChange={event=>set({blend:event.target.value as AutomationLane['blend']})}>{['replace','add','multiply'].map(value=><option key={value}>{value}</option>)}</select></label><label><input type="checkbox" aria-label={`${lane.id} enabled`} disabled={busy} checked={values.enabled} onChange={event=>set({enabled:event.target.checked})}/>Enabled</label><button disabled={!dirty||busy} onClick={()=>void apply()}>Apply range</button>{dirty&&<button disabled={busy} onClick={cancel}>Cancel range</button>}</div>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
