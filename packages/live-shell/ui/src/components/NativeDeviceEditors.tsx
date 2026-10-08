import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react'
import type {Entity, Scene, NativeDeviceChange, NativeEditorBasis, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import {sameEditorBasis} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, baseValue, entityTargets, type NativeBinding} from '@epilogos/expressions-boundary/parameters'
import {useNativeInputRetention, type NativeInputAperture} from '../continuity/nativeInputContext'
import {nativeInputTargetKey, type NativeInputMaterial, type NativeInputTarget, type PrivateNativeInputReceipt} from '../continuity/nativeInputs'
import './NativeDeviceEditors.css'

export interface NativeDeviceEditorsProps {
  reading: NativeEditorReading | null
  request: (request: NativeEditorRequest) => Promise<NativeEditorReply>
  onSelectEntity?: (id: string) => void
  isPresented?: () => boolean
}
type Apply = (changes: readonly NativeDeviceChange[], basis?: NativeEditorBasis) => Promise<NativeEditorReply>
type DeviceCurrent = (reply?: NativeEditorReply) => boolean
type CaptureCurrent = () => DeviceCurrent
export interface NativeDevicePresentation {epoch:number;cut:string;reading:NativeEditorReading|null;presented:boolean;entity_id:string|null;entity_ref:string|null}
/** Owner outcomes remain true; only the same visible receiving cut may display them. */
export function currentNativeDeviceReply(captured:NativeDevicePresentation,current:NativeDevicePresentation,reply?:NativeEditorReply) {
  if(!current.presented||captured.epoch!==current.epoch||captured.cut!==current.cut)return false
  if(reply?.ok&&captured.reading&&(reply.reading.basis.expression_ref!==captured.reading.basis.expression_ref
    ||reply.reading.basis.scene_ref!==captured.reading.basis.scene_ref
    ||reply.reading.selection.entity_ids.join('|')!==captured.reading.selection.entity_ids.join('|')
    ||captured.entity_id!==null&&(reply.reading.entityOccurrences[captured.entity_id]??null)!==captured.entity_ref))return false
  if(!captured.reading)return !reply||!reply.ok||!current.reading||reply.reading.basis.expression_ref===current.reading.basis.expression_ref&&reply.reading.basis.scene_ref===current.reading.basis.scene_ref
  if(!current.reading)return false
  return sameEditorBasis(captured.reading.basis,current.reading.basis)
    ||!!reply?.ok&&sameEditorBasis(reply.reading.basis,current.reading.basis)
      &&reply.reading.basis.expression_ref===captured.reading.basis.expression_ref&&reply.reading.basis.scene_ref===captured.reading.basis.scene_ref
}
const target = (id: string, suffix: string) => `entity:${encodeURIComponent(id)}:${suffix}`
const short = (n: number) => Number.isFinite(n) ? String(Number(n.toFixed(4))) : '—'
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const fieldBinding = (path: string) => NATIVE_BINDINGS.find(binding => binding.path === path)

/** Receiving projection only: every write and clear goes through the original
 * private draft owner. Ambiguous divergent copies remain in its recovery panel. */
export class NativeDeviceInputCustody {
  receipt:PrivateNativeInputReceipt|null=null
  fault=''
  constructor(readonly aperture:NativeInputAperture|null,material:Pick<NativeInputMaterial,'basis'|'target'>,kind:'text'|'gesture') {
    if(!aperture)return
    try {
      if(!aperture.current())return
      const copies=aperture.owner.read().copies.filter(row=>row.copy.writer_id===aperture.owner.writerId
        &&row.copy.writer_scope.accessEpoch===aperture.owner.scope.accessEpoch
        &&row.copy.input.kind===kind&&nativeInputTargetKey(row.copy)===nativeInputTargetKey(material))
      if(copies.length===1)this.receipt=copies[0]
      else if(copies.length>1)this.fault='Divergent input copies are retained; choose the exact copy in recovery'
    }catch(cause){this.fault=cause instanceof Error?cause.message:String(cause)}
  }
  retain(material:NativeInputMaterial):PrivateNativeInputReceipt {
    if(!this.aperture)throw Error('The private input owner is unavailable; keep this view open')
    try {
      if(this.fault&&!this.receipt)throw Error(this.fault)
      const old=this.receipt
      if(old&&nativeInputTargetKey(old.copy)!==nativeInputTargetKey(material))throw Error('The input belongs to another captured device target')
      // A new human gesture may start on a later basis. It gets a distinct
      // private copy; the older failed gesture is never rebased or overwritten.
      // Explicit recovery-panel ACK/Discard may already have consumed this
      // own copy. A later human edit starts a new private identity while still
      // carrying the caller's original material; no native basis is refreshed.
      const stillHeld=old&&this.aperture.owner.read().copies.some(row=>row.ref===old.ref)
      const previous=old&&stillHeld&&sameEditorBasis(old.copy.basis,material.basis)?old:undefined
      const receipt=this.aperture.owner.retain(material,this.aperture.current,previous)
      this.receipt=receipt;this.aperture.failure?.(nativeInputTargetKey(material),null);this.aperture.changed();return receipt
    }catch(cause){this.aperture.failure?.(nativeInputTargetKey(material),cause instanceof Error?cause.message:String(cause));throw cause}
  }
  clear(submitted:PrivateNativeInputReceipt|null):void {
    if(!submitted||!this.aperture)return
    if(this.aperture.owner.clear(submitted,this.aperture.current)){
      if(this.receipt?.ref===submitted.ref&&this.receipt===submitted)this.receipt=null
      this.aperture.failure?.(nativeInputTargetKey(submitted.copy),null);this.aperture.changed()
    }
  }
}
function useDeviceInputCustody(material:Pick<NativeInputMaterial,'basis'|'target'>,kind:'text'|'gesture') {
  const aperture=useNativeInputRetention(),held=useRef<{aperture:NativeInputAperture|null;key:string;custody:NativeDeviceInputCustody}|null>(null)
  const key=nativeInputTargetKey(material)
  if(!held.current||held.current.aperture?.owner!==aperture?.owner||held.current.key!==key)held.current={aperture,key,custody:new NativeDeviceInputCustody(aperture,material,kind)}
  return held.current.custody
}
const fieldInputTarget=(parameter:string,family:string):NativeInputTarget=>({scope:'field',entity_id:null,entity_ref:null,step_id:null,parameter,family,axis:null})
const forceInputTarget=(reading:NativeEditorReading,entity:Entity,parameter:string|null,axis:'y'|'z'|null=null):NativeInputTarget=>({scope:'entity',entity_id:entity.id,entity_ref:reading.entityOccurrences[entity.id]??null,step_id:null,parameter,family:'force',axis})

