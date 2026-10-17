// The stage's answer to the subject door's ask [the ticket S, PATH §7; FOUNDATION §3 N2; DEVICE-SEMANTICS-LOCK §0 law 4 "Owners
// write; faces read" and "Nothing moves without a visible cause"].
//
// The door posts the owner's selection ask (`requestWikiSelection`) and presents the stage (openSubject.ts). What follows is the
// stage's: its navigator takes the ask and the owner focuses the Scene, settling it opened or refused
// (packages/expressions-boundary/src/techne.ts `connectSelectionRequests`, `onSettled`), and the frame announces the Scene it shows
// (panels/expressions.tsx `onState`). This module carries that answer back, by value, from the stage's one writer
// (panels/expressions.tsx) to the door's faces (subjectOpenings.ts) — the browser row's standing and the Clip side.
//
// An ask nobody takes is answered here by its deadline, in words that say what is known; the stage's wiring shows that answer on
// the pane's fault line. Seen headless against the real ground, 15 Oct: the ask was posted and the stage pane opened, but nothing
// took the ask, and nothing said so.
//
// Pure TypeScript: no React, no DOM, no transport. The live seam (the projection store) is read only through `AskEnv`.

/** The Scene an ask names: the owner's register and the Scene's ref (WikiSelectionRequest). */
export interface AskedScene {registerKey: string; sceneRef: string}

/** The stage's answer, or the door's when the stage gave none: `shown` once the frame announces the Scene's Expression,
 * `refused` with the owner's words (or, from the door, the words of a deadline). A stage's refusal names the pane that presented
 * the stage when it took the ask (`paneId`; null when none held the frame) and the cut the frame stood in then (`mode`, the frame's
 * own announced host mode): its fault line is that pane's, in that cut (askFault.ts). */
export type AskAnswer =
  | {state: 'shown'; registerKey: string; sceneRef: string; expression_ref: string}
  | {state: 'refused'; registerKey: string; sceneRef: string; reason: string; by: 'stage' | 'door'; paneId?: string | null; mode?: string | null}

const listeners = new Set<(answer: AskAnswer) => void>()

/** Publish one answer to every follower. Written by the stage's wiring (panels/expressions.tsx) and by a follower's deadline. */
export function answerAsk(answer: AskAnswer): void {
  for (const listener of [...listeners]) listener(answer)
}

