import type {NativeColourChange,NativeDeviceChange,NativeEditorBasis,NativeEditorReading,NativeEditorReply,NativeFieldPanelChange} from '../../../../expressions-boundary/src/editor'
import {sameEditorBasis} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS,baseValue} from '../../../../expressions-boundary/src/parameters'
import {NATIVE_COLOUR_MODES,validateNativeColourChange,validateNativeFieldPanelChange} from '../../../../expressions-boundary/src/nativeDeviceEdits'
import {validateNativeInkModeChange} from '../../../../expressions-boundary/src/nativeFieldStyle'
import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {resolvedAutomation} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks'
import {toNativeConfig} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge'
import {nativeInputTargetKey,type NativeInputJson,type NativeInputMaterial,type PrivateNativeInputReceipt} from '../continuity/nativeInputs'

export type ColourSection='palette'|'background'|'setting:colorEnabled'|'setting:colorMode'|'preset'|'geometry'
const geometryPaths=['color.fieldCenterOffset.0','color.fieldCenterOffset.1','color.angle'] as const
/** The whole Colour Field panel, grouped as the app groups it (inspector.ts:116 Palette and paper; nested Palette dynamics at :121).
 * Palette holds the non-numeric stops, presets, background and the two admitted settings; every numeric control sits in one of the three numeric groups. */
