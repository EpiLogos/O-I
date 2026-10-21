// Central's actions as the kernel carries them (invoke_action: action.rs invoke → Central's runner), and their dispatch read as an answer.
// Pure, and free of the window's held readings (owners/ownerCall.ts installs the readings holder when it loads): the writers
// (centralDeviceWrites.ts) and the readers (useCentralReadings.ts) share these without the one pulling the other in.
import type {ActionDispatch, KernelOp, KernelOutcome} from '../../../../../../desktop/cradle/src/kernel/types'

/** One Central action's answer as a device reads it: the action's data, its refusal in the owner's words, or nothing yet. */
export type ActionAnswer = {readonly status: 'reading'} | {readonly status: 'answered'; readonly value: unknown} | {readonly status: 'refused'; readonly error: string}

/** The kernel op that asks Central for one action (owner_write.rs carries a Central reading as a reading: it retires nothing; the person's own
 * presses, action.rs PERSON_ACTS, carry the host's native token). */
export const centralActionOp = (action: string, input: Readonly<Record<string, unknown>>, project?: string): KernelOp =>
  ({op: 'invoke_action', ...(project ? {project} : {}), invocation: {action, target_ref: `central:action:${action}`, input: {...input}}})

/** The dispatch as an answer: Central's data, or its words (a refusal, an owner the kernel cannot reach, an action it routes to no owner).
 * `reading` is a held answer or a call's, its value the kernel's `action_dispatched` outcome. Pure. */
export function actionAnswerOf(reading: {readonly status: string; readonly value: (Extract<KernelOutcome, {result: 'action_dispatched'}> | {readonly dispatch: ActionDispatch}) | null; readonly error: string | null},
  action: string): ActionAnswer {
  if (reading.status === 'refused') return {status: 'refused', error: reading.error ?? `${action} did not answer.`}
  if (reading.status !== 'answered' || !reading.value) return {status: 'reading'}
  const dispatch = reading.value.dispatch
  switch (dispatch.state) {
    case 'invoked': return {status: 'answered', value: dispatch.data}
    case 'owner_refused': return {status: 'refused', error: dispatch.message}
    case 'owner_unavailable': return {status: 'refused', error: dispatch.detail}
    case 'unsupported_action': return {status: 'refused', error: dispatch.detail}
    case 'malformed_ref': return {status: 'refused', error: dispatch.detail}
    case 'unknown_owner': return {status: 'refused', error: `The kernel routes ${dispatch.action} to no owner (desktop/cradle/kernel/src/action.rs invoke).`}
  }
}
