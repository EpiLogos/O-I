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
import {useEffect, useRef, useState, type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {registerProjectionModule} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {USER_FLOWS_DIR} from '../../../../../../desktop/cradle/src/flow/instances'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {DocumentDayDieFace} from '../../inhabitants/DocumentDayDieFace'
import {FlowFace} from '../../inhabitants/DocumentFlowFace'
import type {DayDocumentStanding} from '../centralVertical'
import {CentralDayNotice} from '../CentralDayNotice'
import {CENTRAL_DOCUMENT_PANE_KIND, parseDocumentSubject} from './centralDocuments'
import {readDayStanding, readLatestFlow, type FlowReading} from './documentReadings'
import './centralDocuments.css'

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

/** The owner's standing for one Day (`dayRef` null: the current Day); null while the owner answers. */
export function useDayStanding(transport: KernelTransportStatus, dayRef: string | null): DayDocumentStanding | null {
  const returns = useWindowReturns()
  const key = dayRef ?? 'current'
  const [held, setHeld] = useState<{key: string; standing: DayDocumentStanding} | null>(null)
  useEffect(() => {
    let alive = true
    void readDayStanding(transport, dayRef).then(standing => { if (alive) setHeld({key, standing}) })
    return () => { alive = false }
  }, [transport, dayRef, key, returns])
  return held?.key === key ? held.standing : null
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

/** The Day as the owner stands it: its die when the owner has stood the Day up, else the owner's own words for why not. */
export function DayView({transport, standing}: {transport: KernelTransportStatus; standing: DayDocumentStanding | null}) {
  if (!standing) return <Absence form="Day" state="reading"><p>Reading the owner’s Day…</p></Absence>
  if (standing.state === 'ready') {
    return <DocumentDayDieFace transport={transport} project={null} sourceRef={standing.sourceRef} documentId={standing.documentId} presentation="pane" />
  }
  return <Absence form="Day" state={standing.state}><CentralDayNotice notice={standing} /></Absence>
}

/** The Day of one civil date, or (`dayRef` null) the owner's current Day. */
export function DayDocument({transport, dayRef}: {transport: KernelTransportStatus; dayRef: string | null}) {
  return <DayView transport={transport} standing={useDayStanding(transport, dayRef)} />
}

/** One Flow, by its owner location. */
export function FlowDocument({transport, location}: {transport: KernelTransportStatus; location: CentralLocation}) {
  return <FlowFace transport={transport} location={location} presentation="pane" />
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

/** The pane's body for its subject ref. A ref that names no document this pane holds is said, never another document drawn. */
export function CentralDocumentPane({transport, subjectRef}: {transport: KernelTransportStatus; subjectRef: string | undefined}) {
  const subject = parseDocumentSubject(subjectRef)
  return (
    <section className="central-document-pane" data-central-document={subject?.form ?? 'unknown'} data-subject={subjectRef ?? ''}>
      {!subject
        ? <Absence form="Document" state="unknown"><p>This pane’s subject, <span className="mono">{subjectRef}</span>, is no Day or Flow. Documents open from the browser’s Days and Files rows: double-click one, or press Enter on it.</p></Absence>
        : subject.form === 'day'
          ? <DayDocument transport={transport} dayRef={subject.dayRef} />
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
      root.render(<CentralDocumentPane transport={detectTransport()} subjectRef={binding.subject_ref} />)
      // The pane session tears down inside a commit; the root leaves after it (its container is the session's own).
      return {unmount: () => queueMicrotask(() => root.unmount())}
    },
  })
}
