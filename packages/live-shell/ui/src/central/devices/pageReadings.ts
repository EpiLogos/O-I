// What a Central page holds, read from its own payload for the page family's devices (DLW §17.8 Document, §18.3 Flow, §18.6 Text,
// §18.7 Highlight, §18.8 Notes): the entries and their words, the style of each paragraph and the emphasis and marks on each word,
// the notes, the packet, the journal's pages and the people. Pure: no React, no transport, no store; it writes nothing.
//
// The payload is the owner's, read through the owner's own routes before it reaches here:
//   - a Flow's `ql-doc` island, read through the Flow's file route (flow/instances.ts readFlowInstance, which parses it with
//     flow/instance.ts parseInstance) — the same read the Flow's hosted face makes (inhabitants/DocumentFlowFace.tsx:79);
//   - a Day document's `template_payload` (`receiving` kind:document; central/devices/useCentralReadings.ts useDayDieReading).
// The shapes are the forms' own (desktop/cradle/documents/): an entry keeps its words as html (ql-flow.html clean() keeps tags and
// drops inline style), so a paragraph's style is its block tag (`h2`, `blockquote`, `ul`/`li`), a word's emphasis its inline tags
// (`b`/`strong`, `i`/`em`, `s`/`strike`/`del`) and a highlight a `<mark>` span (ql-flow.html:1074 act('hl')); a note is
// {id, entryId, anchor, author, timing, text, at, replies} (ql-flow.html:1075, :938 — a note with no timing is drawn `during`); a
// packet item is {entryId, scope, label, text} (:1076). Ported from central/documentPayload.ts (markedPassages, entryPlace, the
// html-to-text law) and flow/plural.ts (isCurrentFormat, relationsOf), never rewritten: the readers here only go to the word.
import {participantOf, type QlDoc, type QlDocParticipant} from '../../../../../../desktop/cradle/src/flow/instance'
import {isCurrentFormat, relationsOf, type PluralEntry, type PluralParticipant} from '../../../../../../desktop/cradle/src/flow/plural'
import {payloadText, plainLine} from '../documentPayload'

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const list = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])
const said = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)

// ---------------------------------------------------------------------------------------------------------------- words

/** One word of an entry: its letters, the emphasis it carries (`b`, `i`, `s`, in that order) and whether a `<mark>` covers it. */
export interface PageWord {
  readonly word: string
  readonly flags: string
  readonly marked: boolean
}

export type ParagraphStyle = 'body' | 'head' | 'quote' | 'list'

const ENTITY: Readonly<Record<string, string>> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'"}
const decode = (text: string): string => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (all, name: string) => {
  if (ENTITY[name.toLowerCase()] !== undefined) return ENTITY[name.toLowerCase()]!
  const code = name.startsWith('#x') || name.startsWith('#X') ? parseInt(name.slice(2), 16) : name.startsWith('#') ? Number(name.slice(1)) : NaN
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all
})

const FLAG_OF: Readonly<Record<string, string>> = {b: 'b', strong: 'b', i: 'i', em: 'i', s: 's', strike: 's', del: 's'}
/** Tags that end a word as whitespace does (a block, a line break). */
const BREAKS = /^(p|div|br|li|ul|ol|blockquote|h[1-6]|section|article|pre|hr|tr|td|th)$/
const FLAG_ORDER = ['b', 'i', 's']

/** The words of an html body, each with the emphasis and the mark it stands in — the page's own tags read to the word. Script and
 * style bodies are dropped (documentPayload.ts payloadText's law). A word that runs across a tag is one word, carrying every
 * emphasis any of its letters carries. `limit` bounds the words read (a long entry's start). */
