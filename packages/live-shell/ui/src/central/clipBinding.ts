// Central's clip binding (manual §18.1 Clip view; §16.5's table: "Central — A page — Page and Source; a Flow's Dialogue, Flow and
// Journal — None — None"; lock §0.3.4: Text, Highlight and Notes are a page's tools in Clip view; Flow, Beings and Things are a
// page's Clip panel and editor tabs). The page THE selection opens, on the owners the replaced bodies read, mapped onto the keys of
// the designed clip `clip:central` (inhabitants/catalogue/clips/central.tsx). It replaces central/CentralClipChooser.tsx and
// central/CentralClipDetail.tsx (the page as data rows and columns). Ported from:
//   - the selection: a browser subject (the Days and Files rows) or the spine's retained occasion (a Timeline clip), one at a time
//     (CentralClipChooser.tsx; central/centralVertical.ts resolveCentralOccasion);
//   - a browser subject's file through the owner's file route (CentralClipDetail.tsx useSubjectReading: `readFile`,
//     `central.file-reading/v1`, CAS-revised; a folder through `listFiles`): a Flow's `ql-doc` island read by the page family's own
//     reader (central/devices/pageReadings.ts readFlowPage over flow/instance.ts parseInstance), an oi.page/v1 island (a Being, a
//     Thing: central/devices/pageBindings.ts pageValues' reads), any other file's own text;
//   - a Day clip: the owner's open-day and its Day document's payload (CentralClipDetail.tsx DayClip, useDayDocumentPayload);
//   - a NOW return (`central.now-reading/v1`), a wiki return (its own file), a conversation (CentralClipDetail.tsx);
//   - the page in a pane, where the hand reached it (central/documents/documentDoor.ts): its save router outcome.
// A page is placed, not launched: no Launch tab (Live cap 47). A page's own fields — its title and colour, a Being's or Thing's
// ties and appearance, a Flow's container, how it opens, and the highlights and notes the passage acts make — are written through the
// page owner (kernel/src/page.rs, T-WORLDS W2), each on the revision read, and read again after; a pane holding the page with unsaved
// edits refuses first. What no owner takes still refuses in the page family's own words (pageBindings.ts). Pure apart from the
// reading hooks at the end.
import {useEffect, useState} from 'react'
import {nowReading} from '../../../../../desktop/cradle/src/receiving/now'
import {receiving} from '../../../../../desktop/cradle/src/receiving/client'
import {validateDocumentBasis} from '../../../../../desktop/cradle/src/central/dayForm'
import {islandSpan} from '../../../../../desktop/cradle/src/document/identity'
import {listFiles, readFile} from '../../../../../desktop/cradle/src/files/client'
import {parseInstance, type QlDoc} from '../../../../../desktop/cradle/src/flow/instance'
import {circleHolder, containerOf, ENTRY_KINDS} from '../../../../../desktop/cradle/src/flow/plural'
import {currentIdentity} from '../../../../../desktop/cradle/src/nara/identity/current'
import {ANSWER_NO_EXPRESSION, ANSWER_NO_IDENTITY, answerThis} from '../../../../../desktop/cradle/src/nara/answerThis'
import {useHostedChrome} from '../projections/expressionsPaneHost'
import {useBeingSky} from '../inhabitants/ql/devices/beingSky'
import type {CentralLocation, KernelTransportStatus, NativeDirectory, PageField} from '../../../../../desktop/cradle/src/kernel/types'
import {writePageField} from '../../../../../desktop/cradle/src/personal/pageOwner'
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, clipHostId, useViewHoldsVersion, viewHoldsOf, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {madeOfValues, withMadeOf, type ClipSource} from '../frame/detail/clipSource'
import {MADE_OF} from '../inhabitants/catalogue/clips/design'
import {useConstellations, type Constellation} from '../owners/constellations'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {casShort} from '../inhabitants/centralDayNowModel'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {conversationGap, nowReturnFacts, parseCentralPathRef, resolveCentralOccasion, type CentralClipSelection, type NowReturnFacts} from './centralVertical'
import {FLOW_WIRING, HIGHLIGHT_WIRING, NOTES_WIRING, BEINGS_WIRING, TEXT_WIRING} from './devices/pageBindings'
import {faceOfField, readFlowPage, wordsOfHtml, type FlowPage} from './devices/pageReadings'
import {useReachedDocument, type DocumentInPane} from './documents/documentDoor'
import {useCentralDayStanding} from './useCentralDayStanding'
import {useCentralGroundAnswer} from './devices/useCentralReadings'
import {currentDayOf} from './devices/dayBinding'
import {MAIN_TRACK_REF} from '../frame/tracks/SessionGrid'
import {CENTRAL_DAY_TRACK_ID} from '../timeline/centralTrackAdapter'
import {subjectWords} from './daySurface'

const READ_PREVIEW_CHARS = 4000
const basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path

// ---------------------------------------------------------------------------------------------------------------- the page as paragraphs

/** One paragraph of the design's page (clips/central.tsx Para). */
export interface Para {readonly id: string; readonly kind: 'h1' | 'intro' | 'h2' | 'p' | 'quote'; readonly parts: readonly {readonly text: string; readonly mark?: string}[]}

/** A page's own text as paragraphs: blank lines part them; `#` heads the page, `##`/`###` head a section, `>` quotes; `==words==`
 * is a marked passage (the Being fixture's own marking; Central's day.md keeps the same). A reduction of the owner's text, adding
 * nothing: the words are the page's, in its order. Pure. */
