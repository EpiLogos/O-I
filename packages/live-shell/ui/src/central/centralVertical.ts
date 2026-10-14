/** The Central vertical's join (WORLD-SHELL-DESIGN §17.2; DLW-PLAN Phase 3) — pure.
 *
 * One real day is recovered through the Timeline: a selected clip on the day
 * track, the conversation track, or the wiki's Constellation resolves here to
 * the Central material it stands for. Nothing in this module reads the
 * kernel, the wall clock or a store:
 *
 * - the selected clip is the temporal event the ONE encounter spine retained
 *   (`spine.occasion()` → the event in the reading the World cut holds);
 * - each owner reading the detail row draws is named here, with its op, so the
 *   device face can say exactly which owner answered and which did not;
 * - a wiki subject is opened only from a ref the return or the Day names in its
 *   own text (`wiki:node:…`). No slug is guessed, no edge is invented.
 *
 * Pure TypeScript. No React, no transport, no timers. */

import type {TemporalEventRow} from '../timeline/timeSpine'
import {dayTrackLaneOf} from '../timeline/dayTrackAdapter'
import {isConversationSubject} from '../timeline/conversationTrackAdapter'

// ---------------------------------------------------------------------------
// the selected clip's Central identity

/** What a selected temporal event stands for in Central. `day` is a dated
 * day-track moment that is not a return; `return` is a NOW clearing or a wiki
 * return; `conversation` is a session-space receipt; `other` is anything the
 * vertical does not own (named in the detail, never opened as a Day). */
export type CentralClipKind = 'day' | 'return' | 'conversation' | 'other'
export type CentralReturnKind = 'now' | 'wiki-return'

export interface CentralClipSelection {
  readonly kind: CentralClipKind
  readonly returnKind: CentralReturnKind | null
  /** The event's subject ref — the identity the spine retains and the
   * projection draws. The detail row and the projection share this value. */
  readonly subjectRef: string
  readonly stream: string | null
  readonly summary: string | null
  readonly instantUnixMs: number | null
  /** The civil day the event stands in (`central:day:<scope>:<date>`), when dated. */
  readonly dayRef: string | null
  /** The `YYYY-MM-DD` of `dayRef` — the projection's day column key. */
  readonly civilDate: string | null
  readonly evidenceRefs: readonly string[]
}

/** The civil date a day ref names (`central:day:control:root:2026-10-08` → `2026-10-08`). */
export function civilDateOfDayRef(dayRef: string | null | undefined): string | null {
  const match = dayRef?.match(/(\d{4}-\d{2}-\d{2})$/)
  return match ? match[1] : null
}

/** Classify one temporal event the reading gives. The lane is the day
 * track's own lane (`dayTrackLaneOf`) — the same streams the projection draws. */
export function classifyCentralEvent(event: TemporalEventRow): CentralClipSelection {
  const dayRef = event.day_ref ?? null
  const civilDate = civilDateOfDayRef(dayRef)
  const base = {
    subjectRef: event.subject_ref,
    stream: event.stream ?? null,
    summary: event.summary ?? null,
    instantUnixMs: event.instant_unix_ms ?? null,
    dayRef,
    civilDate,
    evidenceRefs: [...(event.evidence_refs ?? [])],
  }
  if (isConversationSubject(event.subject_ref)) return {...base, kind: 'conversation', returnKind: null}
  if (event.stream === 'central-now') return {...base, kind: 'return', returnKind: 'now'}
  if (event.stream === 'wiki-returns') return {...base, kind: 'return', returnKind: 'wiki-return'}
  if (dayTrackLaneOf(event) && civilDate) return {...base, kind: 'day', returnKind: null}
  return {...base, kind: 'other', returnKind: null}
}

/** The Base detail row's one selection. A browser subject (the Days/Files
 * rows) stands while it is set; otherwise the encounter's retained occasion
 * (the spine's, a Timeline clip) names the Central material. The occasion's
 * event is looked up in the reading the World cut already holds — nothing is
 * copied into a second store. */
