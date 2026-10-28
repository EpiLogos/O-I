// The trail (manual §10.7, §23.5): every place you went, newest first, from the world context the book keeps — each move (a mode
// switch, a selection, a subject or an occasion change) and the place it landed on. Selecting a stop returns to it: the same
// place, page and point in the reading. Nothing here stores; the book is the one writer (FOUNDATION F1). It is the dock's Trail
// tile, drawn as the mockup's stops (world-shell-mockup.html `tileBody('trail')` 1631: a time, the place, the kind of work it was
// in); the rail draws the Trail device (widgets/railDevices.tsx), which returns through the same `returnToStop`.
//
// A stop's time is the book's (`at`, epoch ms, desktop/cradle/src/workspace/store.ts stopOf); a stop kept from before the book
// stamped one draws no time rather than a guessed one.
import {useOptionalContinuity, type CandidateWorkspace} from '../continuity/workspace'
import {standingOn, walkTrail, type TrailStop} from '../../../../../desktop/cradle/src/workspace/store'
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

/** Return to stop `index` on the book's trail: the mode it was in, and the world, selection, subject and reading it names (the
 * book's walkTrail). The walk adds no stop; the book now stands on that stop, so Back and Forward step on from it. The one return
 * the title line's Back and Forward, this tile and the rail's Trail device share. */
export function returnToStop(continuity: Pick<CandidateWorkspace, 'current' | 'switchMode' | 'setContext'>, index: number): void {
  const stop = continuity.current.context?.trail?.[index]
  if (!stop) return
  continuity.switchMode(stop.mode)
  continuity.setContext(context => walkTrail(context, index))
}

export function TrailWidget({glance}: Partial<WidgetBodyProps> = {}) {
  const continuity = useOptionalContinuity()
  const context = continuity?.current.context
  const stops = context?.trail ?? []
  useGlance(glance, trailGlance([...stops].reverse()))
  const returnTo = (index: number) => { if (continuity) returnToStop(continuity, index) }
  return <TrailStops stops={stops} standing={stops.length ? standingOn(context ?? {}) : null} onReturn={returnTo} />
}

/** The stops, newest first, each a press that returns to it; `stops` in the book's order (oldest first), `standing` the stop you stand
 * on and `onReturn` given the stop's place on the trail. Pure presentation over the book's trail. */
export function TrailStops({stops, standing, onReturn}: {stops: readonly TrailStop[]; standing: number | null; onReturn: (index: number) => void}) {
  if (!stops.length) return <p className="mode-dock-note">Every place you go is kept here. Select a Day, a clip or a task, and you can return to it.</p>
  return <ol className="mode-dock-lines trail-stops" aria-label="Trail">
    {stops.map((stop, index) => ({stop, index})).reverse().map(({stop, index}) => {
      const time = stopTime(stop)
      return <li key={`${index}-${stop.surfaceRef ?? stop.label}`} data-trail-stop={stop.surfaceKind ?? stop.mode} aria-current={index === standing ? 'location' : undefined}>
        <button type="button" className="mode-dock-line trail-stop" title={`Return to ${stop.label}${stop.surfaceRef ? ` (${stop.surfaceRef})` : ''}${time ? '' : ' · the book recorded no time for this stop'}`}
          onClick={() => onReturn(index)}>
          <span className="mode-dock-line-lead">{time ?? ''}</span>
          <span className="mode-dock-line-text">{stop.label}</span>
          <span className="mode-dock-line-meta">{MODE_CURATION[stop.mode].label}</span>
        </button>
      </li>
    })}
  </ol>
}
