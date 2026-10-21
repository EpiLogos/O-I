// NOWs' Close (manual §23.6; W2): a NOW clearing closed through Central's `central.now.lifecycle` — one of the person's own presses the
// kernel carries through invoke_action (action.rs PERSON_ACTS) — on the clearing's revision as the ground's listing gave it
// (central.now-listing/v1 `revision.revision`) and on the placement policy's revision (`central.work.policy` `revision`, the action's
// expected_policy_revision). The NOWs device's binding (widgets/railDevices.tsx useNowsBinding) hands its `close` press here: the
// design sets `close` to the now_ref of the clearing open in Full (widgets__nows.tsx). Central checks both revisions and refuses in its
// own words; the window's readings are asked again behind the write (centralWrite: kernelOp, the kernel's write notice).
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {centralWrite} from './centralDeviceWrites'

export const NOW_LIFECYCLE_ACTION = 'central.now.lifecycle'
/** Central's placement policy, whose revision a lifecycle change is checked against (a reading: owner_write.rs retires nothing for it). */
export const WORK_POLICY_ACTION = 'central.work.policy'

/** One clearing as the ground's NOW listing gives it (the fields a close needs). */
export interface NowRow {
  readonly now_ref?: unknown
  readonly revision?: unknown
  readonly lifecycle?: unknown
}

/** The input central.now.lifecycle takes to close the clearing `nowRef`, from the listing's rows and the policy's reading; or why it
 * cannot be asked now, in words. Pure. */
export function nowCloseInput(nowRef: unknown, rows: readonly NowRow[] | null, policy: unknown):
  {readonly input: {now_ref: string; expected_revision: string; expected_policy_revision: string; lifecycle: 'closed'}} | {readonly refused: string} {
  if (typeof nowRef !== 'string' || !nowRef) return {refused: 'Close: open a moment first, then close it when it is done.'}
  if (!rows) return {refused: 'Close: the ground\'s NOW listing has not answered, so no clearing\'s revision stands to close it on.'}
  const row = rows.find(candidate => candidate.now_ref === nowRef)
  if (!row) return {refused: `Close: ${nowRef} is not among the clearings the ground lists now.`}
  if (row.lifecycle === 'closed' || row.lifecycle === 'archived') return {refused: `Close: ${nowRef} is ${String(row.lifecycle)} already.`}
  // The listing carries a clearing's revision as Central's content revision ({byte_len, revision}); a bare string is read as one too.
  const revision = typeof row.revision === 'string' ? row.revision : (row.revision as {revision?: unknown} | null)?.revision
  if (typeof revision !== 'string' || !revision) return {refused: `Close: the listing gives ${nowRef} no revision, so the close cannot be checked against it.`}
  const policyRevision = (policy as {revision?: unknown} | null)?.revision
  if (typeof policyRevision !== 'string' || !policyRevision) return {refused: 'Close: Central\'s placement policy (central.work.policy) has not answered, and a lifecycle change is checked against its revision.'}
  return {input: {now_ref: nowRef, expected_revision: revision, expected_policy_revision: policyRevision, lifecycle: 'closed'}}
}

/** Close the clearing through Central (central.now.lifecycle `closed`), in the root register unless a project is named. Resolves with
 * Central's answer; throws the refusal, or Central's words. */
export async function closeNowClearing(transport: KernelTransportStatus, nowRef: unknown, rows: readonly NowRow[] | null, policy: unknown, project?: string): Promise<unknown> {
  const asked = nowCloseInput(nowRef, rows, policy)
  if ('refused' in asked) throw new Error(asked.refused)
  return centralWrite(transport, NOW_LIFECYCLE_ACTION, asked.input, project)
}
