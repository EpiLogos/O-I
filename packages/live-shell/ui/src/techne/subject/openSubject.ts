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
//   - the hop: `oi:epi-examine`, which panels/expressions.tsx:312-313 answers with `workspace.setMode('techne')`.

import {getWikiProjectionState, requestWikiSelection, wikiProjectionOf} from '../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {liveWikiStandingSource} from '../../native/wikiSubjectStanding'
import {openSubjectScene, resolveSubject, type SubjectAbsence, type SubjectScene, type SubjectSource, type WorldSubject} from './subjectScenes'

/** The window event the owner's hand-off dispatches to enter Technē (desktop/cradle/src/knowledge/techneHandoff.ts:43); the candidate answers
 * it in panels/expressions.tsx:313. */
export const TECHNE_EXAMINE_EVENT = 'oi:epi-examine'

/** The candidate's live source: the owner's projection state, the owner's ask, and the owner's hop. */
export const liveSubjectSource: SubjectSource = {
  loadRegisters: () => liveWikiStandingSource.loadRegisters(),
  unreadRegisters: () => liveWikiStandingSource.unreadRegisters(),
  standingsOf: subjectRef => liveWikiStandingSource.standingsOf(subjectRef),
  projectionOf: registerKey => wikiProjectionOf(getWikiProjectionState().standings[registerKey]),
  ask: request => requestWikiSelection(request),
  present: () => { window.dispatchEvent(new CustomEvent(TECHNE_EXAMINE_EVENT, {detail: {}})) },
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
