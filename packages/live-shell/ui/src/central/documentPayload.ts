/** A Central document's own Highlights, Notes and Packet, read from its payload for the Clip view's columns (manual §5: "Select
 * a passage and the rest is close at hand: highlight it, note it, put it in the packet … The packet is exactly what the agent
 * will read; you see it whole, and how big it is"; world-shell-mockup.html clipDetail() :1663). A pure reading of what the
 * document already holds: it writes nothing, keeps no store, and gives the shell text only — never the payload's html.
 *
 * Two doors bring a payload here, both the owner's:
 * - a document file read through the owner's file route (`readFile`): its `ql-doc` island, found by the document identity's
 *   own reader (desktop/cradle/src/document/identity.ts:131 islandSpan, :116 readDocumentIdentity for its family) and parsed
 *   by the Flow's own parser (desktop/cradle/src/flow/instance.ts:63 parseInstance, which undoes the island's script-safe
 *   escapes) — ported, not rewritten;
 * - the Day document, which the owner reads as `central.document-reading/v1` (`receiving` `document`): its `template_payload`
 *   is the Day die's own payload (desktop/cradle/src/central/dayForm.ts:90 validateDocumentBasis).
 *
 * The payload's shapes are the forms' own (desktop/cradle/documents/):
 * - a Flow marks a passage as a <mark> span in an entry's html (ql-flow.html:1074 act('hl')); its notes are
 *   {entryId, anchor, text} (:1075), or {at, html} in v0.1 files; its packet items {entryId, scope, label, text} (:1076), or
 *   {kind, html} in v0.1 files;
 * - the Day die marks a passage as a <mark> span in a field's html (ql-daily-die.html:649); its notes are {field, anchor, text}
 *   (:650), its packet items {field, label, text} (:651).
 * Html is reduced to text by the Flow's own stripper (flow/instance.ts:81 htmlToText). */

import {FAMILY_LABEL, islandSpan, readDocumentIdentity, type DocumentFamily} from '../../../../../desktop/cradle/src/document/identity'
import {htmlToText, parseInstance} from '../../../../../desktop/cradle/src/flow/instance'

/** How many rows a column shows before it says how many more the payload holds. */
export const PAYLOAD_ROWS = 12

/** A passage the document marks: its words, and where it stands (the entry or the Day field). */
export interface PayloadHighlight {
  /** Short, in the mockup's grammar: "F2" (an entry: its author's initial and its place in the thread), "p3" (a Day face). */
  readonly anchor: string
  /** The form's own name for the place: "entry 2 (F)" (ql-flow.html:891 num()), or the Day field's id. */
  readonly where: string
  readonly text: string
}

export interface PayloadNote {
  /** The entry or face the note stands on; null when the note names none (a v0.1 note). */
  readonly anchor: string | null
  readonly where: string | null
  /** The note's own words, reduced to text ("" when the note is still empty). */
  readonly text: string
  /** The passage the note was made on, as the form kept it (`anchor`), when it kept one. */
  readonly quote: string | null
  readonly at: string | null
}

export interface PayloadPacketItem {
  /** The item's kind as the payload names it: its `kind` (v0.1) or its `scope` ("selection", "whole entry", "journal page"). */
  readonly kind: string | null
  /** Where it came from, as the form labelled it ("entry 2 (F)", "Observations"). */
  readonly source: string | null
  /** Exactly the words the agent would read. */
  readonly text: string
  readonly at: string | null
}

export type DocumentPayloadReading =
  /** The source carries no `ql-doc` island: no payload to read. */
  | {readonly state: 'absent'}
  /** The island is there but does not parse: nothing in it is read. */
  | {readonly state: 'malformed'; readonly reason: string}
  | {
      readonly state: 'read'
      readonly family: DocumentFamily
      /** The family's name for the one-line readings ("Flow", "Day"); "document" when the payload declares none. */
      readonly label: string
      /** The template the payload names (`meta.template`), when it names one. */
      readonly template: string | null
      readonly highlights: readonly PayloadHighlight[]
      readonly notes: readonly PayloadNote[]
      readonly packet: readonly PayloadPacketItem[]
    }

export type PayloadColumn = 'highlights' | 'notes' | 'packet'

const NOUN: Record<PayloadColumn, string> = {highlights: 'highlights', notes: 'notes', packet: 'packet items'}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const said = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const list = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []
const codePoint = (all: string, code: number): string => Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all

/** Plain words folded to one line. */
export const plainLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Html reduced to one line of text: script and style bodies dropped, then the Flow's own stripper (every tag removed, the five
 * XML entities decoded), then the non-breaking spaces and numeric references an editable page leaves, folded to one line. */
export function payloadText(html: string): string {
  return plainLine(htmlToText(html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ''))
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (all, code: string) => codePoint(all, Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (all, code: string) => codePoint(all, parseInt(code, 16))))
}

/** The passages an html body marks: each outermost <mark>…</mark> span reduced to text. A mark inside a mark is one passage;
 * an unclosed mark runs to the end of the body; an empty mark marks nothing. */
export function markedPassages(html: string): string[] {
  const passages: string[] = []
  const keep = (inner: string) => { const text = payloadText(inner); if (text) passages.push(text) }
  let depth = 0
  let start = 0
  for (const tag of html.matchAll(/<(\/?)mark\b[^>]*>/gi)) {
    const at = tag.index ?? 0
    if (!tag[1]) { if (depth++ === 0) start = at + tag[0].length }
    else if (depth > 0 && --depth === 0) keep(html.slice(start, at))
  }
  if (depth > 0) keep(html.slice(start))
  return passages
}