export function pageOfText(text: string, limit = 80): Para[] {
  const blocks = text.replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '').split(/\n{2,}/).map(block => block.trim()).filter(Boolean).slice(0, limit)
  return blocks.map((block, i) => {
    const kind: Para['kind'] = /^#\s/.test(block) ? 'h1' : /^#{2,6}\s/.test(block) ? 'h2' : /^>\s?/.test(block) ? 'quote' : 'p'
    const body = block.replace(/^#{1,6}\s+/, '').replace(/^>\s?/gm, '').replace(/\s*\n\s*/g, ' ')
    const parts = body.split(/(==[^=]+==)/).filter(Boolean).map(part => part.startsWith('==') && part.endsWith('==') ? {text: part.slice(2, -2), mark: 'yellow'} : {text: part})
    return {id: `b${i + 1}`, kind, parts}
  })
}

/** An html field as one paragraph's parts: its words, with the runs a `<mark>` covers marked (pageReadings.ts wordsOfHtml). Pure. */
export function partsOfHtml(html: string): Para['parts'] {
  const parts: {text: string; mark?: string}[] = []
  for (const word of wordsOfHtml(html)) {
    const last = parts[parts.length - 1]
    if (last && !!last.mark === word.marked) last.text += ` ${word.word}`
    else parts.push({text: parts.length ? ` ${word.word}` : word.word, ...(word.marked ? {mark: 'yellow'} : {})})
  }
  return parts
}

// ---------------------------------------------------------------------------------------------------------------- the page's readings

const RELATION_WORD: Readonly<Record<string, string>> = {reply: 'Reply', branch: 'Branch', converge: 'Converge', correct: 'Correct'}

/** A Flow's readings: its participants, its entries (each with its relation and its depth in the thread) and its notes. Pure. */
export function flowValues(page: FlowPage): Values {
  const values: Record<string, Value> = {kind: 'flow', name: page.title}
  if (page.template) values.template = page.template
  const nameOf = (initial: string) => page.people.find(person => person.initial === initial)?.name || initial
  values.participants = JSON.stringify(page.people.filter(person => !person.left).map(person => ({name: person.name || person.initial, initial: person.initial, kind: person.kind,
    ...(person.ref && person.kind === 'agent' ? {session: person.ref} : {})})))
  const depth = new Map<number, number>()
  values.entries = JSON.stringify(page.entries.map(entry => {
    const to = entry.relation?.to[0]
    const d = to === undefined ? 0 : Math.min(2, (depth.get(to) ?? 0) + 1)
    depth.set(entry.n, d)
    return {id: entry.id, who: nameOf(entry.by), ...(entry.relation ? {rel: RELATION_WORD[entry.relation.type] ?? entry.relation.type} : {}), depth: d, text: entry.text}
  }))
  values.notes = JSON.stringify(page.notes.map(note => ({id: note.id, anchor: `${note.entry !== null ? `entry ${note.entry}` : 'the page'}${note.anchor ? ` · "${note.anchor}"` : ''}`,
    text: note.text, timing: note.timing})))
  // The template's one marker colour (HIGHLIGHT_WIRING reads it so: ql-flow.html --hl).
  values['hl.colour'] = 'yellow'
  return values
}

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** An oi.page/v1 page's readings (pageBindings.ts pageValues reads the same fields): its form, title, template, ties, appearance and
 * its page — title, line of introduction, opening, numbered sections. Null when the island is no oi.page/v1 page. Pure. */
export function pageIslandValues(doc: unknown): Values | null {
  const page = record(doc)
  if (!page || page.profile !== 'oi.page/v1') return null
  const meta = record(page.meta) ?? {}, bindings = record(page.bindings) ?? {}, appearance = record(page.appearance) ?? {}, body = record(page.page) ?? {}
  const family = text(meta.family)
  const values: Record<string, Value> = {kind: family === 'beings' ? 'being' : family === 'things' ? 'thing' : family ?? 'page'}
  const title = text(meta.title)
  if (title !== null) values.name = title
  const template = text(meta.template), version = text(meta.templateVersion)
  if (template) values.template = `${template.replace(/^oi\.template\//, '').replace(/^./, c => c.toUpperCase())}${version ? ` @ ${version}` : ''}`
  for (const [key, from] of [['world', bindings.worldRef], ['subject', bindings.subjectRef], ['expression', bindings.expressionRef]] as const) if (typeof from === 'string' && from) values[key] = from
  if (family === 'beings' && (bindings.kind === 'person' || bindings.kind === 'agent')) values.being = bindings.kind
  Object.assign(values, ownValues(meta))
  // The constellation the page was made of (manual §18.1 The Clip panel: "The one the page was made of … The page's source"): its ref,
  // as the page's island keeps it from its first write (flow/createInPlace.ts tieMadeOf).
  if (typeof bindings.constellationRef === 'string' && bindings.constellationRef) values[MADE_OF.ref] = bindings.constellationRef
  if (Array.isArray(bindings.categories)) values.office = [1, 2, 3, 4].filter(n => (bindings.categories as unknown[]).includes(`C${n}`)).join(',')
  if (Array.isArray(bindings.sources)) values.sources = JSON.stringify(bindings.sources.map(record).filter((s): s is Record<string, unknown> => s !== null)
    .map(source => `${text(source.ref) ?? ''}${text(source.revision) ? ` @ ${text(source.revision)}` : ''}`))
  if (appearance.layout === 'portrait' || appearance.layout === 'editorial') values.layout = appearance.layout
  if (appearance.tone === 'paper' || appearance.tone === 'ink') values.tone = appearance.tone
  const paras: Para[] = []
  const marks = Array.isArray(page.highlights) ? page.highlights.map(record).filter((m): m is Record<string, unknown> => m !== null) : []
  const marked = (id: string, words: string): Para['parts'] => markedParts(words, marks.filter(m => m.part === id))
  if (title) paras.push({id: 'title', kind: 'h1', parts: marked('title', title)})
  const subtitle = text(body.subtitle), introduction = text(body.introduction)
  if (subtitle) paras.push({id: 'subtitle', kind: 'intro', parts: marked('subtitle', subtitle)})
  if (introduction) paras.push({id: 'introduction', kind: 'p', parts: marked('introduction', introduction)})
  if (Array.isArray(body.sections)) body.sections.map(record).filter((s): s is Record<string, unknown> => s !== null).forEach((section, i) => {
    const id = text(section.id) ?? `section-${i + 1}`
    paras.push({id: `${id}:h`, kind: 'h2', parts: [{text: `${i + 1}. ${text(section.heading) ?? ''}`}]})
    if (text(section.text)) paras.push({id, kind: 'p', parts: marked(id, text(section.text)!)})
  })
  values.page = JSON.stringify(paras)
  return values
}