export type CentralOccasionResolution =
  | {readonly state: 'none'}
  | {readonly state: 'absent'; readonly ref: string}
  | {readonly state: 'selected'; readonly selection: CentralClipSelection}

export function resolveCentralOccasion(
  occasion: {readonly basis: {readonly ref: string; readonly instantUnixMs: number | null}} | null,
  events: readonly TemporalEventRow[],
): CentralOccasionResolution {
  if (!occasion) return {state: 'none'}
  const {ref, instantUnixMs} = occasion.basis
  const event = events.find((item) => item.subject_ref === ref && (item.instant_unix_ms ?? null) === instantUnixMs)
    ?? events.find((item) => item.subject_ref === ref)
  if (!event) return {state: 'absent', ref}
  return {state: 'selected', selection: classifyCentralEvent(event)}
}

// ---------------------------------------------------------------------------
// the Day document — the owner's `central` open-day reading

/** The Day document's standing for one civil day. Each non-ready state names
 * the owner's own words; `uninitialised` names the owner op that would admit
 * the Day document (the explicit native initialisation path). */
export type DayDocumentStanding =
  | {state: 'ready'; dayRef: string; civilDate: string; sourceRef: string; documentId: string; revision: string}
  | {state: 'uninitialised'; dayRef: string; civilDate: string; owner: string; op: string; remedy: string; message: string}
  | {state: 'refused'; dayRef: string; civilDate: string; message: string}

export const DAY_OWNER = 'Central (root register)'
export const DAY_INITIALISE_OP = 'central · initialise-day'
export const DAY_INITIALISE_REMEDY = 'The owner\'s explicit native initialisation writes the Day document from the retained form (expected revisions and the policy revision are its own). The Day die docks here once the document exists.'

/** The request the Day document device sends for one day (the `central` op). */
export function dayOpenRequest(dayRef: string): {kind: 'open-day'; day_ref: string} {
  return {kind: 'open-day', day_ref: dayRef}
}

/** Interpret the owner's answer to `open-day`. The kernel refuses an
 * uninitialised Day with its own sentence; that sentence is the state, never
 * an error to hide. Anything else the owner refuses stays refused, verbatim. */
export function interpretDayOpen(dayRef: string, answer: {data?: unknown; error?: string | null}): DayDocumentStanding {
  const civilDate = civilDateOfDayRef(dayRef) ?? dayRef
  if (answer.error) {
    if (/no native document yet/i.test(answer.error)) {
      return {state: 'uninitialised', dayRef, civilDate, owner: DAY_OWNER, op: DAY_INITIALISE_OP, remedy: DAY_INITIALISE_REMEDY, message: answer.error}
    }
    return {state: 'refused', dayRef, civilDate, message: answer.error}
  }
  const data = answer.data as {day?: {document_state?: unknown; source?: {ref?: unknown}; document?: {document_id?: unknown}; revision?: {revision?: unknown}}} | undefined
  const day = data?.day
  const sourceRef = day?.source?.ref
  const documentId = day?.document?.document_id
  const revision = day?.revision?.revision
  if (day?.document_state === 'ready' && typeof sourceRef === 'string' && typeof documentId === 'string' && typeof revision === 'string') {
    return {state: 'ready', dayRef, civilDate, sourceRef, documentId, revision}
  }
  return {state: 'refused', dayRef, civilDate, message: 'The owner answered the Day without a ready document identity; nothing is drawn for it.'}
}

// ---------------------------------------------------------------------------
// the NOW return — the owner's `central.now-reading/v1`

export interface NowReturnFacts {
  readonly nowRef: string
  readonly purpose: string
  readonly lifecycle: string | null
  readonly createdUnixSeconds: number | null
  readonly taskRef: string | null
  readonly sourceRefs: readonly string[]
  readonly returns: readonly {returnRef: string; status: string; settled: boolean}[]
  /** Basis the owner disclosed for the clearing's source (ref + CAS revision). */
  readonly source: {ref: string; path: string} | null
  readonly revision: string | null
  readonly namedWikiRefs: readonly string[]
}

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** Read the facts the return's detail draws from the owner's NOW reading. Only
 * what the record discloses is returned; a missing field stays null. */
