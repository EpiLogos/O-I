// The trail (manual §10.7): every place you went, newest first, from the world context the book keeps — the one
// selection's moves and the encounters before them. Selecting a stop returns to it: the mode it was in, and the same
// thing selected. Nothing here stores; the book is the one writer (FOUNDATION F1). It becomes the rail's Trail widget
// at F8.
import {useOptionalContinuity} from '../continuity/workspace'
import type {TrailStop} from '../../../../../desktop/cradle/src/workspace/store'
import {MODE_CURATION} from '../../../../../desktop/cradle/src/workspace/mode'

export function TrailWidget() {
  const continuity = useOptionalContinuity()
  const context = continuity?.current.context
  const stops = [...(context?.trail ?? [])].reverse()
  const here = context?.selection
  if (!stops.length) return <p className="mode-dock-note">Every place you go is kept here. Select a Day, a clip or a task, and you can return to it.</p>
  const returnTo = (stop: TrailStop) => {
    if (!continuity) return
    continuity.switchMode(stop.mode)
    if (stop.surfaceRef && stop.surfaceKind) {
      const selection = {mode: stop.mode, kind: stop.surfaceKind, ref: stop.surfaceRef, title: stop.label, track: stop.position}
      continuity.setContext(current => ({...current, selection}))
    }
  }
  return <ol className="mode-dock-rows trail-stops" aria-label="Trail">
    {stops.map((stop, index) => {
      const current = !!here && here.ref === stop.surfaceRef && here.kind === stop.surfaceKind
      return <li key={`${index}-${stop.surfaceRef ?? stop.label}`} className="mode-dock-row" data-trail-stop={stop.surfaceKind ?? stop.mode} aria-current={current ? 'location' : undefined}>
        <button type="button" className="trail-stop" title={stop.surfaceRef ?? stop.label} onClick={() => returnTo(stop)}>
          <span>{MODE_CURATION[stop.mode].label}</span><b>{stop.label}</b>
        </button>
      </li>
    })}
  </ol>
}
