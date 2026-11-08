/**
 * The Jankó keyboard's surface, read from the owner through the kernel
 * (T-LIVE-JANKO-DEVICE). The kernel's `janko_window_read` op runs the installed
 * quaternal-logic's `music janko window --json` (ql.janko-surface/v1) and passes the
 * owner's document through; the device validates it strictly (jankoLayout.ts) and
 * never runs ql itself. The window follows the instrument's acting lens: it is read
 * again when the lens changes, never polled. A reply that arrives after a newer
 * request is dropped, so a slow read never overwrites the current lens's window.
 */
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../desktop/cradle/src/kernel/types'
import {liveJankoWindow, publishLiveJankoWindow, refuseLiveJankoWindow} from '../live/janko/jankoLayout'
import type {LiveTorusState} from '../live/torusInstrument'

export type KernelCall = (op: KernelOp) => Promise<KernelOpCall>

export type JankoWindowAnswer = {readonly ok: true; readonly document: unknown} | {readonly ok: false; readonly reason: string}

/** One answer from the kernel for the window on `lens` (null: the owner's default); every refusal is named. */
export async function readJankoWindowThroughKernel(call: KernelCall, lens: number | null): Promise<JankoWindowAnswer> {
  let answer: KernelOpCall
  try {
    answer = await call(lens === null ? {op: 'janko_window_read'} : {op: 'janko_window_read', lens})
  } catch (error) {
    return {ok: false, reason: `the kernel could not be asked for the Jankó window: ${String(error)}`}
  }
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'the kernel did not serve the Jankó window'}
  const outcome = answer.outcome as {result?: string; document?: unknown}
  if (outcome.result !== 'janko_window_reading') {
    return {ok: false, reason: `the kernel answered \`${outcome.result ?? 'unknown'}\`, not \`janko_window_reading\``}
  }
  return {ok: true, document: outcome.document}
}

let sequence = 0

/** Read the window for `lens` and publish it to the device, or publish the named refusal. */
export async function requestLiveJankoWindow(lens: number | null, call: KernelCall = op => kernelOp(detectTransport(), op)): Promise<void> {
  const mine = ++sequence
  const answer = await readJankoWindowThroughKernel(call, lens)
  if (mine !== sequence) return
  if (answer.ok) publishLiveJankoWindow(answer.document)
  else refuseLiveJankoWindow(answer.reason)
}

/** The instrument's acting lens as the owner's window takes it (the owner's lens12 is ql's --lens index); null, the owner's default. */
export function jankoLensOf(torus: LiveTorusState | null): number | null {
  return torus?.ok ? torus.determinants?.lens.lens12 ?? null : null
}

type Following = {lens: number | null; pending: boolean}
let following: Following | null = null

/** The window for the instrument's acting lens, asked of the owner only when the lens moved or no window stands (none yet, or a refusal).
 * The part's one playing path needs it whether or not a keyboard surface is mounted: a row launched in Session view strikes its keys too
 * (G4, DLW build ruling 2026-11-07). Live's transport and the keyboard surface both follow through here, so one lens is asked once. */
export function followLiveJankoWindow(lens: number | null, call?: KernelCall): Promise<void> {
  if (following && following.lens === lens && (following.pending || liveJankoWindow()?.ok)) return Promise.resolve()
  const mine: Following = {lens, pending: true}
  following = mine
  return requestLiveJankoWindow(lens, call).finally(() => { mine.pending = false })
}