/** A page's own colour and how it opens, from its meta (kernel/src/page.rs writes `colour`, `launch`, a Flow's `container`). Pure. */
function ownValues(meta: Record<string, unknown>): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (typeof meta.colour === 'string' && meta.colour) values.colour = meta.colour
  if (typeof meta.container === 'string' && meta.container) values.container = meta.container
  // A Flow keeps the constellation it was made of in its meta (flow/createInPlace.ts tieMadeOf).
  if (typeof meta.constellation === 'string' && meta.constellation) values[MADE_OF.ref] = meta.constellation
  const launch = record(meta.launch) ?? {}
  if (typeof launch.opensAs === 'string') values.opensAs = launch.opensAs
  if (typeof launch.opensIn === 'string') values.opensIn = launch.opensIn
  if (typeof launch.seats === 'boolean') values.seats = launch.seats
  return values
}

/** A part's words with its highlights marked: a highlight with no passage marks the whole part, one with a passage its first run. */
function markedParts(words: string, marks: readonly Record<string, unknown>[]): Para['parts'] {
  const whole = marks.find(m => m.passage === null || m.passage === undefined)
  if (whole) return [{text: words, mark: text(whole.colour) ?? 'yellow'}]
  let parts: {text: string; mark?: string}[] = [{text: words}]
  for (const mark of marks) {
    const passage = text(mark.passage)
    if (!passage) continue
    parts = parts.flatMap(part => {
      const at = part.mark ? -1 : part.text.indexOf(passage)
      if (at < 0) return [part]
      return [...(at ? [{text: part.text.slice(0, at)}] : []), {text: passage, mark: text(mark.colour) ?? 'yellow'},
        ...(at + passage.length < part.text.length ? [{text: part.text.slice(at + passage.length)}] : [])]
    })
  }
  return parts
}

/** A Day document's payload as a page (its fields, each a section of the page; their marks) and its notes. Pure. */
export function dayPayloadValues(payload: unknown): Values {
  const doc = record(payload)
  if (!doc) return {}
  const values: Record<string, Value> = {}
  const meta = record(doc.meta)
  if (meta && text(meta.template)) values.template = text(meta.template)!
  const paras: Para[] = []
  for (const group of [doc.fields, doc.body]) {
    const fields = record(group)
    if (!fields) continue
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value !== 'string' || !value.trim()) continue
      const face = faceOfField(field)
      paras.push({id: `${field}:h`, kind: 'h2', parts: [{text: face !== null ? `Face ${face} · ${field.replace(/^p\d_/, '').replace(/_/g, ' ')}` : field}]})
      paras.push({id: field, kind: 'p', parts: partsOfHtml(value)})
    }
  }
  if (paras.length) values.page = JSON.stringify(paras)
  if (Array.isArray(doc.notes)) values.notes = JSON.stringify(doc.notes.map(record).filter((n): n is Record<string, unknown> => n !== null)
    .map((note, i) => ({id: text(note.id) ?? `note-${i + 1}`, anchor: `${text(note.field) ?? 'the Day'}${text(note.anchor) ? ` · "${text(note.anchor)}"` : ''}`,
      text: text(note.text) ?? '', timing: note.timing === 'after' ? 'after' : 'during'})))
  return values
}

/** A Flow's entries with the kind each says it is, in a container (manual §24.5; flow/plural.ts PluralEntry.kind): the design draws it
 * beside the author. Pure. */
function withEntryKinds(values: Values, doc: unknown): Values {
  const kinds = new Map((Array.isArray(record(doc)?.entries) ? record(doc)!.entries as unknown[] : []).map(record)
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry.id === 'string' && ENTRY_KINDS.includes(String(entry.kind)))
    .map(entry => [entry.id as string, entry.kind as string]))
  if (!kinds.size || typeof values.entries !== 'string') return values
  const entries = (JSON.parse(values.entries) as {id: string}[]).map(entry => kinds.has(entry.id) ? {...entry, kind: kinds.get(entry.id)} : entry)
  return {...values, entries: JSON.stringify(entries)}
}

/** A file's own content as the page's readings — a Flow, an oi.page page, or its own text — with the island they were read from (the
 * passage acts read it to know what is marked). Pure. */
export function fileReading(content: string, fallbackKind: string): {values: Values; island: unknown} {
  if (islandSpan(content, 'ql-doc')) {
    let doc: unknown = null
    try { doc = parseInstance(content) } catch { doc = null }
    const page = pageIslandValues(doc)
    if (page) return {values: page, island: doc}
    if (doc && Array.isArray((doc as QlDoc).entries)) return {values: withEntryKinds({...flowValues(readFlowPage(doc as QlDoc)), ...ownValues(record((doc as QlDoc).meta) ?? {})}, doc), island: doc}
  }
  return {values: {kind: fallbackKind, page: JSON.stringify(pageOfText(content)), source: content.length > READ_PREVIEW_CHARS ? `${content.slice(0, READ_PREVIEW_CHARS)}…` : content}, island: null}
}