export function wordsOfHtml(html: string, limit = Infinity): PageWord[] {
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
  const open = new Map<string, number>()
  const words: PageWord[] = []
  let letters = '', flags = new Set<string>(), marked = false
  const end = () => {
    if (letters) words.push({word: letters, flags: FLAG_ORDER.filter(flag => flags.has(flag)).join(''), marked})
    letters = ''; flags = new Set(); marked = false
  }
  const active = (flag: string) => (open.get(flag) ?? 0) > 0
  for (const part of body.split(/(<[^>]*>)/)) {
    if (words.length >= limit) break
    if (part.startsWith('<')) {
      const tag = part.match(/^<\s*(\/?)\s*([a-z0-9]+)/i)
      if (!tag) continue
      const closing = tag[1] === '/', name = tag[2]!.toLowerCase()
      if (BREAKS.test(name)) { end(); continue }
      const flag = name === 'mark' ? 'mark' : FLAG_OF[name]
      if (flag) open.set(flag, Math.max(0, (open.get(flag) ?? 0) + (closing ? -1 : 1)))
      continue
    }
    for (const ch of decode(part)) {
      if (/\s/.test(ch)) { end(); if (words.length >= limit) break; continue }
      letters += ch
      for (const flag of FLAG_ORDER) if (active(flag)) flags.add(flag)
      if (active('mark')) marked = true
    }
  }
  end()
  return words.slice(0, limit)
}

/** A paragraph's style: the entry's first block tag — `h1`–`h3` a Head, `blockquote` a Quote, `ul`/`ol`/`li` a List, anything
 * else (a `p`, plain words) Body. */
export function paragraphStyleOf(html: string): ParagraphStyle {
  const first = html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '').match(/<\s*([a-z0-9]+)/i)?.[1]?.toLowerCase()
  if (first === 'blockquote') return 'quote'
  if (first && /^h[1-3]$/.test(first)) return 'head'
  if (first === 'ul' || first === 'ol' || first === 'li') return 'list'
  return 'body'
}

/** An entry's opening words: its first sentence, at most `max` characters. */
export function headOf(text: string, max = 96): string {
  const line = plainLine(text)
  const sentence = line.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? line
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence
}

// ---------------------------------------------------------------------------------------------------------------- time

const two = (n: number) => String(n).padStart(2, '0')
/** An instant as the clock on the page shows it (`17:01`), in this machine's civil time; null for anything that is no instant. */
export function clockOf(at: unknown): string | null {
  if (typeof at !== 'string') return null
  const when = new Date(at)
  return Number.isNaN(when.getTime()) ? null : `${two(when.getHours())}:${two(when.getMinutes())}`
}
/** An instant's civil date in this machine's civil time (`2026-10-03`); null for anything that is no instant. */
export function civilDateOf(at: unknown): string | null {
  if (typeof at !== 'string') return null
  const when = new Date(at)
  return Number.isNaN(when.getTime()) ? null : `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}`
}

// ---------------------------------------------------------------------------------------------------------------- a Flow

export type RelationKind = 'reply' | 'branch' | 'correct' | 'converge'

export interface PageEntry {
  readonly id: string
  /** The entry's number in the thread, from 1 (ql-flow.html num()). */
  readonly n: number
  /** The author's initial (the declared participant's). */
  readonly by: string
  readonly at: string | null
  /** The entry's words, reduced to one line of text. */
  readonly text: string
  readonly style: ParagraphStyle
  /** The relation the entry carries to earlier entries (reply, branch, correct; converge names every entry it draws together), by
   * their numbers; null when it carries none. */
  readonly relation: {readonly type: RelationKind; readonly to: readonly number[]} | null
  /** The sources and artifacts it names (relations of type source and artifact). */
  readonly sources: number
  readonly artifacts: number
  /** The raw html, for the word readers. */
  readonly html: string
}

export interface PagePerson {
  readonly initial: string
  readonly name: string
  readonly kind: 'person' | 'agent'
  /** How the participant is bound: declared or verified by its binding; unknown otherwise. */
  readonly basis: 'declared' | 'verified' | 'unknown'
  readonly left: boolean
  /** The session or agent ref the participant is bound to, when it names one. */
  readonly ref: string | null
}

export interface PageNote {
  readonly id: string
  /** The entry's number, null for a note on the whole document. */
  readonly entry: number | null
  /** The quoted passage, null for a note on the whole entry. */
  readonly anchor: string | null
  readonly text: string
  readonly timing: 'during' | 'after'
  readonly at: string | null
  readonly replies: readonly string[]
}

export interface PagePacketItem {
  /** The entry's number (a Day's face number for a Day field), or null when the item names none. */
  readonly entry: number | null
  /** The scope it was added under (`selection`, `whole entry`, `journal page`), or its label. */
  readonly scope: string
  readonly text: string
}

