// The main area's view (manual §10.2): Session view, Arrangement view or Pane view. Session and Arrangement are two views of
// the mode's one set of tracks (frame/tracks/TracksPane.tsx, drawn straight into the main area); Pane view is the pane tree,
// where devices' Full views stand (native/Workbench.tsx). No pane holds the set's views: a request for them switches the view.
//
// Which of Session and Arrangement stands is the tracks' own presentation (projections/timelinePaneHost.ts), so the grid, the
// ruler, the transport and the Device side read one value. This module holds only whether the set or the panes stand, and the
// one writer every switch goes through: the transport's marks, Tab, ⌥⌘9, the instrument door and the focus keys.
import {useSyncExternalStore} from 'react'
import {setTimelinePanePresentation, timelinePanePresentation, useTimelinePanePresentation, type TimelinePresentation} from '../projections/timelinePaneHost'

export type MainView = TimelinePresentation | 'pane'

/** Whether the set (Session or Arrangement) or the panes stand in the main area. */
let layer: 'set' | 'pane' = 'pane'
const listeners = new Set<() => void>()

function setLayer(next: 'set' | 'pane'): void {
  if (next === layer) return
  layer = next
  for (const listener of listeners) listener()
}

/** The view that stands now. */
export function mainViewNow(): MainView {
  return layer === 'pane' ? 'pane' : timelinePanePresentation()
}

/** Show a view. Session or Arrangement also sets the tracks' presentation; Pane keeps it, so Tab returns to the one you left. */
export function showMainView(next: MainView): void {
  if (next !== 'pane') setTimelinePanePresentation(next)
  setLayer(next === 'pane' ? 'pane' : 'set')
}

/** Tab (manual §10.2): between Session view and Arrangement view; from Pane view, back to the one you left. */
export function tabMainView(): void {
  if (layer === 'pane') showMainView(timelinePanePresentation())
  else showMainView(timelinePanePresentation() === 'session' ? 'arrangement' : 'session')
}

/** ⌥⌘9: Pane view, or back to the set view you left. */
export function togglePaneView(): void {
  showMainView(layer === 'pane' ? timelinePanePresentation() : 'pane')
}

/** The view as a hook: the frame, the transport's marks and the status bar re-read it when it changes. */
export function useMainView(): MainView {
  const standing = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => layer, () => layer)
  const presentation = useTimelinePanePresentation()
  return standing === 'pane' ? 'pane' : presentation
}