/** A file's own content as the page's readings: a Flow, an oi.page page, or its own text. Pure. */
export const fileValues = (content: string, fallbackKind: string): Values => fileReading(content, fallbackKind).values

// ---------------------------------------------------------------------------------------------------------------- the wiring

/** clip:central's wiring before its source: every key the design draws or sets, in the page family's own words. */
const PAGE_WIRING: ClipWiring = {
  reads: {
    name: 'the page\'s title: a Flow\'s meta.title, an oi.page meta.title, else the file\'s or the clip\'s own name', colour: 'the page\'s own colour (meta.colour), else its track\'s colour (the tracks pane)',
    kind: 'the page\'s form: Flow, Being, Thing, Day, or the file\'s kind', template: 'the template the page names, at its version', revision: 'the owner\'s CAS revision of the bytes',
    save: 'the save router\'s outcome, where the page stands reached in a pane', page: 'the page\'s own text, as paragraphs', source: 'the page\'s source text',
    notes: 'the page\'s notes', participants: 'a Flow\'s participants', entries: 'a Flow\'s entries, their relations and depth', world: 'bindings.worldRef', subject: 'bindings.subjectRef',
    office: 'bindings.categories (C1–C4)', sources: 'bindings.sources, each at its revision', expression: 'bindings.expressionRef', layout: 'appearance.layout', tone: 'appearance.tone',
    'hl.colour': 'the Flow template\'s one marker colour',
    sky: 'a Being\'s birth sky: its Subject\'s saved identity\'s own natal chart, read through nara_identity (inhabitants/ql/devices/beingSky.ts)',
    identity: 'a Being\'s identity layers, each with its source or absent with its reason (nara_identity open)',
  },
  acts: {},
  view: {
    selected: 'the paragraph or entry the selection stands in, in Clip view', speakAs: 'who writes the next entry (FLOW_WIRING local: speaker)',
    relation: 'how the next entry connects (FLOW_WIRING local)', journalPage: 'the journal page Clip view shows (FLOW_WIRING local: page)',
    entryKind: 'what the next entry is, in a container: observe, interpret or choose (written with the entry, flow/plural.ts)',
    'notes.order': 'the order of the list of notes (NOTES_WIRING local)',
  },
  refused: {
    name: 'Only a Flow keeps a title of its own, in its file: a Day\'s heading is its date, and another page\'s name is its file\'s.', colour: 'A page takes its world\'s colour: no owner operation sets a page\'s own colour yet.',
    'text.style': TEXT_WIRING.refused.styles!, 'text.emphasis': TEXT_WIRING.refused.marks!, 'text.size': TEXT_WIRING.refused.size!,
    'hl.colour': HIGHLIGHT_WIRING.refused.colour!, 'hl.show': HIGHLIGHT_WIRING.refused.show!, 'hl.pen': HIGHLIGHT_WIRING.refused.pen!, 'hl.tool': HIGHLIGHT_WIRING.refused.tool!,
    'act.highlight': HIGHLIGHT_WIRING.refused.marks!, 'act.note': HIGHLIGHT_WIRING.refused.note!, 'act.topacket': HIGHLIGHT_WIRING.refused.toPacket!,
    'act.answerthis': HIGHLIGHT_WIRING.refused.answer!,
    'notes.timing': NOTES_WIRING.refused.timing!, 'notes.anchor': NOTES_WIRING.refused.anchor!, 'notes.show': NOTES_WIRING.refused.show!,
    being: BEINGS_WIRING.refused.kind!, office: BEINGS_WIRING.refused.o1!, layout: BEINGS_WIRING.refused.layout!, tone: BEINGS_WIRING.refused.ground!,
    addParticipant: FLOW_WIRING.refused['in:<agent>']!, media: 'Media joins an entry on the page itself: the hosted form is the page\'s one writer while it holds the page (DocumentFlowFace.tsx).',
    // Launch and the container (manual §18.1, §24.5; T-WORLDS W2): the page owner op keeps them once it exists.
    opensAs: 'No owner keeps how a page opens yet: the page owner op carries it (T-WORLDS W2).', opensIn: 'No owner keeps where a page opens yet (T-WORLDS W2).',
    seats: 'No owner reseats a Flow\'s people and agents yet (T-WORLDS W2).', container: 'A Flow\'s form keeps no container yet: meta.container joins the flow form (T-WORLDS W2, W4).',
  },
  absent: {
    being: BEINGS_WIRING.absent.kind!, place: BEINGS_WIRING.absent.place!, anchor: BEINGS_WIRING.absent.anchor!, 'text.style': 'The page\'s selection does not cross the host bridge.',
    'text.emphasis': 'not read', 'text.size': TEXT_WIRING.absent.size!, 'hl.show': HIGHLIGHT_WIRING.absent.show!, 'hl.pen': HIGHLIGHT_WIRING.absent.pen!, 'hl.tool': HIGHLIGHT_WIRING.absent.tool!,
    'notes.timing': NOTES_WIRING.absent.timing!, 'notes.anchor': NOTES_WIRING.absent.anchor!, 'notes.show': NOTES_WIRING.absent.show!,
    journalPages: 'The Journal\'s dated pages are not read from the Flow\'s journal[] yet (T-WORLDS W2).',
    open: 'No NOW clearing is tied to a page yet: launching a page allocates one (T-WORLDS W2).',
    stop: 'A page is a stop on no walk until it joins the atlas as an occurrence (T-WORLDS W2).',
  },
}

/** Where the page owner keeps a page's source (kernel/src/page.rs reads the island whole). */
const PAGE_SOURCE = 'the page\'s island: an oi.page page\'s bindings.constellationRef, a Flow\'s meta.constellation (the page owner, kernel/src/page.rs)'
/** What Central reads of a clip's source: the constellation a page's island names; a page that names none was made of none; anything
 * that is no page keeps none of its own. Pure. */