export interface FlowPage {
  readonly form: 'flow'
  readonly documentId: string | null
  readonly title: string
  /** The template the page names (`ql-dialogue-flow v0.4`). */
  readonly template: string | null
  /** The current form (format v4): relations and participants. */
  readonly plural: boolean
  readonly view: 'dialogue' | 'flow' | 'journal' | null
  /** The page's own revision counter (meta.revision). */
  readonly revision: number | null
  /** The entry the page holds open (meta.current), by number. */
  readonly current: number | null
  readonly people: readonly PagePerson[]
  readonly entries: readonly PageEntry[]
  readonly notes: readonly PageNote[]
  readonly packet: readonly PagePacketItem[]
  /** The journal's pages, each by the instant it was made. */
  readonly journal: readonly {readonly id: string; readonly at: string | null}[]
  readonly media: number
  /** What the island's other keys hold, in a few characters each (`[3]`, `{…}`). */
  readonly island: Readonly<Record<string, string>>
}

const RELATION_KINDS: readonly string[] = ['reply', 'branch', 'correct', 'converge']

/** The people of a Flow: its declared participants; an earlier form that declares none reads its authors as the form itself
 * does (flow/instance.ts participantOf: `F` the person, `H` the agent). */
function peopleOf(doc: QlDoc): PagePerson[] {
  const declared = (doc.meta.participants ?? []) as PluralParticipant[]
  const base: (QlDocParticipant & Partial<PluralParticipant>)[] = declared.length ? declared
    : [...new Set(['F', ...doc.entries.map(entry => entry.author).filter(Boolean)])].map(initial => participantOf(doc, initial))
  const seen = new Set<string>()
  return base.flatMap(person => {
    if (!person.initial || seen.has(person.initial)) return []
    seen.add(person.initial)
    const basis = person.binding?.basis
    return [{initial: person.initial, name: person.name ?? '', kind: person.kind === 'agent' ? 'agent' : 'person',
      basis: basis === 'declared' || basis === 'verified' ? basis : 'unknown', left: !!person.left, ref: person.binding?.ref ?? person.ref ?? null}] as PagePerson[]
  })
}

function islandSummary(doc: Record<string, unknown>, read: ReadonlySet<string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (read.has(key)) continue
    out[key] = Array.isArray(value) ? `[${value.length}]` : value && typeof value === 'object' ? '{…}' : typeof value === 'string' ? JSON.stringify(value.length > 16 ? `${value.slice(0, 15)}…` : value) : String(value)
  }
  return out
}

