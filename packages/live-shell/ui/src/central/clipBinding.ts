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
// A page is placed, not launched: no Launch tab (Live cap 47). The page's tools and its forms' fields refuse in the page family's
// own words (pageBindings.ts DOCUMENT_WIRING, FLOW_WIRING, TEXT_WIRING, HIGHLIGHT_WIRING, NOTES_WIRING, BEINGS_WIRING): the hosted
// form is the page's one writer while it holds the page. Pure apart from the reading hooks at the end.
import {useEffect, useState} from 'react'
import {nowReading} from '../../../../../desktop/cradle/src/receiving/now'
import {receiving} from '../../../../../desktop/cradle/src/receiving/client'
import {validateDocumentBasis} from '../../../../../desktop/cradle/src/central/dayForm'
import {islandSpan} from '../../../../../desktop/cradle/src/document/identity'
import {listFiles, readFile} from '../../../../../desktop/cradle/src/files/client'
import {parseInstance, type QlDoc} from '../../../../../desktop/cradle/src/flow/instance'
import type {CentralLocation, KernelTransportStatus, NativeDirectory} from '../../../../../desktop/cradle/src/kernel/types'
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, useViewHoldsVersion, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {casShort} from '../inhabitants/centralDayNowModel'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {conversationGap, nowReturnFacts, parseCentralPathRef, resolveCentralOccasion, type CentralClipSelection, type NowReturnFacts} from './centralVertical'
import {FLOW_WIRING, HIGHLIGHT_WIRING, NOTES_WIRING, BEINGS_WIRING, TEXT_WIRING} from './devices/pageBindings'
import {faceOfField, readFlowPage, wordsOfHtml, type FlowPage} from './devices/pageReadings'
import {useReachedDocument, type DocumentInPane} from './documents/documentDoor'
import {setFlowMeta} from './devices/centralDeviceWrites'
import {useCentralDayStanding} from './useCentralDayStanding'
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
  if (Array.isArray(bindings.categories)) values.office = [1, 2, 3, 4].filter(n => (bindings.categories as unknown[]).includes(`C${n}`)).join(',')
  if (Array.isArray(bindings.sources)) values.sources = JSON.stringify(bindings.sources.map(record).filter((s): s is Record<string, unknown> => s !== null)
    .map(source => `${text(source.ref) ?? ''}${text(source.revision) ? ` @ ${text(source.revision)}` : ''}`))
  if (appearance.layout === 'portrait' || appearance.layout === 'editorial') values.layout = appearance.layout
  if (appearance.tone === 'paper' || appearance.tone === 'ink') values.tone = appearance.tone
  const paras: Para[] = []
  if (title) paras.push({id: 'title', kind: 'h1', parts: [{text: title}]})
  const subtitle = text(body.subtitle), introduction = text(body.introduction)
  if (subtitle) paras.push({id: 'subtitle', kind: 'intro', parts: [{text: subtitle}]})
  if (introduction) paras.push({id: 'introduction', kind: 'p', parts: [{text: introduction}]})
  if (Array.isArray(body.sections)) body.sections.map(record).filter((s): s is Record<string, unknown> => s !== null).forEach((section, i) => {
    const id = text(section.id) ?? `section-${i + 1}`
    paras.push({id: `${id}:h`, kind: 'h2', parts: [{text: `${i + 1}. ${text(section.heading) ?? ''}`}]})
    if (text(section.text)) paras.push({id, kind: 'p', parts: [{text: text(section.text)!}]})
  })
  values.page = JSON.stringify(paras)
  return values
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

/** A file's own content as the page's readings: a Flow, an oi.page page, or its own text. Pure. */
export function fileValues(content: string, fallbackKind: string): Values {
  if (islandSpan(content, 'ql-doc')) {
    let doc: unknown = null
    try { doc = parseInstance(content) } catch { doc = null }
    const page = pageIslandValues(doc)
    if (page) return page
    if (doc && Array.isArray((doc as QlDoc).entries)) return flowValues(readFlowPage(doc as QlDoc))
  }
  return {kind: fallbackKind, page: JSON.stringify(pageOfText(content)), source: content.length > READ_PREVIEW_CHARS ? `${content.slice(0, READ_PREVIEW_CHARS)}…` : content}
}