export const COLOUR_GROUPS:Record<'palette'|'dynamics'|'geometry'|'atmosphere',{title:string;paths:readonly string[];note:string}>={
 palette:{title:'Palette',paths:[],note:'Colour pipeline (inspector.ts:121): Field palette → entity tint → travelling-focus contribution → optional semantic spatial colour. These layers stay independent.'},
 dynamics:{title:'Dynamics',paths:['color.cycleSpeed','color.hueShiftSpeed','color.waveFrequency','color.speedReactiveIntensity','color.turbulenceModulation','color.densityWeight','color.contrast'],note:'Native speeds, modulation and contrast of the palette response.'},
 geometry:{title:'Geometry',paths:geometryPaths,note:'The centre and direction handles in the diagram move these same three parameters.'},
 atmosphere:{title:'Atmosphere & paper',paths:['backgroundGlowIntensity','paperGrain'],note:'Background mode is a native choice (inspector.ts:118); glow and paper grain are exact values.'},
}
/** Exact-value controls in the device's group order. Dynamics, Geometry and Atmosphere together are every numeric Colour Field path. */
export const COLOUR_CONTROL_PATHS:readonly string[]=[...COLOUR_GROUPS.dynamics.paths,...COLOUR_GROUPS.geometry.paths,...COLOUR_GROUPS.atmosphere.paths]
const sections:readonly ColourSection[]=['palette','background','setting:colorEnabled','setting:colorMode','preset','geometry']
export function colourBinding(path:string) {
 const binding=NATIVE_BINDINGS.find(row=>row.path===path&&row.group==='color')
 if(!binding)throw Error('This colour control has no native registry binding')
 return binding
}
export function nativeColourProjection(reading:NativeEditorReading) {
 const config=toNativeConfig(reading.scene).color
 if(!config)throw Error('This Scene has no native colour configuration')
 const source=reading.scene.engine.paletteSource??'custom'
 return {config,colors:[...reading.scene.field.palette],source,positions:source==='legacy'?null:reading.scene.field.palette.map((_,index,array)=>index/(array.length-1))}
}
function snapshot(reading:NativeEditorReading) {
 return {palette:[...reading.scene.field.palette],background:reading.scene.field.background,enabled:reading.scene.engine.colorEnabled,mode:reading.scene.engine.colorMode}
}
export function colourInputIdentity(reading:NativeEditorReading,section:ColourSection):Pick<NativeInputMaterial,'basis'|'target'> {
 if(!sections.includes(section))throw Error('Choose an exact native colour input family')
 return {basis:{...reading.basis},target:{scope:'field',entity_id:null,entity_ref:null,step_id:null,parameter:null,family:'colour:'+section,axis:null}}
}
export interface ColourGeometryGesture {
 pointer:number;handle:'centre'|'direction';pixelsPerUnit:number;start:{x:number;y:number};centre:{x:number;y:number};initial:{x:number;y:number;angle:number};value:{x:number;y:number;angle:number}
}
export interface NativeColourEdit {
 basis:NativeEditorBasis;section:ColourSection;initial:ReturnType<typeof snapshot>;changes:NativeDeviceChange[]
 raw?:{palette?:string[];background?:string};gesture?:ColourGeometryGesture
}
export function colourChangeEdit(reading:NativeEditorReading,change:NativeColourChange):NativeColourEdit {
 const admitted=validateNativeColourChange(change),section:ColourSection=admitted.kind==='colour-setting'?admitted.key==='colorEnabled'?'setting:colorEnabled':'setting:colorMode':admitted.kind==='colour-preset'?'preset':admitted.kind==='colour-background'?'background':'palette'
 return {basis:{...reading.basis},section,initial:snapshot(reading),changes:[admitted]}
}
export function colourPaletteEdit(reading:NativeEditorReading,raw:readonly string[],original?:NativeColourEdit):NativeColourEdit {
 if(!Array.isArray(raw)||raw.length<2||raw.length>8||Array.from(raw).some(value=>typeof value!=='string')||original&&original.section!=='palette')throw Error('Retain exactly 2–8 native palette source entries')
 const edit=original??{basis:{...reading.basis},section:'palette' as const,initial:snapshot(reading),changes:[]}
 let changes:NativeDeviceChange[]=[]
 try{changes=[validateNativeColourChange({kind:'colour-palette',colors:[...raw]})]}catch{/* Exact incomplete human input is retained, with no intended mutation. */}
 return {...edit,section:'palette',raw:{palette:[...raw]},changes}
}
export function colourBackgroundEdit(reading:NativeEditorReading,raw:string,original?:NativeColourEdit):NativeColourEdit {
 if(typeof raw!=='string'||original&&original.section!=='background')throw Error('Retain the exact original background text')
 const edit=original??{basis:{...reading.basis},section:'background' as const,initial:snapshot(reading),changes:[]}
 let changes:NativeDeviceChange[]=[]
 try{changes=[validateNativeColourChange({kind:'colour-background',value:raw})]}catch{/* Incomplete hex bytes stay in the original private copy. */}
 return {...edit,section:'background',raw:{background:raw},changes}
}
function gestureValue(reading:NativeEditorReading,path:typeof geometryPaths[number]) {
 const binding=colourBinding(path),target='field.'+binding.key
 const replacing=reading.scene.automation.filter(lane=>lane.target===target&&resolvedAutomation(reading.scene.automation,lane).enabled).at(-1)
 if(replacing?.blend!=='replace')return baseValue(reading.scene,binding.key)
 const observed=reading.observation?.effectiveValues?.[target]
 if(typeof observed!=='number'||!Number.isFinite(observed))throw Error('Read the effective automated value before moving this colour handle')
 return observed
}
export function startColourGeometry(reading:NativeEditorReading,pointer:number,handle:ColourGeometryGesture['handle'],point:{x:number;y:number},pixelsPerUnit:number,centre=point):NativeColourEdit {
 if(!Number.isInteger(pointer)||!['centre','direction'].includes(handle)||![point.x,point.y,centre.x,centre.y,pixelsPerUnit].every(Number.isFinite)||pixelsPerUnit<=0||handle==='direction'&&centre.x===point.x&&centre.y===point.y)throw Error('Capture an owned colour pointer in the actual displayed coordinate plane')
 const values={x:gestureValue(reading,geometryPaths[0]),y:gestureValue(reading,geometryPaths[1]),angle:gestureValue(reading,geometryPaths[2])}
 return {basis:{...reading.basis},section:'geometry',initial:snapshot(reading),changes:[],gesture:{pointer,handle,pixelsPerUnit,start:{...point},centre:{...centre},initial:{...values},value:{...values}}}
}
const quantize=(path:typeof geometryPaths[number],value:number)=>{const binding=colourBinding(path);return Math.max(binding.hardMin,Math.min(binding.hardMax,Math.round(value/binding.step)*binding.step))}
function geometryChanges(gesture:ColourGeometryGesture):NativeDeviceChange[] {
 const paths=gesture.handle==='centre'?geometryPaths.slice(0,2):[geometryPaths[2]]
 return paths.map(path=>{const binding=colourBinding(path),value=path.endsWith('.0')?gesture.value.x:path.endsWith('.1')?gesture.value.y:gesture.value.angle
  if(!Number.isFinite(value)||value<binding.hardMin||value>binding.hardMax)throw Error('Keep the colour handle within its native range')
  return {kind:'parameter' as const,target:'field.'+binding.key,value}
 })
}
export function moveColourGeometry(edit:NativeColourEdit,pointer:number,point:{x:number;y:number}):NativeColourEdit {
 const gesture=edit.gesture;if(!gesture||gesture.pointer!==pointer)return edit
 if(![point.x,point.y].every(Number.isFinite))throw Error('Keep the colour pointer position finite')
 const value={...gesture.initial},dx=point.x-gesture.start.x,dy=point.y-gesture.start.y
 if(dx!==0||dy!==0){if(gesture.handle==='centre'){value.x=quantize(geometryPaths[0],value.x+dx/gesture.pixelsPerUnit);value.y=quantize(geometryPaths[1],value.y-dy/gesture.pixelsPerUnit)}else{const bearing=Math.atan2(gesture.centre.y-point.y,point.x-gesture.centre.x),initialBearing=Math.atan2(gesture.centre.y-gesture.start.y,gesture.start.x-gesture.centre.x),delta=Math.atan2(Math.sin(bearing-initialBearing),Math.cos(bearing-initialBearing))*180/Math.PI;value.angle=quantize(geometryPaths[2],gesture.initial.angle+delta)}}
 const next={...gesture,value},changed=Object.keys(value).some(key=>value[key as keyof typeof value]!==gesture.initial[key as keyof typeof value])
 return {...edit,gesture:next,changes:changed?geometryChanges(next):[]}
}
export function nudgeColourGeometry(edit:NativeColourEdit,key:string,shift=false):NativeColourEdit {
 const gesture=edit.gesture;if(!gesture)return edit
 const value={...gesture.value},axis=gesture.handle==='direction'?'angle':key==='ArrowLeft'||key==='ArrowRight'?'x':'y',path=axis==='angle'?geometryPaths[2]:axis==='x'?geometryPaths[0]:geometryPaths[1]
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return edit
 const sign=key==='ArrowLeft'||key==='ArrowDown'?-1:1,binding=colourBinding(path)
 value[axis]=Math.max(binding.hardMin,Math.min(binding.hardMax,value[axis]+sign*binding.step*(shift?10:1)))
 const next={...gesture,value},changed=value[axis]!==gesture.initial[axis]
 return {...edit,gesture:next,changes:changed?geometryChanges(next):[]}
}
export function colourEditChanges(edit:NativeColourEdit):NativeDeviceChange[] {
 if(edit.raw?.palette)return [validateNativeColourChange({kind:'colour-palette',colors:edit.raw.palette})]
 if(edit.raw?.background!==undefined)return [validateNativeColourChange({kind:'colour-background',value:edit.raw.background})]
 if(edit.section==='geometry') {
  if(!edit.gesture)throw Error('The original colour handle is missing')
  if(!edit.changes.length&&Object.keys(edit.gesture.value).every(key=>edit.gesture!.value[key as keyof ColourGeometryGesture['value']]===edit.gesture!.initial[key as keyof ColourGeometryGesture['initial']]))return []
  const actual=geometryChanges(edit.gesture)
  if(JSON.stringify(actual)!==JSON.stringify(edit.changes))throw Error('The retained colour handle crosses its original native target')
  return actual
 }
 return edit.changes.map(change=>validateNativeColourChange(change))
}
export function colourInputMaterial(edit:NativeColourEdit,refusal?:string):NativeInputMaterial {
 const changes=JSON.parse(JSON.stringify(edit.changes)) as Array<{[key:string]:NativeInputJson}>
 return {...colourInputIdentity({basis:edit.basis} as NativeEditorReading,edit.section),input:{kind:'gesture',gesture:JSON.parse(JSON.stringify(edit)),changes},...(refusal?{refusal}:{})}
}
export function nativeColourInputEdit(copy:PrivateNativeInputReceipt['copy']):NativeColourEdit {
 if(copy.input.kind!=='gesture')throw Error('Use the original Colour Field input editor')
 const edit=copy.input.gesture as unknown as NativeColourEdit
 if(!edit?.initial||!sameEditorBasis(edit.basis,copy.basis))throw Error('The colour copy lost its original native basis')
 if(Object.keys(edit).some(key=>!['basis','section','initial','changes','raw','gesture'].includes(key))||Object.keys(edit.initial).some(key=>!['palette','background','enabled','mode'].includes(key)))throw Error('The colour copy carries foreign input operands')
 if(edit.raw&&(Object.keys(edit.raw).some(key=>!['palette','background'].includes(key))||edit.raw.palette!==undefined&&(edit.section!=='palette'||edit.raw.background!==undefined)||edit.raw.background!==undefined&&edit.section!=='background'))throw Error('The raw colour copy belongs to another input family')
 if(edit.gesture) {
  const g=edit.gesture
  if(edit.section!=='geometry'||Object.keys(g).some(key=>!['pointer','handle','pixelsPerUnit','start','centre','initial','value'].includes(key))||!Number.isInteger(g.pointer)||!['centre','direction'].includes(g.handle)||!g.start||!g.centre||!g.initial||!g.value||![g.pixelsPerUnit,g.start.x,g.start.y,g.centre.x,g.centre.y,...Object.values(g.initial),...Object.values(g.value)].every(Number.isFinite)||g.pixelsPerUnit<=0)throw Error('The original colour pointer is incomplete')
  for(const values of [g.initial,g.value])for(const [axis,path]of [['x',geometryPaths[0]],['y',geometryPaths[1]],['angle',geometryPaths[2]]] as const){const binding=colourBinding(path);if(Object.keys(values).some(key=>!['x','y','angle'].includes(key))||values[axis]<binding.hardMin||values[axis]>binding.hardMax)throw Error('The retained colour handle is outside the native range')}
 }
 validateNativeColourChange({kind:'colour-palette',colors:edit.initial.palette});validateNativeColourChange({kind:'colour-background',value:edit.initial.background})
 validateNativeColourChange({kind:'colour-setting',key:'colorEnabled',value:edit.initial.enabled});validateNativeColourChange({kind:'colour-setting',key:'colorMode',value:edit.initial.mode})
 const material=colourInputMaterial(edit)
 if(nativeInputTargetKey(material)!==nativeInputTargetKey(copy)||JSON.stringify(material.input)!==JSON.stringify(copy.input))throw Error('The retained colour input crosses its original Field target')
 if(edit.section==='geometry')colourEditChanges(edit)
 else if(edit.raw?.palette){const produced=colourPaletteEdit({basis:edit.basis} as NativeEditorReading,edit.raw.palette,edit);if(JSON.stringify(produced.changes)!==JSON.stringify(edit.changes))throw Error('The palette copy carries foreign native changes')}
 else if(edit.raw?.background!==undefined){const produced=colourBackgroundEdit({basis:edit.basis} as NativeEditorReading,edit.raw.background,edit);if(JSON.stringify(produced.changes)!==JSON.stringify(edit.changes))throw Error('The background copy carries foreign native changes')}
 else{for(const change of colourEditChanges(edit)){const kind=(change as NativeColourChange).kind,expected=kind==='colour-setting'?'setting:'+(change as Extract<NativeColourChange,{kind:'colour-setting'}>).key:kind==='colour-preset'?'preset':kind==='colour-background'?'background':'palette';if(expected!==edit.section)throw Error('The retained colour change belongs to another input family')}}
 return edit
}
export function nativeColourInputChanges(copy:PrivateNativeInputReceipt['copy']):NativeDeviceChange[] {
 const changes=colourEditChanges(nativeColourInputEdit(copy));if(!changes.length)throw Error('This colour input has no intended native edit');return changes
}
/** Admitted Atmosphere choice (inspector.ts:118 option list). A plain panel-setting change, not a retained colour draft. */
export function atmosphereChange(value:string):NativeFieldPanelChange {
 return validateNativeFieldPanelChange({kind:'panel-setting',key:'backgroundMode',value})
}
/** Admitted rows of one discrete palette or paper action: Colour Field kinds, Field panel settings, and colour-group parameters inside their native range.
 * Each target may appear once, the same law the host reducer enforces (nativeDeviceEdits.ts "written twice"). */