/** Exact entry commits explicitly, so opening another disclosure retains the draft. */
function NumberControl({label, value, binding, disabled, onCommit, automated, observed, captureCurrent, material}: {
  label: string; value: number; binding: Pick<NativeBinding, 'hardMin' | 'hardMax' | 'step' | 'unit'>
  disabled: boolean; onCommit: (value: number,basis?:NativeEditorBasis) => Promise<NativeEditorReply>; automated?: boolean; observed?: number
  captureCurrent: CaptureCurrent; material:Pick<NativeInputMaterial,'basis'|'target'>
}) {
  const custody=useDeviceInputCustody(material,'text'),recovered=custody.receipt?.copy.input
  const [text, setText] = useState(recovered?.kind==='text'?recovered.text:short(value)), [error, setError] = useState(custody.fault), [retained, setRetained] = useState(!!recovered)
  const inputBasis=useRef(recovered?custody.receipt!.copy.basis:material.basis),initialText=useRef(recovered?.kind==='text'?recovered.initial:short(value)),inputCustody=useRef(custody),restoredFocus=useRef(!!recovered)
  const focused = useRef(false), original = useRef(recovered?.kind==='text'?Number(recovered.initial):value), commitTarget = useRef(onCommit)
  const draftEpoch=useRef(0),inFlight=useRef(false)
  const mounted=useRef(true),commitCurrent=useRef<DeviceCurrent>(captureCurrent())
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;draftEpoch.current++}},[])
  useEffect(() => {if (!focused.current && !retained) {setText(short(value)); original.current = value}}, [value, retained])
  useEffect(()=>{const copy=custody.receipt?.copy;if(!retained&&copy?.input.kind==='text'){inputCustody.current=custody;restoredFocus.current=true;inputBasis.current=copy.basis;initialText.current=copy.input.initial;original.current=Number(copy.input.initial);setText(copy.input.text);setRetained(true);setError(copy.refusal??custody.fault)}},[custody])
  const retainText=(raw:string,refusal?:string)=>inputCustody.current.retain({basis:inputBasis.current,target:material.target,input:{kind:'text',text:raw,initial:initialText.current},...(refusal?{refusal}: {})})
  const discard=()=>{try{inputCustody.current.clear(inputCustody.current.receipt);inputCustody.current=custody;draftEpoch.current++;setRetained(false);setText(short(value));original.current=value;initialText.current=short(value);inputBasis.current=material.basis;commitCurrent.current=captureCurrent();setError('')}catch(cause){setError(cause instanceof Error?cause.message:String(cause))}}
  const commit = () => {
    if(inFlight.current)return
    if(!mounted.current||!commitCurrent.current()){setError('Retained edit · The captured device presentation or revision changed');return}
    if (!text.trim() || !Number.isFinite(Number(text))) {setError('Enter a finite number'); return}
    const next = Number(text)
    if (next < binding.hardMin || next > binding.hardMax) {setError(`Range ${binding.hardMin}–${binding.hardMax}`); return}
    setError('')
    if (next !== original.current || retained) {
      let submitted:PrivateNativeInputReceipt;try{submitted=retainText(text)}catch(cause){setError(cause instanceof Error?cause.message:String(cause));return}
      const submittedEpoch=draftEpoch.current;inFlight.current=true
      setRetained(true)
      void commitTarget.current(next,submitted.copy.basis).then(reply => {
        if(!mounted.current||draftEpoch.current!==submittedEpoch||!commitCurrent.current(reply))return
        if(reply.ok)original.current=next
        if(reply.ok){try{inputCustody.current.clear(submitted);setRetained(false);setError('');setText(short(next))}catch(cause){setError('Retained edit · '+(cause instanceof Error?cause.message:String(cause)))}}else {try{retainText(text,reply.error)}catch{}setError('Retained edit · '+reply.error)}
      }).catch(cause=>{if(mounted.current&&draftEpoch.current===submittedEpoch&&commitCurrent.current())setError('Retained edit · '+(cause instanceof Error?cause.message:String(cause)))}).finally(()=>{inFlight.current=false})
    }
  }
  return <label className={`native-number ${automated ? 'is-automated' : ''}`}>
    <span>{label}{automated && <i title="Automation drives this target">A</i>}</span>
    <div><input aria-label={label} type="text" inputMode="decimal" value={text} disabled={disabled}
      onFocus={() => {focused.current = true;if(restoredFocus.current){commitCurrent.current=captureCurrent();commitTarget.current=onCommit;restoredFocus.current=false} if (!retained) {inputCustody.current=custody;original.current = value;initialText.current=short(value);inputBasis.current=material.basis; commitTarget.current = onCommit;commitCurrent.current=captureCurrent()}}}
      onChange={event => {draftEpoch.current++;setRetained(true); setText(event.target.value);try{retainText(event.target.value);setError('')}catch(cause){const message=cause instanceof Error?cause.message:String(cause);custody.aperture?.failure?.(nativeInputTargetKey(material),message);setError(message)}}}
      onBlur={() => {focused.current = false}}
      onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); commit()} else if (event.key === 'Escape') {event.preventDefault();discard(); event.currentTarget.blur()}}} />
      <small>{binding.unit ?? ''}</small></div>
    {retained && <small className="native-retained-error">{error || 'Unsubmitted value'}<button type="button" disabled={disabled} onClick={event => {event.preventDefault(); commit()}}>Apply</button><button type="button" onClick={event => {event.preventDefault();discard()}}>Discard</button></small>}
    {!retained && error && <small role="alert" className="native-retained-error">{error}</small>}
    {automated && observed !== undefined && <small className="native-effective">Effective {short(observed)}</small>}
  </label>
}

function FieldControl({reading, path, family, disabled, apply, captureCurrent}: {reading: NativeEditorReading; family:string; path: string; disabled: boolean; apply: Apply;captureCurrent:CaptureCurrent}) {
  const binding = fieldBinding(path)
  if (!binding) return null
  const id = 'field.' + binding.key
  const automated = reading.scene.automation.some(lane => lane.enabled && lane.target === id)
  return <NumberControl material={{basis:reading.basis,target:fieldInputTarget(id,family)}} captureCurrent={captureCurrent} label={binding.label} value={baseValue(reading.scene, binding.key)} binding={binding} disabled={disabled} automated={automated}
    observed={reading.observation?.effectiveValues?.[id]} onCommit={(value,basis) => apply([{kind: 'parameter', target: id, value}],basis)} />
}

/** The browser supplies the real SVG screen transform, including letterboxing
 * and host scaling. Rect-only conversion drifts when max-height constrains it. */
