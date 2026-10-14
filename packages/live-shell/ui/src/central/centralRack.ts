/** The Base Devices chain's apertures (WORLD-SHELL-DESIGN §5, §17.2) — pure.
 *
 * The rack docks a Day die only with a `day` aperture (`sourceRef`, `documentId`)
 * and a conversation only with a `conversation` aperture. Both come from the same
 * selection the Document row shows (`resolveCentralOccasion`), through the same
 * owner read (`open-day`). A Day with no ready document gives no aperture: the
 * owner's state is named above the rack instead, never drawn as a die. */

import type {CentralClipSelection, DayDocumentStanding} from './centralVertical'

export interface CentralRackApertures {
  readonly day?: {readonly project: string | null; readonly sourceRef: string; readonly documentId: string}
  readonly conversation?: {readonly project: string | null; readonly expressionRef: string | null; readonly conversation: string}
  /** The owner's non-ready Day standing, named above the rack. */
  readonly dayNotice?: Exclude<DayDocumentStanding, {state: 'ready'}>
}

export function centralRackApertures(selection: CentralClipSelection | null, standing: DayDocumentStanding | null): CentralRackApertures {
  if (!selection) return {}
  if (selection.kind === 'conversation') {
    // The binding keys on an expression no owner read discloses for a space (OPEN 3): null, named by the face.
    return {conversation: {project: null, expressionRef: null, conversation: selection.subjectRef}}
  }
  const dayed = selection.kind === 'day' || selection.kind === 'return'
  if (!dayed || !selection.dayRef || !standing) return {}
  if (standing.state === 'ready') return {day: {project: null, sourceRef: standing.sourceRef, documentId: standing.documentId}}
  return {dayNotice: standing}
}
