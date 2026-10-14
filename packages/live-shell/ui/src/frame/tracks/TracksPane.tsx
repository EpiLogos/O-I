// The Session · Arrangement pane (FOUNDATION F3): one instrument over the mode's tracks — the grid in Session, the ruler in
// Arrangement, Tab between them. It reads the reading the frame publishes (projections/timelinePaneHost.ts), takes the
// mode's tracks from its registration (modeTracks.ts) and draws one of the two shared views. It knows no mode.
import {useTimelinePanePresentation, useTimelineReading, type TimelineHostReading} from '../../projections/timelinePaneHost'
import {MODE_TRACKS} from './modeTracks'
import {SessionGrid} from './SessionGrid'
import {ArrangementRuler} from './ArrangementRuler'

export function TracksPane() {
  const reading = useTimelineReading()
  if (!reading) return <p role="status" className="source-note">The tracks are waiting for the shell to publish this work's reading.</p>
  // Keyed by mode: a mode's tracks are its own hook, and a mode switch mounts the next mode's.
  return <ModeTracksView key={reading.mode} reading={reading} />
}

function ModeTracksView({reading}: {reading: TimelineHostReading}) {
  const presented = useTimelinePanePresentation()
  const set = MODE_TRACKS[reading.mode](reading)
  if (!set) return <div className="tracks-empty" role="status">{reading.waiting ?? 'This work has no tracks to show yet.'}</div>
  const selection = {ref: reading.selectedRef, select: reading.selectTrackItem}
  return <div className="tracks-pane" style={{position: 'absolute', inset: 0}} data-tracks-mode={reading.mode}>
    {presented === 'arrangement' ? <ArrangementRuler set={set} selection={selection} /> : <SessionGrid set={set} selection={selection} />}
  </div>
}