export function nativeDeviceSvgPoint(point: {clientX:number;clientY:number}, matrix: {a:number;b:number;c:number;d:number;e:number;f:number} | null) {
  if(!matrix)return null
  const determinant=matrix.a*matrix.d-matrix.b*matrix.c
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-12)return null
  const x=point.clientX-matrix.e,y=point.clientY-matrix.f
  const mapped={x:(matrix.d*x-matrix.c*y)/determinant,y:(matrix.a*y-matrix.b*x)/determinant}
  return Number.isFinite(mapped.x)&&Number.isFinite(mapped.y)?mapped:null
}
export interface ForceGesture {
  pointer:number;handle:'centre'|'radius';basis:NativeEditorBasis;entity_id:string;entity_ref:string|null;axis:'y'|'z';extent:number
  x:number;y:number;radius:number;initial:{x:number;y:number;radius:number};offset:{x:number;y:number;radius:number}
  bounds:{x:{hardMin:number;hardMax:number};y:{hardMin:number;hardMax:number};radius:{hardMin:number;hardMax:number}}
}
export function createNativeForceGesture(reading:NativeEditorReading,entity:Entity,handle:ForceGesture['handle'],pointer:number,point:{x:number;y:number}):ForceGesture {
  const axis=reading.scene.engine.mediumPlane==='horizontal'?'z':'y',bindings=entityTargets(reading.scene).filter(binding=>binding.entityId===entity.id)
  const binding=(key:string)=>{const found=bindings.find(row=>row.key===key);if(!found)throw Error('This force handle has no native parameter binding');return {hardMin:found.hardMin,hardMax:found.hardMax}}
  const extent=Math.max(1.5,Math.abs(entity.position.x)+entity.force.radius*1.4,Math.abs(entity.position[axis])+entity.force.radius*1.4)
  const x=(point.x-160)/140*extent,y=(106-point.y)/86*extent
  return {pointer,handle,basis:{...reading.basis},entity_id:entity.id,entity_ref:reading.entityOccurrences[entity.id]??null,axis,extent,
    x:entity.position.x,y:entity.position[axis],radius:entity.force.radius,initial:{x:entity.position.x,y:entity.position[axis],radius:entity.force.radius},
    offset:{x:entity.position.x-x,y:entity.position[axis]-y,radius:entity.force.radius-Math.hypot(x-entity.position.x,y-entity.position[axis])},
    bounds:{x:binding('x'),y:binding(axis),radius:binding('forces.radius')}}
}
export function moveNativeForceGesture(prior:ForceGesture,point:{x:number;y:number}):ForceGesture {
  const x=(point.x-160)/140*prior.extent,y=(106-point.y)/86*prior.extent
  return prior.handle==='centre'?{...prior,x:clamp(x+prior.offset.x,prior.bounds.x.hardMin,prior.bounds.x.hardMax),y:clamp(y+prior.offset.y,prior.bounds.y.hardMin,prior.bounds.y.hardMax)}
    :{...prior,radius:clamp(Math.hypot(x-prior.initial.x,y-prior.initial.y)+prior.offset.radius,prior.bounds.radius.hardMin,prior.bounds.radius.hardMax)}
}
export function nativeForceGestureChanges(edit:ForceGesture):NativeDeviceChange[] {
  if(edit.handle==='radius')return Math.abs(edit.radius-edit.initial.radius)<1e-9?[]:[{kind:'parameter',target:target(edit.entity_id,'forces.radius'),value:edit.radius}]
  return (['x','y'] as const).filter(key=>Math.abs(edit[key]-edit.initial[key])>=1e-9).map(key=>({kind:'parameter',target:target(edit.entity_id,key==='x'?'x':edit.axis),value:edit[key]}))
}
export function nativeForceInputMaterial(edit:ForceGesture):NativeInputMaterial {
  const {pointer,handle,basis,entity_id,entity_ref,axis,extent,x,y,radius,initial,offset,bounds}=edit
  return {basis,target:{scope:'entity',entity_id,entity_ref,step_id:null,parameter:null,family:'force',axis},
    input:{kind:'gesture',gesture:{pointer,handle,basis:{...basis},entity_id,entity_ref,axis,extent,x,y,radius,initial:{...initial},offset:{...offset},bounds:{x:{...bounds.x},y:{...bounds.y},radius:{...bounds.radius}}},changes:nativeForceGestureChanges(edit).map(change=>({...change}))}}
}
export interface FieldGesture {pointer:number;basis:NativeEditorBasis;value:number;initial:number;offset_x:number}
export function nativeFieldInputMaterial(edit:FieldGesture,parameter:string,family:string):NativeInputMaterial {
  const {pointer,basis,value,initial,offset_x}=edit
  return {basis,target:fieldInputTarget(parameter,family),input:{kind:'gesture',gesture:{pointer,basis:{...basis},value,initial,offset_x},changes:[{kind:'parameter',target:parameter,value}]}}
}
/** A restored own gesture must still be the full producer material, not an
 * arbitrary JSON object that happens to share a target lookup key. */
