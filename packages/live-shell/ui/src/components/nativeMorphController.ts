import type {NativeDeviceChange,NativeMorphSettingChange,NativeEditorBasis,NativeEditorReading,Scene} from '../../../../expressions-boundary/src/editor'
import {sameEditorBasis} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS,baseValue} from '../../../../expressions-boundary/src/parameters'
import {validateNativeMorphSetting} from '../../../../expressions-boundary/src/nativeDeviceEdits'
import {toNativeConfig} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge'
import {resolvedAutomation} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks'
import {computeMorphDrive} from '../../../../../desktop/cradle/expressions-app/src/engine/morphSignal'
import type {ToroidalMorphConfig} from '../../../../../desktop/cradle/expressions-app/src/engine/types'
import {nativeInputTargetKey,type NativeInputMaterial,type PrivateNativeInputReceipt} from '../continuity/nativeInputs'
import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** The Morph device's sixteen numeric parameters (every Morph-group registry entry), in the app's Morph tab order
 * (desktop inspector.ts:218-226). The θ/φ offsets sit under Conjugate phases beside the phase handle that writes them. */
const CONJUGATE_PHASE_PATHS=['toroidalMorph.toroidalPhase','toroidalMorph.poloidalPhase','toroidalMorph.oscillationSpeed','toroidalMorph.poloidalRate','toroidalMorph.driveDepth','toroidalMorph.holdRatio'] as const
const PHYSICAL_MORPH_PATHS=['morphProgress'] as const
const MANIFOLD_DETAIL_PATHS=['toroidalMorph.oscillationAmplitude','toroidalMorph.breathRate','toroidalMorph.breathDepth','toroidalMorph.fiberPhaseOffset','toroidalMorph.chiralCoupling','toroidalMorph.toroidalWinding','toroidalMorph.poloidalWinding','toroidalMorph.manifoldRadius','toroidalMorph.volumetricDepthScale'] as const
/** Exact paths disclosed by the existing native registry (group 'Morph'), grouped as the app groups them. */
export const MORPH_CONTROL_PATHS=[...CONJUGATE_PHASE_PATHS,...PHYSICAL_MORPH_PATHS,...MANIFOLD_DETAIL_PATHS] as const
export type MorphControlPath=typeof MORPH_CONTROL_PATHS[number]
/** Coupled groups; every group shows under its title and together they cover MORPH_CONTROL_PATHS exactly. */
export const MORPH_GROUPS=[
 {title:'Conjugate phases',paths:CONJUGATE_PHASE_PATHS,note:'θ and φ are one coupled gesture: the phase handle writes both offsets as one batch. The drive-law curve is the authored configuration, not a live trajectory.'},
 {title:'Physical morph',paths:PHYSICAL_MORPH_PATHS,note:'The manifold scrub drives the blend by hand when Oscillating drive is off. The switches below choose trajectory, waveform and interference law.'},
 {title:'Manifold detail',paths:MANIFOLD_DETAIL_PATHS,note:'Breathing, chirality, winding and radius shape the live Stage manifold (GPGPUSimulator.ts:979-986 uniforms). The scalar drive law charted above does not include them.'},
] as const
const TAU=Math.PI*2
const phasePaths=['toroidalMorph.toroidalPhase','toroidalMorph.poloidalPhase'] as const
/** The one in-diagram handle drives exactly these two coupled offsets. */
export const MORPH_HANDLE_PATHS=phasePaths
export function morphBinding(path:MorphControlPath) {
 const binding=NATIVE_BINDINGS.find(row=>row.path===path)
 if(!binding)throw Error(`No native Morph binding is disclosed for ${path}`)
 return binding
}
export function morphValue(reading:NativeEditorReading,path:MorphControlPath):number {
 return baseValue(reading.scene,morphBinding(path).key)
}
/** Match the native reducer's manual takeover law: only an active replacing
 * lane starts from the actual evaluated value, then offsets its range. */
export function morphGestureValue(reading:NativeEditorReading,path:MorphControlPath):number {
 const target='field.'+morphBinding(path).key
 const replacing=reading.scene.automation.filter(lane=>lane.target===target&&resolvedAutomation(reading.scene.automation,lane).enabled).at(-1)
 if(replacing?.blend!=='replace')return morphValue(reading,path)
 const observed=reading.observation?.effectiveValues?.[target]
 if(typeof observed!=='number'||!Number.isFinite(observed))throw Error('Read the effective automated value before moving this control.')
 return observed
}
/** The same compiler and evaluator used by the native body. No particle
 * trajectory is approximated here: this is its configured A→B drive law. */
