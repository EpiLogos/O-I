// A Central document in a pane (DLW §5; the mockup's `modes.base`: the Day on the left, a Flow on the right; manual §10.2
// "Each pane holds one instrument"). The pane kind `projection.central-document` is admitted through the cradle's projection
// module door (desktop/cradle/src/surface/projectionModules.ts), the same door the Timeline, the Earth and the full-size
// device pane are admitted through (projections/timelinePane.tsx, frame/devices/devicePane.tsx).
//
// The body is an existing owner-backed body, ported, never recreated:
//   - a Day is the Day die's hosted form (inhabitants/DocumentDayDieFace.tsx) over the owner's `open-day` reading — the same
//     body the Day die opens full size in a pane, and the same one the Document clip draws;
//   - a Flow is the Flow's hosted form (inhabitants/DocumentFlowFace.tsx) over the owner's file route.
// Both write only through their owners' own routes (the die face's `mutate-field`, the Flow's CAS write). Neither is a
// device here: the Day die the browser shows on the Device chain keeps driving the open document (central/devices).
//
// The pane draws the document and nothing around it: the faces were drawn for the device card, and this pane's stylesheet
// (centralDocuments.css) lays them out for a pane — the form fills the pane on the paper's ground, its own save strip is a
// quiet line under it. A document the owner has not stood up is the owner's sentence, not a blank or a stand-in.
//
// Lifetime: the module mounts its own React root into the pane element and unmounts that root alone. A concealed pane keeps
// its root mounted (the hidden-inhabitant law), so an unsaved draft in a hosted form survives a tab switch. A new kernel
// connection generation remounts the module (surface/projectionPane.tsx), and the owner is read again.
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {registerProjectionModule} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {USER_FLOWS_DIR} from '../../../../../../desktop/cradle/src/flow/instances'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {DocumentDayDieFace} from '../../inhabitants/DocumentDayDieFace'
import {FlowFace} from '../../inhabitants/DocumentFlowFace'
import {PageFace, type PageLinkTarget} from '../../inhabitants/DocumentPageFace'
import {openBinding} from '../../../../../../desktop/cradle/src/surface/engine'
import {listFiles} from '../../../../../../desktop/cradle/src/files/client'
import {readPageOwned} from '../../../../../../desktop/cradle/src/personal/pageOwner'
import type {DayDocumentStanding} from '../centralVertical'
import {CentralDayNotice} from '../CentralDayNotice'
import {CENTRAL_DOCUMENT_PANE_KIND, openCentralDocumentAt, parseDocumentSubject} from './centralDocuments'
import {readLatestFlow, type FlowReading} from './documentReadings'
import {useDayAnswer} from '../../owners/day'
import './centralDocuments.css'
import {DocumentPaneContext, documentLayoutWriter} from './documentDoor'

/** A count that advances when the window regains focus or becomes visible: a document that can change outside this shell (a
 * Day initialised elsewhere) is read again then — never polled. */
function useWindowReturns(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const again = () => { if (document.visibilityState !== 'hidden') setCount(value => value + 1) }
    window.addEventListener('focus', again)
    document.addEventListener('visibilitychange', again)
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again) }
  }, [])
  return count
}

/** The owner's standing for one Day (`dayRef` null: the current Day); null while the owner answers. The window's shared Day
 * answer (owners/day.ts): an answered Day is read again when the window is regained; a refusal (the stale-today pointer,
 * refused on every boot) is remembered for the spine's epoch, which this pane's own root reads as published by the shell. */
export function useDayStanding(transport: KernelTransportStatus, dayRef: string | null): DayDocumentStanding | null {
  return useDayAnswer(transport, dayRef).standing
}

/** The most recent Flow the owner lists; null while the owner answers. It is chosen once and held — a Flow written while this
 * one is open does not take the pane out from under its draft — and read again only while there is none to hold. */
export function useLatestFlow(transport: KernelTransportStatus): FlowReading | null {
  const returns = useWindowReturns()
  const [held, setHeld] = useState<FlowReading | null>(null)
  const chosen = useRef(false)
  useEffect(() => {
    if (chosen.current) return
    let alive = true
    void readLatestFlow(transport).then(reading => { if (alive) { chosen.current = reading.state === 'found'; setHeld(reading) } })
    return () => { alive = false }
  }, [transport, returns])
  return held
}

const Absence = ({form, state, children}: {form: string; state: string; children: ReactNode}) => (
  <div className="central-document-absence" role="status" data-central-absence={state} data-central-document-form={form}>
    <p className="central-document-eyebrow">{form}</p>
    {children}
  </div>
)