export function centralSourceOf(values: Values): ClipSource {
  const ref = values[MADE_OF.ref]
  if (typeof ref === 'string' && ref) return {made: 'of', ref, by: PAGE_SOURCE}
  if (['flow', 'being', 'thing', 'page'].includes(String(values.kind))) return {made: 'none', by: PAGE_SOURCE}
  return {made: 'unread', why: 'Only a page keeps the constellation it was made of, in its island: a Day, a note or a folder keeps none of its own.'}
}

/** clip:central's wiring: every key the design draws or sets, in the page family's own words. */
export const CENTRAL_WIRING: ClipWiring = withMadeOf(PAGE_WIRING, {made: 'none', by: PAGE_SOURCE})

// ---------------------------------------------------------------------------------------------------------------- the readings

/** What one selection's owner answered, reduced to the design's values (null while it answers). */
export interface CentralReading {
  readonly ref: string
  readonly values: Values
  /** The owner location of the page's file, when it is a file (the reached page's save outcome is matched by it). */
  readonly location?: CentralLocation | null
  /** The page's island as read (a Flow's or an oi.page page's), for the passage acts; absent for any other file. */
  readonly island?: unknown
}

/** One field of the page written through the page owner on the revision read (kernel/src/page.rs `mutate_field`): resolves when
 * the owner answered with its receipt, or throws the owner's words. */
export type PageWrite = (field: PageField, value: unknown) => Promise<void>

const DIRTY = 'The page holds edits its owner does not: save or re-read them first, so the change joins the revision you read.'
const NO_SELECTION_ACT = 'Select a paragraph or an entry first: the act stands on it.'

/** Where the selection stands, as the page owner names it: a Flow's entry, or a page's part (a section's heading stands for its section). */
export function selectedAt(kind: Value | undefined, selected: Value | undefined): {entry: string} | {part: string} | null {
  if (typeof selected !== 'string' || !selected) return null
  return kind === 'flow' ? {entry: selected} : {part: selected.replace(/:h$/, '')}
}

/** Whether the selection already holds a highlight (choosing Highlight again takes it away): a Flow entry with a mark in its words,
 * a page part with a whole-part highlight. Pure. */
export function selectionMarked(island: unknown, at: {entry: string} | {part: string}): boolean {
  const doc = record(island)
  if (!doc) return false
  if ('entry' in at) {
    const entry = (Array.isArray(doc.entries) ? doc.entries : []).map(record).find(e => e?.id === at.entry)
    return typeof entry?.html === 'string' && entry.html.includes('<mark')
  }
  return (Array.isArray(doc.highlights) ? doc.highlights : []).map(record).some(m => m?.part === at.part && (m.passage === null || m.passage === undefined))
}

/** A page's wiring over the page owner: its own fields written, the passage acts making highlights and notes on the selection, the
 * next highlight's colour and the next note's timing and anchor held by the view. A pane holding the page with unsaved edits refuses
 * every write first. */
function pageWiring(write: PageWrite, kind: Value | undefined, island: unknown, held: DocumentInPane | null, view: () => Values, answer: AnswerHand | null = null): ClipWiring {
  const flow = kind === 'flow'
  const page = kind === 'being' || kind === 'thing'
  // The keys the page owner takes for this kind of page (the design's keys; kernel/src/page.rs `apply_field` holds each rule).
  const writes = new Set<string>(flow ? ['name', 'colour', 'container', 'opensAs', 'opensIn', 'seats', 'act.highlight', 'act.note']
    : ['name', 'colour', ...(kind === 'being' ? ['being'] : []), ...(page ? ['world', 'subject', 'expression'] : []), 'office', 'layout', 'tone', 'opensAs', 'opensIn', 'act.highlight', 'act.note'])
  const send = (field: PageField, value: unknown) => {
    if (held?.dirty) throw new Error(DIRTY)
    return write(field, value)
  }
  const all: Record<string, (value: Value) => Promise<void>> = {
    name: async value => send('title', String(value ?? '')),
    colour: async value => send('colour', value ?? null),
    being: async value => send('kind', value),
    // A Being's or Thing's ties (kernel/src/page.rs apply_field takes world, subject and expression as refs; empty unties it).
    world: async value => send('world', value || null),
    subject: async value => send('subject', value || null),
    expression: async value => send('expression', value || null),
    office: async value => send('office', String(value ?? '').split(',').filter(Boolean).map(n => `C${n}`)),
    layout: async value => send('layout', value),
    tone: async value => send('tone', value),
    container: async value => send('container', value ?? 'none'),
    opensAs: async value => send('launch', {opensAs: value}),
    opensIn: async value => send('launch', {opensIn: value}),
    seats: async value => send('launch', {seats: value === true}),
    'act.highlight': async () => {
      const at = selectedAt(kind, view().selected)
      if (!at) throw new Error(NO_SELECTION_ACT)
      if (selectionMarked(island, at)) return send('highlight.remove', at)
      return send('highlight.add', {...at, colour: typeof view()['hl.colour'] === 'string' ? view()['hl.colour'] : 'yellow'})
    },
    'act.note': async () => {
      const held = view()
      const anchor = held['notes.anchor'] ?? 'selection'
      const at = anchor === 'document' && !flow ? {} : selectedAt(kind, held.selected)
      if (!at) throw new Error(flow ? 'A Flow\'s note stands on an entry: select one first.' : NO_SELECTION_ACT)
      return send('note.add', {...at, timing: held['notes.timing'] === 'after' ? 'after' : 'during', text: ''})
    },
  }
  const acts = Object.fromEntries(Object.entries(all).filter(([key]) => writes.has(key)))
  // Answer this (manual §18.1, §24.1; nara/answerThis.ts): on a Flow, Nara answers the selected entry's words from your pages, and the
  // answer is kept in the Flow naming each passage. Where no bound conversation can stand, it stays refused in words naming what is
  // missing.
  const answering = flow && answer && 'ask' in answer ? answer : null
  if (answering) acts['act.answerthis'] = async () => {
    if (held?.dirty) throw new Error(DIRTY)
    const at = selectedAt(kind, view().selected)
    if (!at || !('entry' in at)) throw new Error('Select an entry of the Flow first: Nara answers its words.')
    await answering.ask(at.entry)
  }
  const refused: Record<string, string> = Object.fromEntries(Object.entries(CENTRAL_WIRING.refused).filter(([key]) => !(key in acts) && !(key in PAGE_VIEW && (flow || page))))
  if (flow && answer && 'refused' in answer) refused['act.answerthis'] = answer.refused
  return {...CENTRAL_WIRING, refused, acts: {...CENTRAL_WIRING.acts, ...acts}, view: {...CENTRAL_WIRING.view, ...(flow || page ? PAGE_VIEW : {})}}
}

