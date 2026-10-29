// The mode's tracks in the one Session · Arrangement pane (frame/tracks/TracksPane.tsx, which loads this module when the tracks first
// draw — the mode's tracks are its registration's, frame/tracks/modeTracks.ts, and come with the mode, not with the shell's first
// frame; O-I #740). It knows no mode.
import {useEffect} from 'react'
import {useTimelinePanePresentation, type TimelineHostReading} from '../../projections/timelinePaneHost'
import {MODE_OWNERS, MODE_TRACKS, MODE_WAITING} from './modeTracks'
import {MODE_CLIP_MAKERS, withClipMaker} from './clipMakers'
import {publishTrackRows} from '../keys/keyDoors'
import {publishShownTracks} from './tracksDoor'
import {SessionGrid} from './SessionGrid'
import {ArrangementRuler} from './ArrangementRuler'
import {NO_TRACKS} from './TracksPane'

/** A pinned pane shows its pinned clip as selected; a following one shows THE selection. */
export function ModeTracksView({reading, pinnedRef}: {reading: TimelineHostReading; pinnedRef?: string}) {
  const presented = useTimelinePanePresentation()
  const projected = MODE_TRACKS[reading.mode](reading)
  // Each set names whose ops its object acts are, for the acts its owner does not carry yet (frame/menu/objectActions.ts), and takes a
  // constellation dropped on a track: its own maker, else its mode's refusal in its owner's words (clipMakers.ts MODE_CLIP_MAKERS).
  // Each also says what an act no owner op carries waits for, by its registration (modeTracks.ts MODE_WAITING), beneath its own words.
  const owned = projected && !('waiting' in projected) && !projected.actions?.owner
    ? {...projected, actions: {...projected.actions, owner: MODE_OWNERS[reading.mode]}} : projected
  const named = owned && !('waiting' in owned) && MODE_WAITING[reading.mode]
    ? {...owned, actions: {...owned.actions, waiting: {...MODE_WAITING[reading.mode], ...owned.actions?.waiting}}} : owned
  const maker = MODE_CLIP_MAKERS[reading.mode]
  const set = named && !('waiting' in named) && maker ? withClipMaker(named, maker) : named
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
