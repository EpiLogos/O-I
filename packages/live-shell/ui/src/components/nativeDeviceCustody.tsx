import {useRef} from 'react'
import {sameEditorBasis, type NativeEditorChange, type NativeEditorBasis, type NativeEditorReply} from '../../../../expressions-boundary/src/editor'
import {useNativeInputRetention, type NativeInputAperture} from '../continuity/nativeInputContext'
import {nativeInputTargetKey, type NativeInputMaterial, type NativeInputTarget, type PrivateNativeInputReceipt} from '../continuity/nativeInputs'

/** Shared device input custody: one private-draft projection used by Field, Force and handle surfaces. */
/** The editor's one apply path accepts every admitted editor change (device, glyph, rack, chosen-control). */
export type Apply = (changes: readonly NativeEditorChange[], basis?: NativeEditorBasis) => Promise<NativeEditorReply>
export type DeviceCurrent = (reply?: NativeEditorReply) => boolean
export type CaptureCurrent = () => DeviceCurrent

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
export function useDeviceInputCustody(material:Pick<NativeInputMaterial,'basis'|'target'>,kind:'text'|'gesture') {
  const aperture=useNativeInputRetention(),held=useRef<{aperture:NativeInputAperture|null;key:string;custody:NativeDeviceInputCustody}|null>(null)
  const key=nativeInputTargetKey(material)
  if(!held.current||held.current.aperture?.owner!==aperture?.owner||held.current.key!==key)held.current={aperture,key,custody:new NativeDeviceInputCustody(aperture,material,kind)}
  return held.current.custody
}
export const fieldInputTarget=(parameter:string,family:string):NativeInputTarget=>({scope:'field',entity_id:null,entity_ref:null,step_id:null,parameter,family,axis:null})

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
