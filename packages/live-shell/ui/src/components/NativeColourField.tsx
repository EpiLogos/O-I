import {useEffect,useRef,useState,type PointerEvent,type ReactNode} from 'react'
import type {NativeColourChange,NativeDeviceChange,NativeEditorReply} from '../../../../expressions-boundary/src/editor'
import {NATIVE_COLOUR_MODES,NATIVE_COLOUR_PALETTES} from '../../../../expressions-boundary/src/nativeDeviceEdits'
import {useNativeInputRetention,type NativeInputAperture} from '../continuity/nativeInputContext'
import {nativeInputTargetKey} from '../continuity/nativeInputs'
import type {NativeMorphDriveProps,NativeMorphInputCustody} from './NativeMorphDrive'
import {COLOUR_GROUPS,atmosphereChange,colourBinding,colourInputIdentity,colourInputMaterial,colourEditChanges,colourChangeEdit,colourPaletteEdit,colourBackgroundEdit,nativeColourInputEdit,nativeColourProjection,startColourGeometry,moveColourGeometry,nudgeColourGeometry,dispatchColourAction,paperGlowTarget,type NativeColourEdit,type ColourSection} from './nativeColourController'
import {PALETTE_STOPS,inkLabel,invertPaletteStops,removePaletteStop,randomPaletteChange,harmonizePaperChanges,invertPaperChanges,paperPresetChanges,paperPresets} from './nativeColourHelpers'
import './NativeColourField.css'

export type NativeColourFieldProps=NativeMorphDriveProps
type Current=(reply?:NativeEditorReply)=>boolean
function useColourInput(props:NativeColourFieldProps,section:ColourSection) {
 const region=useRef<HTMLDivElement>(null),mounted=useRef(true),pending=useRef(false),original=useRef<NativeColourEdit|null>(null)
 const [attempt,setAttempt]=useState<NativeColourEdit|null>(null),[fault,setFault]=useState('')
 const aperture=useNativeInputRetention(),identity=colourInputIdentity(props.reading,section),key=nativeInputTargetKey(identity)
 const held=useRef<{key:string;aperture:NativeInputAperture|null;custody:NativeMorphInputCustody}|null>(null)
 if(!held.current||held.current.key!==key||held.current.aperture?.owner!==aperture?.owner)held.current={key,aperture,custody:props.createCustody(aperture,identity)}
 const custody=held.current.custody
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{if(!original.current&&custody.receipt){try{const edit=nativeColourInputEdit(custody.receipt.copy);original.current=edit;setAttempt(edit)}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}}},[custody])
 const presented=()=>mounted.current&&!!region.current?.getClientRects().length&&props.captureCurrent()()
 const fail=(cause:unknown)=>{if(mounted.current)setFault(cause instanceof Error?cause.message:String(cause))}
 const retain=(edit:NativeColourEdit,owner=custody,refusal?:string)=>{
  try{const receipt=owner.retain(colourInputMaterial(edit,refusal));original.current=edit;if(mounted.current){setAttempt(edit);setFault(refusal??'')}return receipt}catch(cause){fail(cause);return null}
 }
 const submit=(edit:NativeColourEdit,current:Current=props.captureCurrent(),owner=custody)=>{
  if(props.disabled||pending.current||!presented()||!current())return
  let changes;try{changes=colourEditChanges(edit);if(!changes.length){fail('The handle is at its original native values; no edit was dispatched');return}}catch(cause){retain(edit,owner);fail(cause);return}
  const receipt=retain(edit,owner);if(!receipt||!current())return
  pending.current=true
  void props.apply(changes,edit.basis).then(reply=>{
   if(!mounted.current||!region.current?.getClientRects().length||!current(reply))return
   if(reply.ok){try{owner.clear(receipt);if(owner.receipt?.ref===receipt.ref)throw Error('The original colour copy remains retained');if(original.current===edit){original.current=null;setAttempt(value=>value===edit?null:value)}setFault('')}catch(cause){fail(cause)}}else{if(original.current===edit)retain(edit,owner,reply.error);fail(reply.error)}
  }).catch(cause=>{if(original.current===edit)retain(edit,owner,cause instanceof Error?cause.message:String(cause));if(current())fail(cause)}).finally(()=>{pending.current=false})
 }
 const discard=()=>{if(!presented())return;try{const receipt=custody.receipt;custody.clear(receipt);if(receipt&&custody.receipt?.ref===receipt.ref)throw Error('The original colour copy remains retained');original.current=null;setAttempt(null);setFault('')}catch(cause){fail(cause)}}
 const status=<>{(fault||custody.fault)&&<p role="alert">{fault||custody.fault}</p>}{attempt&&<div className="native-retained-gesture">Retained original Field input · r{attempt.basis.revision}<button disabled={props.disabled} onClick={()=>submit(attempt)}>Apply original</button><button onClick={discard}>Discard</button></div>}</>
 return {region,attempt,original,pending,custody,presented,retain,submit,fail,status}
}
const messageOf=(cause:unknown)=>cause instanceof Error?cause.message:String(cause)
/** Discrete palette and paper actions keep no private draft. Each builds its change set at click time and sends ONE apply on the basis it read;
 * a refusal shows in the alert line, as ColourAtmosphere does. */