export function colourActionChanges(changes:readonly NativeDeviceChange[]):NativeDeviceChange[] {
 if(!changes.length)throw Error('This colour action has no native change')
 const seen=new Set<string>()
 return changes.map(change=>{
  const row=change as unknown as Record<string,unknown>
  let admitted:NativeDeviceChange,target:string
  if(['colour-setting','colour-palette','colour-background','colour-preset'].includes(String(row.kind))){
   const colour=validateNativeColourChange(change)
   admitted=colour;target=colour.kind==='colour-setting'?'colour-setting:'+colour.key:colour.kind==='colour-background'?'colour-background':'colour-palette'
  }else if(row.kind==='ink-mode'){
   const ink=validateNativeInkModeChange(change);admitted=ink;target='ink-mode'
  }else if(row.kind==='panel-setting'){
   const panel=validateNativeFieldPanelChange(change);admitted=panel;target='panel-setting:'+panel.key
  }else if(row.kind==='parameter'){
   const path=String(row.target),binding=NATIVE_BINDINGS.find(item=>item.group==='color'&&'field.'+item.key===path),value=row.value
   if(!binding||typeof value!=='number'||!Number.isFinite(value)||value<binding.hardMin||value>binding.hardMax)throw Error('Choose an admitted native Colour Field parameter inside its range.')
   admitted={kind:'parameter',target:path,value};target=path
  }else throw Error('Choose an admitted native Colour Field action.')
  if(seen.has(target))throw Error('A device gesture cannot write the same Colour Field target twice.')
  seen.add(target)
  return admitted
 })
}
/** The single dispatch path for a discrete action: validation runs first, so a refused action sends nothing; otherwise exactly one apply on the basis it was read on. */
export function dispatchColourAction(apply:(changes:readonly NativeDeviceChange[],basis?:NativeEditorBasis)=>Promise<NativeEditorReply>,basis:NativeEditorBasis,changes:readonly NativeDeviceChange[]):Promise<NativeEditorReply> {
 return apply(colourActionChanges(changes),basis)
}
/** The native row written by "Harmonize paper to palette": the Glow Intensity binding of the Color group (app.ts:538). */
export function paperGlowTarget():string {
 return 'field.'+colourBinding('backgroundGlowIntensity').key
}
/** Pure whole-device facts for the Colour Field, consumed by the rack widget and expanded pool. Mirrors FieldFaceModel
 * except `controlPath`: the device has no single slider path, its two-axis handle drives the geometry parameters. */
