// How a field device writes: one `apply` on the reading's basis, with the numeric edits held in the private input owner
// while the owner has not answered. This is NativeFieldHandle's own direct commit (components/NativeFieldHandle.tsx `commitDirect`,
// lines 53-65) for a value that arrives by Send rather than by a drag: retain the gesture, apply, clear it on an ok reply,
// retain it again with the owner's refusal on a refused one, and leave it to the recovery panel when the work moved on. The
// target key is the handle's own (`fieldInputTarget`), so the recovery panel shows one copy however the value was entered.
import type {NativeEditorBasis, NativeEditorChange, NativeEditorReply} from '@epilogos/expressions-boundary/editor'
import type {NativeInputAperture} from '../../continuity/nativeInputContext'
import type {PrivateNativeInputReceipt} from '../../continuity/nativeInputs'
import {handleGestureMaterial} from '../NativeFieldHandle'
import {NativeDeviceInputCustody, type Apply, type CaptureCurrent} from '../nativeDeviceCustody'
import type {FieldDeviceSend, NumericEdit} from './expressionsDevice'

export interface FieldDeviceHost {
  /** The rack's (or the pool's) one apply: in-flight lock and basis included. */
  readonly apply: Apply
  readonly captureCurrent: CaptureCurrent
  /** The private input owner, read when a change is sent (its object changes with every render of its provider). */
  readonly aperture: () => NativeInputAperture | null
}

interface Held {readonly custody: NativeDeviceInputCustody; readonly receipt: PrivateNativeInputReceipt; readonly edit: NumericEdit}

const messageOf = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

function materialOf(family: string, basis: NativeEditorBasis, edit: NumericEdit, refusal?: string) {
  const material = handleGestureMaterial({pointer: -1, basis: {...basis}, value: edit.value, initial: edit.initial, offset: 0}, edit.id, family)
  return refusal ? {...material, refusal} : material
}

/** The host's write as the model asks for it. The family names the device in the retained copy's target, as the handle's does. */
export function fieldDeviceSend(family: string, host: FieldDeviceHost): FieldDeviceSend {
  return async (edits: readonly NativeEditorChange[], numeric: readonly NumericEdit[], basis: NativeEditorBasis): Promise<NativeEditorReply> => {
    const current = host.captureCurrent()
    if (!current()) return {ok: false, error: 'The native work moved on; your values are kept.'}
    const aperture = host.aperture()
    const held: Held[] = []
    if (aperture) {
      try {
        for (const edit of numeric) {
          const material = materialOf(family, basis, edit)
          const custody = new NativeDeviceInputCustody(aperture, {basis: material.basis, target: material.target}, 'gesture')
          held.push({custody, receipt: custody.retain(material), edit})
        }
      } catch (cause) {
        // Nothing is sent that the private owner could not keep: the legacy handle's rule, stated in the owner's words.
        return {ok: false, error: messageOf(cause)}
      }
    }
    let reply: NativeEditorReply
    try { reply = await host.apply(edits, basis) } catch (cause) { reply = {ok: false, error: messageOf(cause)} }
    if (!current(reply)) return reply
    for (const entry of held) {
      try {
        if (reply.ok) entry.custody.clear(entry.receipt)
        else entry.custody.retain(materialOf(family, basis, entry.edit, reply.error))
      } catch { /* the original copy stays in the recovery panel, which names it */ }
    }
    return reply
  }
}
