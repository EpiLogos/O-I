import {useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react'
import type {NativeDeviceChange,NativeMorphSettingChange,NativeEditorBasis,NativeEditorReading,NativeEditorReply} from '../../../../expressions-boundary/src/editor'
import {NATIVE_MORPH_SETTINGS,validateNativeMorphSetting} from '../../../../expressions-boundary/src/nativeDeviceEdits'
import {useNativeInputRetention,type NativeInputAperture} from '../continuity/nativeInputContext'
import {nativeInputTargetKey,type NativeInputMaterial,type PrivateNativeInputReceipt} from '../continuity/nativeInputs'
import {MORPH_GROUPS,changedMorphPhase,morphPhaseChanges,morphPhaseGestureCopy,morphPhaseInputMaterial,morphPhaseInputIdentity,morphSettingValue,morphSettingInputMaterial,morphSettingGestureCopy,nativeMorphProjection,startMorphPhaseGesture,moveMorphPhaseGesture,nudgeMorphPhaseGesture,type MorphPhaseGesture,type MorphSettingGesture} from './nativeMorphController'
import './NativeMorphDrive.css'

export interface NativeMorphInputCustody {
 receipt:PrivateNativeInputReceipt|null;fault:string
 retain(material:NativeInputMaterial):PrivateNativeInputReceipt
 clear(receipt:PrivateNativeInputReceipt|null):void
}
type Current=(reply?:NativeEditorReply)=>boolean
export interface NativeMorphDriveProps {
 reading:NativeEditorReading;disabled:boolean
 apply(changes:readonly NativeDeviceChange[],basis?:NativeEditorBasis):Promise<NativeEditorReply>
 captureCurrent():Current
 renderControl(path:string):ReactNode
 createCustody(aperture:NativeInputAperture|null,material:Pick<NativeInputMaterial,'basis'|'target'>):NativeMorphInputCustody
}
const fraction=(turns:number)=>turns-Math.floor(turns)
const short=(value:number)=>String(Number(value.toFixed(4)))
function svgPoint(event:PointerEvent<SVGSVGElement>,svg:SVGSVGElement|null) {
 const matrix=svg?.getScreenCTM();if(!matrix)return null
 const inverse=matrix.inverse(),x=inverse.a*event.clientX+inverse.c*event.clientY+inverse.e,y=inverse.b*event.clientX+inverse.d*event.clientY+inverse.f
 return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null
}
const settingLabels={morphEnabled:'Morph trajectory',autoOscillate:'Oscillating drive',trajectory:'Spatial trajectory',driveShape:'Drive waveform',law:'Conjugate interference'} as const
function MorphSetting({reading,disabled,apply,captureCurrent,createCustody,setting}:Omit<NativeMorphDriveProps,'renderControl'>&{setting:NativeMorphSettingChange['key']}) {
 const element=useRef<HTMLLabelElement>(null),mounted=useRef(true),pending=useRef(false)
 const [attempt,setAttempt]=useState<MorphSettingGesture|null>(null),[fault,setFault]=useState('')
 const value=morphSettingValue(reading.scene,setting),base={basis:reading.basis,change:validateNativeMorphSetting({kind:'morph-setting',key:setting,value}),initial:value}
 const material=morphSettingInputMaterial(base),aperture=useNativeInputRetention(),key=nativeInputTargetKey(material)
 const held=useRef<{key:string;aperture:NativeInputAperture|null;custody:NativeMorphInputCustody}|null>(null)
 if(!held.current||held.current.key!==key||held.current.aperture?.owner!==aperture?.owner)held.current={key,aperture,custody:createCustody(aperture,material)}
 const custody=held.current.custody
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{if(!attempt&&custody.receipt){try{setAttempt(morphSettingGestureCopy(custody.receipt))}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}}},[custody,attempt])
 const presented=()=>mounted.current&&!!element.current?.getClientRects().length&&captureCurrent()()
 const retain=(edit:MorphSettingGesture,owner=custody,refusal?:string)=>{try{return owner.retain(morphSettingInputMaterial(edit,refusal))}catch(cause){if(mounted.current)setFault(cause instanceof Error?cause.message:String(cause));return null}}
 const submit=(edit:MorphSettingGesture)=>{
  if(disabled||pending.current||!presented())return
  const current=captureCurrent(),owner=custody,receipt=retain(edit);setAttempt(edit)
  if(!receipt||!current())return
  pending.current=true
  void apply([edit.change],edit.basis).then(reply=>{
   if(!mounted.current||!element.current?.getClientRects().length||!current(reply))return
   if(reply.ok){try{owner.clear(receipt);if(owner.receipt?.ref===receipt.ref)throw Error('The original Morph setting remains in recovery');setAttempt(value=>value===edit?null:value);setFault('')}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}}
   else{retain(edit,owner,reply.error);setFault(reply.error)}
  }).catch(cause=>{const message=cause instanceof Error?cause.message:String(cause);retain(edit,owner,message);if(mounted.current&&current())setFault(message)}).finally(()=>{pending.current=false})
 }
 const choose=(next:boolean|string)=>{if(next===value&&!attempt)return;submit({basis:{...reading.basis},initial:value,change:validateNativeMorphSetting({kind:'morph-setting',key:setting,value:next})})}
 const shown=attempt?.basis.expression_ref===reading.basis.expression_ref&&attempt.basis.scene_ref===reading.basis.scene_ref?attempt.change.value:value
 return <label ref={element} className="native-morph-setting"><span>{settingLabels[setting]}</span>
  {typeof value==='boolean'?<input type="checkbox" aria-label={settingLabels[setting]} checked={shown===true} disabled={disabled} onChange={event=>choose(event.target.checked)}/>:<select aria-label={settingLabels[setting]} value={String(shown)} disabled={disabled} onChange={event=>choose(event.target.value)}>{NATIVE_MORPH_SETTINGS[setting].map(option=><option key={String(option)} value={String(option)}>{String(option)}</option>)}</select>}
  {attempt&&<small>{fault||`Retained original native r${attempt.basis.revision}`}<button type="button" disabled={disabled} onClick={event=>{event.preventDefault();submit(attempt)}}>Apply original</button><button type="button" onClick={event=>{event.preventDefault();if(!presented())return;try{const receipt=custody.receipt;custody.clear(receipt);if(receipt&&custody.receipt?.ref===receipt.ref)throw Error('The original Morph setting remains in recovery');setAttempt(null);setFault('')}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}}}>Discard</button></small>}
  {!attempt&&(fault||custody.fault)&&<small role="alert">{fault||custody.fault}</small>}
 </label>
}
/** The parent supplies its existing admitted apply/lifetime/input machinery.
 * Local values are presentation drafts; persistence remains the original owner. */
