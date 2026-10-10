/** Document device model (WORLD-SHELL-DESIGN §5.2) — the pure half of the
 * document face kinds: the save router's named outcomes, their classifier,
 * and the rack-strip reading (identity + basis + save state).
 *
 * The outcomes are the design's five names, carried verbatim; the
 * classifier maps the ACTUAL save-path results onto them:
 * - the Day die path (DayFormSession.save + receiving mutate-field): no
 *   edits staged → unchanged; acknowledged field writes with matching
 *   receipts → saved; the owner's "source changed; review" block → stale;
 *   a missing/contradictory acknowledgement → conflict; an unavailable or
 *   refusing owner → refused.
 * - the Flow path (readFlowInstance + revision-checked CAS write): a write
 *   the owner declines for a moved revision → stale; the owner's conflict
 *   bytes → conflict; anything else that refuses → refused.
 *
 * Pure: no view, no store, no I/O. */

import {SAVE_ROUTER_OUTCOMES, type SaveRouterOutcome} from './manifest.ts'

export {SAVE_ROUTER_OUTCOMES}
export type {SaveRouterOutcome}

/** What the save router knows at the moment the strip renders. */
export interface SaveRouterReading {
  readonly outcome: SaveRouterOutcome
  /** The owner's or classifier's own words for the outcome — disclosed, not prettified. */
  readonly detail?: string
  /** When the outcome was reached (ISO string), absent before any save attempt. */
  readonly at?: string
}

/** Identity + basis + save state — the design's rack strip for a document
 * device: exactly what the strip shows, nothing more. */
export interface DocumentStripReading {
  /** Human name of the document device (the form's label). */
  readonly title: string
  readonly documentId: string
  /** The native basis the body stands on (source ref + revision). */
  readonly sourceRef: string
  readonly revision: string
  /** Whether the body holds edits not yet sent to the owner. */
  readonly dirty: boolean
  /** Whether a save flight is in the air. */
  readonly pending: boolean
  /** The last save-router outcome; undefined before the first attempt. */
  readonly save?: SaveRouterReading
}

const DIRTY_REVIEW = /changed|review|stale|conflict/i
const REFUSED = /unavailable|refus|not ready|retired|withheld|cannot|failed/i

/** Classify the Day die save path's failure words onto the router's names.
 * Success never reaches this function (callers name saved/unchanged
 * directly from the session's own facts). */
export function classifySaveFailure(reason: unknown): SaveRouterReading {
  const detail = String(reason)
  const outcome: SaveRouterOutcome = DIRTY_REVIEW.test(detail) ? 'stale' : REFUSED.test(detail) ? 'refused' : 'conflict'
  return {outcome, detail, at: new Date().toISOString()}
}

/** The strip reading for a save attempt that never left the ground: the
 * session held no edits, so no write was sent. */
export const unchangedOutcome = (): SaveRouterReading => ({outcome: 'unchanged', at: new Date().toISOString()})

/** The strip reading for an acknowledged save: the owner's receipt carried. */
export const savedOutcome = (detail?: string): SaveRouterReading => ({outcome: 'saved', detail, at: new Date().toISOString()})

/** One line for the strip's status slot — the outcome's plain words. Never
 * decorative: a reading names its state or it is absent. */
export function outcomeLabel(reading: SaveRouterReading | undefined): string | null {
  if (!reading) return null
  switch (reading.outcome) {
    case 'saved': return 'saved — native save acknowledged'
    case 'unchanged': return 'unchanged — nothing to send'
    case 'stale': return `stale — the native source moved; review before saving${reading.detail ? ` (${reading.detail})` : ''}`
    case 'conflict': return `conflict — the acknowledgement contradicted the write${reading.detail ? ` (${reading.detail})` : ''}`
    case 'refused': return `refused — ${reading.detail ?? 'the owner declined or is unavailable'}`
  }
}

/** The full strip reading, assembled from the face's live facts. */
export function documentStrip(reading: DocumentStripReading): DocumentStripReading {
  return reading
}
