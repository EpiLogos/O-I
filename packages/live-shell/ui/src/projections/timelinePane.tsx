// The Timeline as a pane body (T-FACTORY-TIMELINE-PANE): the `projection.timeline` pane kind admitted through the cradle's
// projection module door (desktop/cradle/src/surface/projectionModules.ts), the same door registerAtlasHost.ts admits the
// Earth through.
//
// The body reads the App's published reading (timelinePaneHost.ts) and renders it through TimelineProjectionResidence, the
// component the World cut renders, with the same props the World cut passes: the set, its document, the selection, the
// colours and the World cut's temporal reading. The native sources are not passed (the World cut passes none either), so
// the body presents the same items the World cut presents for the same document and window. Its presentation is the pane's
// own (Session = Journey, m3; Arrangement = Timeline, m2): choosing one never writes the App's World cut `tab`.
//
// Lifecycle: the module mounts its own React root into the pane element and unmounts that root alone. Its subscriptions are
// the two useSyncExternalStore reads, which the root releases on unmount; the published reading itself belongs to the App
// and is not disposed here. A concealed pane keeps its root mounted (the hidden-inhabitant law).

import {createRoot} from 'react-dom/client'
import {registerProjectionModule, type ProjectionModuleHandle} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {TimelineProjectionResidence} from './timelineResidence'
import {useTimelinePanePresentation, useTimelineReading} from './timelinePaneHost'

export const TIMELINE_MODULE_ID = 'timeline-world'

/** The pane body: the published reading, presented through the residence at the pane's own presentation. */
export function TimelinePaneBody() {
  const reading = useTimelineReading()
  const presented = useTimelinePanePresentation()
  if (!reading) {
    return <p role="status" className="source-note">The Timeline is waiting for the shell to publish its temporal reading.</p>
  }
  return <div className="timeline-pane-body" style={{position: 'absolute', inset: 0, overflow: 'auto'}}>
    <TimelineProjectionResidence set={reading.set} document={reading.document} selection={reading.selection} select={reading.select}
      colors={reading.colors} setColor={reading.setColor} session={undefined} arrangement={undefined} compactTransport={false}
      presented={presented} world={reading.world} journey={reading.journey} />
  </div>
}

/** Mount one Timeline body into a pane element. The module owns the element's content and leaves it clean on unmount. */
function mountTimelinePane(element: HTMLElement): ProjectionModuleHandle {
  const root = createRoot(element)
  root.render(<TimelinePaneBody />)
  return {unmount: () => root.unmount()}
}

let registered = false

/** Admit the Timeline body for the `projection.timeline` pane kind. Called once from App.tsx, beside registerAtlasHost. */
export function registerTimelineHost(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: TIMELINE_MODULE_ID, kind: 'projection.timeline', create: context => mountTimelinePane(context.element)})
}