export function NativeMorphDrive({reading,disabled,apply,captureCurrent,renderControl,createCustody}:NativeMorphDriveProps) {
 const [conjugate,physical,manifold]=MORPH_GROUPS
 const region=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),mounted=useRef(true),pending=useRef(false)
 const active=useRef<{gesture:MorphPhaseGesture;current:Current;custody:NativeMorphInputCustody}|null>(null)
 const [attempt,setAttempt]=useState<MorphPhaseGesture|null>(null),[draft,setDraft]=useState<MorphPhaseGesture|null>(null),[error,setError]=useState('')
 const aperture=useNativeInputRetention(),material=morphPhaseInputIdentity(reading),key=nativeInputTargetKey(material)
 const held=useRef<{aperture:NativeInputAperture|null;key:string;custody:NativeMorphInputCustody}|null>(null)
 if(!held.current||held.current.aperture?.owner!==aperture?.owner||held.current.key!==key)held.current={aperture,key,custody:createCustody(aperture,material)}
 const custody=held.current.custody
 const ownPresented=()=>mounted.current&&!!region.current?.getClientRects().length&&captureCurrent()()
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current=null}},[])
 useEffect(()=>{if(!attempt&&custody.receipt){try{setAttempt(morphPhaseGestureCopy(custody.receipt))}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}},[custody,attempt])
 const shown=draft??(attempt?.basis.expression_ref===reading.basis.expression_ref&&attempt.basis.scene_ref===reading.basis.scene_ref?attempt:null)
 const projection=nativeMorphProjection(reading),preview=shown?nativeMorphProjection(reading,{theta:shown.theta,phi:shown.phi}):null
 const theta=shown?.theta??(projection.config.toroidalPhase??0)/(Math.PI*2),phi=shown?.phi??(projection.config.poloidalPhase??0)/(Math.PI*2)
 const retain=(gesture:MorphPhaseGesture,owner=custody,refusal?:string)=>{
  try{const receipt=owner.retain(morphPhaseInputMaterial(gesture,refusal));if(mounted.current)setError('');return receipt}
  catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:String(cause));return null}
 }
 const cancel=()=>{const pointer=active.current?.gesture.pointer;active.current=null;setDraft(null);if(pointer!==undefined&&svg.current?.hasPointerCapture(pointer))svg.current.releasePointerCapture(pointer)}
 const retainAndCancel=()=>{const held=active.current;if(held&&changedMorphPhase(held.gesture)){retain(held.gesture,held.custody);setAttempt({...held.gesture})}cancel()}
 const submit=(gesture:MorphPhaseGesture,current:Current,owner:NativeMorphInputCustody)=>{
  const submitted={...gesture},receipt=retain(submitted,owner);setAttempt(submitted)
  if(!receipt||disabled||pending.current||!ownPresented()||!current())return
  pending.current=true
  void apply(morphPhaseChanges(submitted),submitted.basis).then(reply=>{
   if(!mounted.current||!region.current?.getClientRects().length||!current(reply))return
   if(reply.ok){try{owner.clear(receipt);if(owner.receipt?.ref===receipt.ref)throw Error('The original phase copy remains in recovery');setAttempt(value=>value===submitted?null:value);setError('')}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}
   else{retain(submitted,owner,reply.error);setError(reply.error)}
  }).catch(cause=>{const message=cause instanceof Error?cause.message:String(cause);retain(submitted,owner,message);if(mounted.current&&current())setError(message)}).finally(()=>{pending.current=false})
 }
 const finish=(event:PointerEvent<SVGSVGElement>)=>{const held=active.current;if(!held||held.gesture.pointer!==event.pointerId)return;cancel();if(changedMorphPhase(held.gesture))submit(held.gesture,held.current,held.custody)}
 const start=(pointer:number,point:{x:number;y:number})=>{try{return startMorphPhaseGesture(reading,pointer,point)}catch(cause){setError(cause instanceof Error?cause.message:String(cause));return null}}
 return <div ref={region} className="native-morph-drive">
  <header><strong>Morph Drive</strong><span>Field · {projection.config.enabled?'enabled':'off'} · {projection.config.trajectory}</span></header>
  <section className="native-control-group native-morph-group" aria-label={conjugate.title}><h4>{conjugate.title}</h4><p>{conjugate.note}</p>
  <div className="native-morph-layout"><svg ref={svg} viewBox="0 0 360 210" aria-label="Coupled native Morph phase offsets" tabIndex={0}
   onPointerDown={event=>{if(disabled||pending.current||active.current||event.button!==0||!(event.target as SVGElement).dataset.morphPhaseHandle||!ownPresented())return;const point=svgPoint(event,svg.current);if(!point)return;const current=captureCurrent();if(!current())return;const gesture=start(event.pointerId,point);if(!gesture)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);active.current={gesture,current,custody};setDraft(gesture)}}
   onPointerMove={event=>{const held=active.current;if(!held||held.gesture.pointer!==event.pointerId)return;if(!ownPresented()||!held.current()){retainAndCancel();return}const point=svgPoint(event,svg.current);if(!point)return;held.gesture=moveMorphPhaseGesture(held.gesture,event.pointerId,point);setDraft(held.gesture);if(changedMorphPhase(held.gesture)||held.custody.receipt)retain(held.gesture,held.custody)}}
   onPointerUp={finish} onPointerCancel={event=>{if(active.current?.gesture.pointer===event.pointerId)retainAndCancel()}} onLostPointerCapture={event=>{if(active.current?.gesture.pointer===event.pointerId)retainAndCancel()}}
   onKeyDown={event=>{if(event.key==='Escape'&&active.current){event.preventDefault();retainAndCancel();return}if(disabled||pending.current||active.current||!(event.target as SVGElement).dataset.morphPhaseHandle||!event.key.startsWith('Arrow')||!ownPresented())return;event.preventDefault();const initial=start(-1,{x:0,y:0});if(!initial)return;const gesture=nudgeMorphPhaseGesture(initial,event.key,event.shiftKey);if(changedMorphPhase(gesture))submit(gesture,captureCurrent(),custody)}}>
   <rect x="30" y="20" width="300" height="150" className="native-morph-plane" />
   {[0,.25,.5,.75,1].map(value=><g key={value}><path d={`M${30+value*300} 20V170M30 ${20+value*150}H330`} className="native-morph-grid"/><text x={30+value*300} y="187">{value}</text></g>)}
   <text x="35" y="14">φ · poloidal offset</text><text x="215" y="205">θ · toroidal offset · turns</text>
   <circle cx={30+fraction(theta)*300} cy={170-fraction(phi)*150} r="9" data-morph-phase-handle="true" tabIndex={disabled?-1:0} role="button" className="native-morph-handle" aria-label="Coupled phase offsets. Drag or use arrow keys" />
  </svg><div className="native-morph-drive-curve"><svg viewBox="0 0 360 210" aria-label="Native conjugate-phase A to B drive law">
   <path d="M25 20V170H335M25 95H335" className="native-morph-grid"/><text x="8" y="27">B</text><text x="8" y="172">A</text>
   <path d={projection.points.map((point,index)=>`${index?'L':'M'}${25+point.seconds/projection.duration*310} ${170-point.progress*150}`).join(' ')} className="native-morph-curve"/>
   {preview&&<path d={preview.points.map((point,index)=>`${index?'L':'M'}${25+point.seconds/preview.duration*310} ${170-point.progress*150}`).join(' ')} className="native-morph-curve native-morph-draft-curve"/>}
   <circle cx="25" cy={170-projection.initial.progress*150} r="4" className="native-morph-handle"/>
   <text x="25" y="188">0 s</text><text x="295" y="188">{short(projection.duration)} s</text><text x="25" y="205">{projection.config.driveShape} · {projection.config.interference} · configured law</text>
  </svg><p>{shown?'Retained gesture preview':'Authored offsets'} · θ {short(theta)} turns · φ {short(phi)} turns · law at offset {short((preview??projection).initial.progress)}</p>{preview&&<p>Solid: authored configuration · dashed: unsubmitted gesture preview</p>}</div></div>
  <div className="native-control-grid">{conjugate.paths.map(path=><div key={path}>{renderControl(path)}</div>)}</div></section>
  <section className="native-control-group native-morph-group" aria-label={physical.title}><h4>{physical.title}</h4><p>{physical.note}</p>
  <div className="native-morph-settings">{(Object.keys(NATIVE_MORPH_SETTINGS) as NativeMorphSettingChange['key'][]).map(setting=><MorphSetting key={setting} reading={reading} disabled={disabled} apply={apply} captureCurrent={captureCurrent} createCustody={createCustody} setting={setting}/>)}</div>
  <div className="native-control-grid">{physical.paths.map(path=><div key={path}>{renderControl(path)}</div>)}</div></section>
  <section className="native-control-group native-morph-group" aria-label={manifold.title}><h4>{manifold.title}</h4><p>{manifold.note}</p>
  <div className="native-control-grid">{manifold.paths.map(path=><div key={path}>{renderControl(path)}</div>)}</div></section>
  <p className="native-morph-caption">The solid curve evaluates the authored native drive configuration, not a live trajectory: the scalar drive law of θ/φ offsets, drive depth, waveform, dwell, fiber offset and interference law, on the time base set by the two rates. Effective automated values are disclosed in the controls; active replacing lanes start gestures from that actual observation. Spatial trajectory and running particle response remain on the same Stage.</p>
  {(error||custody.fault)&&<p role="alert">{error||custody.fault}</p>}
  {attempt&&<div className="native-retained-gesture">Original Field gesture retained · native r{attempt.basis.revision}<button disabled={disabled} onClick={()=>{if(!ownPresented())return;submit(attempt,captureCurrent(),custody)}}>Apply original gesture</button><button onClick={()=>{if(!ownPresented())return;try{const original=custody.receipt;custody.clear(original);if(original&&custody.receipt?.ref===original.ref)throw Error('The original phase copy remains in recovery');setAttempt(null);setError('')}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}}>Discard</button></div>}
 </div>
}
