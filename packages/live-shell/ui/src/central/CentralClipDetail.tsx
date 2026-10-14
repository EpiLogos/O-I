import {useEffect, useState} from 'react'

/** Central's Clip side: the selected document as data (manual §3; world-shell-mockup.html clipDetail(), its Central branch, :1666-1668)
 * — the Clip view's props column (its form on the head, then file, template, revision, state and its bindings: world, subject,
 * office, sources) beside its named columns (Highlights, Notes, and what the material itself holds). Every value is a reading
 * an owner already gives through the door this file has always used; a row no owner fills shows "—", a column no owner fills
 * says so in one line. Nothing here writes, and no device stands here: the document's devices (the Day die, the
 * conversation) stand on the Device side, from the same selection (shell/ModeDetail.tsx BaseDevicesDetail).
 *
 * Two kinds of selection open here (central/CentralClipChooser.tsx):
 * - a browser subject — a folder, note or day of the ground — read through the owner's file route (`readFile` →
 *   `central.file-reading/v1`, CAS-revised; a folder through `listFiles`). Ported from inhabitants/CentralSubjectDetail.tsx:53-101.
 * - a Timeline clip — the spine's retained occasion: a day reads the owner's `open-day` (useCentralDayStanding); a NOW return
 *   reads `central.now-reading/v1` (`receiving/now` `read`); a wiki return reads its own file through the owner's file route.
 *   Ported from the panes this file drew before (DayDocumentPane, NowReturnPane, WikiReturnPane).
 * A wiki subject is opened only from a `wiki:node:` ref the material names in its own text; the Constellation opens focused
 * on it. No store here: each read is held for its selection and dropped when the selection changes. */

import {nowReading} from '../../../../../desktop/cradle/src/receiving/now'
import {listFiles, readFile} from '../../../../../desktop/cradle/src/files/client'
import type {CentralLocation, KernelTransportStatus, NativeDirectory} from '../../../../../desktop/cradle/src/kernel/types'
import {casShort, subjectDayRef} from '../inhabitants/centralDayNowModel'
import {SAVE_ROUTER_OUTCOMES} from '../inhabitants/manifest.ts'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {ClipLine, ClipNone, ClipView, ClipWaiting, type ClipColumn, type ClipRow} from '../frame/detail/ClipView'
import {
  conversationGap,
  namedWikiSubjects,
  nowReturnFacts,
  parseCentralPathRef,
  type CentralClipSelection,
  type NowReturnFacts,
} from './centralVertical'
import {openConstellation} from './constellation'
import {useCentralDayStanding} from './useCentralDayStanding'

const READ_PREVIEW_CHARS = 4000
/** A subject's owner location: the one the browser's row carried (the owner's own `files_list` entry), else the entry the
 * owner lists for it in its folder. The root is the owner's — no machine's path is written into the shell. */
async function ownerLocation(transport: KernelTransportStatus, subject: CentralSubjectSelection): Promise<CentralLocation> {
  if (subject.location) return subject.location
  const cut = subject.path.lastIndexOf('/')
  const folder = await listFiles(transport, cut > 0 ? subject.path.slice(0, cut) : '')
  const name = subject.path.slice(cut + 1)
  const entry = folder.entries.find(row => row.name === name)
  if (entry?.location) return entry.location
  throw new Error(`the owner lists no ${name} in ${cut > 0 ? subject.path.slice(0, cut) : 'the ground'}`)
}

/** The mockup's widths for the first two columns (clipDetail() :1668); the last column takes the rest. */
const HIGHLIGHTS_W = 320, NOTES_W = 300

const NO_SAVE = `The save router's outcomes (${SAVE_ROUTER_OUTCOMES.join(' · ')}) — none reached: the Clip view performs no write`
const UNBOUND = (binding: string) => `No reading gives this document's ${binding} binding`
const basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path

/** The binding rows the mockup's bound documents carry (Things, Beings: clipDetail() :1667); this reading gives none of them. */
const bindingRows = (): ClipRow[] => ['world', 'subject', 'office', 'sources'].map(key => ({key, value: null, title: UNBOUND(key)}))
/** A Day's own rows in the mockup (its die's face and when it closes, :1667): the die reads its face on the Device side and the
 * day's closure is the owner's automation, so neither is read here. */
const dayRows = (): ClipRow[] => [
  {key: 'face', value: null, title: 'The Day die reads the open face (the Device side)'},
  {key: 'closes', value: null, title: 'The day closes by the owner\'s automation; no reading gives its close here'},
]

