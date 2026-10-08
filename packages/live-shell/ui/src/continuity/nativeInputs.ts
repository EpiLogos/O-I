import {
  validateNativeInputScope, sameNativeInputOwner, qualifyPrivateNativeInput,
  readPrivateNativeInputs, retainPrivateNativeInput, clearPrivateNativeInput,
  type NativeInputScope, type NativeInputBasis, type NativeInputTarget, type NativeInputValue,
  type PrivateNativeInputReceipt, type PrivateNativeInputInventory,
} from '../../../../../desktop/cradle/src/workspace/drafts'

export type {NativeInputScope, NativeInputBasis, NativeInputTarget, NativeInputValue, PrivateNativeInputReceipt, PrivateNativeInputInventory}
export interface NativeInputMaterial {basis:NativeInputBasis;target:NativeInputTarget;input:NativeInputValue;refusal?:string}
/** Stable presentation key only. Revisions remain pinned in each retained copy. */
export function nativeInputTargetKey(material:Pick<NativeInputMaterial,'basis'|'target'>):string {
  const {basis,target}=material
  return JSON.stringify([basis.expression_ref,basis.scene_ref,target.scope,target.entity_id,target.entity_ref,target.step_id,target.parameter,target.family,target.axis])
}

/** Projection over the original local draft owner. No native adoption,
 * rebasing, dispatch or alternate persistence lives in this adapter. */
export class NativeInputContinuity {
  readonly writerId:string
  private readonly configured:NativeInputScope
  private live=true
  private readonly acknowledged=new Map<string,PrivateNativeInputReceipt>()

  constructor(scope:NativeInputScope,writerId:string=crypto.randomUUID()) {
    this.configured=validateNativeInputScope(scope)
    if(!/^[a-zA-Z0-9_.-]{1,128}$/.test(writerId))throw Error('Choose a distinct private input writer identity')
    this.writerId=writerId
  }
  get scope():NativeInputScope {return {...this.configured}}
  private current(predicate:()=>boolean):void {
    if(!this.live||typeof predicate!=='function'||!predicate())throw Error('The private input aperture retired; all original copies were retained')
  }
  read():PrivateNativeInputInventory {
    if(!this.live)throw Error('The private input aperture retired; its durable copies remain')
    return readPrivateNativeInputs(this.configured)
  }
  retain(material:NativeInputMaterial,current:()=>boolean,previous?:PrivateNativeInputReceipt):PrivateNativeInputReceipt {
    this.current(current)
    const old=previous?qualifyPrivateNativeInput(previous):null
    if(old&&(old.writer_id!==this.writerId||!sameNativeInputOwner(old.writer_scope,this.configured)||old.writer_scope.accessEpoch!==this.configured.accessEpoch))throw Error('Fork a recovered copy into this aperture before editing; its original was retained')
    this.current(current)
    const receipt=retainPrivateNativeInput({schema:'oi.cradle.private-native-input/v1',writer_id:this.writerId,
      copy_id:old?.copy_id??crypto.randomUUID(),scope:old?.scope??this.configured,writer_scope:old?.writer_scope??this.configured,
      basis:material.basis,target:material.target,input:material.input,...(material.refusal===undefined?{}:{refusal:material.refusal})},previous)
    this.acknowledged.set(receipt.ref,receipt)
    return receipt
  }
  /** Recovery retains its original scope/basis and creates only a private copy. */
  fork(receipt:PrivateNativeInputReceipt,current:()=>boolean):PrivateNativeInputReceipt {
    this.current(current)
    const original=qualifyPrivateNativeInput(receipt)
    if(!sameNativeInputOwner(original.scope,this.configured))throw Error('The recovered input belongs to another native owner/workspace/surface')
    this.current(current)
    const fork=retainPrivateNativeInput({...original,writer_id:this.writerId,copy_id:crypto.randomUUID(),writer_scope:this.configured})
    this.acknowledged.set(fork.ref,fork)
    return fork
  }
  /** Caller supplies actual qualified ACK/current intent or deliberate Discard. */
  clear(receipt:PrivateNativeInputReceipt,current:()=>boolean):boolean {
    this.current(current)
    const copy=qualifyPrivateNativeInput(receipt)
    if(!sameNativeInputOwner(copy.writer_scope,this.configured)||copy.writer_scope.accessEpoch!==this.configured.accessEpoch)return false
    const cleared=clearPrivateNativeInput(receipt,this.writerId,()=>this.live&&current())
    if(cleared)this.acknowledged.delete(receipt.ref)
    return cleared
  }
  /** Parent registers this with the existing document checkpoint lifecycle. */
  checkpoint(current:()=>boolean):void {
    this.current(current)
    for(const receipt of this.acknowledged.values()){this.current(current);qualifyPrivateNativeInput(receipt)}
    this.current(current)
  }
  retire():void {this.live=false;this.acknowledged.clear()}
}
export function createNativeInputContinuity(scope:NativeInputScope,writerId?:string):NativeInputContinuity {
  return new NativeInputContinuity(scope,writerId)
}