export function nativeDeviceGestureCopy(receipt:PrivateNativeInputReceipt,family:'force'|'field'):ForceGesture|FieldGesture {
  const copy=receipt.copy
  if(copy.input.kind!=='gesture')throw Error('The retained copy is not a native device gesture')
  const gesture=copy.input.gesture as unknown as ForceGesture&FieldGesture
  if(!sameEditorBasis(gesture.basis,copy.basis))throw Error('The retained gesture lost its original native basis')
  const material=family==='force'?nativeForceInputMaterial(gesture):nativeFieldInputMaterial(gesture,copy.target.parameter!,copy.target.family!)
  if(nativeInputTargetKey(material)!==nativeInputTargetKey(copy)||JSON.stringify(material.input)!==JSON.stringify(copy.input))throw Error('The retained device gesture is incomplete; its original copy remains in recovery')
  return gesture
}
export function sameNativeForceTarget(edit:ForceGesture,reading:NativeEditorReading,entity:Entity) {
  return edit.entity_id===entity.id&&edit.basis.expression_ref===reading.basis.expression_ref&&edit.basis.scene_ref===reading.basis.scene_ref
    &&edit.entity_ref===(reading.entityOccurrences[entity.id]??null)
}
function ForceSurface({reading, entity, disabled, apply, captureCurrent}: {reading: NativeEditorReading; entity: Entity; disabled: boolean; apply: Apply;captureCurrent:CaptureCurrent}) {
  const [gesture, setGesture] = useState<ForceGesture | null>(null)
  const [attempt, setAttempt] = useState<ForceGesture | null>(null)
  const svg = useRef<SVGSVGElement>(null), active = useRef<(ForceGesture & {current:DeviceCurrent}) | null>(null)
  const custody=useDeviceInputCustody({basis:reading.basis,target:forceInputTarget(reading,entity,null,attempt?.axis??(reading.scene.engine.mediumPlane==='horizontal'?'z':'y'))},'gesture')
  const [custodyError,setCustodyError]=useState(custody.fault)
  useEffect(()=>{if(!attempt&&custody.receipt?.copy.input.kind==='gesture'){try{setAttempt(nativeDeviceGestureCopy(custody.receipt,'force') as ForceGesture)}catch(cause){setCustodyError(cause instanceof Error?cause.message:String(cause))}}},[custody])
  const retainGesture=(edit:ForceGesture,refusal?:string)=>{try{const receipt=custody.retain({...nativeForceInputMaterial(edit),...(refusal?{refusal}: {})});setCustodyError('');return receipt}catch(cause){setCustodyError(cause instanceof Error?cause.message:String(cause));return null}}
  const clearGesture=(submitted:PrivateNativeInputReceipt|null)=>{try{custody.clear(submitted);return true}catch(cause){setCustodyError(cause instanceof Error?cause.message:String(cause));return false}}
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current=null}},[])
  const horizontal = reading.scene.engine.mediumPlane === 'horizontal'
  const axis = horizontal ? 'z' : 'y'
  const extent = Math.max(1.5, Math.abs(entity.position.x) + entity.force.radius * 1.4, Math.abs(entity.position[axis]) + entity.force.radius * 1.4)
  const project = (x: number, y: number) => ({x: 160 + x / extent * 140, y: 106 - y / extent * 86})
  const current = gesture ?? (attempt?.axis===axis?attempt:null) ?? {x: entity.position.x, y: entity.position[axis], radius: entity.force.radius}
  const center = project(current.x, current.y), radius = Math.max(.0125, current.radius) / extent * 140
  const coordinate = (event: PointerEvent<SVGSVGElement>) => {
    return nativeDeviceSvgPoint(event,svg.current?.getScreenCTM()??null)
  }
  const cancel = () => {const pointer=active.current?.pointer;active.current = null;setGesture(null);if(pointer!==undefined&&svg.current?.hasPointerCapture(pointer))svg.current.releasePointerCapture(pointer)}
  const retainAndCancel=()=>{const edit=active.current;if(edit&&nativeForceGestureChanges(edit).length){retainGesture(edit);if(mounted.current)setAttempt(edit)}cancel()}
  useEffect(() => {cancel()}, [entity.id, reading.basis.scene_ref])
  const finish = (event: PointerEvent<SVGSVGElement>) => {
    const edit = active.current
    if (!edit || edit.pointer !== event.pointerId) return
    cancel()
    if (svg.current?.hasPointerCapture(event.pointerId)) svg.current.releasePointerCapture(event.pointerId)
    const changes=nativeForceGestureChanges(edit)
    if(!changes.length)return
    if(mounted.current)setAttempt(edit)
    const submitted=retainGesture(edit)
    if(!submitted||!mounted.current||!edit.current())return
    void apply(changes, edit.basis).then(reply => {if(!mounted.current||!edit.current(reply))return;if(reply.ok){if(clearGesture(submitted))setAttempt(current=>current===edit?null:current)}else retainGesture(edit,reply.error)})
  }
  const keyboard = (event: KeyboardEvent<SVGElement>, handle: 'centre' | 'radius') => {
    if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const delta = (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1) * (event.shiftKey ? .05 : .0125)
    const current=captureCurrent();if(!current())return
    const initial=createNativeForceGesture(reading,entity,handle,-1,handle==='radius'?{x:center.x+radius,y:center.y}:center)
    const edit=handle==='radius'?{...initial,radius:clamp(entity.force.radius+delta,initial.bounds.radius.hardMin,initial.bounds.radius.hardMax)}
      :event.key==='ArrowLeft'||event.key==='ArrowRight'?{...initial,x:clamp(entity.position.x+delta,initial.bounds.x.hardMin,initial.bounds.x.hardMax)}:{...initial,y:clamp(entity.position[axis]+delta,initial.bounds.y.hardMin,initial.bounds.y.hardMax)}
    const receipt=retainGesture(edit);setAttempt(edit);if(!receipt)return
    void apply(nativeForceGestureChanges(edit),edit.basis).then(reply=>{if(!mounted.current||!current(reply))return;if(reply.ok){if(clearGesture(receipt))setAttempt(value=>value===edit?null:value)}else retainGesture(edit,reply.error)})
  }
  return <div className="native-force-surface">
    <svg ref={svg} viewBox="0 0 320 212" aria-label={`${entity.name} force centre and falloff radius`} tabIndex={0}
      onPointerDown={event => {
        if (disabled || event.button !== 0 || active.current || !captureCurrent()()) return
        const handle = (event.target as SVGElement).dataset.handle
        if (handle !== 'centre' && handle !== 'radius') return
        const point=coordinate(event);if(!point)return
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId)
        const next={...createNativeForceGesture(reading,entity,handle,event.pointerId,point),current:captureCurrent()}
        active.current = next; setGesture(next)
      }}
      onPointerMove={event => {const prior = active.current; if (!prior || prior.pointer !== event.pointerId) return;if(!prior.current()){if(nativeForceGestureChanges(prior).length){retainGesture(prior);setAttempt(prior)}cancel();return} const point = coordinate(event);if(!point)return
        const next=moveNativeForceGesture(prior,point)
        active.current = {...next,current:prior.current}; setGesture(next);if(nativeForceGestureChanges(next).length||custody.receipt)retainGesture(next)
      }} onPointerUp={finish} onPointerCancel={event=>{if(active.current?.pointer===event.pointerId)retainAndCancel()}} onLostPointerCapture={event=>{if(active.current?.pointer===event.pointerId)retainAndCancel()}}
      onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); cancel()}}}>
      <defs><pattern id={`force-grid-${entity.id}`} width="32" height="26.5" patternUnits="userSpaceOnUse"><path d="M32 0H0V26.5" className="native-grid-line" /></pattern></defs>
      <rect width="320" height="212" fill={`url(#force-grid-${entity.id})`} />
      <path d="M20 106H300M160 20V192" className="native-axis" />
      {reading.scene.entities.filter(item => item.id !== entity.id).map(item => {const point = project(item.position.x, item.position[axis]); return <g key={item.id}><circle cx={point.x} cy={point.y} r={item.kind === 'pin' ? 3 : 2} className="native-other-centre" /><title>{item.name}</title></g>})}
      {[.5, 1, 1.5, 2].map(ring => <ellipse key={ring} cx={center.x} cy={center.y} rx={radius * ring} ry={radius * ring * 86 / 140} className={`native-force-ring ring-${ring}`} />)}
      <line x1={center.x} y1={center.y} x2={center.x + radius} y2={center.y} className="native-radius-line" />
      <circle cx={center.x} cy={center.y} r="8" className="native-centre-handle" data-handle="centre" tabIndex={disabled ? -1 : 0} role="button" aria-label="Move force centre with arrow keys" onKeyDown={event => keyboard(event, 'centre')} />
      <circle cx={center.x + radius} cy={center.y} r="6" className="native-radius-handle" data-handle="radius" tabIndex={disabled ? -1 : 0} role="slider" aria-label="Force falloff radius" aria-valuemin={.0125} aria-valuemax={50} aria-valuenow={current.radius} onKeyDown={event => keyboard(event, 'radius')} />
      <text x="10" y="15" className="native-graph-label">{horizontal ? 'XZ' : 'XY'} · stage units</text>
      <text x="10" y="202" className="native-graph-label">{short(current.x)}, {short(current.y)} · R {short(current.radius)}</text>
    </svg>
    {custodyError&&<p role="alert">{custodyError}</p>}
    <span className="native-gesture-caption">Centre and Gaussian radius configuration · drag handles or use arrows</span>
    {attempt && <div className="native-retained-gesture">Unacknowledged {attempt.axis==='z'?'XZ':'XY'} gesture retained<button onClick={() => {if(!sameNativeForceTarget(attempt,reading,entity))return;const current=captureCurrent();if(!current())return;const submitted=attempt,receipt=retainGesture(submitted);if(!receipt)return;void apply(nativeForceGestureChanges(submitted),reading.basis).then(reply => {if(!mounted.current||!current(reply))return;if(reply.ok){if(clearGesture(receipt))setAttempt(current=>current===submitted?null:current)}else retainGesture(submitted,reply.error)})}} disabled={disabled||!sameNativeForceTarget(attempt,reading,entity)}>Retry on current revision</button><button onClick={() => {if(clearGesture(custody.receipt))setAttempt(null)}}>Discard</button></div>}
  </div>
}

