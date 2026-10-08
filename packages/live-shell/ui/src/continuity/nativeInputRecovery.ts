import type {NativeEditorChange,NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import type {PrivateNativeInputReceipt} from './nativeInputs'

type Copy=PrivateNativeInputReceipt['copy']
/** Recovery may address only the original native instance and stable state. */
export function privateNativeInputTargetCurrent(copy:Copy,reading:NativeEditorReading,requireSelectedState=true):boolean {
  if(copy.basis.expression_ref!==reading.basis.expression_ref||copy.basis.scene_ref!==reading.basis.scene_ref)return false
  const target=copy.target
  if(target.scope==='field')return target.entity_id===null&&target.entity_ref===null&&target.step_id===null
  if(!target.entity_id||!target.entity_ref||reading.entityOccurrences[target.entity_id]!==target.entity_ref||!reading.selection.entity_ids.includes(target.entity_id))return false
  const entity=reading.scene.entities.find(row=>row.id===target.entity_id)
  return !!entity&&(target.step_id===null||(!requireSelectedState||reading.selection.step_id===target.step_id)&&entity.sequence.steps.some(step=>step.id===target.step_id))
}
/** Private JSON is never a generic command queue. Decode only native editor
 * changes within the exact retained target; the native validator still owns
 * values, revisions, topology and mutation. */
export function privateNativeInputChanges(copy:Copy,reading:NativeEditorReading,requireSelectedState=true):NativeEditorChange[] {
  if(!privateNativeInputTargetCurrent(copy,reading,requireSelectedState))throw Error('The retained input target is no longer selected or available')
  const {target,input}=copy
  if(!requireSelectedState&&(input.kind!=='gesture'||input.changes.some(change=>change.kind!=='step-timing')))throw Error('Only an active timing handle may edit an unselected stable state')
  if(input.kind==='text') {
    if(target.parameter==='glyph-source'&&target.entity_id&&target.step_id)return [{kind:'step-source',entity_id:target.entity_id,step_id:target.step_id,shape:'text',text:input.text}]
    if(!target.parameter||!input.text.trim()||!Number.isFinite(Number(input.text)))throw Error('This retained input needs its original editor or a finite exact parameter value')
    const prefix=target.scope==='field'?'field.':`entity:${encodeURIComponent(target.entity_id!)}:`
    if(!target.parameter.startsWith(prefix))throw Error('The retained parameter belongs to another native scope')
    return [{kind:'parameter',target:target.parameter,value:Number(input.text)}]
  }
  if(!input.changes.length)throw Error('This gesture has no intended native change')
  const changes=input.changes as unknown as NativeEditorChange[]
  for(const change of changes) {
    if(change.kind==='parameter') {
      const prefix=target.scope==='field'?'field.':`entity:${encodeURIComponent(target.entity_id!)}:`
      if(!change.target.startsWith(prefix)||target.parameter!==null&&change.target!==target.parameter)throw Error('The retained gesture crosses a native target')
    }else if(change.kind==='field-setting'||change.kind==='field-font') {
      if(target.scope!=='field')throw Error('This retained gesture cannot change the shared Field')
    }else if(change.kind==='force-mode') {
      if(target.scope!=='entity'||change.entity_id!==target.entity_id)throw Error('This retained gesture belongs to another emitter')
    }else if(['step-timing','step-source','step-position','step-overrides','step-layers','sequence-settings'].includes(change.kind)) {
      const step=change as {entity_id:string;step_id?:string}
      if(target.scope!=='entity'||step.entity_id!==target.entity_id||step.step_id!==target.step_id)throw Error('This retained gesture belongs to another stable state')
    }else throw Error('Recover this operation through its original editor')
  }
  return changes
}