/** Open what a page's link names, in the shell, and say why not when it cannot: the opener every hosted page in a pane follows its
 * links with (the Day's form, a Flow, a Being, a Thing), and the words its pane shows under the page when the opening fails. */
export function useLinkOpener(transport: KernelTransportStatus): {openLink: (target: PageLinkTarget) => void; fault: string | undefined} {
  const [fault, setFault] = useState<string>()
  const openLink = useCallback((target: PageLinkTarget) => {
    setFault(undefined)
    void openPageLink(transport, target).catch(error => setFault(String(error instanceof Error ? error.message : error)))
  }, [transport])
  return {openLink, fault}
}

type ReadyDay = Extract<DayDocumentStanding, {state: 'ready'}>

/** Which Day a Day pane shows (Two Days at a time, manual §18.2). `held` is the Day it showed, `ready` the owner's Day for its subject
 * now, `dirty` whether the shown Day's form holds a draft. A draft keeps its Day in the pane when the owner's Day moves on (a new civil
 * Day, a rollover) or stands no document yet; without one the pane follows the owner. `kept` says the pane shows a Day the owner no
 * longer names for its subject. Pure. */
export function keptDay(held: ReadyDay | null, ready: ReadyDay | null, dirty: boolean): {held: ReadyDay | null; shown: ReadyDay | null; kept: boolean} {
  const same = (a: ReadyDay | null, b: ReadyDay | null) => !!a && !!b && a.sourceRef === b.sourceRef && a.documentId === b.documentId
  const next = ready && !same(held, ready) && (!dirty || !held) ? ready : held
  const shown = dirty && next ? next : ready
  return {held: next, shown, kept: !!shown && !same(shown, ready)}
}

/** The Day as the owner stands it: its die when the owner has stood the Day up, else the owner's own words for why not.
 *
 * Two Days at a time (manual §18.2): a pane that holds the current Day keeps the Day it shows while that Day's draft stands, when the
 * owner's current Day moves on (the civil boundary, a rollover — read again when the window returns) or the new Day has no
 * document yet (keptDay). The die is not unmounted under its draft; the pane says which Day it keeps and why, and moves on once the
 * draft is saved or set aside. */
export function DayView({transport, standing}: {transport: KernelTransportStatus; standing: DayDocumentStanding | null}) {
  const {openLink, fault} = useLinkOpener(transport)
  const [held, setHeld] = useState<ReadyDay | null>(null)
  const [dirty, setDirty] = useState(false)
  const view = keptDay(held, standing?.state === 'ready' ? standing : null, dirty)
  useEffect(() => { if (view.held !== held) setHeld(view.held) }, [view.held, held])
  const shown = view.shown, moved = view.kept
  if (!shown) {
    if (!standing || standing.state === 'ready') return <Absence form="Day" state="reading"><p>Reading the owner’s Day…</p></Absence>
    return <Absence form="Day" state={standing.state}><CentralDayNotice notice={standing} /></Absence>
  }
  return <>
    {moved && <p className="inhabitant-device-notice central-document-kept" role="status" data-day-kept={shown.civilDate}>
      Central’s current Day is {standing?.civilDate ?? 'not read'}{standing && standing.state !== 'ready' ? ` (${standing.state})` : ''}. This pane keeps {shown.civilDate}’s Day while its draft stands: save it or set it aside, and the pane moves on.</p>}
    <DocumentDayDieFace key={`${shown.sourceRef}|${shown.documentId}`} transport={transport} project={null} sourceRef={shown.sourceRef} documentId={shown.documentId}
      presentation="pane" openLink={openLink} onDirty={setDirty} />
    {fault && <p className="inhabitant-device-fault" role="alert">{fault}</p>}
  </>
}

/** The Day of one civil date, or (`dayRef` null) the owner's current Day. */
export function DayDocument({transport, dayRef}: {transport: KernelTransportStatus; dayRef: string | null}) {
  return <DayView transport={transport} standing={useDayStanding(transport, dayRef)} />
}

/** One Flow, by its owner location; its links open in the shell. */
export function FlowDocument({transport, location}: {transport: KernelTransportStatus; location: CentralLocation}) {
  const {openLink, fault} = useLinkOpener(transport)
  return <>
    <FlowFace transport={transport} location={location} presentation="pane" openLink={openLink} />
    {fault && <p className="inhabitant-device-fault" role="alert">{fault}</p>}
  </>
}

