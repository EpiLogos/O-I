import {useEffect, useState} from 'react'

/** The selected Timeline clip's Central craft, drawn in the Base detail row
 * (WORLD-SHELL-DESIGN §17.2 — the Central vertical).
 *
 * Each part reads its owner through the existing door and names its owner
 * when it cannot answer:
 * - a day (a dated day-track moment, or the day a return stands in) opens the
 *   Day document device over the owner's `central` open-day reading — the
 *   device itself is `DocumentDayDieFace`, imported, not copied;
 * - a NOW return reads `central.now-reading/v1` (`receiving/now` `read`) and
 *   draws its purpose, lifecycle, source basis and returns;
 * - a wiki return reads its own file through the owner's file route
 *   (`central:path` ref, CAS-revised) and draws its text;
 * - a conversation opens the Nara device (`NaraConversationFace`), which
 *   names the binding gap rather than guessing an expression.
 * A wiki subject is opened only from a `wiki:node:` ref the return or Day
 * names in its own text; the Constellation opens focused on that ref.
 *
 * No store here: each read is held by this component for its selection and
 * dropped when the selection changes (the chooser keys it by identity). */

import {nowReading} from '../../../../../desktop/cradle/src/receiving/now'
import {readFile} from '../../../../../desktop/cradle/src/files/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {DocumentDayDieFace} from '../inhabitants/DocumentDayDieFace'
import {NaraConversationFace} from '../inhabitants/ConversationNaraFace'
import {KindMark} from '../inhabitants/sdk/marks.tsx'
import '../inhabitants/inhabitantDevices.css'
import {
  CONVERSATION_BINDING_GAP,
  namedWikiSubjects,
  nowReturnFacts,
  parseCentralPathRef,
  type CentralClipSelection,
  type NowReturnFacts,
} from './centralVertical'
import {openConstellation} from './constellation'
import {useCentralDayStanding} from './useCentralDayStanding'

const READ_PREVIEW_CHARS = 4000

export interface CentralClipDetailProps {
  readonly transport: KernelTransportStatus
  readonly selection: CentralClipSelection
}

/** The Constellation opener for one wiki subject; a refusal is named here. */
function ConstellationOpener({subjectRef}: {subjectRef: string}) {
  const [refusal, setRefusal] = useState<string | null>(null)
  return (
    <span className="inhabitant-device-note" data-constellation-opener={subjectRef}>
      <button type="button" className="inhabitant-act" data-action="open-constellation" data-subject-ref={subjectRef}
        title="Open the wiki Constellation focused on this subject (oi:epi-open-knowledge, wiki address, graph plane)"
        onClick={() => {setRefusal(null); openConstellation(subjectRef, subjectRef, error => setRefusal(error ?? null))}}>
        Open in the Constellation
      </button>
      <span className="mono"> {subjectRef}</span>
      {refusal && <span className="inhabitant-device-fault" role="alert" data-constellation-refusal> The Constellation refused: {refusal}</span>}
    </span>
  )
}

/** The named wiki subjects a text carries, each opening the Constellation; an
 * honest absence when the text names none. */
