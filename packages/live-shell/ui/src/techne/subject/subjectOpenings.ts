// What the subject door answered, per subject, for the faces that show it [the ticket N, PATH §7 S1; FOUNDATION §3 N2].
//
// A browser row asks the door (`openWorldSubject`, openSubject.ts) to open its subject; the answer is the owner's own — the Scene its
// reverse query found and the ones that also carry the subject, or the owner's absence words. This module keeps the latest answer
// for each subject so every face reads the same one (the row's standing slot, the Scenes under the row, a detail that lists them),
// as the suite standing is kept for its faces (projections/atlas/provider/suiteStanding.ts): a latest snapshot, subscribe, publish.
// It is a reading, never a second source: nothing here is written but by the door's own two acts, and nothing is made up — a
// subject the door has not been asked about has no entry.
//
// Pure TypeScript apart from the one React hook; no DOM, no transport.

import {useSyncExternalStore} from 'react'
import {openChosenScene, openWorldSubject, type SubjectOpen} from './openSubject'
import type {SubjectScene, WorldSubject} from './subjectScenes'

/** The door's answer for one subject: being asked; asked, with the Scene asked for and every Scene that carries the subject (the
 * asked one among them); or absent, in the owner's words. */
export type SubjectOpening =
  | {readonly state: 'opening'}
  | {readonly state: 'asked'; readonly opened: SubjectScene; readonly scenes: readonly SubjectScene[]}
  | {readonly state: 'absent'; readonly reason: string}

let openings: ReadonlyMap<string, SubjectOpening> = new Map()
const listeners = new Set<() => void>()

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

/** Open a subject through the door and hold its answer. A door that throws (it never should: its absences are answers) is held as an
 * absence in its own words, never swallowed. */
export async function openHeldSubject(subject: WorldSubject, door: (subject: WorldSubject) => Promise<SubjectOpen> = openWorldSubject): Promise<SubjectOpening> {
  publish(subject.ref, {state: 'opening'})
  let held: SubjectOpening
  try {
    held = openingOf(await door(subject))
  } catch (cause) {
    held = {state: 'absent', reason: cause instanceof Error ? cause.message : String(cause)}
  }
  publish(subject.ref, held)
  return held
}

/** Open another of the Scenes that carry an asked subject (the door's `openChosenScene`), and hold it as the one asked for. Does
 * nothing for a subject the door has not asked, or a Scene not among its answer's. */
export function chooseHeldScene(subjectRef: string, scene: SubjectScene, title: string | undefined, choose: typeof openChosenScene = openChosenScene): boolean {
  const held = openings.get(subjectRef)
  if (!held || held.state !== 'asked' || !held.scenes.some(row => row.registerKey === scene.registerKey && row.scene_ref === scene.scene_ref)) return false
  choose(scene, title)
  publish(subjectRef, {...held, opened: scene})
  return true
}

/** Forget every answer (the tests). */
export function resetSubjectOpenings(): void {
  openings = new Map()
  for (const listener of [...listeners]) listener()
}
