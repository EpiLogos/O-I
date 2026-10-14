// A World subject opens as the Scene that carries it [FOUNDATION §3 N2; DLW manual §8 "Find a subject and gather what surrounds it";
// DEVICE-SEMANTICS-LOCK §0 "Technē instruments already act on Expressions", law 4 "Owners write; faces read", §9.1 Technē row].
//
// The decision this module carries (N2): the frame's research instruments read dates and places from a native Scene, and that is the
// intended shape, not a gap. The Scene is the gathering the person works in:
//   - the owner's reading is a Scene aperture. `readWikiSceneTechne` (desktop/cradle/src/techne/wikiReadingProvider.ts:312) answers for the
//     exact Scene presented, and dates and places attach to that Scene's retained subject bindings at their exact revision
//     (techne/temporalFacets.ts:53 `sceneTemporalFacets`: "A dated source changed; refresh its live composition"; techne/spatialFacets.ts:40
//     `sceneSpatialFacets`: "A placed source changed; refresh its live composition before opening Places");
//   - the shared time window and place focus are one owner session keyed by the Scene's basis
//     (packages/expressions-boundary/src/timeWindow.ts:88-91 `current`, `sameBasis(context.state?.nativeScene, native)`);
//   - the instruments write into the Scene (timeline layouts, saved views, tours, cards: researchInstruments.tsx:1204, :1260 `host.material(sceneId, …)`);
//   - the frame refuses a reading that is not bound to the construction (researchInstrumentsData.ts:222 `assertInstrumentReadingScope`:
//     "A host-wide reading cannot lend dates or places to unrelated construction").
// The subject-addressed provider (`wikiTechneReadingProvider`) is registered nowhere in the product, and it carries no temporal facet.
//
// So a subject reaches the instruments by being opened where the owner already stands it: the wiki projection makes each register one
// native Expression whose Scenes are constellations and whose entities are the subjects (techne/wikiExpression.ts:261
// `WikiProjection`). The owner's reverse query answers "which Scenes carry this subject" (techne/wikiProjectionStore.ts:597
// `wikiSubjectStandings`, read from the standing document, authored edits included). This module chooses among those rows and posts the
// owner's own selection ask (`requestWikiSelection`), which the candidate's Technē navigator consumes (panels/expressions.tsx:173, :307, :374, through
// `createNativeTechneNavigator.connectSelectionRequests`, expressions-boundary/src/techne.ts:110) and opens in the one hosted frame.
//
// It creates no Scene, reads no date or place, and keeps no store. A subject no register's standing carries is a named absence in the
// owner's words (desktop/cradle/src/knowledge/techneHandoff.ts:15 and :42); nothing is made up to stand in for it.
//
// Pure TypeScript apart from the owner's one predicate (`isHostedNode`). No React, no transport, no timers.

import type {ProjectedSubjectStanding, WikiSelectionRequest} from '../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import type {WikiProjection} from '../../../../../../desktop/cradle/src/techne/wikiExpression'
import {isHostedNode} from '../../../../../../desktop/cradle/src/knowledge/graph'

/** A World subject as a surface holds it: `WorldContext.subject` (desktop/cradle/src/workspace/store.ts:73) with the ref required, plus the
 * owner's name when the surface knows it (a Graph row carries `native_owner`). The owner's reverse query spans every register, so the
 * subject's project is not needed to find its Scene. */
export interface WorldSubject {
  ref: string
  title?: string
  native_owner?: string
}

/** One Scene that carries the subject, in the words of the owner's standing. */
export interface SubjectScene {
  registerKey: string
  expression_ref: string
  scene_ref: string
  scene_title: string
  /** The subject's entity in that Scene; null when the Scene itself is the subject (a constellation opened whole). */
  entity_ref: string | null
  subject_ref: string
  /** The Scene is this subject's own constellation (the subject is that constellation's whole or space). */
  whole: boolean
  /** The register's overview Scene, which stands the constellations' wholes and not their members. */
  overview: boolean
}

export type SubjectAbsence = 'no-ref' | 'hosted' | 'not-loaded' | 'unstood'

export type SubjectResolution =
  | {state: 'standing'; scene: SubjectScene; others: readonly SubjectScene[]}
  | {state: 'absent'; why: SubjectAbsence; reason: string}

/** The owner's words (desktop/cradle/src/knowledge/techneHandoff.ts:15 and :42), carried verbatim. */
export const HOSTED_WORDS = 'This subject lives in the hosted Shared Field; Technè projects the local Wiki registers.'
export const UNSTOOD_WORDS = 'Technè\'s standing projection carries no Scene with this subject; open a Wiki space or constellation that holds it.'