/** The two columns every Central document has. No reader in the shell discloses a document's highlights or its notes yet. */
const marksColumns = (last: boolean): ClipColumn[] => [
  {name: 'Highlights', width: HIGHLIGHTS_W, body: <ClipNone>No highlights reading: the document's owner discloses none.</ClipNone>},
  {name: 'Notes', width: last ? undefined : NOTES_W, body: <ClipNone>No notes reading: the document's owner discloses none.</ClipNone>},
]

/** The wiki subjects a text names, each opening the Constellation; one line when the text names none. */
function NamesColumn({refs, from}: {refs: readonly string[]; from: string}) {
  const [refusal, setRefusal] = useState<string | null>(null)
  if (!refs.length) return <ClipNone>{from} names no wiki node (no `wiki:node:` ref in its own text).</ClipNone>
  return <div data-named-wiki={refs.length}>
    {refs.map(ref => <ClipLine key={ref} lead="names" title="Open the wiki Constellation focused on this subject (oi:epi-open-knowledge)"
      onPress={() => { setRefusal(null); openConstellation(ref, ref, error => setRefusal(error ?? null)) }}>{ref}</ClipLine>)}
    {refusal && <ClipNone><span role="alert">The Constellation refused: {refusal}</span></ClipNone>}
  </div>
}

// ---------------------------------------------------------------------------
// a browser subject: a folder, note or day of the ground

interface SubjectReading {
  readonly revision: string | null
  readonly ref: string | null
  readonly byteLen: number | null
  readonly project: string | null
  readonly boundaryOp: string
  readonly directory: NativeDirectory | null
  readonly pending: boolean
  readonly fault: string | null
}


/** The subject's reading through the owner's file route (ported from inhabitants/CentralSubjectDetail.tsx:53-101). */
function useSubjectReading(transport: KernelTransportStatus, subject: CentralSubjectSelection): SubjectReading {
  const folder = subject.kind === 'folder'
  const [state, setState] = useState<SubjectReading>({revision: null, ref: null, byteLen: null, project: null, boundaryOp: '', directory: null, pending: true, fault: null})
  useEffect(() => {
    let alive = true
    setState({revision: null, ref: null, byteLen: null, project: null, boundaryOp: '', directory: null, pending: true, fault: null})
    const read = folder
      ? listFiles(transport, subject.path).then(directory => ({
          revision: null, ref: directory.location?.ref ?? null,
          byteLen: directory.entries.reduce((total, entry) => total + (entry.byte_len ?? 0), 0), project: null,
          boundaryOp: 'op files_list (central.directory-reading/v1)', directory, pending: false, fault: null}))
      : ownerLocation(transport, subject).then(location => readFile(transport, location)).then(reading => ({
          revision: reading.revision, ref: reading.location?.ref ?? null,
          byteLen: reading.byte_len, project: reading.project?.name ?? null,
          boundaryOp: 'op file_read (central.file-reading/v1)', directory: null, pending: false, fault: null}))
    read.then(
      next => { if (alive) setState(next) },
      (error: unknown) => { if (alive) setState(held => ({...held, pending: false, fault: error instanceof Error ? error.message : String(error)})) },
    )
    return () => { alive = false }
  }, [transport, subject.path, folder])
  return state
}

const FORM: Record<CentralSubjectSelection['kind'], string> = {folder: 'Folder', note: 'Note', day: 'Day'}

/** A browser subject by its form and its file's name ("Day · 2026-10-08.md"), as the row's head names it. */
export const centralSubjectName = (subject: CentralSubjectSelection): string => `${FORM[subject.kind]} · ${basename(subject.path)}`

/** A browser subject as data. Legacy: inhabitants/CentralSubjectDetail.tsx:112-182 (the reading rows under "Central detail"). */
export function CentralSubjectClip({transport, subject, colour}: {transport: KernelTransportStatus; subject: CentralSubjectSelection; colour?: string | null}) {
  const read = useSubjectReading(transport, subject)
  const dayRef = subjectDayRef(subject.path)
  const rows: ClipRow[] = [
    {key: 'file', value: basename(subject.path), title: read.ref ?? subject.path},
    {key: 'template', value: null, title: 'The file reading names no template'},
    {key: 'revision', value: read.revision ? casShort(read.revision) : null, title: read.revision ?? (read.directory ? 'A listing has no single CAS revision: its entries carry their own' : 'Not read yet')},
    {key: 'state', value: null, title: NO_SAVE},
    ...(subject.kind === 'day' ? dayRows() : bindingRows()),
    {key: 'path', value: subject.path, title: subject.path},
    {key: 'size', value: read.byteLen !== null ? `${read.byteLen} B` : null},
    ...(read.project ? [{key: 'project', value: read.project}] : []),
    ...(dayRef ? [{key: 'civil day', value: dayRef}] : []),
    {key: 'read via', value: read.boundaryOp || null},
  ]
  const note = read.pending ? 'Reading the owner…' : read.fault ? <span role="alert" data-detail-fault>The owner refused the read: {read.fault}</span> : null
  const columns: ClipColumn[] = read.directory
    ? [{name: 'Entries', body: read.directory.entries.length
        ? <div data-detail-entries>{read.directory.entries.map(entry => <ClipLine key={entry.name} lead={entry.kind} right={entry.byte_len != null ? `${entry.byte_len} B` : undefined}>{entry.name}</ClipLine>)}</div>
        : <ClipNone>The listing holds no entries.</ClipNone>}]
    : marksColumns(true)
  return <ClipView kind={`subject:${subject.kind}`} name={FORM[subject.kind]} colour={colour} rows={rows} columns={columns} note={note} />
}

// ---------------------------------------------------------------------------
// a Timeline clip: a day, a return, a conversation

function DayClip({transport, selection, colour}: {transport: KernelTransportStatus; selection: CentralClipSelection; colour?: string | null}) {
  const standing = useCentralDayStanding(transport, selection.dayRef)
  const ready = standing?.state === 'ready' ? standing : null
  const rows: ClipRow[] = [
    {key: 'file', value: ready?.sourceRef ?? null, title: 'The Day document\'s source, as the owner\'s open-day names it'},
    {key: 'template', value: null, title: 'The open-day reading names no template'},
    {key: 'revision', value: ready?.revision ?? null},
    {key: 'state', value: !standing ? null : standing.state === 'ready' ? 'ready' : standing.state === 'uninitialised' ? 'no Day document yet' : 'refused', title: NO_SAVE},
    ...dayRows(),
    {key: 'document', value: ready?.documentId ?? null},
    {key: 'civil day', value: selection.civilDate},
  ]
  const note = !selection.dayRef ? 'Undated: the reading gives this clip no civil day, so no Day document opens for it.'
    : !standing ? 'Reading the owner\'s Day…'
    : standing.state === 'uninitialised' ? <span data-day-standing="uninitialised">The owner says: “{standing.message}” — {standing.owner} · {standing.op}</span>
    : standing.state === 'refused' ? <span role="alert" data-day-standing="refused">The owner refused the Day document: “{standing.message}”</span>
    : null
  return <ClipView kind="day" name="Day" colour={colour} rows={rows} columns={marksColumns(true)} note={note} />
}

type NowState = {phase: 'reading'} | {phase: 'done'; facts: NowReturnFacts | null; error: string | null}

function NowReturnClip({transport, selection, colour}: {transport: KernelTransportStatus; selection: CentralClipSelection; colour?: string | null}) {
  const nowRef = selection.subjectRef
  const [state, setState] = useState<NowState>({phase: 'reading'})
  useEffect(() => {
    let alive = true
    setState({phase: 'reading'})
    nowReading(transport, null, {kind: 'read', now_ref: nowRef})
      .then(reading => { if (alive) setState({phase: 'done', facts: nowReturnFacts(reading, nowRef), error: null}) })
      .catch((error: unknown) => { if (alive) setState({phase: 'done', facts: null, error: error instanceof Error ? error.message : String(error)}) })
    return () => { alive = false }
  }, [transport, nowRef])
  const facts = state.phase === 'done' ? state.facts : null
  const rows: ClipRow[] = [
    {key: 'file', value: facts?.source?.path ?? null, title: facts?.source?.ref ?? 'The clearing\'s source, as the owner discloses it'},
    {key: 'template', value: null, title: 'The NOW reading names no template'},
    {key: 'revision', value: facts?.revision ?? null},
    {key: 'state', value: facts?.lifecycle ?? null, title: 'The clearing\'s lifecycle, as the owner reads it'},
    {key: 'purpose', value: facts?.purpose || null},
    ...(facts?.taskRef ? [{key: 'task', value: facts.taskRef}] : []),
    {key: 'returns', value: facts ? (facts.returns.length ? facts.returns.map(item => `${item.status}${item.settled ? '' : ' (open)'}`).join(' · ') : 'none') : null},
    {key: 'civil day', value: selection.civilDate},
  ]
  const note = state.phase === 'reading' ? 'Reading the NOW return…'
    : !facts ? <span role="alert" data-now-standing="refused">The NOW return was refused by its owner: {state.error ?? 'no reading for this clearing'}</span>
    : null
  return <ClipView kind="now-return" name={`NOW return · ${facts?.purpose || nowRef}`} colour={colour} rows={rows} note={note}
    columns={[...marksColumns(false), {name: 'Names', body: facts ? <NamesColumn refs={facts.namedWikiRefs} from="This NOW return" /> : <ClipNone>Waiting for the owner's reading.</ClipNone>}]} />
}

type WikiState = {phase: 'reading'} | {phase: 'done'; content: string; revision: string; byteLen: number | null; path: string} | {phase: 'refused'; message: string}

function WikiReturnClip({transport, selection, colour}: {transport: KernelTransportStatus; selection: CentralClipSelection; colour?: string | null}) {
  const subjectRef = selection.subjectRef
  const [state, setState] = useState<WikiState>({phase: 'reading'})
  useEffect(() => {
    let alive = true
    const at = parseCentralPathRef(subjectRef)
    if (!at) { setState({phase: 'refused', message: `The return's ref is not a central:path ref: ${subjectRef}`}); return () => { alive = false } }
    setState({phase: 'reading'})
    readFile(transport, {schema: 'central.path-ref/v1', ref: subjectRef, root: at.root, path: at.path})
      .then(reading => { if (alive) setState({phase: 'done', content: reading.content, revision: reading.revision, byteLen: reading.byte_len, path: at.path}) })
      .catch((error: unknown) => { if (alive) setState({phase: 'refused', message: error instanceof Error ? error.message : String(error)}) })
    return () => { alive = false }
  }, [transport, subjectRef])
  const done = state.phase === 'done' ? state : null
  const rows: ClipRow[] = [
    {key: 'file', value: done?.path ?? null, title: subjectRef},
    {key: 'template', value: null, title: 'The file reading names no template'},
    {key: 'revision', value: done ? casShort(done.revision) : null, title: done?.revision},
    {key: 'state', value: null, title: NO_SAVE},
    {key: 'size', value: done?.byteLen != null ? `${done.byteLen} B` : null},
    {key: 'civil day', value: selection.civilDate},
  ]
  const note = state.phase === 'reading' ? 'Reading the wiki return…'
    : state.phase === 'refused' ? <span role="alert" data-wiki-return-standing="refused">The wiki return was refused by its owner: {state.message}</span>
    : null
  const text = done ? (done.content.length > READ_PREVIEW_CHARS ? `${done.content.slice(0, READ_PREVIEW_CHARS)}…` : done.content) : null
  return <ClipView kind="wiki-return" name={`Wiki return · ${done ? basename(done.path) : subjectRef}`} colour={colour} rows={rows} note={note} columns={[
    {name: 'Text', width: 420, body: text !== null ? <pre className="ccol-text" data-wiki-return-content>{text}</pre> : <ClipNone>Waiting for the owner's reading.</ClipNone>},
    {name: 'Names', body: done ? <NamesColumn refs={namedWikiSubjects(done.content)} from="This wiki return" /> : <ClipNone>Waiting for the owner's reading.</ClipNone>},
  ]} />
}

function ConversationClip({selection, colour}: {selection: CentralClipSelection; colour?: string | null}) {
  return <ClipView kind="conversation" name={`Conversation · ${selection.summary ?? selection.subjectRef}`} colour={colour} rows={[
    {key: 'space', value: selection.subjectRef},
    {key: 'stream', value: selection.stream},
    {key: 'expression', value: null, title: conversationGap(selection.subjectRef)},
    {key: 'civil day', value: selection.civilDate},
  ]} columns={[{name: 'Binding', body: <ClipNone>{conversationGap(selection.subjectRef)}</ClipNone>}]} />
}

/** The selected Timeline clip as data. Legacy: this file's CentralClipDetail (the "Central · <kind>" card with its panes). */
export function CentralClipDetail({transport, selection, colour}: {transport: KernelTransportStatus; selection: CentralClipSelection; colour?: string | null}) {
  if (selection.kind === 'day') return <DayClip transport={transport} selection={selection} colour={colour} />
  if (selection.kind === 'return' && selection.returnKind === 'now') return <NowReturnClip transport={transport} selection={selection} colour={colour} />
  if (selection.kind === 'return' && selection.returnKind === 'wiki-return') return <WikiReturnClip transport={transport} selection={selection} colour={colour} />
  if (selection.kind === 'conversation') return <ConversationClip selection={selection} colour={colour} />
  if (selection.kind === 'return') return <ClipView kind="return" name={`Return · ${selection.summary ?? selection.subjectRef}`} colour={colour}
    rows={[{key: 'ref', value: selection.subjectRef}, {key: 'stream', value: selection.stream}, {key: 'civil day', value: selection.civilDate}]}
    columns={marksColumns(true)} note="The reading names no kind for this return (NOW or wiki), so no owner read opens for it." />
  return <ClipWaiting line={`This clip stands for material Central does not own (${selection.stream ?? 'no stream'}), so it opens nothing here.`} />
}
