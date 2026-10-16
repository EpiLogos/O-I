// The fault line of a Technē ask: a refusal stands on the fault line of the pane whose stage took the ask, and nowhere else
// [the ticket S's fault line, scoped by lane D; DEVICE-SEMANTICS-LOCK §0 law 4 "Nothing moves without a visible cause"].
//
// Seen natively by the lead (16 Oct, m4 build) and headless on the real ground: the door's refusal was written into the one
// Expressions panel's faults, which every Expressions pane draws, so Technē's fault line still stood on Expressions' pane after the
// mode changed. Now each refusal of an ask (subjectAsks.ts `answerAsk`) is held here with the pane that presented the stage when the
// stage took the ask and the cut the frame stood in (the stage's answers carry both: subjectAsks.ts `createStageAnswers`); an
// Expressions pane body draws the fault held for its own pane while the frame stands in that cut (projections/expressionsPane.tsx).
// The cut matters as much as the pane: the modes' trees can hold the same stage pane (makeProjectionBinding reuses a kind's binding,
// desktop/cradle/src/surface/engine.ts:268; seen headless, 16 Oct, a fault scoped by pane alone still stood in Expressions mode).
// The fault clears when its ask is shown, when a newer ask is posted for a subject (subjectOpenings.ts), or when its pane leaves
// (the pane changes instrument: its body unmounts). A refusal no stage took (the door's deadline) belongs to no pane: the row
// that asked says it (worldRows.ts), as before.
//
// A reading, never a source: written only by the ask's answers and the pane's own leaving.

import {useSyncExternalStore} from 'react'
import {framePlacement} from '../../projections/expressionsPaneHost'
import {onAskAnswer, sameAsk, type AskedScene} from './subjectAsks'

/** The refusal standing for an ask: its words, the pane whose stage took the ask (null: no stage took it), and the cut the frame
 * stood in then (null: not named — an older wiring; the pane alone then scopes it). */
export interface AskFault {asked: AskedScene; reason: string; paneId: string | null; mode: string | null}

let held: AskFault | null = null
const listeners = new Set<() => void>()

function publish(next: AskFault | null): void {
  if (next === held) return
  held = next
  for (const listener of [...listeners]) listener()
}

/** The pane a refusal belongs to: the one its stage named; for a stage refusal that names none (an older wiring), the pane
 * presenting the stage as it refuses; for the door's, none. */
export function faultPane(answer: {by: 'stage' | 'door'; paneId?: string | null}, placed: () => string | null = () => framePlacement()?.paneId ?? null): string | null {
  if (answer.paneId !== undefined) return answer.paneId
  return answer.by === 'stage' ? placed() : null
}

onAskAnswer(answer => {
  if (answer.state === 'refused') publish({asked: {registerKey: answer.registerKey, sceneRef: answer.sceneRef}, reason: answer.reason, paneId: faultPane(answer), mode: answer.mode ?? null})
  else if (held && sameAsk(held.asked, answer)) publish(null)
})

/** The fault standing on a pane's fault line while the frame stands in `mode` (its announced host mode), or null. */
export function askFaultIn(paneId: string, mode: string | null | undefined): string | null {
  return held && held.paneId === paneId && (held.mode === null || held.mode === mode) ? held.reason : null
}

/** The held fault, whatever its pane (the tests; a face that names it). */
export function askFault(): AskFault | null {
  return held
}

/** A newer ask was posted: the older ask's fault no longer stands. With a pane, only a fault that pane holds clears (the pane left). */
export function clearAskFault(paneId?: string): void {
  if (held && (paneId === undefined || held.paneId === paneId)) publish(null)
}

/** The pane's fault in the frame's cut, as a hook: a pane body re-reads when the fault arrives, clears, or moves to another pane. */
export function useAskFault(paneId: string, mode: string | null | undefined): string | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => askFaultIn(paneId, mode),
    () => askFaultIn(paneId, mode),
  )
}