const colourValue=(scene:NativeEditorReading['scene'],path:string)=>String(Number(baseValue(scene,colourBinding(path).key).toFixed(4)))
export const colourDeviceFacts = {
 name:'Colour Field',
 /** Every numeric registry row of group 'Color' or 'Paper' (both group 'color' in NATIVE_BINDINGS), in registry = app order. */
 paths:NATIVE_BINDINGS.filter(binding=>binding.group==='color').map(binding=>binding.path),
 groups:[COLOUR_GROUPS.palette,COLOUR_GROUPS.dynamics,COLOUR_GROUPS.geometry,COLOUR_GROUPS.atmosphere],
 /** Performer levers that change the live palette without a diagram handle: two speeds, wave density and contrast. Geometry stays on the diagram. */
 compact:['color.cycleSpeed','color.hueShiftSpeed','color.waveFrequency','color.contrast'],
 /** Expressions Studio section id (shell.ts:17 studio-sections value 'appearance'; app.ts:221 maps it to the palette and material groups). */
 studio:'appearance',
 /** Activator: the real owner enable, engine.colorEnabled (also the host's activator light, NativeDeviceEditors.tsx:355). */
 // An unset flag is on: the native export enables colour unless it is explicitly false (nativeBridge.ts toNativeConfig).
 enabled:(reading:NativeEditorReading)=>reading.scene.engine.colorEnabled!==false,
 strip:{
  summary:(reading:NativeEditorReading)=>{const engine=reading.scene.engine,mode=NATIVE_COLOUR_MODES.find(row=>row.id===engine.colorMode)?.label??engine.colorMode
   return `${engine.colorEnabled!==false?'Palette on':'Monochrome ink'} · ${reading.scene.field.palette.length} stops · ${mode} · cycle ${colourValue(reading.scene,'color.cycleSpeed')}`},
  toggle:{kind:'colour-setting',key:'colorEnabled'} as const,
 },
} satisfies Omit<FieldFaceModel,'controlPath'>
