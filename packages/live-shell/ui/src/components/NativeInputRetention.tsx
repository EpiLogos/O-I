import {useEffect,useRef,useState,type ReactNode} from 'react'
import {useContinuity,type Workspace} from '../continuity'
import {useWorkspace} from '../shell/workspace'
import {groupsOf} from '../../../../../desktop/cradle/src/surface/engine'
import {registerDocumentCheckpoint} from '../../../../../desktop/cradle/src/document/frame'
import {createNativeInputContinuity,type NativeInputContinuity,type PrivateNativeInputReceipt} from '../continuity/nativeInputs'
import {sameEditorBasis,type NativeEditorReading,type NativeEditorChange,type NativeEditorRequest,type NativeEditorReply} from '@epilogos/expressions-boundary/editor'
import {privateNativeInputChanges,privateNativeInputTargetCurrent} from '../continuity/nativeInputRecovery'
import {NativeInputRetentionContext as Retention,useNativeInputRetention,type NativeInputAperture} from '../continuity/nativeInputContext'
export {useNativeInputRetention}
export type {NativeInputAperture}

/** Checkpoint membership is the actual open Expressions binding, including a
 * detached or retained mode tree. A presentation carrier is never its ID. */
export function nativeInputBinding(owner:Workspace):string|null {
  for(const layout of [owner.layout,...Object.values(owner.modeLayouts??{})]) {
    for(const id of [...groupsOf(layout.root).flatMap(group=>group.tabs),...(layout.sidePane?.tabs??[]),...(layout.detached??[]).map(row=>row.surfaceId)]) {
      if(layout.surfaces[id]?.kind==='expressions')return id
    }
  }
  return null
}
export function NativeInputRetentionProvider({children}:{children:ReactNode}) {
  const workspace=useWorkspace(),book=useContinuity()
  const latest=useRef({workspace,book});latest.current={workspace,book}
  const failures=useRef(new Map<string,string>())
  const [,revision]=useState(0),[aperture,setAperture]=useState<NativeInputAperture|null>(null)
  const bindingId=nativeInputBinding(book.current),scope=workspace.nativeScope
  const scopeKey=JSON.stringify([scope,workspace.workspaceId,workspace.accessEpoch,bindingId,workspace.accessReady])
  useEffect(()=>{
    if(!scope||!bindingId||!workspace.accessReady){setAperture(null);return}
    const epoch=workspace.accessEpoch,workspaceId=workspace.workspaceId
    let live=true
    const current=()=>{const now=latest.current.workspace;return live&&now.workspaceId===workspaceId&&now.accessEpoch===epoch
      &&now.nativeAccessCurrent(epoch)&&nativeInputBinding(latest.current.book.current)===bindingId
      &&now.nativeScope?.owner===scope.owner&&now.nativeScope.world===scope.world&&now.nativeScope.workcell===scope.workcell
      &&now.nativeScope.accessEpoch===scope.accessEpoch}
    const owner=createNativeInputContinuity({...scope,workspace_id:workspaceId,surface_id:bindingId})
    const changed=()=>{if(live)revision(value=>value+1)}
    const failure=(key:string,reason:string|null)=>{if(reason===null)failures.current.delete(key);else failures.current.set(key,reason);changed()}
    const stop=registerDocumentCheckpoint(bindingId,async()=>{if(failures.current.size)throw Error(`Unretained native input · ${[...failures.current.values()].join('; ')}`);owner.checkpoint(current)})
    const storageChanged=()=>changed()
    window.addEventListener('storage',storageChanged)
    setAperture({owner,current,changed,failure})
    return()=>{live=false;stop();window.removeEventListener('storage',storageChanged);owner.retire()}
  },[scopeKey])
  return <Retention.Provider value={aperture?{...aperture,failures:[...failures.current.values()]}:null}>{children}</Retention.Provider>
}

/** Recovery is deliberate native work. Original copies retain their scope,
 * revision and bytes; an explicit current-revision application uses a fork. */