/** Answer this on a Flow (nara/answerThis.ts): the act on the selected entry, or why it cannot be made now. */
export type AnswerHand = {readonly ask: (entryId: string) => Promise<void>} | {readonly refused: string}

/** What the view holds for the passage acts (the next highlight's colour, the next note's timing and anchor). */
const PAGE_VIEW: Readonly<Record<string, string>> = {
  'hl.colour': 'the colour of the next highlight (the page owner keeps each highlight in its own colour)',
  'notes.timing': 'whether the next note is made during reading or after',
  'notes.anchor': 'what the next note stands on: the selection, its entry, or the page',
}

/** The page's binding over its reading: the save outcome where the reached page is this file; the page's own fields written through
 * the page owner where a writer is given. Pure. */
export function centralClipBinding(reading: CentralReading, input: {colour?: string | null; reached?: DocumentInPane | null; write?: PageWrite | null; answer?: AnswerHand | null;
  /** The wiki's constellations, which name the page's source (owners/constellations.ts). */
  constellations?: readonly Constellation[] | null}): ClipBinding {
  const source = centralSourceOf(reading.values)
  const values: Record<string, Value> = {...reading.values, ...madeOfValues(source, input.constellations)}
  if (input.colour && !values.colour) values.colour = input.colour
  const reached = input.reached
  const here = reached && reading.location && reached.location?.ref === reading.location.ref ? reached : null
  if (here?.outcome) values.save = here.outcome
  const ref = reading.ref
  const viewDefaults: Record<string, Value> = {'view.panel': 'clip', 'view.tools': 'highlight', 'view.editor': values.kind === 'flow' ? 'dialogue' : 'page', 'notes.order': 'place',
    'hl.colour': 'yellow', 'notes.timing': 'during', 'notes.anchor': 'selection',
    ...(typeof values.participants === 'string' ? speakerDefault(values.participants, reading.island) : {}),
    ...(values.container && values.container !== 'none' ? {entryKind: 'observe'} : {})}
  const view = (): Values => ({...values, ...viewDefaults, ...viewHoldsOf(clipHostId('central', ref))})
  const writable = input.write && reading.location && reading.island && ['flow', 'being', 'thing'].includes(String(values.kind))
  const wiring = withMadeOf(writable ? pageWiring(input.write!, values.kind, reading.island, here, view, input.answer ?? null) : CENTRAL_WIRING, source)
  return clipBinding({mode: 'central', ref, values, wiring, placed: true, viewDefaults})
}
/** Who the next entry belongs to by default: in a Circle the one who holds the word (flow/plural.ts circleHolder: Speak as passes round
 * the participants in order, manual §24.5), else you. */
const speakerDefault = (participants: string, island: unknown): Record<string, Value> => {
  try {
    const people = JSON.parse(participants) as {name: string; initial: string; kind: string}[]
    const doc = island as QlDoc | null
    const holder = doc && Array.isArray(doc.entries) && containerOf(doc) === 'circle' ? circleHolder(doc) : undefined
    const held = holder ? people.find(person => person.initial === holder.initial) ?? (holder.name ? {name: holder.name} : null) : null
    if (held) return {speakAs: held.name}
    const person = people.find(item => item.kind === 'person')
    return person ? {speakAs: person.name} : {}
  } catch { return {} }
}

type Answer = {phase: 'reading'} | {phase: 'read'; values: Values; location?: CentralLocation | null; revision?: string; island?: unknown} | {phase: 'refused'; values: Values}

const FORM: Record<CentralSubjectSelection['kind'], string> = {folder: 'folder', note: 'note', day: 'day'}

/** A browser subject by its form and its file's name ("Day · 2026-10-08.md"), as the detail head names it (ported from
 * CentralClipDetail.tsx centralSubjectName). */
export const centralSubjectName = (subject: CentralSubjectSelection): string => `${FORM[subject.kind][0]!.toUpperCase()}${FORM[subject.kind].slice(1)} · ${subjectWords(subject.path)}`