/** The most recent Flow as the owner lists it, or what the owner says about there being none. */
export function LatestFlowView({transport, reading}: {transport: KernelTransportStatus; reading: FlowReading | null}) {
  if (!reading) return <Absence form="Flow" state="reading"><p>Reading the owner’s Flows…</p></Absence>
  if (reading.state === 'found') return <FlowDocument transport={transport} location={reading.row.location} />
  if (reading.state === 'none') {
    return <Absence form="Flow" state="none">
      <p>{USER_FLOWS_DIR} holds no Flow document: the owner’s listing came back empty. A Flow begins when its first entry is written.</p>
      <p className="central-document-owner">owner: Central files · op: <span className="mono">files_list</span> at <span className="mono">{USER_FLOWS_DIR}</span></p>
    </Absence>
  }
  return <Absence form="Flow" state="refused">
    <p role="alert">The owner refused the Flow listing — “{reading.message}”</p>
    <p className="central-document-owner">owner: Central files · op: <span className="mono">files_list</span> at <span className="mono">{USER_FLOWS_DIR}</span></p>
  </Absence>
}

/** The most recent Flow. */
export function LatestFlowDocument({transport}: {transport: KernelTransportStatus}) {
  return <LatestFlowView transport={transport} reading={useLatestFlow(transport)} />
}

/** Open what a page's link names, in the shell: an http(s) address in a web pane; a page of a world by the owner's own listing of its
 * folder (never a minted ref) and the page owner's reading of its form — a Flow as its Flow, a Being or a Thing as its page. */
export async function openPageLink(transport: KernelTransportStatus, target: {kind: 'page'; path: string} | {kind: 'web'; url: string}): Promise<void> {
  const write = documentLayoutWriter()
  if (!write) throw new Error('No pane tree is mounted to open the link in.')
  if (target.kind === 'web') {
    write(layout => openBinding(layout, {id: crypto.randomUUID(), kind: 'browser', title: target.url, browser: {url: target.url}}))
    return
  }
  const cut = target.path.lastIndexOf('/')
  const folder = await listFiles(transport, target.path.slice(0, cut))
  const entry = folder.entries.find(item => item.kind === 'file' && item.name === target.path.slice(cut + 1))
  if (!entry) throw new Error(`The owner lists no ${target.path.slice(cut + 1)} in ${target.path.slice(0, cut)}.`)
  const page = await readPageOwned(transport, entry.location)
  write(layout => openCentralDocumentAt(layout, page.form === 'flow' ? {form: 'flow', location: entry.location}
    : {form: 'page', kind: page.form === 'thing' ? 'thing' : 'being', location: entry.location}))
}

/** One Being or Thing page, by its owner location; its links open in the shell. */
export function PageDocument({transport, kind, location}: {transport: KernelTransportStatus; kind: 'being' | 'thing'; location: CentralLocation}) {
  const {openLink, fault} = useLinkOpener(transport)
  return <>
    <PageFace transport={transport} kind={kind} location={location} openLink={openLink} />
    {fault && <p className="inhabitant-device-fault" role="alert">{fault}</p>}
  </>
}

/** The pane's body for its subject ref. A ref that names no document this pane holds is said, never another document drawn. */
export function CentralDocumentPane({transport, subjectRef}: {transport: KernelTransportStatus; subjectRef: string | undefined}) {
  const subject = parseDocumentSubject(subjectRef)
  return (
    <section className="central-document-pane" data-central-document={subject?.form ?? 'unknown'} data-subject={subjectRef ?? ''}>
      {!subject
        ? <Absence form="Document" state="unknown"><p>This pane’s subject, <span className="mono">{subjectRef}</span>, is no Day or Flow. Documents open from the browser’s Days and Files rows: double-click one, or press Enter on it.</p></Absence>
        : subject.form === 'day'
          ? <DayDocument transport={transport} dayRef={subject.dayRef} />
          : subject.form === 'page'
            ? <PageDocument transport={transport} kind={subject.kind} location={subject.location} />
          : subject.location
            ? <FlowDocument transport={transport} location={subject.location} />
            : <LatestFlowDocument transport={transport} />}
    </section>
  )
}

let registered = false

/** Admit the document pane for the `projection.central-document` kind. Called once from App.tsx, beside registerTimelineHost. */
export function registerCentralDocumentPane(): void {
  if (registered) return
  registered = true
  registerProjectionModule({
    id: 'central-document',
    kind: CENTRAL_DOCUMENT_PANE_KIND,
    create: ({element, binding}) => {
      const root = createRoot(element)
      root.render(<DocumentPaneContext.Provider value={binding.id}><CentralDocumentPane transport={detectTransport()} subjectRef={binding.subject_ref} /></DocumentPaneContext.Provider>)
      // The pane session tears down inside a commit; the root leaves after it (its container is the session's own).
      return {unmount: () => queueMicrotask(() => root.unmount())}
    },
  })
}
