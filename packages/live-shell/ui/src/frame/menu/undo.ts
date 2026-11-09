// The undo list (manual §10.9): every change an owner takes through an object act, with the change that takes it back. Undo and
// Redo cover the owners' mutations, never what only changes the view (a fold, a view switched, a pane split). A change whose owner
// gives no way back is not listed, so Undo never claims a reversal the owner cannot make. Each step is labelled as the act was
// ("Rename Bollingen"), and is undone alone. Pure TypeScript.

import type {NativeCompositionViewSource} from '../../shell/compositionViews'
import {endKeyRuns} from '../../inhabitants/sdk/panel'

export interface UndoStep {
  /** The act's words, as the receipt said them. */
  readonly label: string
  readonly undo: () => Promise<unknown> | unknown
  readonly redo: () => Promise<unknown> | unknown
}

const LIMIT = 100
let done: UndoStep[] = []
let undone: UndoStep[] = []
const listeners = new Set<() => void>()
const notify = () => { for (const listener of listeners) listener() }

/** A change the owner took, with its way back. A new change clears what was undone. */
export function recordStep(step: UndoStep): void {
  done = [...done.slice(-(LIMIT - 1)), step]
  undone = []
  notify()
}

/** The owner's words where it refused a way back (an answer `{ok: false}`, or a throw); null where it took it. */
async function refusalOf(run: () => Promise<unknown> | unknown): Promise<string | null> {
  try {
    const answer = await run()
    if (answer && typeof answer === 'object' && (answer as {ok?: unknown}).ok === false) {
      const error = (answer as {error?: unknown}).error
      return typeof error === 'string' && error ? error : 'The owner refused it and gave no reason. Nothing was changed.'
    }
    return null
  } catch (cause) { return cause instanceof Error ? cause.message : String(cause) }
}

/** Take back the last change: its owner's way back, run. Null when there is nothing to undo. Where the owner refuses it (O-I #747 round
 * 892), the step stands where it was and `say` has the owner's words. */
export async function undoStep(say?: (label: string, words: string) => void): Promise<UndoStep | null> {
  const step = done[done.length - 1]
  if (!step) return null
  done = done.slice(0, -1)
  undone = [...undone, step]
  notify()
  // A control's run of key steps ends here and again when the owner has answered: the next press steps from what the undo left, never
  // from the run's last step (fresh review of O-I #939, item 9).
  endKeyRuns()
  const refused = await refusalOf(step.undo)
  endKeyRuns()
  if (refused !== null) { undone = undone.filter(row => row !== step); done = [...done, step]; notify(); say?.(step.label, refused) }
  return step
}

/** Make the last undone change again. Null when there is nothing to redo. A refusal leaves the step to redo, and says why. */
export async function redoStep(say?: (label: string, words: string) => void): Promise<UndoStep | null> {
  const step = undone[undone.length - 1]
  if (!step) return null
  undone = undone.slice(0, -1)
  done = [...done, step]
  notify()
  endKeyRuns()
  const refused = await refusalOf(step.redo)
  endKeyRuns()
  if (refused !== null) { done = done.filter(row => row !== step); undone = [...undone, step]; notify(); say?.(step.label, refused) }
  return step
}

/** What Undo and Redo would take back or make again, for the menu's words. */
export const undoState = (): {undo: string | null; redo: string | null} =>
  ({undo: done[done.length - 1]?.label ?? null, redo: undone[undone.length - 1]?.label ?? null})

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** For tests: an empty list. */
export function clearUndo(): void { done = []; undone = []; notify() }

// ---------------------------------------------------------------------------------------------------------------- the frame's own steps

/** The presented composition as the shell last read it (frame/tracks/modeTracks.ts expressionsControls, on each read). A frame step asks it
 * when Undo or Redo runs, never the source its change was made through, whose presentation may have been retired since
 * (shell/compositionViews.ts). */
let presentedNow: NativeCompositionViewSource | undefined
export function presentFrameHistory(source: NativeCompositionViewSource): void { presentedNow = source }

/** Why a frame step's way back does not run when its own step is not on top of the frame's list (O-I #747 round 893): the step on top is
 * another change, or the list holds nothing of it. */
function notOnTop(operation: 'undo' | 'redo', top: {label: string} | undefined): string {
  if (operation === 'undo') return top
    ? `Undo takes back only the last change, and the last change in this Expression is "${top.label}". Nothing was changed.`
    : 'This Expression no longer lists it to take back. Nothing was changed.'
  return top
    ? `Redo makes again only the last change taken back, and in this Expression that is "${top.label}". Nothing was changed.`
    : 'This Expression changed after it was taken back, so it cannot be made again. Nothing was changed.'
}
type Answer = {ok: boolean; note?: string; error?: string}
/** A change the frame took as one labelled step of its own history — a scene cut (O-I #747 round 892), a rename in Clip view (round 893) —
 * and its way back and forth (manual §16.6 "Every edit is one labelled step in the undo list"): the frame's own Undo or Redo, asked of the
 * composition presented then, on the basis that stands, and only while that is this Expression at the revision the change, or the last
 * Undo or Redo of it, left, with the change's own step (`step`, its id in the frame's history) on top of the frame's list. A frame-local
 * edit not saved yet leaves the revision where it was: the frame's own list says whether the step is on top. A later change is never taken
 * back in this one's name. */
export function frameStep(expressionRef: string, revision: number, step: string): {undo(): Promise<Answer>; redo(): Promise<Answer>} {
  let stands = revision
  const ask = async (operation: 'undo' | 'redo'): Promise<Answer> => {
    const source = presentedNow, reading = source?.currentReading?.() ?? null, actions = source?.actions
    if (!source || !actions || !source.isPresented() || !reading || reading.basis.expression_ref !== expressionRef)
      return {ok: false, error: 'Its Expression is not the Expression presented now: open it, then try again. Nothing was changed.'}
    if (reading.basis.revision !== stands)
      return {ok: false, error: `The Expression changed after it (revision ${stands}, now ${reading.basis.revision}), and ${operation === 'undo' ? 'Undo takes back' : 'Redo makes again'} only its last change. Nothing was changed.`}
    const top = reading.history?.[operation]
    if (top?.step !== step) return {ok: false, error: notOnTop(operation, top)}
    const reply = await actions.history(operation, reading.basis)
    if (reply.ok && typeof reply.reading?.basis?.revision === 'number') stands = reply.reading.basis.revision
    return reply.ok ? {ok: true, note: reply.note || (operation === 'undo' ? 'Taken back.' : 'Made again.')} : {ok: false, error: reply.error ?? 'The owner refused and gave no reason.'}
  }
  return {undo: () => ask('undo'), redo: () => ask('redo')}
}
