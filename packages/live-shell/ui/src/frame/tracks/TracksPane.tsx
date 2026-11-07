// The Session · Arrangement pane (FOUNDATION F3): one instrument over the mode's tracks — the grid in Session, the ruler in
// Arrangement, Tab between them. It reads the reading the frame publishes (projections/timelinePaneHost.ts), takes the
// mode's tracks from its registration (modeTracks.ts) and draws one of the two shared views. It knows no mode.
import {useTimelinePanePresentation, useTimelineReading, type TimelineHostReading} from '../../projections/timelinePaneHost'
import {SessionGrid, type TracksSelection} from './SessionGrid'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {loadWhenDrawn} from '../../shell/loadWhenDrawn'

export const NO_TRACKS: WorldTrackSet = {columns: [], tracks: [], clips: []}

type ViewProps = {reading: TimelineHostReading; pinnedRef?: string}

// The Arrangement's ruler (ArrangementRuler.tsx) loads when it first draws, not with the window's first script: the mode's tracks carry it,
// and the waiting Arrangement below loads it, saying so in words meanwhile (round 891; tests/first-load-budget.test.mjs LOADS_LATER).
const ArrangementWaiting = loadWhenDrawn<{set: WorldTrackSet; selection: TracksSelection; empty?: string}>(
  'The arrangement', () => import('./ArrangementRuler').then(module => module.ArrangementRuler))

/** The tracks' place before the mode's tracks arrive: the empty Session or Arrangement with what it waits for in it, as a mode whose
 * owner has not answered draws it. */
function TracksWaiting({reading, pinnedRef}: ViewProps) {
  const presented = useTimelinePanePresentation()
  const selection = {ref: pinnedRef ?? reading.selectedRef, select: reading.selectTrackItem}
  const waiting = 'The tracks are loading…'
  return <div className="tracks-pane" style={{position: 'absolute', inset: 0}} data-tracks-mode={reading.mode} data-waiting>
    {presented === 'arrangement' ? <ArrangementWaiting set={NO_TRACKS} selection={selection} empty={waiting} /> : <SessionGrid set={NO_TRACKS} selection={selection} empty={waiting} />}
  </div>
}

// The mode's tracks (frame/tracks/ModeTracksView.tsx over the registration, modeTracks.ts) load when the tracks first draw (O-I #740).
const ModeTracksView = loadWhenDrawn<ViewProps>('The tracks', () => import('./ModeTracksView').then(module => module.ModeTracksView), TracksWaiting)

export function TracksPane({pinnedRef}: {pinnedRef?: string} = {}) {
  const reading = useTimelineReading()
  if (!reading) return <p role="status" className="source-note">The tracks are waiting for the shell to publish this work's reading.</p>
  // Keyed by mode: a mode's tracks are its own hook, and a mode switch mounts the next mode's.
  return <ModeTracksView key={reading.mode} reading={reading} pinnedRef={pinnedRef} />
}
