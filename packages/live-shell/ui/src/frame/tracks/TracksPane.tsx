// The Session · Arrangement pane (FOUNDATION F3): one instrument over the mode's tracks — the grid in Session, the ruler in
// Arrangement, Tab between them. It reads the reading the frame publishes (projections/timelinePaneHost.ts), takes the
// mode's tracks from its registration (modeTracks.ts) and draws one of the two shared views. It knows no mode.
import {useTimelinePanePresentation, useTimelineReading, type TimelineHostReading} from '../../projections/timelinePaneHost'
import {useEffect} from 'react'
import {MODE_TRACKS} from './modeTracks'
import {publishTrackRows} from '../keys/keyDoors'
import {publishShownTracks} from './tracksDoor'
import {SessionGrid} from './SessionGrid'
import {ArrangementRuler} from './ArrangementRuler'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'

const NO_TRACKS: WorldTrackSet = {columns: [], tracks: [], clips: []}

export function TracksPane({pinnedRef}: {pinnedRef?: string} = {}) {
  const reading = useTimelineReading()
  if (!reading) return <p role="status" className="source-note">The tracks are waiting for the shell to publish this work's reading.</p>
  // Keyed by mode: a mode's tracks are its own hook, and a mode switch mounts the next mode's.
  return <ModeTracksView key={reading.mode} reading={reading} pinnedRef={pinnedRef} />
}

/** A pinned pane shows its pinned clip as selected; a following one shows THE selection. */
function ModeTracksView({reading, pinnedRef}: {reading: TimelineHostReading; pinnedRef?: string}) {
  const presented = useTimelinePanePresentation()
  const set = MODE_TRACKS[reading.mode](reading)
  const selection = {ref: pinnedRef ?? reading.selectedRef, select: reading.selectTrackItem}
  // The row keys launch the stops drawn here (F9), so they read the set this pane shows.
  useEffect(() => { publishTrackRows(set && !('waiting' in set) ? {set, presented} : null); return () => publishTrackRows(null) })
  // The clip box shows the same tracks (frame/tracks/tracksDoor.ts): published here, never read twice.
  const drawn = set && !('waiting' in set) ? set : null
  useEffect(() => { publishShownTracks(drawn); return () => publishShownTracks(null) }, [drawn])
  // While the mode's owner has not answered, the empty Session or Arrangement stands with the reason in it.
  const waiting = !set || 'waiting' in set ? set?.waiting ?? reading.waiting ?? 'This work has no tracks to show yet.' : undefined
  const shown = set && !('waiting' in set) ? set : NO_TRACKS
  return <div className="tracks-pane" style={{position: 'absolute', inset: 0}} data-tracks-mode={reading.mode} data-waiting={waiting !== undefined || undefined}>
    {presented === 'arrangement' ? <ArrangementRuler set={shown} selection={selection} empty={waiting} /> : <SessionGrid set={shown} selection={selection} empty={waiting} />}
  </div>
}
