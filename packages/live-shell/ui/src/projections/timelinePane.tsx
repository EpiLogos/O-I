// The Session · Arrangement pane (FOUNDATION F3): the `projection.timeline` pane kind admitted through the cradle's
// projection module door (desktop/cradle/src/surface/projectionModules.ts), the same door registerAtlasHost.ts admits the
// Earth through. Its body is the one Session grid and Arrangement ruler over the mode's tracks (frame/tracks/TracksPane.tsx),
// fed by the reading the frame publishes (timelinePaneHost.ts); its presentation is the pane's own, moved by Tab.
//
// Lifecycle: the module mounts its own React root into the pane element and unmounts that root alone. Its subscriptions are
// the two useSyncExternalStore reads, which the root releases on unmount; the published reading itself belongs to the App
// and is not disposed here. A concealed pane keeps its root mounted (the hidden-inhabitant law).

import {createRoot} from 'react-dom/client'
import {registerProjectionModule, type ProjectionModuleHandle} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {TracksPane} from '../frame/tracks/TracksPane'

export const TIMELINE_MODULE_ID = 'timeline-world'

/** The pane body: the one Session grid or Arrangement ruler over the mode's tracks (frame/tracks/TracksPane.tsx). */
export const TimelinePaneBody = TracksPane

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
