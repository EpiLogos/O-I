// Open and Reveal (manual §10.9: "Open hands a world's folder, or a page's file, to the application your computer opens it with, such as
// your editor. Reveal shows it in Finder. Neither changes the world"): a page's file or a world's folder, named by its Central-relative path
// (a page's `location.path`, a world's `folder`), handed to Central's work.open or work.reveal (ctrl/src/action.rs select_path,
// EpiLogos/Central#289), which asks the computer through its NativeOpen / NativeReveal port. A path outside the root's Control or Work, or
// one that names nothing, is refused in Central's words. Light on purpose: the Session grid's set reaches it (frame/tracks/useCentralTracks.ts),
// so it imports only the kernel op and the dispatch reading.
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {actionAnswerOf, centralActionOp} from './centralActions'

export const CENTRAL_OPEN_ACTS = {open: 'work.open', reveal: 'work.reveal'} as const
export type CentralOpenAct = keyof typeof CENTRAL_OPEN_ACTS

/** Open or reveal one path through Central. Resolves with Central's answer (the item it opened); throws a path with no home, or Central's
 * refusal in its words. */
export async function openOrRevealInCentral(transport: KernelTransportStatus, act: CentralOpenAct, path: string): Promise<unknown> {
  const named = path.trim()
  if (!named.includes('/')) throw new Error(`${act === 'open' ? 'Open' : 'Reveal'}: "${path}" is no Central-relative path (a page's file or a world's folder names its home, Control/… or Work/…).`)
  const action = CENTRAL_OPEN_ACTS[act]
  const call = await kernelOp(transport, centralActionOp(action, {query: named}))
  if (call.error) throw new Error(call.error)
  const answer = actionAnswerOf({status: 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: null}, action)
  if (answer.status === 'answered') return answer.value
  throw new Error(answer.status === 'refused' ? answer.error : `${action} did not answer.`)
}