interface Place { readonly anchor: string | null; readonly where: string | null }

/** An entry's place: its author's initial and its place in the thread ("F2", the mockup's "Fz2"), and the Flow's own label for it
 * (ql-flow.html:891 num() with its author: "entry 2 (F)"). */
function entryPlace(entry: Record<string, unknown>, index: number): {anchor: string; where: string} {
  const author = said(entry.author)?.trim() ?? ''
  return {anchor: `${author}${index + 1}`, where: `entry ${index + 1}${author ? ` (${author})` : ''}`}
}

/** A Day field's place: the die's face its id opens with ("p3_observations" → "p3", ql-daily-die.html:342 FIXTURES), and the id. */
function fieldPlace(field: string): {anchor: string; where: string} {
  return {anchor: /^(p\d)_/.exec(field)?.[1] ?? field, where: field}
}

/** Read one parsed payload object. `family` is the identity the payload declares (identity.ts), or the Day's when the owner's
 * Day document reading gave it. */
export function readPayload(doc: unknown, family: DocumentFamily): DocumentPayloadReading {
  const payload = record(doc)
  if (!payload) return {state: 'malformed', reason: 'the payload is not a JSON object'}
  const meta = record(payload.meta) ?? {}
  const highlights: PayloadHighlight[] = []
  const entries = new Map<string, Place>()
  list(payload.entries).forEach((value, index) => {
    const entry = record(value)
    if (!entry) return
    const place = entryPlace(entry, index)
    if (typeof entry.id === 'string') entries.set(entry.id, place)
    if (typeof entry.html === 'string') for (const text of markedPassages(entry.html)) highlights.push({...place, text})
  })
  for (const group of [payload.fields, payload.body]) {
    const fields = record(group)
    if (!fields) continue
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value === 'string') for (const text of markedPassages(value)) highlights.push({...fieldPlace(field), text})
    }
  }
  const placeOf = (item: Record<string, unknown>): Place => {
    if (typeof item.entryId === 'string') return entries.get(item.entryId) ?? {anchor: null, where: `an entry no longer in the payload (${item.entryId})`}
    if (typeof item.field === 'string') return fieldPlace(item.field)
    return {anchor: null, where: null}
  }
  const items = (value: unknown) => list(value).map(record).filter((item): item is Record<string, unknown> => item !== null)
  const notes: PayloadNote[] = items(payload.notes).map(note => {
    const place = placeOf(note)
    const text = typeof note.text === 'string' ? payloadText(note.text) : typeof note.html === 'string' ? payloadText(note.html) : ''
    const quote = said(note.anchor)
    return {anchor: place.anchor, where: place.where, text, quote: quote ? plainLine(quote) : null, at: said(note.at)}
  })
  const packet: PayloadPacketItem[] = items(payload.packet).map(item => {
    const text = typeof item.text === 'string' ? plainLine(item.text) : typeof item.html === 'string' ? payloadText(item.html) : ''
    return {kind: said(item.kind) ?? said(item.scope), source: said(item.label) ?? placeOf(item).where, text, at: said(item.at)}
  })
  return {state: 'read', family, label: FAMILY_LABEL[family] ?? 'document', template: said(meta.template), highlights, notes, packet}
}

/** A document file's payload, from the content the owner's file route read. */
export function readDocumentPayload(source: string): DocumentPayloadReading {
  if (!islandSpan(source, 'ql-doc')) return {state: 'absent'}
  let doc: unknown
  try { doc = parseInstance(source) } catch (error) { return {state: 'malformed', reason: error instanceof Error ? error.message : String(error)} }
  const identity = readDocumentIdentity(source)
  return readPayload(doc, identity?.payload === 'ql-doc' ? identity.family : 'unknown')
}

/** The Day document's payload, from the owner's Day document reading (`template_payload`). */
export const readDayPayload = (templatePayload: unknown): DocumentPayloadReading => readPayload(templatePayload, 'day')

/** A column's rows, bounded: the first `limit`, and how many more the payload holds. */
export function bounded<T>(rows: readonly T[], limit = PAYLOAD_ROWS): {readonly shown: readonly T[]; readonly more: number} {
  return {shown: rows.slice(0, limit), more: Math.max(0, rows.length - limit)}
}

/** The one line a column says when the payload gives it no rows, naming what was read; null when the column has rows to show,
 * or when there is no payload at all (the caller keeps its own line). */
export function payloadLine(reading: DocumentPayloadReading, column: PayloadColumn): string | null {
  if (reading.state === 'absent') return null
  if (reading.state === 'malformed') return `This document's payload does not parse, so its ${NOUN[column]} are not read.`
  if (reading[column].length) return null
  const owner = reading.label.endsWith('s') ? `${reading.label}'` : `${reading.label}'s`
  return `This ${owner} payload holds no ${NOUN[column]}.`
}

/** An item's size: the characters the agent would read. */
export const packetChars = (item: PayloadPacketItem): number => [...item.text].length

/** The Packet column's head: how many items, and how big they are together ("Packet · 3 items · 500 chars"). */
export function packetHead(reading: DocumentPayloadReading): string {
  if (reading.state !== 'read' || !reading.packet.length) return 'Packet'
  const count = reading.packet.length
  const chars = reading.packet.reduce((total, item) => total + packetChars(item), 0)
  return `Packet · ${count} item${count === 1 ? '' : 's'} · ${chars} chars`
}