function ForceResponse({entity}: {entity: Entity}) {
  const points = Array.from({length: 65}, (_, index) => {const r = index / 64 * 3; return `${20 + index / 64 * 280},${90 - Math.exp(-r * r / 2) * 64}`}).join(' ')
  return <svg viewBox="0 0 320 116" className="native-response" aria-label="Native Gaussian falloff response">
    <path d="M20 20V90H300" className="native-axis" /><polyline points={points} className="native-response-line" />
    {[0, 1, 2, 3].map(value => <text key={value} x={20 + value / 3 * 280} y="106" className="native-graph-label">{value === 0 ? '0' : `${value}R`}</text>)}
    <text x="29" y="18" className="native-graph-label">Gaussian influence · native R {short(Math.max(.0125, entity.force.radius))}</text>
  </svg>
}

function ForceEditor({reading, entity, disabled, apply, captureCurrent}: {reading: NativeEditorReading; entity: Entity; disabled: boolean; apply: Apply;captureCurrent:CaptureCurrent}) {
  const bindings = entityTargets(reading.scene).filter(binding => binding.entityId === entity.id)
  const parameterControl = (suffix: string, label: string) => {
    const binding = bindings.find(item => item.key === suffix)
    if (!binding) return null
    return <NumberControl material={{basis:reading.basis,target:forceInputTarget(reading,entity,binding.target)}} captureCurrent={captureCurrent} key={suffix} label={label} value={binding.value} binding={binding} disabled={disabled || entity.locked}
      automated={reading.scene.automation.some(lane => lane.enabled && lane.target === binding.target)} observed={reading.observation?.effectiveValues?.[binding.target]}
      onCommit={(value,basis) => apply([{kind: 'parameter', target: binding.target, value}],basis)} />
  }
  return <article className="native-device native-force-device">
    <header><span className={`native-device-light ${entity.enabled===false||entity.force.kind === 'none' && Math.abs(entity.force.spin) < 1e-9 ? 'is-off' : ''}`} title={entity.enabled===false?'Native entity disabled':entity.force.kind==='none'&&Math.abs(entity.force.spin)<1e-9?'Force and spin off':'Force contribution configured'} /><strong>Force</strong><span>{entity.kind === 'pin' ? 'Independent emitter' : 'Formation contribution'}</span></header>
    <div className="native-device-heading"><b>{entity.name}</b><code title={entity.id}>{reading.entityOccurrences[entity.id]??'Unbound draft'}</code>{entity.locked && <span>Locked</span>}</div>
    <div className="native-force-layout"><ForceSurface captureCurrent={captureCurrent} reading={reading} entity={entity} disabled={disabled || entity.locked} apply={apply} /><div className="native-force-controls">
      <div className="native-mode-buttons" aria-label="Force mode">{(['none', 'attract', 'repel', 'vortex'] as const).map(mode => <button key={mode} aria-pressed={entity.force.kind === mode} disabled={disabled || entity.locked} onClick={() => apply([{kind: 'force-mode', entity_id: entity.id, value: mode}])}>{mode}</button>)}</div>
      <div className="native-control-grid">{parameterControl('forces.strength', 'Signed strength')}{parameterControl('forces.spin', 'Spin')}{parameterControl('forces.radius', 'Radius')}{parameterControl('x', 'Centre X')}{parameterControl('y', 'Centre Y')}{parameterControl('z', 'Centre Z')}</div>
      <ForceResponse entity={entity} />
    </div></div>
    <footer>Summed into the shared particle medium · {reading.scene.engine.mediumPlane === 'horizontal' ? 'XZ' : 'XY'} physical plane · Spin remains active in None mode</footer>
  </article>
}

const FIELD_FAMILIES = {
  flow: {name: 'Flow', paths: ['fluid.returnSpeed', 'fluid.viscosity', 'fluid.vortexStrength', 'fluid.curlScale', 'fluid.curlSpeed', 'fluid.turbulence', 'fluid.dispersion', 'fluid.quadraticDrag', 'fluid.maxSpeed']},
  medium: {name: 'Shared Medium', paths: ['medium.pressure', 'medium.coupling', 'medium.persistence', 'medium.iterations', 'medium.gridRes', 'medium.splatGain', 'medium.extent']},
  resonance: {name: 'Resonator', paths: ['cymatics.frequencyHz', 'cymatics.dampingQFactor', 'cymatics.driveStrength', 'cymatics.dominance', 'cymatics.modeCount']},
  collision: {name: 'Collision', paths: ['collision.restitution', 'collision.friction', 'collision.band', 'collision.strength', 'collision.integrity', 'pairwise.radius', 'pairwise.stiffness', 'pairwise.restitution', 'pairwise.viscosity']},
} as const
type FieldFamily = keyof typeof FIELD_FAMILIES
function nativeValue(scene: Scene, path: string) {const binding = fieldBinding(path); return binding ? baseValue(scene, binding.key) : undefined}