export function nativeMorphProjection(reading:NativeEditorReading,phases?:{theta:number;phi:number},samples=129) {
 if(!Number.isInteger(samples)||samples<2||samples>513)throw Error('Choose 2–513 native drive samples')
 const native=toNativeConfig(reading.scene),source=native.toroidalMorph
 if(!source)throw Error('This native Scene has no Morph configuration')
 const config:ToroidalMorphConfig={...source}
 if(phases){config.toroidalPhase=phases.theta*morphBinding(phasePaths[0]).factor;config.poloidalPhase=phases.phi*morphBinding(phasePaths[1]).factor}
 const thetaRate=config.oscillationSpeed,phiRate=config.poloidalRate??0
 const duration=thetaRate!==0?1/Math.abs(thetaRate):phiRate!==0?1/Math.abs(phiRate):1
 const points=Array.from({length:samples},(_,index)=>{
  const seconds=duration*index/(samples-1)
  return {seconds,...computeMorphDrive(config,(config.toroidalPhase??0)+TAU*thetaRate*seconds,(config.poloidalPhase??0)+TAU*phiRate*seconds)}
 })
 return {config,duration,points,initial:points[0],manualProgress:native.morphProgress,scope:'field' as const}
}
export interface MorphPhaseGesture {
 pointer:number;basis:NativeEditorBasis;theta:number;phi:number;initial:{theta:number;phi:number};start:{x:number;y:number}
}
export function morphPhaseInputIdentity(reading:NativeEditorReading):Pick<NativeInputMaterial,'basis'|'target'> {
 return {basis:{...reading.basis},target:{scope:'field',entity_id:null,entity_ref:null,step_id:null,parameter:null,family:'morph-drive',axis:null}}
}
export function startMorphPhaseGesture(reading:NativeEditorReading,pointer:number,point:{x:number;y:number}):MorphPhaseGesture {
 if(!Number.isInteger(pointer)||!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('A native phase gesture needs an owned pointer and finite position')
 const theta=morphGestureValue(reading,phasePaths[0]),phi=morphGestureValue(reading,phasePaths[1])
 return {pointer,basis:{...reading.basis},theta,phi,initial:{theta,phi},start:{...point}}
}
export function moveMorphPhaseGesture(gesture:MorphPhaseGesture,pointer:number,point:{x:number;y:number}):MorphPhaseGesture {
 if(pointer!==gesture.pointer)return gesture
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error('Keep the phase handle within a finite coordinate')
 if(point.x===gesture.start.x&&point.y===gesture.start.y)return {...gesture,theta:gesture.initial.theta,phi:gesture.initial.phi}
 const quantize=(path:typeof phasePaths[number],value:number)=>{const b=morphBinding(path);return Math.max(b.hardMin,Math.min(b.hardMax,Math.round(value/b.step)*b.step))}
 return {...gesture,theta:quantize(phasePaths[0],gesture.initial.theta+(point.x-gesture.start.x)/300),phi:quantize(phasePaths[1],gesture.initial.phi-(point.y-gesture.start.y)/150)}
}
export function nudgeMorphPhaseGesture(gesture:MorphPhaseGesture,key:string,shift=false):MorphPhaseGesture {
 const axis=key==='ArrowLeft'||key==='ArrowRight'?'theta':key==='ArrowUp'||key==='ArrowDown'?'phi':null
 if(!axis)return gesture
 const binding=morphBinding(axis==='theta'?phasePaths[0]:phasePaths[1]),sign=key==='ArrowLeft'||key==='ArrowDown'?-1:1
 return {...gesture,[axis]:Math.max(binding.hardMin,Math.min(binding.hardMax,gesture[axis]+sign*binding.step*(shift?10:1)))}
}
export function morphPhaseChanges(gesture:MorphPhaseGesture):Extract<NativeDeviceChange,{kind:'parameter'}>[] {
 return phasePaths.map((path,index)=>{const binding=morphBinding(path),value=index===0?gesture.theta:gesture.phi
  if(!Number.isFinite(value)||value<binding.hardMin||value>binding.hardMax)throw Error('The retained phase lies outside the native range')
  return {kind:'parameter' as const,target:'field.'+binding.key,value}
 })
}
export const changedMorphPhase=(gesture:MorphPhaseGesture)=>gesture.theta!==gesture.initial.theta||gesture.phi!==gesture.initial.phi
export function morphPhaseInputMaterial(gesture:MorphPhaseGesture,refusal?:string):NativeInputMaterial {
 const {pointer,basis,theta,phi,initial,start}=gesture
 return {basis:{...basis},target:{scope:'field',entity_id:null,entity_ref:null,step_id:null,parameter:null,family:'morph-drive',axis:null},
  input:{kind:'gesture',gesture:{pointer,basis:{...basis},theta,phi,initial:{...initial},start:{...start}},changes:morphPhaseChanges(gesture)},...(refusal?{refusal}:{})}
}
export function morphPhaseGestureCopy(receipt:PrivateNativeInputReceipt):MorphPhaseGesture {
 const copy=receipt.copy
 if(copy.input.kind!=='gesture')throw Error('The retained Morph input is not a phase gesture')
 const gesture=copy.input.gesture as unknown as MorphPhaseGesture
 if(!gesture.initial||!gesture.start||!Number.isInteger(gesture.pointer)||![gesture.theta,gesture.phi,gesture.initial.theta,gesture.initial.phi,gesture.start.x,gesture.start.y].every(Number.isFinite)||!sameEditorBasis(gesture.basis,copy.basis))throw Error('The original Morph gesture is incomplete; its copy remains retained')
 for(const [index,path]of phasePaths.entries()){const binding=morphBinding(path),value=index===0?gesture.initial.theta:gesture.initial.phi;if(value<binding.hardMin||value>binding.hardMax)throw Error('The original phase lies outside its native range')}
 const material=morphPhaseInputMaterial(gesture)
 if(nativeInputTargetKey(material)!==nativeInputTargetKey(copy)||JSON.stringify(material.input)!==JSON.stringify(copy.input))throw Error('The retained Morph input crosses its original Field target')
 return gesture
}
export function morphSettingValue(scene:Scene,key:'morphEnabled'|'autoOscillate'|'trajectory'|'driveShape'|'law') {
 return key==='law'?scene.morph.law:scene.engine[key]
}
export interface MorphSettingGesture {basis:NativeEditorBasis;change:NativeMorphSettingChange;initial:boolean|string}
export function morphSettingInputMaterial(edit:MorphSettingGesture,refusal?:string):NativeInputMaterial {
 const {basis,change,initial}=edit
 return {basis:{...basis},target:{scope:'field',entity_id:null,entity_ref:null,step_id:null,parameter:null,family:'morph-setting:'+change.key,axis:null},
  input:{kind:'gesture',gesture:{basis:{...basis},change:{...change},initial},changes:[{...change}]},...(refusal?{refusal}:{})}
}
export function morphSettingGestureCopy(receipt:PrivateNativeInputReceipt):MorphSettingGesture {
 const copy=receipt.copy
 if(copy.input.kind!=='gesture')throw Error('The retained Morph input is not a discrete setting')
 const edit=copy.input.gesture as unknown as MorphSettingGesture
 if(!edit?.basis||!sameEditorBasis(edit.basis,copy.basis))throw Error('The original Morph setting lost its native basis; its copy remains retained')
 validateNativeMorphSetting(edit.change);validateNativeMorphSetting({...edit.change,value:edit.initial})
 const material=morphSettingInputMaterial(edit)
 if(nativeInputTargetKey(material)!==nativeInputTargetKey(copy)||JSON.stringify(material.input)!==JSON.stringify(copy.input))throw Error('The retained Morph setting crosses its original Field target')
 return edit
}
/** Pure facts for the Morph device, shaped as FieldFaceModel so the rack widget and pool host consume it like the Field faces.
 * Morph is bespoke (NativeMorphDrive hosts it), so it is not a registry entry. Enable light = engine.morphEnabled, a real owner switch. */
export const morphDeviceFacts: FieldFaceModel = {
 name:'Morph',
 paths:MORPH_CONTROL_PATHS,
 groups:MORPH_GROUPS,
 // Four performer controls: the two conjugate rates set the tempo of θ and φ, drive depth sets how far the charted A→B
 // law swings, and breath depth is the manifold's most visible swell. The θ/φ offsets stay on the phase handle.
 compact:['toroidalMorph.oscillationSpeed','toroidalMorph.poloidalRate','toroidalMorph.driveDepth','toroidalMorph.breathDepth'],
 // The bottom slider drives drive depth: it is always live when Morph is enabled, unlike the manual scrub (morphProgress), which only acts when Oscillating drive is off.
 controlPath:'toroidalMorph.driveDepth',
 studio:'motion',
 enabled:reading=>reading.scene.engine.morphEnabled===true,
 strip:{
  summary:({scene})=>`θ ${fieldValue(scene,'toroidalMorph.oscillationSpeed')} · φ ${fieldValue(scene,'toroidalMorph.poloidalRate')} · depth ${fieldValue(scene,'toroidalMorph.driveDepth')}`,
  toggle:{kind:'morph-setting',key:'morphEnabled'},
 },
}