/** What the resolver reads: the owner's projection state, and the two acts that follow a choice. Injectable for the tests; the live source
 * is `liveSubjectSource` (openSubject.ts). */
export interface SubjectSource {
  /** Make sure the World's wiki registers are disclosed and each one's reading stands (once per owner access). */
  loadRegisters(): Promise<void>
  /** Registers whose reading could not be read; a search across them is partial, and a miss says so. */
  unreadRegisters(): readonly {key: string; reason: string}[]
  /** Every projected occurrence of one subject (`wikiSubjectStandings`). */
  standingsOf(subjectRef: string): readonly ProjectedSubjectStanding[]
  /** A register's standing projection, for telling its overview Scene and each constellation's own Scene. */
  projectionOf(registerKey: string): Pick<WikiProjection, 'overviewSceneRef' | 'constellations'> | undefined
  /** Post the owner's selection ask (`requestWikiSelection`). */
  ask(request: Omit<WikiSelectionRequest, 'seq'>): void
  /** Present Technē so its navigator consumes the ask (the owner's `oi:epi-examine` hop). */
  present(): void
}

const absent = (why: SubjectAbsence, reason: string): SubjectResolution => ({state: 'absent', why, reason})
const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/** The Scenes a subject stands in, ordered for opening: its own constellation first, then the Scenes that carry it as a member, then the
 * register's overview. Within each group the owner's order is kept, so the first is stable and nothing is dropped. */
export function sceneChoicesOf(
  subjectRef: string,
  standings: readonly ProjectedSubjectStanding[],
  projectionOf: SubjectSource['projectionOf'],
): SubjectScene[] {
  const choices = standings.map((row, index) => {
    const projection = projectionOf(row.registerKey)
    const overview = projection?.overviewSceneRef === row.scene_ref
    const whole = !!projection?.constellations.some(
      constellation => constellation.sceneRef === row.scene_ref && (constellation.wholeRef === subjectRef || constellation.spaceRef === subjectRef),
    )
    const scene: SubjectScene = {
      registerKey: row.registerKey,
      expression_ref: row.expression_ref,
      scene_ref: row.scene_ref,
      scene_title: row.scene_title,
      entity_ref: whole ? null : row.entity_ref,
      subject_ref: row.subject_ref,
      whole,
      overview,
    }
    return {scene, index, rank: whole ? 0 : overview ? 2 : 1}
  })
  return choices.sort((a, b) => a.rank - b.rank || a.index - b.index).map(choice => choice.scene)
}

/** Find the Scene that carries a subject. A named absence, never a throw and never a Scene made up for it. */
export async function resolveSubject(subject: WorldSubject, source: SubjectSource): Promise<SubjectResolution> {
  const ref = typeof subject?.ref === 'string' ? subject.ref.trim() : ''
  if (!ref) return absent('no-ref', 'This selection names no subject ref, so no Scene can be found for it.')
  if (subject.native_owner !== undefined && isHostedNode({native_owner: subject.native_owner})) return absent('hosted', HOSTED_WORDS)
  try {
    await source.loadRegisters()
  } catch (cause) {
    return absent('not-loaded', `The wiki registers were not loaded, so where this subject stands in the wiki is not read: ${messageOf(cause)}`)
  }
  const choices = sceneChoicesOf(ref, source.standingsOf(ref), source.projectionOf)
  if (choices.length === 0) {
    const unread = source.unreadRegisters()
    const partial = unread.length ? ` The search was partial: ${unread.map(row => `${row.key} could not be read (${row.reason})`).join('; ')}.` : ''
    return absent('unstood', `${UNSTOOD_WORDS}${partial}`)
  }
  return {state: 'standing', scene: choices[0], others: choices.slice(1)}
}

/** The two acts for a chosen Scene, in the owner's order (techneHandoff.ts:33-43): the selection ask, then Technē presented. A constellation
 * opened whole opens on the Canvas, as the owner's hand-off opens it. The ask is posted, not acknowledged: the navigator opens the Scene
 * when Technē is presented, and the frame's own state announcement is what proves it opened. */
export function openSubjectScene(scene: SubjectScene, title: string | undefined, source: SubjectSource): void {
  source.ask({
    registerKey: scene.registerKey,
    sceneRef: scene.scene_ref,
    entityRef: scene.entity_ref,
    subjectRef: scene.subject_ref,
    title: title ?? scene.scene_title,
    origin: 'external',
    ...(scene.whole ? {lens: 'canvas' as const} : {}),
  })
  source.present()
}