/** Source-bound diagrams: handles change admitted native parameters. The
 * visuals describe configuration; physical output comes from the Stage. */
function FieldSurface({reading, family, disabled, apply, captureCurrent}: {reading: NativeEditorReading; family: FieldFamily; disabled: boolean; apply: Apply;captureCurrent:CaptureCurrent}) {
  const svg = useRef<SVGSVGElement>(null)
  const [draft, setDraft] = useState<number | null>(null)
  const [attempt, setAttempt] = useState<FieldGesture | null>(null)
  const active = useRef<(FieldGesture&{current:DeviceCurrent}) | null>(null)
  const mounted=useRef(true)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current=null}},[])
  const controlPath = family === 'medium' ? 'medium.coupling' : family === 'flow' ? 'fluid.vortexStrength' : family === 'resonance' ? 'cymatics.frequencyHz' : 'pairwise.restitution'
  const binding = fieldBinding(controlPath), value = binding ? baseValue(reading.scene, binding.key) : 0
  const custody=useDeviceInputCustody({basis:reading.basis,target:fieldInputTarget('field.'+(binding?.key??controlPath),family)},'gesture')
  const [custodyError,setCustodyError]=useState(custody.fault)
  useEffect(()=>{if(!attempt&&custody.receipt?.copy.input.kind==='gesture'){try{setAttempt(nativeDeviceGestureCopy(custody.receipt,'field') as FieldGesture)}catch(cause){setCustodyError(cause instanceof Error?cause.message:String(cause))}}},[custody])
  const retainGesture=(edit:FieldGesture,refusal?:string)=>{if(!binding)return null;try{const receipt=custody.retain({...nativeFieldInputMaterial(edit,'field.'+binding.key,family),...(refusal?{refusal}: {})});setCustodyError('');return receipt}catch(cause){setCustodyError(cause instanceof Error?cause.message:String(cause));return null}}
  const clearGesture=(submitted:PrivateNativeInputReceipt|null)=>{try{custody.clear(submitted);return true}catch(cause){setCustodyError(cause instanceof Error?cause.message:String(cause));return false}}
  const graphValue = draft ?? attempt?.value ?? value
  const position = binding ? (clamp(graphValue, binding.min, binding.max) - binding.min) / (binding.max - binding.min) : 0
  const cancel=()=>{const pointer=active.current?.pointer;active.current=null;setDraft(null);if(pointer!==undefined&&svg.current?.hasPointerCapture(pointer))svg.current.releasePointerCapture(pointer)}
  const retainAndCancel=()=>{const edit=active.current;if(edit&&edit.value!==edit.initial){retainGesture(edit);if(mounted.current)setAttempt({...edit})}cancel()}
  const finish = (event:PointerEvent<SVGSVGElement>) => {const gesture=active.current;if(!gesture||gesture.pointer!==event.pointerId)return;cancel();if(binding&&gesture.value!==gesture.initial){const submitted={...gesture};if(mounted.current)setAttempt(submitted);const receipt=retainGesture(submitted);if(!receipt||!mounted.current||!gesture.current())return;void apply([{kind:'parameter',target:'field.'+binding.key,value:submitted.value}],gesture.basis).then(reply=>{if(!mounted.current||!gesture.current(reply))return;if(reply.ok){if(clearGesture(receipt))setAttempt(current=>current===submitted?null:current)}else retainGesture(submitted,reply.error)})}}
  return <div className="native-field-surface"><svg ref={svg} viewBox="0 0 360 160" aria-label={`${FIELD_FAMILIES[family].name} native configuration`} tabIndex={0}
    onPointerDown={event => {if (disabled || active.current || !binding || event.button !== 0 || !(event.target as SVGElement).dataset.fieldHandle || !captureCurrent()()) return;const point=nativeDeviceSvgPoint(event,svg.current?.getScreenCTM()??null);if(!point)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);active.current={pointer:event.pointerId,basis:{...reading.basis},value,initial:value,offset_x:35+position*290-point.x,current:captureCurrent()};setDraft(value)}}
    onPointerMove={event => {const gesture=active.current;if(!gesture||gesture.pointer!==event.pointerId||!binding)return;if(!gesture.current()){if(gesture.value!==gesture.initial){retainGesture(gesture);setAttempt({...gesture})}cancel();return}const point=nativeDeviceSvgPoint(event,svg.current?.getScreenCTM()??null);if(!point)return;const next=binding.min+clamp((point.x+gesture.offset_x-35)/290,0,1)*(binding.max-binding.min);gesture.value=clamp(Math.round(next/binding.step)*binding.step,binding.hardMin,binding.hardMax);setDraft(gesture.value);if(gesture.value!==gesture.initial||custody.receipt)retainGesture(gesture)}}
    onPointerUp={finish} onPointerCancel={event=>{if(active.current?.pointer===event.pointerId)retainAndCancel()}} onLostPointerCapture={event=>{if(active.current?.pointer===event.pointerId)retainAndCancel()}} onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault();cancel()}}}>
    {family === 'medium' ? <>
      <rect x="48" y="17" width="264" height="99" rx="2" className="native-medium-boundary" />
      {Array.from({length: 11}, (_, index) => <path key={index} d={`M${48 + index * 26.4} 17V116`} className="native-grid-line" />)}
      {Array.from({length: 5}, (_, index) => <path key={index} d={`M48 ${17 + index * 24.75}H312`} className="native-grid-line" />)}
      <path d={`M70 67H${70 + graphValue * 30}M290 67H${290 - graphValue * 30}`} className="native-response-line" />
      <text x="141" y="70" className="native-graph-label">Coupling</text>
      <text x="56" y="31" className="native-graph-label">{short(nativeValue(reading.scene, 'medium.gridRes') ?? 0)}² grid · extent {short(nativeValue(reading.scene, 'medium.extent') ?? 0)} px</text>
      <text x="56" y="108" className="native-graph-label">Pressure {short(nativeValue(reading.scene, 'medium.pressure') ?? 0)} · shared field</text>
    </> : family === 'flow' ? <>
      {Array.from({length: 35}, (_, index) => {const x = 42 + index % 7 * 45, y = 22 + Math.floor(index / 7) * 22, dx = x - 180, dy = y - 66, factor = graphValue / 25
        return <path key={index} d={`M${x} ${y}l${-dy * factor * .16} ${dx * factor * .1}`} className="native-force-vector" />})}
      <text x="20" y="117" className="native-graph-label">Vortex configuration · return {short(nativeValue(reading.scene, 'fluid.returnSpeed') ?? 0)}</text>
    </> : family === 'resonance' ? <>
      <rect x="25" y="36" width="310" height="70" className="native-medium-boundary" />
      <path d={`M${25 + position * 310} 35V107`} className="native-response-line" />
      <text x="34" y="60" className="native-graph-label">Continuous modal body</text>
      <text x="34" y="81" className="native-graph-label">{short(nativeValue(reading.scene, 'cymatics.modeCount') ?? 0)} requested modes · excitation {short(nativeValue(reading.scene, 'cymatics.driveStrength') ?? 0)}</text>
      <text x="25" y="22" className="native-graph-label">Drive {short(graphValue)} Hz · configured Q {short(nativeValue(reading.scene, 'cymatics.dampingQFactor') ?? 0)}</text>
    </> : <>
      <path d="M30 80H330M180 25V111" className="native-axis" /><circle cx="130" cy="64" r="18" className="native-medium-boundary" /><circle cx="230" cy="64" r="18" className="native-medium-boundary" />
      <path d={`M148 64H${148 + graphValue * 64}M212 64H${212 - graphValue * 64}`} className="native-response-line" />
      <text x="30" y="111" className="native-graph-label">Pairwise restitution · configured contact response</text>
    </>}
    <path d="M35 140H325" className="native-axis" />
    {binding && <circle cx={35 + position * 290} cy="140" r="7" className="native-radius-handle" data-field-handle="true" tabIndex={disabled ? -1 : 0} role="slider" aria-label={binding.label} aria-valuemin={binding.hardMin} aria-valuemax={binding.hardMax} aria-valuenow={graphValue}
      onKeyDown={event => {if (disabled || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault();const current=captureCurrent();if(!current())return;const edit:FieldGesture={pointer:-1,basis:{...reading.basis},initial:value,offset_x:0,value:clamp(value+(event.key==='ArrowLeft'?-1:1)*binding.step*(event.shiftKey?10:1),binding.hardMin,binding.hardMax)},receipt=retainGesture(edit);setAttempt(edit);if(!receipt)return;void apply([{kind:'parameter',target:'field.'+binding.key,value:edit.value}],edit.basis).then(reply=>{if(!mounted.current||!current(reply))return;if(reply.ok){if(clearGesture(receipt))setAttempt(value=>value===edit?null:value)}else retainGesture(edit,reply.error)})}} />}
  </svg>{custodyError&&<p role="alert">{custodyError}</p>}<span className="native-gesture-caption">{binding?.label} · {short(graphValue)} {binding?.unit} · configuration diagram</span>{attempt !== null && binding && <div className="native-retained-gesture">Unacknowledged gesture retained<button disabled={disabled} onClick={() => {const current=captureCurrent();if(!current())return;const submitted=attempt,receipt=retainGesture(submitted);if(!receipt)return;void apply([{kind: 'parameter', target: 'field.' + binding.key, value: submitted.value}], reading.basis).then(reply => {if(!mounted.current||!current(reply))return;if(reply.ok){if(clearGesture(receipt))setAttempt(value=>value===submitted?null:value)}else retainGesture(submitted,reply.error)})}}>Retry on current revision</button><button onClick={() => {if(clearGesture(custody.receipt))setAttempt(null)}}>Discard</button></div>}</div>
}