/** A Flow's page, from its parsed island. */
export function readFlowPage(doc: QlDoc): FlowPage {
  const entries = (doc.entries ?? []) as PluralEntry[]
  const numberOf = new Map(entries.map((entry, index) => [entry.id, index + 1]))
  const pageEntries: PageEntry[] = entries.map((entry, index) => {
    const html = typeof entry.html === 'string' ? entry.html : ''
    const relations = relationsOf(entry)
    const threading = relations.filter(relation => RELATION_KINDS.includes(relation.type) && relation.entryId && numberOf.has(relation.entryId))
    const kind = (threading.find(relation => relation.type === 'converge') ?? threading[0])?.type as RelationKind | undefined
    return {
      id: entry.id, n: index + 1, by: entry.author ?? '', at: typeof entry.at === 'string' ? entry.at : null, text: payloadText(html), style: paragraphStyleOf(html),
      relation: kind ? {type: kind, to: threading.filter(relation => relation.type === kind).map(relation => numberOf.get(relation.entryId!)!)} : null,
      sources: relations.filter(relation => relation.type === 'source').length,
      artifacts: relations.filter(relation => relation.type === 'artifact').length,
      html,
    }
  })
  const notes: PageNote[] = list(doc.notes).map(record).filter((note): note is Record<string, unknown> => note !== null).map((note, index) => ({
    id: said(note.id) ?? `note-${index + 1}`,
    entry: typeof note.entryId === 'string' ? numberOf.get(note.entryId) ?? null : null,
    anchor: said(note.anchor) ? plainLine(String(note.anchor)) : null,
    text: typeof note.text === 'string' ? payloadText(note.text) : typeof note.html === 'string' ? payloadText(note.html) : '',
    timing: note.timing === 'after' ? 'after' : 'during',
    at: said(note.at),
    replies: list(note.replies).map(reply => { const r = record(reply); return r && typeof r.text === 'string' ? payloadText(r.text) : typeof reply === 'string' ? payloadText(reply) : '' }),
  }))
  const packet: PagePacketItem[] = list(doc.packet).map(record).filter((item): item is Record<string, unknown> => item !== null).map(item => ({
    entry: typeof item.entryId === 'string' ? numberOf.get(item.entryId) ?? null : null,
    scope: said(item.scope) ?? said(item.kind) ?? said(item.label) ?? 'item',
    text: typeof item.text === 'string' ? plainLine(item.text) : typeof item.html === 'string' ? payloadText(item.html) : '',
  }))
  const meta = doc.meta ?? ({} as QlDoc['meta'])
  const view = meta.view === 'dialogue' || meta.view === 'flow' || meta.view === 'journal' ? meta.view : null
  return {
    form: 'flow',
    documentId: said(meta.documentId),
    title: typeof meta.title === 'string' ? payloadText(meta.title) : '',
    template: said(meta.template),
    plural: isCurrentFormat(doc),
    view,
    revision: typeof meta.revision === 'number' && Number.isFinite(meta.revision) ? meta.revision : null,
    current: typeof meta.current === 'string' ? numberOf.get(meta.current) ?? null : null,
    people: peopleOf(doc),
    entries: pageEntries,
    notes,
    packet,
    journal: list(doc.journal).map(record).filter((page): page is Record<string, unknown> => page !== null).map((page, index) => ({id: said(page.id) ?? `page-${index + 1}`, at: said(page.at)})),
    media: list(doc.media).length,
    island: islandSummary(doc as unknown as Record<string, unknown>, new Set(['meta', 'entries', 'notes', 'packet', 'journal', 'media'])),
  }
}

// ---------------------------------------------------------------------------------------------------------------- a Day

export interface DayPage {
  readonly form: 'day'
  /** The passages its fields mark. */
  readonly highlights: number
  readonly notes: readonly PageNote[]
  readonly packet: readonly PagePacketItem[]
  readonly island: Readonly<Record<string, string>>
}

/** A Day field's face: the die's face its id opens with (`p3_observations` → 3; ql-daily-die.html FIXTURES). */
export const faceOfField = (field: unknown): number | null => {
  const match = typeof field === 'string' ? /^p(\d)_/.exec(field) : null
  return match ? Number(match[1]) : null
}

/** A Day document's page, from its payload (`template_payload`): the marks in its fields, its notes and its packet. Null when the
 * payload is no object. */
export function readDayPage(payload: unknown): DayPage | null {
  const doc = record(payload)
  if (!doc) return null
  let highlights = 0
  for (const group of [doc.fields, doc.body]) {
    const fields = record(group)
    if (!fields) continue
    for (const value of Object.values(fields)) if (typeof value === 'string') highlights += wordsOfHtml(value).reduce((runs, word, at, all) => runs + (word.marked && !all[at - 1]?.marked ? 1 : 0), 0)
  }
  const items = (value: unknown) => list(value).map(record).filter((item): item is Record<string, unknown> => item !== null)
  return {
    form: 'day',
    highlights,
    notes: items(doc.notes).map((note, index) => ({
      id: said(note.id) ?? `note-${index + 1}`, entry: faceOfField(note.field), anchor: said(note.anchor) ? plainLine(String(note.anchor)) : null,
      text: typeof note.text === 'string' ? payloadText(note.text) : '', timing: note.timing === 'after' ? 'after' : 'during', at: said(note.at), replies: [],
    })),
    packet: items(doc.packet).map(item => ({entry: faceOfField(item.field), scope: said(item.label) ?? said(item.scope) ?? 'item',
      text: typeof item.text === 'string' ? plainLine(item.text) : typeof item.html === 'string' ? payloadText(item.html) : ''})),
    island: islandSummary(doc, new Set(['notes', 'packet'])),
  }
}