function NamedWikiSubjects({refs, from}: {refs: readonly string[]; from: string}) {
  if (!refs.length) {
    return <p className="inhabitant-device-notice" data-named-wiki="none">{from} names no wiki node (no `wiki:node:` ref in its own text), so no Constellation subject is opened from it.</p>
  }
  return (
    <ul className="inhabitant-reading-list" data-named-wiki={refs.length}>
      {refs.map(ref => (
        <li key={ref} className="inhabitant-reading"><span className="inhabitant-reading-op">names</span><ConstellationOpener subjectRef={ref}/></li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// the Day document

/** The Day document device for one civil day, over the owner's open-day reading (the shared hook). */
function DayDocumentPane({transport, dayRef}: {transport: KernelTransportStatus; dayRef: string}) {
  const standing = useCentralDayStanding(transport, dayRef)
  if (!standing) {
    return <p className="inhabitant-device-note" role="status" data-day-standing="reading">Reading the owner's Day {dayRef}…</p>
  }
  if (standing.state === 'ready') {
    return (
      <div data-day-standing="ready" data-day-source={standing.sourceRef} data-day-document={standing.documentId}>
        <p className="inhabitant-device-note" data-day-basis>Day {standing.civilDate} · document {standing.documentId} · revision <span className="mono">{standing.revision}</span></p>
        <DocumentDayDieFace transport={transport} project={null} sourceRef={standing.sourceRef} documentId={standing.documentId}/>
      </div>
    )
  }
  if (standing.state === 'uninitialised') {
    return (
      <div className="inhabitant-device-notice" data-day-standing="uninitialised" data-owner={standing.owner} data-owner-op={standing.op}>
        <p>Day {standing.civilDate} has no Day document yet. The owner says: “{standing.message}”</p>
        <p>Owner: {standing.owner} · op: <span className="mono">{standing.op}</span></p>
        <p>{standing.remedy}</p>
      </div>
    )
  }
  return (
    <div className="inhabitant-device-fault" role="alert" data-day-standing="refused" data-day-refusal>
      Day {standing.civilDate}: the owner refused the Day document — “{standing.message}”
    </div>
  )
}

// ---------------------------------------------------------------------------
// the NOW return

type NowPaneState = {phase: 'reading'} | {phase: 'done'; facts: NowReturnFacts | null; error: string | null}

function NowReturnPane({transport, nowRef}: {transport: KernelTransportStatus; nowRef: string}) {
  const [state, setState] = useState<NowPaneState>({phase: 'reading'})
  useEffect(() => {
    let alive = true
    setState({phase: 'reading'})
    nowReading(transport, null, {kind: 'read', now_ref: nowRef})
      .then(reading => { if (alive) setState({phase: 'done', facts: nowReturnFacts(reading, nowRef), error: null}) })
      .catch((error: unknown) => { if (alive) setState({phase: 'done', facts: null, error: error instanceof Error ? error.message : String(error)}) })
    return () => { alive = false }
  }, [transport, nowRef])

  if (state.phase === 'reading') return <p className="inhabitant-device-note" role="status" data-now-standing="reading">Reading the NOW return…</p>
  if (state.error || !state.facts) {
    return <p className="inhabitant-device-fault" role="alert" data-now-standing="refused">The NOW return was refused by its owner: {state.error ?? 'no reading for this clearing'}</p>
  }
  const facts = state.facts
  return (
    <div data-now-standing="read" data-now-ref={facts.nowRef}>
      <ul className="inhabitant-reading-list" data-now-facts>
        <li className="inhabitant-reading"><span className="inhabitant-reading-op">purpose</span><span className="inhabitant-reading-standing">{facts.purpose || 'no purpose disclosed'}</span></li>
        <li className="inhabitant-reading"><span className="inhabitant-reading-op">lifecycle</span><span className="inhabitant-reading-standing">{facts.lifecycle ?? 'not disclosed'}</span></li>
        {facts.taskRef && <li className="inhabitant-reading"><span className="inhabitant-reading-op">task</span><span className="inhabitant-reading-standing mono">{facts.taskRef}</span></li>}
        {facts.source && <li className="inhabitant-reading" data-now-basis><span className="inhabitant-reading-op">source</span><span className="inhabitant-reading-standing mono" title={facts.revision ?? ''}>{facts.source.path}{facts.revision ? ` · ${facts.revision}` : ''}</span></li>}
        <li className="inhabitant-reading" data-now-returns={facts.returns.length}><span className="inhabitant-reading-op">returns</span><span className="inhabitant-reading-standing">{facts.returns.length ? facts.returns.map(item => `${item.status}${item.settled ? '' : ' (open)'}`).join(' · ') : 'none at this reading'}</span></li>
      </ul>
      <NamedWikiSubjects refs={facts.namedWikiRefs} from="This NOW return"/>
    </div>
  )
}

// ---------------------------------------------------------------------------
// the wiki return

type WikiPaneState = {phase: 'reading'} | {phase: 'done'; content: string; revision: string; byteLen: number | null; path: string} | {phase: 'refused'; message: string}

function WikiReturnPane({transport, subjectRef}: {transport: KernelTransportStatus; subjectRef: string}) {
  const [state, setState] = useState<WikiPaneState>({phase: 'reading'})
  useEffect(() => {
    let alive = true
    const location = parseCentralPathRef(subjectRef)
    if (!location) {
      setState({phase: 'refused', message: `The return's ref is not a central:path ref: ${subjectRef}`})
      return () => { alive = false }
    }
    setState({phase: 'reading'})
    readFile(transport, {schema: 'central.path-ref/v1', ref: subjectRef, root: location.root, path: location.path})
      .then(reading => { if (alive) setState({phase: 'done', content: reading.content, revision: reading.revision, byteLen: reading.byte_len, path: location.path}) })
      .catch((error: unknown) => { if (alive) setState({phase: 'refused', message: error instanceof Error ? error.message : String(error)}) })
    return () => { alive = false }
  }, [transport, subjectRef])

  if (state.phase === 'reading') return <p className="inhabitant-device-note" role="status" data-wiki-return-standing="reading">Reading the wiki return…</p>
  if (state.phase === 'refused') return <p className="inhabitant-device-fault" role="alert" data-wiki-return-standing="refused">The wiki return was refused by its owner: {state.message}</p>
  const named = namedWikiSubjects(state.content)
  const preview = state.content.length > READ_PREVIEW_CHARS ? `${state.content.slice(0, READ_PREVIEW_CHARS)}…` : state.content
  return (
    <div data-wiki-return-standing="read" data-wiki-return-path={state.path}>
      <p className="inhabitant-device-note" data-wiki-return-basis>{state.path} · <span className="mono">{state.revision}</span>{state.byteLen !== null ? ` · ${state.byteLen} B` : ''}</p>
      <pre className="inhabitant-device-note" data-wiki-return-content style={{whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto'}}>{preview}</pre>
      <NamedWikiSubjects refs={named} from="This wiki return"/>
    </div>
  )
}

// ---------------------------------------------------------------------------
// the conversation

function ConversationPane({transport, spaceRef}: {transport: KernelTransportStatus; spaceRef: string}) {
  return (
    <div data-conversation-gap={CONVERSATION_BINDING_GAP.owner}>
      <NaraConversationFace transport={transport} project={null} expressionRef={null} conversation={spaceRef}/>
    </div>
  )
}

// ---------------------------------------------------------------------------

const KIND_LABEL: Record<CentralClipSelection['kind'], string> = {
  day: 'day',
  return: 'return',
  conversation: 'conversation',
  other: 'material',
}

export function CentralClipDetail({transport, selection}: CentralClipDetailProps) {
  const dayRef = selection.dayRef
  const civilDate = selection.civilDate
  const undated = !civilDate
  const stands = selection.kind === 'day' || selection.kind === 'return'
  return (
    <section className="inhabitant-device" data-central-clip={selection.kind} data-subject-ref={selection.subjectRef}
      data-civil-day={civilDate ?? ''} data-stream={selection.stream ?? ''} data-return-kind={selection.returnKind ?? ''}>
      <header className="inhabitant-device-head">
        <span className="inhabitant-device-mark"><KindMark kind={selection.kind === 'conversation' ? 'agent' : selection.kind === 'day' ? 'day' : 'source'} size={12} title={`central ${KIND_LABEL[selection.kind]}`}/></span>
        <strong>Central · {KIND_LABEL[selection.kind]}</strong>
        <span className="inhabitant-device-sub">{selection.summary ?? selection.subjectRef}</span>
        <span className="inhabitant-device-save" data-clip-identity={selection.subjectRef}>{civilDate ? `day ${civilDate}` : 'undated'}</span>
      </header>
      {selection.kind === 'return' && selection.returnKind === 'now' && <NowReturnPane key={`now:${selection.subjectRef}`} transport={transport} nowRef={selection.subjectRef}/>}
      {selection.kind === 'return' && selection.returnKind === 'wiki-return' && <WikiReturnPane key={`wiki:${selection.subjectRef}`} transport={transport} subjectRef={selection.subjectRef}/>}
      {selection.kind === 'day' && dayRef && <DayDocumentPane key={`day:${dayRef}`} transport={transport} dayRef={dayRef}/>}
      {selection.kind === 'conversation' && <ConversationPane key={`conv:${selection.subjectRef}`} transport={transport} spaceRef={selection.subjectRef}/>}
      {selection.kind === 'other' && <p className="inhabitant-device-notice" data-central-other>This clip stands for material the Central vertical does not own ({selection.stream ?? 'no stream'}), so no Central device opens for it.</p>}
      {stands && undated && <p className="inhabitant-device-notice" data-undated>Undated: the reading gives this clip no civil day, so no Day document opens for it.</p>}
      {selection.kind === 'return' && dayRef && (
        <div data-day-context={civilDate ?? ''}>
          <p className="inhabitant-device-note">The day this return stands in</p>
          <DayDocumentPane key={`day-context:${dayRef}`} transport={transport} dayRef={dayRef}/>
        </div>
      )}
    </section>
  )
}
