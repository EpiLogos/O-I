// The undo list (manual §10.9): every change an owner takes through an object act, with the change that takes it back. Undo and
// Redo cover the owners' mutations, never what only changes the view (a fold, a view switched, a pane split). A change whose owner
// gives no way back is not listed, so Undo never claims a reversal the owner cannot make. Each step is labelled as the act was
// ("Rename Bollingen"), and is undone alone. Pure TypeScript.

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
  const refused = await refusalOf(step.undo)
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
  const refused = await refusalOf(step.redo)
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
