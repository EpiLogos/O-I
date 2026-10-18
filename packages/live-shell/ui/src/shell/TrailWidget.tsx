// The trail (manual §10.7): every place you went, newest first, from the world context the book keeps — THE selection's
// moves and the encounters before them. Selecting a stop returns to it: the mode it was in, and the same thing selected.
// Nothing here stores; the book is the one writer (FOUNDATION F1). It is the rail's Trail widget (F8), drawn as the
// mockup's stops (world-shell-mockup.html `tileBody('trail')` 1631: a time, the place, the kind of work it was in).
//
// A stop's time is the book's when it holds one (`at`, epoch ms); the book's TrailStop records none yet
// (desktop/cradle/src/workspace/store.ts), so a stop without one draws no time rather than a guessed one.
import {useOptionalContinuity, type CandidateWorkspace} from '../continuity/workspace'
import type {TrailStop} from '../../../../../desktop/cradle/src/workspace/store'
import {MODE_CURATION} from '../../../../../desktop/cradle/src/workspace/mode'
import type {WidgetBodyProps, WidgetGlance} from '../frame/widgets/widgets'
import {useGlance} from '../frame/widgets/useGlance'

/** The time the book recorded for a stop, as HH:MM; null when it recorded none. */
export function stopTime(stop: TrailStop): string | null {
  const at = (stop as TrailStop & {at?: unknown}).at
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** The trail as the launcher's miniature: its newest stops. */
export function trailGlance(stops: readonly TrailStop[]): WidgetGlance | null {
  if (!stops.length) return null
  return {count: stops.length, status: `${stops.length} stop${stops.length === 1 ? '' : 's'}`,
    lines: stops.slice(0, 8).map(stop => ({lead: stopTime(stop) ?? MODE_CURATION[stop.mode].label, text: stop.label}))}
}

/** Return to a stop: the mode it was in, and the same thing selected (the move adds no stop of its own). The one return the Trail
 * widget and the encounter bar's Back and Forward share. */
export function returnToStop(continuity: Pick<CandidateWorkspace, 'switchMode' | 'setContext'>, stop: TrailStop): void {
  continuity.switchMode(stop.mode)
  if (stop.surfaceRef && stop.surfaceKind) {
    const selection = {mode: stop.mode, kind: stop.surfaceKind, ref: stop.surfaceRef, title: stop.label, track: stop.position}
    continuity.setContext(current => ({...current, selection}))
  }
}

export function TrailWidget({glance}: Partial<WidgetBodyProps> = {}) {
  const continuity = useOptionalContinuity()
  const context = continuity?.current.context
  const stops = [...(context?.trail ?? [])].reverse()
  useGlance(glance, trailGlance(stops))
  const returnTo = (stop: TrailStop) => { if (continuity) returnToStop(continuity, stop) }
  return <TrailStops stops={stops} here={context?.selection ?? null} onReturn={returnTo} />
}

/** The stops, newest first, each a press that returns to it. Pure presentation over the book's trail. */
export function TrailStops({stops, here, onReturn}: {stops: readonly TrailStop[]; here: {ref: string; kind: string} | null; onReturn: (stop: TrailStop) => void}) {
  if (!stops.length) return <p className="mode-dock-note">Every place you go is kept here. Select a Day, a clip or a task, and you can return to it.</p>
  return <ol className="mode-dock-lines trail-stops" aria-label="Trail">
    {stops.map((stop, index) => {
      const current = !!here && here.ref === stop.surfaceRef && here.kind === stop.surfaceKind
      const time = stopTime(stop)
      return <li key={`${index}-${stop.surfaceRef ?? stop.label}`} data-trail-stop={stop.surfaceKind ?? stop.mode} aria-current={current ? 'location' : undefined}>
        <button type="button" className="mode-dock-line trail-stop" title={`Return to ${stop.label}${stop.surfaceRef ? ` (${stop.surfaceRef})` : ''}${time ? '' : ' · the book recorded no time for this stop'}`}
          onClick={() => onReturn(stop)}>
          <span className="mode-dock-line-lead">{time ?? ''}</span>
          <span className="mode-dock-line-text">{stop.label}</span>
          <span className="mode-dock-line-meta">{MODE_CURATION[stop.mode].label}</span>
        </button>
      </li>
    })}
  </ol>
}