export function nowReturnFacts(reading: unknown, nowRef: string): NowReturnFacts | null {
  if (!reading || typeof reading !== 'object') return null
  const value = reading as {record?: Record<string, unknown>; returns?: unknown; source?: {ref?: unknown; path?: unknown}; revision?: {revision?: unknown}}
  const record = value.record
  if (!record || record.now_ref !== nowRef) return null
  const returns = Array.isArray(value.returns)
    ? value.returns.flatMap((entry) => {
        const row = entry as {return_ref?: unknown; status?: unknown; settled?: unknown}
        return typeof row.return_ref === 'string' ? [{returnRef: row.return_ref, status: str(row.status) ?? '', settled: row.settled === true}] : []
      })
    : []
  const sourceRefs = Array.isArray(record.source_refs) ? record.source_refs.filter((ref): ref is string => typeof ref === 'string') : []
  const source = value.source && typeof value.source.ref === 'string' && typeof value.source.path === 'string'
    ? {ref: value.source.ref, path: value.source.path} : null
  return {
    nowRef,
    purpose: str(record.purpose) ?? '',
    lifecycle: str(record.lifecycle),
    createdUnixSeconds: typeof record.created_at_unix_seconds === 'number' ? record.created_at_unix_seconds : null,
    taskRef: str(record.task_ref),
    sourceRefs,
    returns,
    source,
    revision: str(value.revision?.revision),
    namedWikiRefs: namedWikiSubjects(JSON.stringify(record)),
  }
}

// ---------------------------------------------------------------------------
// the wiki subjects a return or a Day names

const WIKI_NODE_REF = /wiki:node:[A-Za-z0-9_\-/]*[A-Za-z0-9_\-]/g

/** The wiki node refs a text names, in order, once each. Only refs spelled
 * `wiki:node:<slug>` count — prose is never matched to a node. */
export function namedWikiSubjects(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(WIKI_NODE_REF)) {
    if (!found.includes(match[0])) found.push(match[0])
  }
  return found
}

/** The Constellation's open request for one wiki subject (the wiki address
 * the knowledge panel admits: `oi:epi-open-knowledge`, plane graph). */
export function constellationRequest(subjectRef: string, title: string): {title: string; address: {kind: 'wiki'; value: string}; plane: 'graph'} {
  return {title, address: {kind: 'wiki', value: subjectRef}, plane: 'graph'}
}

// ---------------------------------------------------------------------------
// the conversation — the Nara binding's owner gap

/** A conversation clip names its session space. The Nara binding keys on an
 * expression; no owner read in this tree returns that expression for a space,
 * so the face names the gap rather than guessing one. */
export const CONVERSATION_BINDING_GAP = {
  owner: 'AIKit · session-space',
  op: 'a session-space read that returns the attachment provenance (expression_ref)',
  remedy: 'the space\'s attachment provenance already holds the expression ref (nara_dialogue.rs); the read must return it to the desktop',
} as const

export function conversationGap(spaceRef: string): string {
  return `The conversation ${spaceRef} stands in the temporal reading. Its Nara binding keys on an expression, and the reading gives only the space: ${CONVERSATION_BINDING_GAP.owner} owes ${CONVERSATION_BINDING_GAP.op}; ${CONVERSATION_BINDING_GAP.remedy}.`
}

/** The root and path a `central:path:<root>:<path>` ref names — read from the
 * ref itself (the owner's own location grammar), never inferred from a name. */
export function parseCentralPathRef(ref: string): {root: string; path: string} | null {
  const match = ref.match(/^central:path:([^:]+):(.+)$/)
  return match ? {root: match[1], path: match[2]} : null
}