export function NativeInputRecovery({reading,request,isPresented}:{reading:NativeEditorReading|null;request:(operation:NativeEditorRequest)=>Promise<import('@epilogos/expressions-boundary/editor').NativeEditorReply>;isPresented:()=>boolean}) {
  const workspace=useWorkspace()
  const aperture=useNativeInputRetention(),residence=useRef<HTMLDetailsElement>(null)
  const current=useRef({reading,request,isPresented,aperture});current.current={reading,request,isPresented,aperture}
  const published=useRef(reading)
  useEffect(()=>{published.current=reading;return workspace.editor?.subscribe(next=>{published.current=next})},[workspace.editor])
  const lifetime=useRef(0),[busy,setBusy]=useState(false),[fault,setFault]=useState<string|null>(null)
  useEffect(()=>{lifetime.current++;return()=>{lifetime.current++}},[])
  if(!aperture)return null
  let inventory:ReturnType<NativeInputContinuity['read']>
  try{inventory=aperture.owner.read()}catch(cause){return <p role="alert">Input recovery unavailable · {cause instanceof Error?cause.message:String(cause)}</p>}
  const presented=()=>current.current.aperture?.owner===aperture.owner&&aperture.current()&&current.current.isPresented()&&!!residence.current?.getClientRects().length
  const applyCopy=async(receipt:PrivateNativeInputReceipt,onCurrentRevision:boolean)=>{
    if(busy||!presented()||!reading)return
    const epoch=lifetime.current,captured=published.current?.basis??reading.basis
    const same=(reply?:NativeEditorReply)=>{const now=published.current;return epoch===lifetime.current&&presented()&&!!now
      &&privateNativeInputTargetCurrent(receipt.copy,now)
      &&sameEditorBasis(reply?.ok?reply.reading.basis:captured,now.basis)}
    setBusy(true);setFault(null)
    try {
      const read=await request({operation:'read'})
      if(!same())return
      if(!read.ok)throw Error(read.error)
      if(!sameEditorBasis(read.reading.basis,captured))throw Error('The native revision changed while reading this input target; the original copy is retained')
      if(!privateNativeInputTargetCurrent(receipt.copy,read.reading))throw Error('Select the captured native object and state before applying this input')
      const changes=privateNativeInputChanges(receipt.copy,read.reading)
      const own=!onCurrentRevision&&receipt.copy.writer_id===aperture.owner.writerId?receipt:aperture.owner.fork(receipt,same)
      aperture.changed()
      const reply=await request({operation:'apply',basis:onCurrentRevision?read.reading.basis:receipt.copy.basis,changes:changes as NativeEditorChange[]})
      if(!same(reply))return
      if(!reply.ok)throw Error(reply.error)
      // Only this exact acknowledged fork is cleared. A later human edit or
      // another writer's original cannot be consumed by this acknowledgement.
      aperture.owner.clear(own,()=>same(reply)&&privateNativeInputTargetCurrent(own.copy,reply.reading));aperture.changed()
    }catch(cause){if(same())setFault(cause instanceof Error?cause.message:String(cause))}
    finally{if(epoch===lifetime.current)setBusy(false)}
  }
  if(!inventory.copies.length&&!inventory.malformed.length&&!inventory.foreign.length&&!aperture.failures?.length)return null
  return <details ref={residence} className="native-input-recovery"><summary>{inventory.copies.length} retained input {inventory.copies.length===1?'copy':'copies'}</summary>
    {inventory.copies.map(receipt=><div key={receipt.ref} className="native-input-copy">
      <span>{receipt.copy.target.parameter??receipt.copy.target.family??'Native gesture'} · r{receipt.copy.basis.revision} · {receipt.copy.target.step_id??receipt.copy.target.entity_id??'Field'}</span>
      <pre>{receipt.copy.input.kind==='text'?receipt.copy.input.text:JSON.stringify(receipt.copy.input.gesture)}</pre>
      <button disabled={busy||!reading||!privateNativeInputTargetCurrent(receipt.copy,reading)} onClick={()=>void applyCopy(receipt,false)}>Apply captured revision</button>
      <button disabled={busy||!reading||!privateNativeInputTargetCurrent(receipt.copy,reading)} onClick={()=>void applyCopy(receipt,true)}>Apply to current revision</button>
      {receipt.copy.writer_id===aperture.owner.writerId&&<button disabled={busy} onClick={()=>{try{aperture.owner.clear(receipt,presented);aperture.changed()}catch(cause){setFault(cause instanceof Error?cause.message:String(cause))}}}>Discard private copy</button>}
      {receipt.copy.refusal&&<span>{receipt.copy.refusal}</span>}
    </div>)}
    {inventory.malformed.length>0&&<p>{inventory.malformed.length} malformed recovery {inventory.malformed.length===1?'record':'records'} retained for inspection.</p>}
    {inventory.foreign.length>0&&<p>{inventory.foreign.length} {inventory.foreign.length===1?'copy belongs':'copies belong'} to another owner or surface.</p>}
    {aperture.failures?.map((reason,index)=><p key={index} role="alert">Input checkpoint refused · {reason}</p>)}
    {fault&&<p role="alert">{fault}</p>}
  </details>
}