function useDiscreteColour(props:NativeColourFieldProps) {
 const [fault,setFault]=useState(''),[busy,setBusy]=useState(false),mounted=useRef(true),pending=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 const run=(build:()=>readonly NativeDeviceChange[])=>{
  const current=props.captureCurrent()
  if(props.disabled||pending.current||!current())return
  let sent:Promise<NativeEditorReply>
  try{sent=dispatchColourAction((changes,basis)=>props.apply(changes,basis),props.reading.basis,build())}catch(cause){setFault(messageOf(cause));return}
  pending.current=true;setBusy(true);setFault('')
  void sent.then(reply=>{if(mounted.current&&current(reply))setFault(reply.ok?'':reply.error)}).catch(cause=>{if(mounted.current)setFault(messageOf(cause))}).finally(()=>{pending.current=false;if(mounted.current)setBusy(false)})
 }
 return {run,busy,alert:fault?<p role="alert">{fault}</p>:null}
}
function PaletteStops(props:NativeColourFieldProps&{onPaletteDraft?:(retained:boolean)=>void}) {
 const input=useColourInput(props,'palette'),colors=input.attempt?.raw?.palette??props.reading.scene.field.palette,discrete=useDiscreteColour(props)
 const retained=!!input.attempt,committed=props.reading.scene.field.palette
 useEffect(()=>props.onPaletteDraft?.(retained),[retained])
 const edit=(next:string[])=>{if(props.disabled||!input.presented())return;input.retain(colourPaletteEdit(props.reading,next,input.original.current??undefined))}
 const reason=props.disabled?'Editing is unavailable in this view.':retained?'Apply or discard the retained palette stops first.':discrete.busy?'Waiting for the previous change to finish.':committed.length<=PALETTE_STOPS.min?'A palette keeps at least 2 stops. Add a stop before removing one.':''
 const locked=props.disabled||retained||discrete.busy
 return <div ref={input.region} className="native-colour-palette"><header><strong>Ordered palette stops</strong><span>{props.reading.scene.engine.paletteSource==='legacy'?'Native legacy ramp':'Native custom ramp'} · {colors.length}/8</span></header>
  <div className="native-colour-swatches" aria-label="Authored palette source order">{colors.map((color,index)=><span key={index} style={{background:/^#[\da-f]{6}$/i.test(color)?color:'transparent'}} title={`Source index ${index}: ${color}`}>{index+1}</span>)}</div>
  <div className="native-colour-stops">{colors.map((color,index)=><div key={index}><label>Stop {index+1}<input aria-label={`Palette stop ${index+1} hex`} value={color} spellCheck={false} disabled={props.disabled} onChange={event=>edit(colors.map((value,i)=>i===index?event.target.value:value))}/></label>
   <button aria-label={`Move stop ${index+1} earlier`} disabled={props.disabled||index===0} onClick={()=>{const next=[...colors];[next[index-1],next[index]]=[next[index],next[index-1]];edit(next)}}>←</button><button aria-label={`Move stop ${index+1} later`} disabled={props.disabled||index===colors.length-1} onClick={()=>{const next=[...colors];[next[index+1],next[index]]=[next[index],next[index+1]];edit(next)}}>→</button><button aria-label={`Remove stop ${index+1}`} disabled={locked||committed.length<=PALETTE_STOPS.min} onClick={()=>discrete.run(()=>[{kind:'colour-palette',colors:removePaletteStop(committed,index)}])}>×</button></div>)}</div>
  <button disabled={props.disabled||colors.length>=8} onClick={()=>edit([...colors,colors.at(-1)!])}>Add stop</button>
  <div className="native-colour-actions"><button disabled={locked} title="Swaps the first and last stops, as the app does" onClick={()=>discrete.run(()=>[{kind:'colour-palette',colors:invertPaletteStops(committed)}])}>Invert palette</button><button disabled={locked} title="Applies one random native palette preset" onClick={()=>discrete.run(()=>[randomPaletteChange(Math.random)])}>Random palette</button></div>
  <p>Custom stops are uniformly spaced by the native renderer. Editing the list selects the custom ramp.</p>{reason&&<p>{reason}</p>}{discrete.alert}{input.status}
 </div>
}
/** Paper actions. Each paper and the ink it needs go out in ONE apply (ink-mode is an admitted change), so no paper is gated by ink. */
function ColourBackground(props:NativeColourFieldProps&{paletteRetained?:boolean}) {
 const input=useColourInput(props,'background'),value=input.attempt?.raw?.background??props.reading.scene.field.background,discrete=useDiscreteColour(props)
 const retained=!!input.attempt,committed=props.reading.scene.field.background,first=props.reading.scene.field.palette[0]
 const reason=props.disabled?'Editing is unavailable in this view.':retained?'Apply or discard the retained paper first.':props.paletteRetained?'Apply or discard the retained palette stops first.':discrete.busy?'Waiting for the previous change to finish.':''
 const locked=!!reason
 const notes=reason?[reason]:[]
 return <div ref={input.region} className="native-colour-background"><label>Field background<input aria-label="Field background hex" value={value} disabled={props.disabled} spellCheck={false} onChange={event=>{if(input.presented())input.retain(colourBackgroundEdit(props.reading,event.target.value,input.original.current??undefined))}}/></label>{input.status}
  <div className="native-colour-actions"><button disabled={locked} title="Flips between the two fixed papers, with the ink each paper needs, as the app does" onClick={()=>discrete.run(()=>invertPaperChanges(committed))}>Invert paper</button><button disabled={locked||!first} title="Paper from the first palette stop, with ambient glow and its ink" onClick={()=>discrete.run(()=>harmonizePaperChanges(first,paperGlowTarget()))}>Harmonize paper to palette</button></div>
  <label className="native-colour-paper">Native paper preset<select aria-label="Native paper preset" value="" disabled={locked} onChange={event=>{const id=event.target.value;if(!id)return;discrete.run(()=>paperPresetChanges(id))}}><option value="">Choose native paper</option>{paperPresets().map(preset=><option key={preset.id} value={preset.id}>{`${preset.name} · ${inkLabel(preset.ink)} ink`}</option>)}</select></label>
  {notes.map(text=><p key={text}>{text}</p>)}{discrete.alert}
 </div>
}
function ColourSetting(props:NativeColourFieldProps&{setting:'colorEnabled'|'colorMode'}) {
 const input=useColourInput(props,props.setting==='colorEnabled'?'setting:colorEnabled':'setting:colorMode'),value=input.attempt?.changes[0]?.kind==='colour-setting'?input.attempt.changes[0].value:props.reading.scene.engine[props.setting]
 const choose=(value:boolean|string)=>{if(!input.presented()||value===props.reading.scene.engine[props.setting])return;try{input.submit(colourChangeEdit(props.reading,{kind:'colour-setting',key:props.setting,value} as NativeColourChange))}catch(cause){input.fail(cause)}}
 return <div ref={input.region} className="native-colour-setting">{props.setting==='colorEnabled'?<label><input type="checkbox" checked={value!==false} disabled={props.disabled} onChange={event=>choose(event.target.checked)}/>Colour Field enabled</label>:<label>Native distribution<select aria-label="Native colour distribution" value={String(value)} disabled={props.disabled} onChange={event=>choose(event.target.value)}>{NATIVE_COLOUR_MODES.map(mode=><option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>}{input.status}</div>
}
function ColourPresets(props:NativeColourFieldProps) {
 const input=useColourInput(props,'preset'),value=input.attempt?.changes[0]?.kind==='colour-preset'?input.attempt.changes[0].palette_id:props.reading.scene.engine.paletteId??''
 return <div ref={input.region} className="native-colour-preset"><label>Native palette preset<select aria-label="Native palette preset" value={NATIVE_COLOUR_PALETTES.some(p=>p.id===value)?value:''} disabled={props.disabled} onChange={event=>{if(event.target.value&&input.presented())input.submit(colourChangeEdit(props.reading,{kind:'colour-preset',palette_id:event.target.value}))}}><option value="">Choose native palette</option>{NATIVE_COLOUR_PALETTES.map(palette=><option key={palette.id} value={palette.id}>{palette.name}</option>)}</select></label><p>Applies the native preset’s colours, distribution and recommended values. Existing automation clocks remain active.</p>{input.status}</div>
}
function ColourGeometry(props:NativeColourFieldProps) {
 const input=useColourInput(props,'geometry'),svg=useRef<SVGSVGElement>(null),active=useRef<{edit:NativeColourEdit;current:Current;custody:NativeMorphInputCustody}|null>(null)
 const [draft,setDraft]=useState<NativeColourEdit|null>(null),source=nativeColourProjection(props.reading).config,shown=draft?.gesture??input.attempt?.gesture
 const x=shown?.value.x??source.fieldCenterOffset[0],y=shown?.value.y??source.fieldCenterOffset[1],angle=shown?.value.angle??source.angle,extent=Math.max(3,Math.abs(x)+1,Math.abs(y)+1),scale=active.current?.edit.gesture?.pixelsPerUnit??120/extent,cx=150+x*scale,cy=150-y*scale,radians=angle*Math.PI/180
 const point=(event:PointerEvent<SVGSVGElement>)=>{const m=svg.current?.getScreenCTM();if(!m)return null;const inverse=m.inverse();return {x:inverse.a*event.clientX+inverse.c*event.clientY+inverse.e,y:inverse.b*event.clientX+inverse.d*event.clientY+inverse.f}}
 const cancel=()=>{const pointer=active.current?.edit.gesture?.pointer;active.current=null;setDraft(null);if(pointer!==undefined&&svg.current?.hasPointerCapture(pointer))svg.current.releasePointerCapture(pointer)}
 const retainAndCancel=()=>{const held=active.current;if(held?.edit.changes.length)input.retain(held.edit,held.custody);cancel()}
 useEffect(()=>()=>{active.current=null},[])
 const start=(pointer:number,handle:'centre'|'direction',at:{x:number;y:number})=>{try{return startColourGeometry(props.reading,pointer,handle,at,scale,{x:cx,y:cy})}catch(cause){input.fail(cause);return null}}
 return <div ref={input.region} className="native-colour-geometry"><svg ref={svg} viewBox="0 0 300 300" aria-label="Native Colour Field centre and direction" tabIndex={0}
  onPointerDown={event=>{const handle=(event.target as SVGElement).dataset.colourHandle;if(props.disabled||input.pending.current||active.current||event.button!==0||!['centre','direction'].includes(handle??'')||!input.presented())return;const at=point(event);if(!at)return;const edit=start(event.pointerId,handle as 'centre'|'direction',at);if(!edit)return;const current=props.captureCurrent();if(!current())return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);active.current={edit,current,custody:input.custody};setDraft(edit)}}
  onPointerMove={event=>{const held=active.current;if(!held||held.edit.gesture?.pointer!==event.pointerId)return;if(!held.current()||!input.presented()){retainAndCancel();return}const at=point(event);if(!at)return;try{held.edit=moveColourGeometry(held.edit,event.pointerId,at);setDraft(held.edit);if(held.edit.changes.length||held.custody.receipt)input.retain(held.edit,held.custody)}catch(cause){input.fail(cause)}}}
  onPointerUp={event=>{const held=active.current;if(!held||held.edit.gesture?.pointer!==event.pointerId)return;cancel();if(held.edit.changes.length)input.submit(held.edit,held.current,held.custody)}}
  onPointerCancel={event=>{if(active.current?.edit.gesture?.pointer===event.pointerId)retainAndCancel()}} onLostPointerCapture={event=>{if(active.current?.edit.gesture?.pointer===event.pointerId)retainAndCancel()}}
  onKeyDown={event=>{if(event.key==='Escape'&&active.current){event.preventDefault();retainAndCancel();return}const handle=(event.target as SVGElement).dataset.colourHandle;if(props.disabled||input.pending.current||active.current||!event.key.startsWith('Arrow')||!['centre','direction'].includes(handle??'')||!input.presented())return;event.preventDefault();const initial=start(-1,handle as 'centre'|'direction',{x:cx+45*Math.cos(radians),y:cy-45*Math.sin(radians)});if(initial){const edit=nudgeColourGeometry(initial,event.key,event.shiftKey);if(edit.changes.length)input.submit(edit)}}}>
  <rect x="30" y="30" width="240" height="240" className="native-colour-plane"/><path d="M150 30V270M30 150H270" className="native-colour-grid"/>
  <path d={`M${cx} ${cy}L${cx+45*Math.cos(radians)} ${cy-45*Math.sin(radians)}`} className="native-colour-direction"/>
  <circle cx={cx} cy={cy} r="8" data-colour-handle="centre" tabIndex={props.disabled?-1:0} role="button" aria-label="Palette centre. Drag or use arrow keys" className="native-colour-handle"/>
  <circle cx={cx+45*Math.cos(radians)} cy={cy-45*Math.sin(radians)} r="6" data-colour-handle="direction" tabIndex={props.disabled?-1:0} role="button" aria-label="Palette direction. Drag or use arrow keys" className="native-colour-handle"/>
  <text x="35" y="20">Y ↑</text><text x="240" y="289">X →</text><text x="35" y="289">±{extent.toFixed(2)} offsets</text>
 </svg><p>{shown?'Retained handle preview':'Authored colour geometry'} · centre {x.toFixed(3)}, {y.toFixed(3)} · {angle.toFixed(1)}°</p><p>One centre offset equals 300 native pixels. This diagram edits configuration; the same Stage renders the colour response.</p>{input.status}</div>
}
/** Atmosphere choice (inspector.ts:118 options). Discrete: applied directly, the reading is the only copy; refusals are shown. */
const ATMOSPHERE_OPTIONS=[['solid','Solid paper'],['vignette','Vignette'],['ambientGlow','Ambient glow'],['adaptive','Adaptive glow']] as const
function ColourAtmosphere(props:NativeColourFieldProps) {
 const [fault,setFault]=useState(''),mounted=useRef(true),mode=props.reading.scene.engine.backgroundMode??'solid'
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 const choose=(value:string)=>{
  const option=ATMOSPHERE_OPTIONS.find(row=>row[0]===value),current=props.captureCurrent()
  if(!option||props.disabled||!current())return
  let change;try{change=atmosphereChange(option[0])}catch(cause){setFault(cause instanceof Error?cause.message:String(cause));return}
  void props.apply([change],props.reading.basis).then(reply=>{if(mounted.current&&current(reply))setFault(reply.ok?'':reply.error)}).catch(cause=>{if(mounted.current)setFault(cause instanceof Error?cause.message:String(cause))})
 }
 return <div className="native-colour-atmosphere"><label>Atmosphere<select aria-label="Background atmosphere" value={mode} disabled={props.disabled} onChange={event=>choose(event.target.value)}>{ATMOSPHERE_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{fault&&<p role="alert">{fault}</p>}</div>
}
/** App Palette dynamics shows the semantic spatial field only when it has bindings (inspector.ts:121; written at app.ts:755).
 * No admitted shell change kind exists for it, so it is disclosed here and never shown as a control. */
function SemanticFieldDisclosure({scene}:{scene:NativeColourFieldProps['reading']['scene']}) {
 const field=scene.semanticField
 if(!field?.bindings.length)return null
 return <p>Semantic spatial colour field · {field.enabled?'on':'off'} · global gain {String(Number(field.globalColorGain.toFixed(4)))} — not writable from the shell yet: no admitted change kind.</p>
}
function ColourGroup({group,children}:{group:{title:string;note:string};children:ReactNode}) {
 return <section className="native-control-group" aria-label={group.title}><h4>{group.title}</h4><p>{group.note}</p>{children}</section>
}
function colourControls(paths:readonly string[],props:NativeColourFieldProps) {
 return <div className="native-control-grid">{paths.map(path=><div key={path} title={colourBinding(path).note}>{props.renderControl(path)}</div>)}</div>
}
/** The whole panel as its four groups, in the device's order. Palette holds the settings, stops, background and presets. */
export function NativeColourField(props:NativeColourFieldProps) {
 const [paletteRetained,setPaletteRetained]=useState(false)
 return <div className="native-colour-field"><header><strong>Colour Field</strong><span>Exact native Scene Field</span></header>
  <div className="native-control-groups">
   <ColourGroup group={COLOUR_GROUPS.palette}>
    <div className="native-colour-settings"><ColourSetting {...props} setting="colorEnabled"/><ColourSetting {...props} setting="colorMode"/></div>
    <PaletteStops {...props} onPaletteDraft={setPaletteRetained}/><ColourBackground {...props} paletteRetained={paletteRetained}/><ColourPresets {...props}/><SemanticFieldDisclosure scene={props.reading.scene}/>
   </ColourGroup>
   <ColourGroup group={COLOUR_GROUPS.dynamics}>{colourControls(COLOUR_GROUPS.dynamics.paths,props)}</ColourGroup>
   <ColourGroup group={COLOUR_GROUPS.geometry}><div className="native-colour-layout"><ColourGeometry {...props}/>{colourControls(COLOUR_GROUPS.geometry.paths,props)}</div></ColourGroup>
   <ColourGroup group={COLOUR_GROUPS.atmosphere}><ColourAtmosphere {...props}/>{colourControls(COLOUR_GROUPS.atmosphere.paths,props)}</ColourGroup>
  </div></div>
}