export function NativeDeviceEditors({reading, request, onSelectEntity, isPresented}: NativeDeviceEditorsProps) {
  const [selected, setSelected] = useState<string | null>(null), [family, setFamily] = useState<FieldFamily>('flow')
  const [scope, setScope] = useState<'entity' | 'field'>(reading?.selection.entity_ids.length ? 'entity' : 'field'), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const region=useRef<HTMLElement>(null),lifetime=useRef(0)
  const cutLifetime=useRef<{cut:string;live:boolean}|null>(null)
  const presentation=useRef({reading,scope,family,selected,isPresented})
  presentation.current={reading,scope,family,selected,isPresented}
  const pending = useRef(false)
  useEffect(() => {alive.current = true;lifetime.current++;if(cutLifetime.current)cutLifetime.current.live=true; return () => {alive.current = false;lifetime.current++;if(cutLifetime.current)cutLifetime.current.live=false}}, [])
  const readPresentation=():NativeDevicePresentation=>{const now=presentation.current,id=now.selected??now.reading?.selection.entity_ids[0]??null;
    return {epoch:lifetime.current,reading:now.reading,entity_id:id,entity_ref:id?now.reading?.entityOccurrences[id]??null:null,cut:JSON.stringify([now.reading?.basis.expression_ref,now.reading?.basis.scene_ref,now.scope,now.family,id,id?now.reading?.entityOccurrences[id]:null,now.reading?.selection.entity_ids]),
      presented:alive.current&&!!region.current?.getClientRects().length&&(now.isPresented?.()??true)}}
  const renderPresentation=readPresentation()
  if(!cutLifetime.current||cutLifetime.current.cut!==renderPresentation.cut||!cutLifetime.current.live){
    if(cutLifetime.current)cutLifetime.current.live=false
    cutLifetime.current={cut:renderPresentation.cut,live:true}
  }
  const renderLifetime=cutLifetime.current
  // Hidden residences stay mounted. Retire this cut after the real DOM commit,
  // so revealing it later cannot revive an old focus or pointer callback.
  useEffect(()=>{if(!readPresentation().presented)renderLifetime.live=false})
  const captureCurrent:CaptureCurrent=()=>{const captured={...renderPresentation,epoch:lifetime.current};return reply=>renderLifetime.live&&currentNativeDeviceReply(captured,readPresentation(),reply)}
  useEffect(() => {
    const selected = reading?.selection.entity_ids[0] ?? null
    setSelected(selected); setScope(selected === null ? 'field' : 'entity')
  }, [reading?.basis.scene_ref, reading?.selection.entity_ids.join('|')])
  const invoke = async (operation: NativeEditorRequest): Promise<NativeEditorReply> => {
    const current=captureCurrent(),now=presentation.current.reading
    if(!current()||operation.operation!=='read'&&(!now||!sameEditorBasis(operation.basis,now.basis)))return {ok:false,error:'The captured device presentation or revision changed; the draft is retained.'}
    if (pending.current) return {ok: false, error: 'Wait for the current native acknowledgement.'}
    pending.current = true
    setBusy(true); setError(null)
    try {const reply = await request(operation); if (current(reply)) setError(reply.ok?null:reply.error); return reply}
    catch (cause) {const message = cause instanceof Error ? cause.message : String(cause); if (current()) setError(message); return {ok: false, error: message}}
    finally {pending.current = false; if (alive.current) setBusy(false)}
  }
  const apply: Apply = (changes, basis) => reading ? invoke({operation: 'apply', basis: basis ?? reading.basis, changes}) : Promise.resolve({ok: false, error: 'Read the native work before editing it.'})
  const currentEntityId = selected ?? reading?.selection.entity_ids[0]
  const entity = reading?.scene.entities.find(item => item.id === currentEntityId)
  if (!reading) return <section ref={region} className="native-devices-empty"><p>Open a native Expression to edit its devices.</p><button onClick={() => void invoke({operation: 'read'})} disabled={busy}>Read current work</button>{error && <p role="alert">{error}</p>}</section>
  const disabled = busy || reading.standing.pending
  const fieldEnabled = family === 'medium' ? reading.scene.engine.mediumEnabled === true
    : family === 'resonance' ? reading.scene.engine.resonanceEnabled === true
      : family === 'collision' ? reading.scene.engine.collisionEnabled === true || reading.scene.engine.pairwiseEnabled === true : undefined
  return <section ref={region} className="native-device-editors" aria-label="Native visual device editors" aria-busy={busy}>
    <div className="native-devices-toolbar"><div className="native-mode-buttons"><button aria-pressed={scope === 'entity'} onClick={() => setScope('entity')}>Entity</button><button aria-pressed={scope === 'field'} onClick={() => setScope('field')}>Field</button></div>
      {scope === 'entity' ? <select aria-label="Device target entity" value={entity?.id ?? ''} disabled={disabled} onChange={event => {if(!captureCurrent()())return;setSelected(event.target.value); onSelectEntity?.(event.target.value)}}><option value="">Choose an object</option>{reading.scene.entities.map(item => <option key={item.id} value={item.id}>{item.name} · {item.kind === 'pin' ? 'Force' : 'Formation'}</option>)}</select>
        : <div className="native-mode-buttons">{(Object.keys(FIELD_FAMILIES) as FieldFamily[]).map(key => <button key={key} aria-pressed={family === key} onClick={() => setFamily(key)}>{FIELD_FAMILIES[key].name}</button>)}</div>}
      <button disabled={disabled || reading.scene.entities.length >= 32} onClick={() => apply([{kind: 'force-insert', position: {x: 0, y: 0, z: 0}}])}>+ Force</button>
      <span className="native-history-controls"><button disabled={disabled || !reading.history.canUndo} onClick={() => void invoke({operation: 'undo', basis: reading.basis})} title="Undo authored edit">↶</button><button disabled={disabled || !reading.history.canRedo} onClick={() => void invoke({operation: 'redo', basis: reading.basis})} title="Redo authored edit">↷</button><button disabled={disabled} onClick={() => void invoke({operation: 'save', basis: reading.basis})}>Save</button></span>
    </div>
    {error && <div className="native-editor-error" role="alert">{error}<button onClick={() => void invoke({operation: 'read'})} disabled={busy}>Read current revision</button></div>}
    {scope === 'entity' ? entity ? <ForceEditor captureCurrent={captureCurrent} key={reading.basis.expression_ref + ':' + reading.basis.scene_ref + ':' + entity.id + ':' + reading.entityOccurrences[entity.id]} reading={reading} entity={entity} disabled={disabled} apply={apply} /> : <div className="native-devices-empty">{reading.scene.entities.length ? 'Choose an object to configure its Force.' : 'This Scene has no object. Insert a Force to create an independent emitter.'}</div>
      : <article className="native-device native-field-device"><header><span className={`native-device-light${fieldEnabled === undefined ? ' is-unknown' : fieldEnabled ? '' : ' is-off'}`} title={fieldEnabled === undefined ? 'No separate enable operation disclosed for Flow' : fieldEnabled ? 'Native field family enabled' : 'Native field family disabled'} /><strong>{FIELD_FAMILIES[family].name}</strong><span>Field · one shared native binding</span></header>
        {family === 'resonance' && <div className="native-medium-switches"><label><input type="checkbox" checked={reading.scene.engine.resonanceEnabled} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'resonanceEnabled', value: event.target.checked}])} />Continuous resonance enabled</label></div>}
        {family === 'collision' && <div className="native-medium-switches"><label><input type="checkbox" checked={reading.scene.engine.collisionEnabled === true} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'collisionEnabled', value: event.target.checked}])} />Glyph boundary</label><select aria-label="Collision mode" value={reading.scene.engine.collisionMode ?? 'obstacle'} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'collisionMode', value: event.target.value as 'obstacle' | 'vessel'}])}><option value="obstacle">Obstacle</option><option value="vessel">Vessel</option></select><label><input type="checkbox" checked={reading.scene.engine.pairwiseEnabled === true} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'pairwiseEnabled', value: event.target.checked}])} />Particle pairs</label></div>}
        {family === 'medium' && <div className="native-medium-switches"><label><input type="checkbox" checked={reading.scene.engine.mediumEnabled === true} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'mediumEnabled', value: event.target.checked}])} />Enabled</label><select aria-label="Medium dimensions" value={reading.scene.engine.mediumDimension ?? '2D'} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'mediumDimension', value: event.target.value as '2D' | '3D'}])}><option>2D</option><option>3D</option></select><select aria-label="Physical medium plane" value={reading.scene.engine.mediumPlane} disabled={disabled} onChange={event => apply([{kind: 'field-setting', key: 'mediumPlane', value: event.target.value as 'vertical' | 'horizontal'}])}><option value="vertical">XY · vertical</option><option value="horizontal">XZ · horizontal</option></select></div>}
        <div className="native-field-layout"><FieldSurface captureCurrent={captureCurrent} key={reading.basis.expression_ref + ':' + reading.basis.scene_ref + ':' + family} reading={reading} family={family} disabled={disabled} apply={apply} /><div className="native-control-grid">{FIELD_FAMILIES[family].paths.map(path => <FieldControl family={family} captureCurrent={captureCurrent} key={reading.basis.expression_ref + ':' + reading.basis.scene_ref + ':' + path} reading={reading} path={path} disabled={disabled} apply={apply} />)}</div></div>
        <footer>Configuration controls the current native Scene’s shared solver. Observe the resulting body on the Stage.</footer>
      </article>}
    <div className="native-editor-standing"><span>{reading.scene.name} · native r{reading.basis.revision} · authored r{reading.basis.authored_revision}</span><span>{busy ? 'Committing through owner…' : reading.standing.pending ? 'Native acknowledgement pending' : reading.standing.dirty ? 'Retained draft' : 'Native readback current'}{reading.observation?.fieldPaused ? ' · physics held' : ''}</span></div>
  </section>
}