/** A browser subject's file or folder through the owner's file route (ported from CentralClipDetail.tsx useSubjectReading). */
function readSubject(transport: KernelTransportStatus, subject: CentralSubjectSelection): Promise<Answer> {
  const name = centralSubjectName(subject)
  if (subject.kind === 'folder') return listFiles(transport, subject.path).then((directory: NativeDirectory) => ({phase: 'read', values: {kind: 'folder', name,
    page: JSON.stringify([{id: 'h', kind: 'h1', parts: [{text: basename(subject.path)}]}, ...directory.entries.slice(0, 80).map((entry, i) => ({id: `e${i}`, kind: 'p',
      parts: [{text: `${entry.kind} · ${entry.name}${entry.byte_len != null ? ` · ${entry.byte_len} B` : ''}`}]}))])}}))
  const located = subject.location ? Promise.resolve(subject.location) : (async () => {
    const cut = subject.path.lastIndexOf('/')
    const folder = await listFiles(transport, cut > 0 ? subject.path.slice(0, cut) : '')
    const entry = folder.entries.find(row => row.name === subject.path.slice(cut + 1))
    if (entry?.location) return entry.location
    throw new Error(`the owner lists no ${subject.path.slice(cut + 1)} in ${cut > 0 ? subject.path.slice(0, cut) : 'the ground'}`)
  })()
  return located.then(location => readFile(transport, location).then(file => {
    const read = fileReading(file.content, FORM[subject.kind])
    const values: Record<string, Value> = {name, ...read.values}
    if (file.revision) values.revision = casShort(file.revision)
    return {phase: 'read' as const, values, location: file.location ?? location, revision: file.revision, island: read.island}
  }))
}

/** A Timeline clip: a day, a NOW return, a wiki return, a conversation (ported from CentralClipDetail.tsx). */
function readOccasion(transport: KernelTransportStatus, selection: CentralClipSelection): Promise<Answer> | Answer {
  if (selection.kind === 'return' && selection.returnKind === 'now') return nowReading(transport, null, {kind: 'read', now_ref: selection.subjectRef}).then(reading => {
    const facts: NowReturnFacts | null = nowReturnFacts(reading, selection.subjectRef)
    if (!facts) return {phase: 'refused' as const, values: {kind: 'NOW return', name: `NOW return · ${selection.subjectRef}`, page: JSON.stringify(pageOfText('The NOW return was refused by its owner: no reading for this clearing.'))}}
    const values: Record<string, Value> = {kind: 'NOW return', name: facts.purpose || selection.subjectRef,
      page: JSON.stringify([{id: 'h', kind: 'h1', parts: [{text: facts.purpose || selection.subjectRef}]},
        ...(facts.lifecycle ? [{id: 'l', kind: 'intro', parts: [{text: facts.lifecycle}]}] : []),
        ...(facts.taskRef ? [{id: 't', kind: 'p', parts: [{text: `task ${facts.taskRef}`}]}] : []),
        ...facts.returns.map((item, i) => ({id: `r${i}`, kind: 'p', parts: [{text: `${item.status}${item.settled ? '' : ' (open)'}`}]}))])}
    if (facts.revision) values.revision = facts.revision
    return {phase: 'read' as const, values}
  })
  if (selection.kind === 'return' && selection.returnKind === 'wiki-return') {
    const at = parseCentralPathRef(selection.subjectRef)
    if (!at) return {phase: 'refused', values: {kind: 'wiki return', name: `Wiki return · ${selection.subjectRef}`}}
    return readFile(transport, {schema: 'central.path-ref/v1', ref: selection.subjectRef, root: at.root, path: at.path}).then(file => ({phase: 'read' as const,
      values: {name: `Wiki return · ${basename(at.path)}`, ...fileValues(file.content, 'wiki return'), revision: casShort(file.revision)}}))
  }
  if (selection.kind === 'conversation') return {phase: 'read', values: {kind: 'conversation', name: `Conversation · ${selection.summary ?? selection.subjectRef}`,
    page: JSON.stringify(pageOfText(conversationGap(selection.subjectRef)))}}
  if (selection.kind === 'return') return {phase: 'read', values: {kind: 'return', name: `Return · ${selection.summary ?? selection.subjectRef}`,
    page: JSON.stringify(pageOfText('The reading names no kind for this return (NOW or wiki), so no owner read opens for it.'))}}
  return {phase: 'read', values: {kind: selection.stream ?? 'material', name: selection.summary ?? selection.subjectRef,
    page: JSON.stringify(pageOfText(`This clip stands for material Central does not own (${selection.stream ?? 'no stream'}), so it opens nothing here.`))}}
}

