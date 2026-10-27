// The page family's devices on Central's chain (lane BC2; DLW §16.2 "Central — A workspace … the document effects, then the agent that
// answers"): what the Workspace, the Document, the Flow and the document effects Text, Highlight and Notes read, gathered from the
// owners the hosted faces already read, and their bindings (pageBindings.ts). The chain (CentralDevices.tsx) places and publishes them.
//
// The reached document is the one the hand last reached in a pane (central/documents/documentDoor.ts): a Flow's face publishes its
// location, draft fact and save outcome there (inhabitants/DocumentFlowFace.tsx), and its file is read again here through the Flow's
// own route (flow/instances.ts readFlowInstance) — keyed by the revision the face holds, so a save in the pane reads the page anew.
// A Day's page is the Day device's document (useCentralReadings.ts useDayDieReading) when the reached Day is that document; any other
// reached Day is read the same way by the document the Day face publishes on the door (lane BC3: DocumentDayDieFace.tsx `day`), its date
// the one its source path names (central/daySurface.ts dateOfDayPath — Central's own `Control/user/day/<date>/day.md`).
//
// Each device's own Full is the page itself: ⤢ brings the document's own pane forward (centralDocuments.ts revealDocumentPane), the
// material the Text, Highlight and Notes Full views name ("the open document at full size", DLW §18.1–§18.1).
import {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import {readFlowInstance} from '../../../../../../desktop/cradle/src/flow/instances'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {BOOK_MODE_OF_SHELL, useOptionalContinuity, type ShellMode} from '../../continuity/workspace'
import type {DesignBinding} from '../../frame/devices/designed'
import type {OwnFull} from '../../frame/devices/deviceDoor'
import type {SaveRouterOutcome} from '../../inhabitants/manifest'
import {useRosterAgents} from '../../owners/readers'
import {revealDocumentPane, subjectOf} from '../documents/centralDocuments'
import {useReachedDocument, type DocumentInPane} from '../documents/documentDoor'
import {centralDeviceId, type CentralReads} from './centralDeviceModel'
import {appendFlowEntry, centralWrite, setFlowMeta} from './centralDeviceWrites'
import {civilDayName, type DayAperture} from './dayBinding'
import {documentBinding, flowBinding, highlightBinding, holdsVersion, notesBinding, subscribeHolds, textBinding, workspaceBinding, type BookWorkspace, type TrackWorld,
  type PageMaterial, type ReachedPage} from './pageBindings'
import {readDayPage, readFlowPage, wordsOfHtml, type FlowPage} from './pageReadings'
import {dateOfDayPath} from '../daySurface'
import {actionAnswerOf, centralActionOp, useCentralAction, useDayDieReading, type ActionAnswer} from './useCentralReadings'
import {kernelOp, kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {CONTEMPLATE_FLOW_ACTION, PC_ACCEPT_ACTION, PC_INSPECT_ACTION, PC_PREVIEW_ACTION, PC_DOCS_ENSURE_ACTION, PC_DOCS_INSPECT_ACTION, PC_TIER_RELATE_ACTION, acceptInput, relateInput,
  lastKeptThought, type FlowThought, type ThoughtHand, type WorkspaceGround} from './pageGround'
import {useOwnerOp} from '../../owners/ownerCall'

/** The Day device's document, as useDayDevice reads it (CentralDevices.tsx). */
export interface DayDocumentReading {
  readonly aperture: DayAperture | null
  readonly face: number | null
  readonly payload: unknown
  readonly civilDate: string | null
}

const OUTCOMES: readonly SaveRouterOutcome[] = ['saved', 'unchanged', 'stale', 'conflict', 'refused']
/** The save router's outcome a face's state words name (documentDoor.ts documentStateWords over documentDeviceModel.ts outcomeLabel:
 * `saved — native save acknowledged`), where the face publishes none of its own. */
export function outcomeOfWords(state: string): SaveRouterOutcome | null {
  const word = state.split(' — ')[0]?.trim() ?? ''
  return (OUTCOMES as readonly string[]).includes(word) ? word as SaveRouterOutcome : null
}
/** The draft fact a face's state words give, where it publishes none of its own: edited since save, or as read / a named outcome. */
export function dirtyOfWords(state: string): boolean | null {
  if (state === 'edited since save') return true
  if (state === 'as read' || outcomeOfWords(state)) return false
  return null
}

const baseName = (path: string): string => (path.split('/').filter(Boolean).pop() ?? path).replace(/\.html$/i, '')

/** The door's document as the bindings read it. `date` is the Day's civil date, when the Day is the Day device's document. */
export function reachedPageOf(doc: DocumentInPane & {form: 'Day' | 'Flow'}, date: string | null): ReachedPage {
  const tabTitle = doc.form === 'Flow'
    ? subjectOf({form: 'flow', location: doc.location ?? null}).title
    : subjectOf({form: 'day', date}).title
  return {
    form: doc.form, tabTitle,
    dirty: doc.dirty ?? dirtyOfWords(doc.state),
    outcome: doc.outcome ?? outcomeOfWords(doc.state),
    name: doc.location ? baseName(doc.location.path) : null,
    ...(doc.save ? {save: doc.save} : {}),
    ...(doc.reread ? {reread: doc.reread} : {}),
  }
}

/** Whether the reached Day is the Day device's own document: by the document the face names on the door, else (a face that names
 * none) by its title. */
export function isDayDevicesDocument(doc: DocumentInPane, day: DayDocumentReading): boolean {
  if (doc.form !== 'Day' || !day.aperture) return false
  return doc.day ? doc.day.sourceRef === day.aperture.sourceRef && doc.day.documentId === day.aperture.documentId : day.aperture.documentId === doc.title
}

/** Another Day the face named on the door (DocumentDayDieFace.tsx `day`, lane BC3): the one the page family reads by that name; null
 * when the reached Day is the Day device's own document, or the face names none. */
export function namedDayOf(doc: DocumentInPane, day: DayDocumentReading): DayAperture | null {
  return doc.form === 'Day' && doc.day && !isDayDevicesDocument(doc, day) ? doc.day : null
}

/** The reached Day's civil date and material: the Day device's own document as that device reads it; another named Day as its own
 * document read by that name (`other`: useDayDieReading's answer — no face until the owner answered), its date the one its source
 * path names (Central's own `Control/user/day/<date>/day.md`, daySurface.ts dateOfDayPath); a Day face that names none reads as its
 * door words alone. */
export function dayPageOf(doc: DocumentInPane, day: DayDocumentReading, other: {readonly face: number | null; readonly payload: unknown} | null): {date: string | null; material: PageMaterial} {
  if (isDayDevicesDocument(doc, day)) {
    return {date: day.civilDate, material: {form: 'day', page: readDayPage(day.payload), face: day.face, date: civilDayName(day.civilDate), refusal: null}}
  }
  const named = namedDayOf(doc, day)
  if (!named) return {date: null, material: {form: 'day', page: null, face: null, date: null, refusal: null}}
  const date = dateOfDayPath(named.sourceRef)
  const face = other?.face ?? null
  return {date, material: {form: 'day', page: face === null ? null : readDayPage(other?.payload), face, date: civilDayName(date), refusal: null}}
}

/** The reached Flow's page, read through the Flow's own route; read again when the revision the face holds moves, or on `refresh`. */
export function useFlowPage(transport: KernelTransportStatus, location: CentralLocation | null, revision: string | null): {page: FlowPage | null; refusal: string | null; refresh: () => void} {
  const [held, setHeld] = useState<{key: string; page: FlowPage | null; refusal: string | null} | null>(null)
  const [again, setAgain] = useState(0)
  const key = location ? `${location.ref}|${revision ?? ''}|${again}` : null
  useEffect(() => {
    if (!location || !key) return
    let alive = true
    readFlowInstance(transport, location).then(
      instance => { if (alive) setHeld({key, page: readFlowPage(instance.doc), refusal: null}) },
      cause => { if (alive) setHeld({key, page: null, refusal: cause instanceof Error ? cause.message : String(cause)}) },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the read
  }, [transport, key])
  const refresh = useCallback(() => setAgain(count => count + 1), [])
  // While a read for a new key answers, the last page of the same Flow stands (no flash of "no reading" after a save).
  const same = held && location && held.key.startsWith(`${location.ref}|`)
  return {page: same ? held.page : null, refusal: same ? held.refusal : null, refresh}
}

export interface PageDevices {
  /** The reached document's form, or null when none is reached. */
  readonly form: 'Day' | 'Flow' | null
  /** Whether a workspace book is mounted (the Workspace stands only then). */
  readonly book: boolean
  /** The bindings by device id. */
  readonly bindings: Readonly<Record<string, DesignBinding>>
  /** Each device's own Full by id: the page's own pane. */
  readonly fulls: Readonly<Record<string, OwnFull>>
  /** The summaries the generic rows read (centralDeviceModel.ts CentralReads). */
  readonly reads: Pick<CentralReads, 'page' | 'workspace' | 'flow'>
  /** The reached document, for the Central writers (the Document's Save, the Flow's next entry). */
  readonly page: {readonly save?: () => void; readonly location?: CentralLocation | null; readonly dirty?: boolean | null} | null
  /** Read the reached page again (after an entry was appended). */
  readonly refresh: () => void
}

/** The shell mode a book mode stands for (continuity/workspace.tsx BOOK_MODE_OF_SHELL, read backwards: a table, never a branch). */
const SHELL_MODE_OF_BOOK: Readonly<Record<string, ShellMode>> = Object.fromEntries(Object.entries(BOOK_MODE_OF_SHELL).map(([shell, book]) => [book, shell as ShellMode]))
const shellModeOf = (mode: string): ShellMode | undefined => SHELL_MODE_OF_BOOK[mode]

const clipboard = (text: string): Promise<void> => (typeof navigator !== 'undefined' && navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('No clipboard here.')))

/** The dispatch of one invoke_action as an answer (Central's or AIKit's data, or its words). */
const answerOfCall = (call: Awaited<ReturnType<typeof kernelOp>>, action: string): ActionAnswer =>
  call.error ? {status: 'refused', error: call.error} : actionAnswerOf({status: 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: null}, action)

/** The Flow's Thought page (pageGround.ts): the preflight, the one run and what changed since, each asked by a press for the Flow's AIKit
 * Flow ref (its document id, as the cradle names it: CradleFrame.tsx `flow.flowRef`), held for that Flow in this window only. */
export function useFlowThought(transport: KernelTransportStatus, flowRef: string | null): {state: FlowThought; hand: ThoughtHand | null} {
  const [held, setHeld] = useState<{ref: string; state: FlowThought} | null>(null)
  const ran = held && held.ref === flowRef ? held.state : {flowRef}
  // The Flow's last thought as AIKit keeps it (W11), and what changed since that one — read for the Flow, never by a press.
  const keptOp = useMemo(() => (flowRef && transport.kind !== 'unavailable' ? {op: 'aikit_read' as const, request: {kind: 'flow-thoughts' as const, flow_ref: flowRef, limit: 1}} : null), [flowRef, transport])
  const keptRead = useOwnerOp(transport, keptOp, 'owner_route_reading').reading
  const kept: ActionAnswer = keptRead.status === 'answered' ? {status: 'answered', value: keptRead.value?.data ?? null}
    : keptRead.status === 'refused' ? {status: 'refused', error: keptRead.error ?? 'AIKit refused its kept thoughts.'} : {status: 'reading'}
  const last = kept.status === 'answered' ? lastKeptThought(kept.value) : undefined
  const sinceOp = useMemo(() => (last && !ran.thought && transport.kind !== 'unavailable' ? {op: 'flow_changed_since' as const, thought: last.thought} : null), [last ? JSON.stringify(last.thought) : null, ran.thought, transport]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinceRead = useOwnerOp(transport, sinceOp, 'flow_changed_since').reading
  const keptSince: FlowThought['since'] = !sinceOp ? undefined : sinceRead.status === 'answered' ? {status: 'answered', value: sinceRead.value?.reading ?? null}
    : sinceRead.status === 'refused' ? {status: 'refused', error: sinceRead.error ?? 'The kernel did not answer what changed since the thought.'} : {status: 'reading'}
  const state: FlowThought = {...ran, kept, ...(keptSince ? {keptSince} : {})}
  const hand = useMemo((): ThoughtHand | null => !flowRef || transport.kind === 'unavailable' ? null : {
    preflight: async () => {
      const call = await kernelOp(transport, {op: 'invoke_action', invocation: {action: CONTEMPLATE_FLOW_ACTION, target_ref: flowRef}})
      setHeld({ref: flowRef, state: {flowRef, preflight: answerOfCall(call, CONTEMPLATE_FLOW_ACTION)}})
    },
    contemplate: async record => {
      const call = await kernelOp(transport, {op: 'invoke_action', invocation: {action: CONTEMPLATE_FLOW_ACTION, target_ref: flowRef, input: {execute: record}}})
      setHeld(was => ({ref: flowRef, state: {...(was?.ref === flowRef ? was.state : {flowRef}), thought: answerOfCall(call, CONTEMPLATE_FLOW_ACTION), since: undefined}}))
    },
    since: async thought => {
      const call = await kernelOp(transport, {op: 'flow_changed_since', thought})
      const since: FlowThought['since'] = call.outcome?.result === 'flow_changed_since' ? {status: 'answered', value: call.outcome.reading} : {status: 'refused', error: call.error ?? 'The kernel did not answer what changed since the thought.'}
      setHeld(was => ({ref: flowRef, state: {...(was?.ref === flowRef ? was.state : {flowRef}), since}}))
    },
  }, [transport, flowRef])
  return {state, hand}
}

/** The Workspace's Ground and Self pages (pageGround.ts): Central's inspection and self reading of the workspace's project world, held for
 * the window; the preview asked by a press; and the person's Accept, Ensure and Relate, written through invoke_action as the person's own
 * presses (action.rs PERSON_ACTS) — each write retires the held readings, so the inspection and the self are read again behind it. No
 * project (a workspace of your root): nothing is asked, and nothing written. */
export function useWorkspaceGround(transport: KernelTransportStatus, project: string | null): WorkspaceGround {
  const input = useMemo(() => (project ? {project} : null), [project])
  const pc = useCentralAction(transport, PC_INSPECT_ACTION, input)
  const self = useCentralAction(transport, PC_DOCS_INSPECT_ACTION, input)
  const [plan, setPlan] = useState<{project: string; treatment: 'adopt' | 'migrate'; answer: ActionAnswer} | null>(null)
  const preview = useCallback(async (treatment: 'adopt' | 'migrate', source: string) => {
    if (!project) return
    const call = await kernelRead(transport, centralActionOp(PC_PREVIEW_ACTION[treatment], {project, source}), {fresh: true})
    setPlan({project, treatment, answer: answerOfCall(call, PC_PREVIEW_ACTION[treatment])})
  }, [transport, project])
  const writes = useMemo(() => (project && transport.kind !== 'unavailable' ? {
    accept: async (treatment: 'create' | 'adopt' | 'migrate', source: string | null) => {
      await centralWrite(transport, PC_ACCEPT_ACTION[treatment], acceptInput(project, treatment, source))
      setPlan(null)
    },
    ensure: async () => { await centralWrite(transport, PC_DOCS_ENSURE_ACTION, {project}) },
    relate: async (tier: number, sourceRef: string) => { await centralWrite(transport, PC_TIER_RELATE_ACTION, relateInput(project, tier, sourceRef)) },
  } : {}), [project, transport])
  return useMemo(() => ({project, ...(project ? {pc, self, preview, ...writes} : {}), ...(plan && plan.project === project ? {plan: {treatment: plan.treatment, answer: plan.answer}} : {})}),
    [project, pc, self, preview, writes, plan])
}

/** The page family's readings and bindings over the reached document, the Day device's document, the roster and the workspace book. */
/** The world a world's head opened the Workspace on, and the projects of Work that are worlds (the Workspace's Folder choices). */
export interface PageWorld {
  readonly world: TrackWorld | null
  readonly folders: readonly string[] | null
}

export function usePageDevices(transport: KernelTransportStatus, day: DayDocumentReading, worldOf: PageWorld = {world: null, folders: null}): PageDevices {
  // The page family's devices speak of a Day or a Flow; a Being or a Thing reached in its pane leaves them as when none is reached.
  const reachedNow = useReachedDocument()
  const doc = reachedNow && (reachedNow.form === 'Day' || reachedNow.form === 'Flow') ? reachedNow as DocumentInPane & {form: 'Day' | 'Flow'} : null
  const book = useOptionalContinuity()
  const roster = useRosterAgents(transport)
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const location = doc?.form === 'Flow' ? doc.location ?? null : null
  const flow = useFlowPage(transport, location, doc?.revision ?? null)
  // The reached Day: the Day device's own document, or another the Day face named on the door (read here by that name).
  const named = doc ? namedDayOf(doc, day) : null
  const otherProject = named?.project ?? null, otherSource = named?.sourceRef ?? null, otherDocument = named?.documentId ?? null
  // The Day is its parts: the face publishes a fresh object on each render.
  const otherDay = useMemo(() => (otherSource && otherDocument ? {project: otherProject, sourceRef: otherSource, documentId: otherDocument} : null), [otherProject, otherSource, otherDocument])
  const other = useDayDieReading(transport, otherDay)
  const dayPage = useMemo(() => (doc?.form === 'Day' ? dayPageOf(doc, day, otherDay ? {face: other.face, payload: other.payload} : null) : null),
    // The Day device's document is its parts; the door's document its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, day.aperture?.sourceRef, day.aperture?.documentId, day.face, day.payload, day.civilDate, otherDay, other.face, other.payload])
  const date = dayPage?.date ?? null
  const reached = useMemo(() => (doc ? reachedPageOf(doc, date) : null), [doc, date])
  const material = useMemo((): PageMaterial | null => {
    if (!doc) return null
    if (doc.form === 'Flow') return {form: 'flow', page: flow.page, refusal: flow.refusal}
    return dayPage?.material ?? {form: 'day', page: null, face: null, date: null, refusal: null}
  }, [doc, flow.page, flow.refusal, dayPage])
  const agents = roster.state === 'ready' ? roster.agents : null
  const refreshFlow = flow.refresh
  const current = book?.current as unknown as BookWorkspace | undefined
  const switchMode = book?.setMode, rename = book?.rename, setLayout = book?.setLayout
  // The Flow's Thought, for its AIKit Flow ref; the workspace's world's ground, for its project (W2: pageGround.ts).
  const flowPage = flow.page
  const thought = useFlowThought(transport, flowPage?.documentId ?? null)
  // The Workspace's Ground and Self read the world its head opened it on (§18.1: the track's Workspace device), else the book's project.
  const world = worldOf.world, folders = worldOf.folders
  const ground = useWorkspaceGround(transport, world ? world.project : current?.project ?? null)
  return useMemo((): PageDevices => {
    const bindings: Record<string, DesignBinding> = {}
    const fulls: Record<string, OwnFull> = {}
    const id = centralDeviceId
    if (current || world) {
      bindings[id('workspace')] = workspaceBinding(id('workspace'), current ?? null, Date.now(), switchMode && rename ? {switchMode: mode => { const shell = shellModeOf(mode); if (!shell) throw new Error(`${mode} is no mode of the shell.`); switchMode(shell) }, rename} : null, ground,
        world, folders)
    }
    if (!doc || !reached) {
      return {form: null, book: !!book, bindings, fulls, reads: {page: null, workspace: current ? {name: current.name, mode: current.layout.mode ?? 'base'} : null, flow: null},
        page: null, refresh: refreshFlow}
    }
    const open: OwnFull | undefined = setLayout ? {open: () => setLayout(layout => revealDocumentPane(layout, doc.paneId, doc.location ?? null))} : undefined
    const meta = doc.form === 'Flow' && location ? async (change: {readonly title?: string; readonly view?: string}) => {
      await setFlowMeta(transport, location, change)
      refreshFlow()
      doc.reread?.()
    } : null
    bindings[id('document')] = documentBinding(id('document'), reached, material, clipboard, meta)
    if (open) fulls[id('document')] = open
    if (doc.form === 'Flow') {
      const writers = location ? {append: async (entry: Parameters<typeof appendFlowEntry>[2]) => {
        await appendFlowEntry(transport, location, entry)
        refreshFlow()
        // The hosted face holds no draft (the append refuses while it does): it reads the page again, with the entry on it.
        doc.reread?.()
      }, ...(meta ? {meta} : {})} : null
      bindings[id('flow-document')] = flowBinding(id('flow-document'), reached, material, agents, writers, thought)
      bindings[id('text')] = textBinding(id('text'), reached, material)
      bindings[id('highlight')] = highlightBinding(id('highlight'), reached, material)
      bindings[id('notes')] = notesBinding(id('notes'), reached, material)
      if (open) for (const face of ['flow-document', 'text', 'highlight', 'notes']) fulls[id(face)] = open
    }
    const page = material?.page ?? null
    const flowPage = page && page.form === 'flow' ? page : null
    const highlights = flowPage ? flowPage.entries.reduce((n, entry) => n + wordsOfHtml(entry.html).reduce((runs, word, at, all) => runs + (word.marked && !all[at - 1]?.marked ? 1 : 0), 0), 0)
      : page && page.form === 'day' ? page.highlights : null
    return {
      form: doc.form, book: !!book, bindings, fulls,
      reads: {
        page: {form: doc.form, title: flowPage?.title || reached.tabTitle, state: doc.state, entries: flowPage ? flowPage.entries.length : null, highlights, notes: page ? page.notes.length : null},
        workspace: current ? {name: current.name, mode: current.layout.mode ?? 'base'} : null,
        flow: location ? {path: location.path, revision: doc.revision ?? null, state: reached.dirty === null ? null : reached.dirty ? 'edited since save' : 'saved'} : null,
      },
      page: {save: doc.save, location, dirty: reached.dirty},
      refresh: refreshFlow,
    }
    // The holds' version re-binds the view's own keys; `heldOf` reads them inside the builders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, reached, material, agents, current, switchMode, rename, setLayout, location, transport, refreshFlow, book, version, thought, ground, world, folders])
}