// ---------------------------------------------------------------------------------------------------------------- the wiring

/** clip:central's wiring: every key the design draws or sets, in the page family's own words. */
export const CENTRAL_WIRING: ClipWiring = {
  reads: {
    name: 'the page\'s title: a Flow\'s meta.title, an oi.page meta.title, else the file\'s or the clip\'s own name', colour: 'the clip\'s track colour (the tracks pane)',
    kind: 'the page\'s form: Flow, Being, Thing, Day, or the file\'s kind', template: 'the template the page names, at its version', revision: 'the owner\'s CAS revision of the bytes',
    save: 'the save router\'s outcome, where the page stands reached in a pane', page: 'the page\'s own text, as paragraphs', source: 'the page\'s source text',
    notes: 'the page\'s notes', participants: 'a Flow\'s participants', entries: 'a Flow\'s entries, their relations and depth', world: 'bindings.worldRef', subject: 'bindings.subjectRef',
    office: 'bindings.categories (C1–C4)', sources: 'bindings.sources, each at its revision', expression: 'bindings.expressionRef', layout: 'appearance.layout', tone: 'appearance.tone',
    'hl.colour': 'the Flow template\'s one marker colour',
  },
  acts: {},
  view: {
    selected: 'the paragraph or entry the selection stands in, in Clip view', speakAs: 'who writes the next entry (FLOW_WIRING local: speaker)',
    relation: 'how the next entry connects (FLOW_WIRING local)', journalPage: 'the journal page Clip view shows (FLOW_WIRING local: page)',
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
    world: BEINGS_WIRING.refused.world!, subject: BEINGS_WIRING.refused.subject!,
    addParticipant: FLOW_WIRING.refused['in:<agent>']!, media: 'Media joins an entry on the page itself: the hosted form is the page\'s one writer while it holds the page (DocumentFlowFace.tsx).',
    // Launch and the container (manual §18.1, §24.5; T-WORLDS W2): the page owner op keeps them once it exists.
    opensAs: 'No owner keeps how a page opens yet: the page owner op carries it (T-WORLDS W2).', opensIn: 'No owner keeps where a page opens yet (T-WORLDS W2).',
    seats: 'No owner reseats a Flow\'s people and agents yet (T-WORLDS W2).', container: 'A Flow\'s form keeps no container yet: meta.container joins the flow form (T-WORLDS W2, W4).',
    entryKind: 'A Flow\'s entries carry no kind yet: observe, interpret and choose join the flow form (T-WORLDS W4).',
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

// ---------------------------------------------------------------------------------------------------------------- the readings

/** What one selection's owner answered, reduced to the design's values (null while it answers). */
export interface CentralReading {
  readonly ref: string
  readonly values: Values
  /** The owner location of the page's file, when it is a file (the reached page's save outcome is matched by it). */
  readonly location?: CentralLocation | null
}

const DIRTY = 'The page holds edits its owner does not: save or re-read them first, so the title joins the revision you read.'

/** A Flow's wiring: its name is its title, written on its own file (centralDeviceWrites.ts setFlowMeta), as Live names a clip in Clip
 * view. The page family's Document device carries the same writer but stands on no chain (CentralDevices.tsx, R4), so Clip view is
 * where the hand reaches it. The pane holding this file with unsaved edits refuses first. */
function flowWiring(rename: (title: string) => Promise<void>, held: DocumentInPane | null): ClipWiring {
  const {name: _refused, ...refused} = CENTRAL_WIRING.refused
  return {...CENTRAL_WIRING, refused, acts: {...CENTRAL_WIRING.acts, name: async value => {
    if (held?.dirty) throw new Error(DIRTY)
    await rename(String(value ?? ''))
  }}}
}

/** The page's binding over its reading: the save outcome where the reached page is this file; a Flow's title written where a writer is
 * given. Pure. */
export function centralClipBinding(reading: CentralReading, input: {colour?: string | null; reached?: DocumentInPane | null;
  rename?: ((title: string) => Promise<void>) | null}): ClipBinding {
  const values: Record<string, Value> = {...reading.values}
  if (input.colour) values.colour = input.colour
  const reached = input.reached
  const here = reached && reading.location && reached.location?.ref === reading.location.ref ? reached : null
  if (here?.outcome) values.save = here.outcome
  const wiring = input.rename && values.kind === 'flow' && reading.location ? flowWiring(input.rename, here) : CENTRAL_WIRING
  return clipBinding({mode: 'central', ref: reading.ref, values, wiring, placed: true,
    viewDefaults: {'view.panel': 'clip', 'view.tools': 'highlight', 'view.editor': values.kind === 'flow' ? 'dialogue' : 'page', 'notes.order': 'place',
      ...(typeof values.participants === 'string' ? speakerDefault(values.participants) : {})}})
}
const speakerDefault = (participants: string): Record<string, Value> => {
  try { const person = (JSON.parse(participants) as {name: string; kind: string}[]).find(item => item.kind === 'person'); return person ? {speakAs: person.name} : {} } catch { return {} }
}

type Answer = {phase: 'reading'} | {phase: 'read'; values: Values; location?: CentralLocation | null} | {phase: 'refused'; values: Values}

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
    const values: Record<string, Value> = {name, ...fileValues(file.content, FORM[subject.kind])}
    if (file.revision) values.revision = casShort(file.revision)
    return {phase: 'read' as const, values, location: file.location ?? location}
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
  const subject = centralSubject
  const resolved = subject || !world ? null : resolveCentralOccasion(world.spine.occasion(), world.source.events)
  const occasion = resolved?.state === 'selected' ? resolved.selection : null
  // A Flow's title written from Clip view reads the file again (the key moves) and the pane holding it reads it again too.
  const [written, setWritten] = useState(0)
  const subjectAnswer = useAnswer(subject ? `subject:${subject.kind}:${subject.path}#${written}` : null, () => readSubject(transport, subject!))
  const occasionAnswer = useAnswer(occasion && occasion.kind !== 'day' ? `occasion:${occasion.subjectRef}:${occasion.instantUnixMs ?? 'undated'}` : null, () => readOccasion(transport, occasion!))
  const day = useDayValues(transport, occasion)
  const colour = selected.track?.color ?? null
  if (subject) {
    const ref = `subject:${subject.kind}:${subject.path}`
    const answer = subjectAnswer ?? {phase: 'reading' as const}
    const name = centralSubjectName(subject)
    const location = answer.phase === 'read' ? answer.location ?? subject.location ?? null : subject.location ?? null
    const rename = location ? async (title: string) => {
      try { await setFlowMeta(transport, location, {title}) } finally {
        setWritten(value => value + 1)
        if (reached?.location?.ref === location.ref) reached.reread?.()
      }
    } : null
    return centralClipBinding({ref, values: answer.phase === 'reading' ? {kind: FORM[subject.kind], name} : answer.values, location}, {colour, reached, rename})
  }
  if (resolved?.state === 'absent') return centralClipBinding({ref: `occasion:${resolved.ref}`, values: {name: resolved.ref,
    page: JSON.stringify(pageOfText(`The retained occasion ${resolved.ref} is no longer in the temporal reading. The spine keeps its basis; nothing opens for it here.`))}}, {colour})
  if (!occasion) return null
  const ref = `occasion:${occasion.subjectRef}:${occasion.instantUnixMs ?? 'undated'}`
  if (occasion.kind === 'day') return centralClipBinding({ref, values: day ?? {kind: 'day'}}, {colour})
  return centralClipBinding({ref, values: occasionAnswer && occasionAnswer.phase !== 'reading' ? occasionAnswer.values : {name: occasion.summary ?? occasion.subjectRef}}, {colour})
}

/** Re-read when the ONE spine's occasion moves (CentralClipChooser.tsx subscribed the same way). */
function useSpine(world: WorldTimelineView | null): void {
  const [, setTick] = useState(0)
  useEffect(() => world?.spine.subscribe(() => setTick(value => value + 1)), [world])
}