/** One read, held for its selection and dropped when the selection changes (CentralClipDetail.tsx's law: no store). */
function useAnswer(key: string | null, read: () => Promise<Answer> | Answer): Answer | null {
  const [held, setHeld] = useState<{key: string; answer: Answer} | null>(null)
  useEffect(() => {
    if (!key) return
    let alive = true
    const answer = read()
    if (!(answer instanceof Promise)) { setHeld({key, answer}); return }
    setHeld({key, answer: {phase: 'reading'}})
    answer.then(next => { if (alive) setHeld({key, answer: next}) },
      (cause: unknown) => { if (alive) setHeld({key, answer: {phase: 'refused', values: {page: JSON.stringify(pageOfText(`The owner refused the read: ${cause instanceof Error ? cause.message : String(cause)}`))}}}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the read
  }, [key])
  return key && held?.key === key ? held.answer : null
}

/** The Day clip's readings: the owner's open-day and its Day document's payload (CentralClipDetail.tsx DayClip). */
function useDayValues(transport: KernelTransportStatus, selection: CentralClipSelection | null): Values | null {
  const standing = useCentralDayStanding(transport, selection?.kind === 'day' ? selection.dayRef : null)
  const ready = standing?.state === 'ready' ? standing : null
  const payload = useAnswer(ready ? `${ready.sourceRef}|${ready.documentId}|${ready.revision}` : null, () =>
    receiving<unknown>(transport, null, {kind: 'document', source_ref: ready!.sourceRef, document_id: ready!.documentId})
      .then(reading => validateDocumentBasis(reading, ready!.sourceRef, ready!.documentId))
      .then(basis => ({phase: 'read' as const, values: dayPayloadValues(basis.payload)})))
  if (selection?.kind !== 'day') return null
  const values: Record<string, Value> = {kind: 'day', name: `Day · ${selection.civilDate ?? selection.subjectRef}`}
  if (ready) values.revision = ready.revision
  if (standing && standing.state !== 'ready') values.page = JSON.stringify(pageOfText(standing.state === 'uninitialised'
    ? `The owner says: “${standing.message}” — ${standing.owner} · ${standing.op}` : `The owner refused the Day document: “${standing.message}”`))
  if (payload && payload.phase !== 'reading') Object.assign(values, payload.values)
  return values
}

/** The Central page THE selection opens: a browser subject, else the spine's retained occasion (CentralClipChooser.tsx). */
export function useCentralClip(): ClipBinding | null {
  const {transport, centralSubject, world} = useDetailReading()
  const selected = useSelectedClip()
  const reached = useReachedDocument()
  useViewHoldsVersion()
  useSpine(world)
  // The wiki's constellations name a page's source (owners/constellations.ts).
  const constellations = useConstellations().rows
  const subject = centralSubject
  const resolved = subject || !world ? null : resolveCentralOccasion(world.spine.occasion(), world.source.events)
  const occasion = resolved?.state === 'selected' ? resolved.selection : null
  // The Main track selected (its head, or the Day's own track): Clip view opens today's Day, its open face for writing (manual §18.1
  // "select the Main track and Clip view opens the Day's open face for writing"). Today is the ground's Day reading.
  const ground = useCentralGroundAnswer(transport)
  const today = ground.reading ? currentDayOf(ground.reading).standing : null
  const mainDay: CentralClipSelection | null = !subject && !occasion && (selected.ref === MAIN_TRACK_REF || selected.ref === CENTRAL_DAY_TRACK_ID) && today
    ? {kind: 'day', returnKind: null, subjectRef: today.dayRef, stream: null, summary: 'Today', instantUnixMs: null, dayRef: today.dayRef, civilDate: today.civilDate, evidenceRefs: []}
    : null
  // A page field written from Clip view reads the file again (the key moves) and the pane holding it reads it again too.
  const [written, setWritten] = useState(0)
  const subjectAnswer = useAnswer(subject ? `subject:${subject.kind}:${subject.path}#${written}` : null, () => readSubject(transport, subject!))
  const occasionAnswer = useAnswer(occasion && occasion.kind !== 'day' ? `occasion:${occasion.subjectRef}:${occasion.instantUnixMs ?? 'undated'}` : null, () => readOccasion(transport, occasion!))
  const day = useDayValues(transport, occasion?.kind === 'day' ? occasion : mainDay)
  const colour = selected.track?.color ?? null
  // The open Expression a Nara conversation is bound to (the frame's native scene, as the M3 clock reads it), and a Being page's sky:
  // its Subject's saved identity, when it carries a natal chart (inhabitants/ql/devices/beingSky.ts).
  const scene = useHostedChrome()?.state?.nativeScene ?? null
  const beingSky = useBeingSky(transport, subjectAnswer?.phase === 'read' ? subjectAnswer.island : undefined)
  if (subject) {
    const ref = `subject:${subject.kind}:${subject.path}`
    const answer = subjectAnswer ?? {phase: 'reading' as const}
    const name = centralSubjectName(subject)
    const location = answer.phase === 'read' ? answer.location ?? subject.location ?? null : subject.location ?? null
    const revision = answer.phase === 'read' ? answer.revision : undefined
    // Each write is made on the revision this read stands on; the owner refuses one the file moved past, overwriting nothing.
    const write: PageWrite | null = location && revision ? async (field, value) => {
      try { await writePageField(transport, location, revision, field, value) } finally {
        setWritten(n => n + 1)
        if (reached?.location?.ref === location.ref) reached.reread?.()
      }
    } : null
    // Answer this: the bound Nara conversation is found for the chosen identity and the open Expression (nara/answerThis.ts); the
    // answer kept, the page is read again.
    const island = answer.phase === 'read' ? answer.island : undefined
    const identity = currentIdentity()
    const answering: AnswerHand | null = !location || !island ? null : !identity ? {refused: ANSWER_NO_IDENTITY} : !scene ? {refused: ANSWER_NO_EXPRESSION}
      : {ask: async entryId => {
        try { await answerThis({transport, identity, expressionRef: scene.expression_ref, location, island, entryId}) } finally {
          setWritten(n => n + 1)
          if (reached?.location?.ref === location.ref) reached.reread?.()
        }
      }}
    const values = answer.phase === 'reading' ? {kind: FORM[subject.kind], name} : {...answer.values, ...beingSky}
    return centralClipBinding({ref, values, location, island}, {colour, reached, write, answer: answering, constellations})
  }
  if (resolved?.state === 'absent') return centralClipBinding({ref: `occasion:${resolved.ref}`, values: {name: resolved.ref,
    page: JSON.stringify(pageOfText(`The retained occasion ${resolved.ref} is no longer in the temporal reading. The spine keeps its basis; nothing opens for it here.`))}}, {colour, constellations})
  if (mainDay) return centralClipBinding({ref: `main:${mainDay.dayRef}`, values: day ?? {kind: 'day', name: `Day · ${mainDay.civilDate}`}}, {colour, constellations})
  if (!occasion) return null
  const ref = `occasion:${occasion.subjectRef}:${occasion.instantUnixMs ?? 'undated'}`
  if (occasion.kind === 'day') return centralClipBinding({ref, values: day ?? {kind: 'day'}}, {colour, constellations})
  return centralClipBinding({ref, values: occasionAnswer && occasionAnswer.phase !== 'reading' ? occasionAnswer.values : {name: occasion.summary ?? occasion.subjectRef}}, {colour, constellations})
}

/** Re-read when the ONE spine's occasion moves (CentralClipChooser.tsx subscribed the same way). */
function useSpine(world: WorldTimelineView | null): void {
  const [, setTick] = useState(0)
  useEffect(() => world?.spine.subscribe(() => setTick(value => value + 1)), [world])
}
