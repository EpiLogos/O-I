// The Session · Arrangement pane (FOUNDATION F3): the `projection.timeline` pane kind admitted through the cradle's
// projection module door (desktop/cradle/src/surface/projectionModules.ts), the same door registerAtlasHost.ts admits the
// Earth through. Its body is the one Session grid and Arrangement ruler over the mode's tracks (frame/tracks/TracksPane.tsx),
// fed by the reading the frame publishes (timelinePaneHost.ts); its presentation is the pane's own, moved by Tab.
//
// Follow and pin (manual §10.2, FOUNDATION F2): the pane follows THE selection — the clip or track the grid and the ruler
// draw as selected — unless it is pinned. A pinned pane keeps the ref it was pinned to as its selected one while the
// selection moves elsewhere; the module reads the pane's subject (`context.subject`) and the body draws it. The pin reaches
// the mounted body through the subject channel, never by a remount.
//
// Lifecycle: the module mounts its own React root into the pane element and unmounts that root alone. Its subscriptions are
// the two useSyncExternalStore reads, which the root releases on unmount; the published reading itself belongs to the App
// and is not disposed here. A concealed pane keeps its root mounted (the hidden-inhabitant law).

import {useSyncExternalStore, type ComponentType} from 'react'
import {createRoot} from 'react-dom/client'
import {registerProjectionModule, type PaneSubject, type ProjectionModuleHandle} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {TracksPane} from '../frame/tracks/TracksPane'

export const TIMELINE_MODULE_ID = 'timeline-world'

/** The pane body: the one Session grid or Arrangement ruler over the mode's tracks (frame/tracks/TracksPane.tsx). */
export const TimelinePaneBody = TracksPane

/** The body as the pin reaches it: `pinnedRef` is the ref a pinned pane keeps as its selected one (absent: it follows the
 * published selection). TracksPane takes it as an optional prop; until it does, a pin has no effect on the body. */
export interface PinnedTracksProps {pinnedRef?: string}
const PinnedTracks: ComponentType<PinnedTracksProps> = TracksPane

const noUnsubscribe = () => () => {}
const noPin = () => undefined

/** The pane root: the tracks body, told which ref the pane is pinned to (nothing, while it follows). */
export function TimelinePaneRoot({subject}: {subject?: PaneSubject}) {
  const pinnedRef = useSyncExternalStore(subject ? subject.subscribe : noUnsubscribe, subject ? subject.pinned : noPin, noPin)
  return <PinnedTracks pinnedRef={pinnedRef} />
}

/** Mount one Timeline body into a pane element. The module owns the element's content and leaves it clean on unmount. */
function mountTimelinePane(element: HTMLElement, subject?: PaneSubject): ProjectionModuleHandle {
  const root = createRoot(element)
  root.render(<TimelinePaneRoot subject={subject} />)
  // The pane session tears down inside a commit; the root leaves after it (its container is the session's own).
  return {unmount: () => queueMicrotask(() => root.unmount())}
}

let registered = false

/** Admit the Timeline body for the `projection.timeline` pane kind. Called once from App.tsx, beside registerAtlasHost. */
export function registerTimelineHost(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: TIMELINE_MODULE_ID, kind: 'projection.timeline', follows: true, create: context => mountTimelinePane(context.element, context.subject)})
}
