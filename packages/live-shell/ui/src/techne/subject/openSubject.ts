// Open a World subject in Technē's instruments: the live source and the one call a surface makes [FOUNDATION §3 N2; see
// subjectScenes.ts for the decision and its evidence].
//
// A surface that holds a subject (a browser row, an Earth occurrence, a Technē track clip) calls `openWorldSubject(subject)`. It resolves
// the Scene that carries the subject through the owner's reverse query, posts the owner's selection ask, and presents Technē. The frame's
// research instruments then read that Scene through the owner they already read (`readWikiSceneTechne`); this module reads no date or place.
//
// Every owner it touches is the one the candidate already runs:
//   - the register load and the reverse query: native/wikiSubjectStanding.ts `liveWikiStandingSource` (the frame's E21 channel answers from
//     the same source), which is `ensureWikiStanding` per register and `wikiSubjectStandings` over the one projection state;
//   - the projection: techne/wikiProjectionStore.ts `wikiProjectionOf` over `getWikiProjectionState().standings`;
//   - the ask: techne/wikiProjectionStore.ts `requestWikiSelection`, consumed by `createNativeTechneNavigator.connectSelectionRequests`
//     (packages/expressions-boundary/src/techne.ts:110) while Technē is presented;
//   - the hop: `oi:epi-examine`, which panels/expressions.tsx answers (`const examine = () => {if (live) workspace.setMode('techne')}`);
//   - the stage: the navigator consumes the ask only while the one Expressions stage is presented in Technē (panels/expressions.tsx
//     `visible`, its `deepPresented`), and Technē's first tree holds the Earth, not the stage (shell/modeFrames.ts
//     `seedInstruments(['projection.earth'])`). So presenting opens the stage through the one instrument door (frame/instrumentDoor.ts
//     `openInstrument`) — which brings a stage already in the tree forward rather than making a second (frame/openInstrument.ts,
//     surface/engine.ts `openBinding`) — then hops;
//   - the answer: the stage settles the ask (shown, or refused in the owner's words) through subjectAsks.ts, which the stage's
//     wiring writes (panels/expressions.tsx); `followLiveAsk` follows it, and answers an ask still untaken at its deadline.
//
// Callers: the browser's Technē World rows (shell/ModeBrowser.tsx, through subjectOpenings.ts `openHeldSubject`).

import {getWikiProjectionState, requestWikiSelection, wikiProjectionOf} from '../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {liveWikiStandingSource} from '../../native/wikiSubjectStanding'
import {openInstrument} from '../../frame/instrumentDoor'
import {openSubjectScene, resolveSubject, type SubjectAbsence, type SubjectScene, type SubjectSource, type WorldSubject} from './subjectScenes'
import {createStageAnswers, followAsk, type AskAnswer, type AskEnv, type AskedScene} from './subjectAsks'
import {framePlacement} from '../../projections/expressionsPaneHost'

/** The window event the owner's hand-off dispatches to enter Technē (desktop/cradle/src/knowledge/techneHandoff.ts:43); the candidate answers
 * it in panels/expressions.tsx (`addEventListener('oi:epi-examine', examine)`). */
export const TECHNE_EXAMINE_EVENT = 'oi:epi-examine'

/** The pane kind of the one Expressions stage, where a Scene is shown (frame/instruments.ts NAMED). */
export const STAGE_KIND = 'projection.expressions'

/** Present Technē's stage: open it (or bring it forward) through the instrument door, then the owner's hop. With no pane tree
 * mounted the door refuses, and the hop alone enters Technē. */
export function presentStage(open: (payload: string) => void = openInstrument, events: EventTarget = window): void {
  try { open(STAGE_KIND) } catch { /* no pane tree is mounted: the hop below still enters Technē */ }
  events.dispatchEvent(new CustomEvent(TECHNE_EXAMINE_EVENT, {detail: {}}))
}

/** The candidate's live source: the owner's projection state, the owner's ask, and the stage presented with the owner's hop. */
export const liveSubjectSource: SubjectSource = {
  loadRegisters: () => liveWikiStandingSource.loadRegisters(),
  unreadRegisters: () => liveWikiStandingSource.unreadRegisters(),
  standingsOf: subjectRef => liveWikiStandingSource.standingsOf(subjectRef),
  projectionOf: registerKey => wikiProjectionOf(getWikiProjectionState().standings[registerKey]),
  ask: request => requestWikiSelection(request),
  present: () => presentStage(),
}

/** What the call did. `asked` means the owner's selection ask was posted and Technē was presented: not that the frame has opened the Scene
 * (its own state announcement proves that). `others` are the further Scenes that carry the subject, kept so a surface can offer them. */
export type SubjectOpen =
  | {state: 'asked'; scene: SubjectScene; others: readonly SubjectScene[]}
  | {state: 'absent'; why: SubjectAbsence; reason: string}

/** Open a World subject in the Scene that carries it. Posts nothing when the subject stands in no Scene; the absence is returned in the
 * owner's words for the surface to show. */
export async function openWorldSubject(subject: WorldSubject, source: SubjectSource = liveSubjectSource): Promise<SubjectOpen> {
  const found = await resolveSubject(subject, source)
  if (found.state === 'absent') return found
  openSubjectScene(found.scene, subject.title, source)
  return {state: 'asked', scene: found.scene, others: found.others}
}

/** Open one of the Scenes `openWorldSubject` returned in `others` (a surface that lets the person choose among them). */
export function openChosenScene(scene: SubjectScene, title: string | undefined, source: SubjectSource = liveSubjectSource): void {
  openSubjectScene(scene, title, source)
}

/** The live seam a follower reads: the ask is still the projection store's untaken request. */
export const liveAskEnv: AskEnv = {
  pending: asked => {
    const request = getWikiProjectionState().request
    return !!request && request.registerKey === asked.registerKey && request.sceneRef === asked.sceneRef
  },
  setTimer: (run, ms) => {
    const timer = setTimeout(run, ms)
    ;(timer as {unref?: () => void}).unref?.()
    return timer
  },
  clearTimer: timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
}

/** Follow the stage's answer to an ask the door posted (subjectAsks.ts `followAsk` over the live seam). */
export type AskFollower = (asked: AskedScene, title: string, onAnswer: (answer: AskAnswer) => void) => () => void
export const followLiveAsk: AskFollower = (asked, title, onAnswer) => followAsk(asked, title, onAnswer, liveAskEnv)

/** The stage's answers over the live stage (subjectAsks.ts `createStageAnswers`): the frame's own announced reading (the Expression
 * it shows, the cut it stands in) as the stage's wiring reads it, the frame's placement for the pane an ask belongs to, and real
 * timers. The stage's wiring makes one per mounted frame (panels/expressions.tsx). */
export function createLiveStageAnswers(reading: () => {nativeScene?: {expression_ref: string}; hostMode?: string} | null | undefined) {
  return createStageAnswers({shownRef: () => reading()?.nativeScene?.expression_ref, mode: () => reading()?.hostMode ?? null,
    paneId: () => framePlacement()?.paneId ?? null, setTimer: liveAskEnv.setTimer, clearTimer: liveAskEnv.clearTimer})
}