export function onAskAnswer(listener: (answer: AskAnswer) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const sameAsk = (a: AskedScene, b: AskedScene): boolean => a.registerKey === b.registerKey && a.sceneRef === b.sceneRef

/** How long a presented stage may leave the ask on the seam. A presented Technē stage takes it at once (0.2 s headless). */
export const ASK_TAKEN_WITHIN_MS = 15_000
/** How long the frame may take to show the Expression the owner focused before the stage says it has not. */
export const SCENE_SHOWN_WITHIN_MS = 30_000

/** The door's words when the ask is still on the seam at its deadline. */
export function notTakenWords(title: string, seconds = ASK_TAKEN_WITHIN_MS / 1000): string {
  return `Technē's stage has not taken the ask to open ${title} after ${seconds} s: no Technē stage presenting the Expressions frame is listening for it. The ask stays posted, and opens when the stage is shown.`
}

/** The stage's words when the owner focused the Scene but the frame did not show it by the deadline. */
export function notShownWords(sceneTitle: string, expressionRef: string, shownRef: string | null | undefined, seconds = SCENE_SHOWN_WITHIN_MS / 1000): string {
  return `Technē focused ${sceneTitle} in ${expressionRef}, but the Expressions frame has not shown it after ${seconds} s: ${shownRef ? `it still shows ${shownRef}` : 'it reports no Scene'}, and it gave the shell no reason.`
}

/** The stage's words when the frame refused to show the Scene the owner focused, in the frame's own reason (its answer to the
 * host's open: the owner's refusal it was given, or its own hold). */
export function refusedWords(sceneTitle: string, expressionRef: string, reason: string): string {
  return `Technē focused ${sceneTitle} in ${expressionRef}, but the Expressions frame refused to show it: ${reason}`
}

/** A settlement of an ask the stage's navigator took (packages/expressions-boundary/src/techne.ts NativeTechneSettlement), by the
 * fields this module reads. */
export type StageSettlement =
  | {state: 'opened'; request: AskedScene & {title?: string}; open: {expression_ref: string}; answer?: Promise<{ok: true} | {ok: false; error: string}>}
  | {state: 'refused'; request: AskedScene; reason: string}

/** What the stage's answers read of the live stage, injectable for the tests. */
export interface StageEnv {
  /** The Expression the frame announces it shows (its own state announcement), if any. */
  shownRef(): string | null | undefined
  /** The pane presenting the stage now (the frame's placement): the pane an ask the stage takes now belongs to. */
  paneId(): string | null
  /** The cut the frame stands in now (its announced host mode): the mode an ask the stage takes now belongs to. */
  mode(): string | null
  setTimer(run: () => void, ms: number): unknown
  clearTimer(timer: unknown): void
}

/** The stage's answer to a Technē selection ask (ticket S; ported from panels/expressions.tsx, where it was written inline): the
 * navigator settles each ask it takes; an opened one is answered `shown` when the frame announces the owner's Expression (`seen`),
 * refused in the frame's own words when the frame answers the open with a refusal (lane D), and refused by its deadline when the
 * frame says nothing (`notShownWords`, the 30 s honesty line). Every refusal names the pane that presented the stage when the ask
 * was taken and the cut the frame stood in, so it stands on that pane's fault line in that cut alone (askFault.ts) — never on
 * another mode's pane, though the modes' trees may hold the same stage pane. One answer per ask. */
export function createStageAnswers(env: StageEnv) {
  let awaiting: {asked: AskedScene; title: string; expression_ref: string; paneId: string | null; mode: string | null; timer: unknown} | null = null
  const finish = (waiting: NonNullable<typeof awaiting>) => {env.clearTimer(waiting.timer); if (awaiting === waiting) awaiting = null}
  const refuse = (waiting: NonNullable<typeof awaiting>, reason: string) => {
    finish(waiting)
    answerAsk({state: 'refused', ...waiting.asked, reason, by: 'stage', paneId: waiting.paneId, mode: waiting.mode})
  }
  /** The frame's own announcement: an awaited ask is shown once the frame stands on its Expression. */
  const seen = (shownRef: string | null | undefined) => {
    const waiting = awaiting
    if (!waiting || shownRef !== waiting.expression_ref) return
    finish(waiting)
    answerAsk({state: 'shown', ...waiting.asked, expression_ref: waiting.expression_ref})
  }
  const settle = (settlement: StageSettlement) => {
    const asked: AskedScene = {registerKey: settlement.request.registerKey, sceneRef: settlement.request.sceneRef}
    if (settlement.state === 'refused') {
      answerAsk({state: 'refused', ...asked, reason: settlement.reason, by: 'stage', paneId: env.paneId(), mode: env.mode()})
      return
    }
    if (awaiting) env.clearTimer(awaiting.timer)
    const waiting: NonNullable<typeof awaiting> = {asked, title: settlement.request.title ?? settlement.request.sceneRef,
      expression_ref: settlement.open.expression_ref, paneId: env.paneId(), mode: env.mode(), timer: undefined}
    waiting.timer = env.setTimer(() => {
      if (awaiting !== waiting) return
      refuse(waiting, notShownWords(waiting.title, waiting.expression_ref, env.shownRef()))
    }, SCENE_SHOWN_WITHIN_MS)
    awaiting = waiting
    // The frame's own answer to the open: a refusal ends the ask in its words; an answer that comes after the ask ended changes nothing.
    void settlement.answer?.then(result => {if (!result.ok && awaiting === waiting) refuse(waiting, refusedWords(waiting.title, waiting.expression_ref, result.error))}, () => {})
    seen(env.shownRef())
  }
  return {settle, seen, dispose: () => {if (awaiting) finish(awaiting)}}
}

/** What a follower reads of the live seam, injectable for the tests. */
export interface AskEnv {
  /** The ask still stands on the seam, untaken. */
  pending(asked: AskedScene): boolean
  setTimer(run: () => void, ms: number): unknown
  clearTimer(timer: unknown): void
}

/** Follow one ask until the stage answers it. If it is still untaken at `ASK_TAKEN_WITHIN_MS`, it is answered by the door
 * (`notTakenWords`), and the follower keeps listening: a stage shown later takes it and answers it. The returned stop ends the
 * follow (a newer ask for the same subject, or a reset). */
export function followAsk(asked: AskedScene, title: string, onAnswer: (answer: AskAnswer) => void, env: AskEnv, takenWithinMs = ASK_TAKEN_WITHIN_MS): () => void {
  let live = true
  const stopListening = onAskAnswer(answer => {
    if (!live || !sameAsk(answer, asked) || (answer.state === 'refused' && answer.by === 'door')) return
    onAnswer(answer)
    if (answer.state === 'shown') stop()
  })
  const timer = env.setTimer(() => {
    if (!live || !env.pending(asked)) return
    const answer: AskAnswer = {state: 'refused', registerKey: asked.registerKey, sceneRef: asked.sceneRef, reason: notTakenWords(title, takenWithinMs / 1000), by: 'door'}
    onAnswer(answer)
    answerAsk(answer)
  }, takenWithinMs)
  function stop() {
    if (!live) return
    live = false
    env.clearTimer(timer)
    stopListening()
  }
  return stop
}
