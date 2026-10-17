// What the subject door answered, per subject, for the faces that show it [the ticket N, PATH §7 S1; the ticket S; FOUNDATION §3 N2].
//
// A browser row asks the door (`openWorldSubject`, openSubject.ts) to open its subject; the answer is the owner's own — the Scene its
// reverse query found and the ones that also carry the subject, or the owner's absence words. Then the stage answers the ask
// (subjectAsks.ts): the frame shows the Scene's Expression, or the stage refuses in the owner's words, or nobody takes it by its
// deadline and the door says so. This module keeps the latest answer for each subject so every face reads the same one (the row's
// standing slot, the Scenes under the row, a detail that lists them), as the suite standing is kept for its faces
// (projections/atlas/provider/suiteStanding.ts): a latest snapshot, subscribe, publish. It is a reading, never a second source:
// nothing here is written but by the door's own acts and the stage's answers, and nothing is made up — a subject the door has not
// been asked about has no entry.
//
// Pure TypeScript apart from the one React hook; no DOM, no transport.

import {useSyncExternalStore} from 'react'
import {followLiveAsk, openChosenScene, openWorldSubject, type AskFollower, type SubjectOpen} from './openSubject'
import type {SubjectScene, WorldSubject} from './subjectScenes'
import {clearAskFault} from './askFault'

/** The door's answer for one subject: being asked; asked, with the Scene asked for and every Scene that carries the subject (the
 * asked one among them), until the stage answers; shown, once the frame shows that Scene's Expression; refused, in the owner's
 * words (the Scenes stay listed, so another can be chosen); or absent, in the owner's words. */
export type SubjectOpening =
  | {readonly state: 'opening'}
  | {readonly state: 'asked'; readonly opened: SubjectScene; readonly scenes: readonly SubjectScene[]}
  | {readonly state: 'shown'; readonly opened: SubjectScene; readonly scenes: readonly SubjectScene[]; readonly expression_ref: string}
  | {readonly state: 'refused'; readonly opened: SubjectScene; readonly scenes: readonly SubjectScene[]; readonly reason: string}
  | {readonly state: 'absent'; readonly reason: string}

/** An opening that carries Scenes: the door found where the subject stands, whatever the stage has answered since. */
export type SceneOpening = Extract<SubjectOpening, {opened: SubjectScene}>
export const hasScenes = (opening: SubjectOpening | undefined): opening is SceneOpening => !!opening && 'opened' in opening

let openings: ReadonlyMap<string, SubjectOpening> = new Map()
const listeners = new Set<() => void>()
/** The follow of each subject's current ask; a newer ask for the subject ends the older one. */
const follows = new Map<string, () => void>()

function publish(ref: string, opening: SubjectOpening): void {
  openings = new Map(openings).set(ref, opening)
  for (const listener of [...listeners]) listener()
}

/** Every answer held, by subject ref: the same map until the next answer. */
export function subjectOpenings(): ReadonlyMap<string, SubjectOpening> {
  return openings
}

export function subscribeSubjectOpenings(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The answers, as a hook: a face re-reads when any answer arrives. */
export function useSubjectOpenings(): ReadonlyMap<string, SubjectOpening> {
  return useSyncExternalStore(subscribeSubjectOpenings, subjectOpenings, subjectOpenings)
}

/** The door's answer as held here. */
export function openingOf(answer: SubjectOpen): SubjectOpening {
  return answer.state === 'asked'
    ? {state: 'asked', opened: answer.scene, scenes: [answer.scene, ...answer.others]}
    : {state: 'absent', reason: answer.reason}
}

/** Follow the stage's answer to the ask just posted for `ref`, holding it while that ask is still the subject's current one. The
 * older ask's fault line clears: the seam holds one ask, and this one replaces it (askFault.ts). */
function follow(ref: string, asked: SceneOpening, title: string, follower: AskFollower): void {
  follows.get(ref)?.()
  clearAskFault()
  const stop = follower({registerKey: asked.opened.registerKey, sceneRef: asked.opened.scene_ref}, title, answer => {
    const held = openings.get(ref)
    if (!hasScenes(held) || held.opened !== asked.opened) return
    publish(ref, answer.state === 'shown'
      ? {state: 'shown', opened: held.opened, scenes: held.scenes, expression_ref: answer.expression_ref}
      : {state: 'refused', opened: held.opened, scenes: held.scenes, reason: answer.reason})
  })
  follows.set(ref, stop)
}

/** Open a subject through the door and hold its answer, then the stage's. A door that throws (it never should: its absences are
 * answers) is held as an absence in its own words, never swallowed. */
export async function openHeldSubject(subject: WorldSubject, door: (subject: WorldSubject) => Promise<SubjectOpen> = openWorldSubject,
  follower: AskFollower = followLiveAsk): Promise<SubjectOpening> {
  follows.get(subject.ref)?.(); follows.delete(subject.ref)
  publish(subject.ref, {state: 'opening'})
  let held: SubjectOpening
  try {
    held = openingOf(await door(subject))
  } catch (cause) {
    held = {state: 'absent', reason: cause instanceof Error ? cause.message : String(cause)}
  }
  publish(subject.ref, held)
  if (hasScenes(held)) follow(subject.ref, held, subject.title ?? held.opened.scene_title, follower)
  return held
}

/** Open another of the Scenes that carry a subject the door found (the door's `openChosenScene`), and hold it as the one asked for
 * until the stage answers it. Does nothing for a subject the door has not found, or a Scene not among its answer's. */
export function chooseHeldScene(subjectRef: string, scene: SubjectScene, title: string | undefined, choose: typeof openChosenScene = openChosenScene,
  follower: AskFollower = followLiveAsk): boolean {
  const held = openings.get(subjectRef)
  if (!hasScenes(held) || !held.scenes.some(row => row.registerKey === scene.registerKey && row.scene_ref === scene.scene_ref)) return false
  choose(scene, title)
  const asked: SceneOpening = {state: 'asked', opened: scene, scenes: held.scenes}
  publish(subjectRef, asked)
  follow(subjectRef, asked, title ?? scene.scene_title, follower)
  return true
}

/** Forget every answer and end every follow (the tests). */
export function resetSubjectOpenings(): void {
  for (const stop of follows.values()) stop()
  follows.clear()
  openings = new Map()
  for (const listener of [...listeners]) listener()
}
