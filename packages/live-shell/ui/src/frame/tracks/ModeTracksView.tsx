// The mode's tracks in the one Session · Arrangement pane (frame/tracks/TracksPane.tsx, which loads this module when the tracks first
// draw — the mode's tracks are its registration's, frame/tracks/modeTracks.ts, and come with the mode, not with the shell's first
// frame; O-I #740). It knows no mode.
import {useEffect, useMemo, useSyncExternalStore} from 'react'
import {useTimelinePanePresentation, type TimelineHostReading} from '../../projections/timelinePaneHost'
import {MODE_OWNERS, MODE_REDRAWS, MODE_TRACKS, MODE_WAITING, type ModeRedraw} from './modeTracks'
import {MODE_CLIP_MAKERS, withClipMaker} from './clipMakers'
import {publishTrackRows} from '../keys/keyDoors'
import {publishShownTracks} from './tracksDoor'
import {HostedDevice} from '../devices/deviceHost'
import {design as sessionGridDesign} from '../../inhabitants/catalogue/panels/dlw__session-grid'
import {TracksMaterial, type TracksMaterialValue} from './tracksDoor'
import type {DesignBinding} from '../devices/designed'
import {design as rulerDesign} from '../../inhabitants/catalogue/panels/dlw__arrangement-ruler'
import type {DesignedDevice} from '../../inhabitants/catalogue/panels/design'
import {NO_TRACKS} from './TracksPane'
import {publishDevice} from '../devices/deviceDoor'
import {useHolds} from '../../techne/devices/designDevices'
import {SESSION_GRID_ID, sessionGridBinding, sessionGridDevice} from './sessionGridBinding'
import {RULER_ID, rulerBinding, rulerDevice} from './rulerBinding'

/** A mode that reads nothing beyond the published reading. */
const STILL: ModeRedraw = {subscribe: () => () => {}, snapshot: () => null}

const NO_NAV = {}
/** The Session or the Arrangement as its device draws it (parity D-25, D-26): the catalogue design's Full on the device's binding, handed
 * the live set, so the pane and every other place of the device draw one Session and one Arrangement. */
function DesignPane({designed, binding, material, title}: {designed: DesignedDevice; binding: DesignBinding; material: TracksMaterialValue; title: string}) {
  return <TracksMaterial.Provider value={material}>
    <HostedDevice designed={designed} binding={binding} view="full" nav={NO_NAV} title={title} />
  </TracksMaterial.Provider>
}
const SessionPane = ({binding, material}: {binding: DesignBinding; material: TracksMaterialValue}) =>
  <DesignPane designed={sessionGridDesign} binding={binding} material={material} title="Session grid" />
const ArrangementPane = ({binding, material}: {binding: DesignBinding; material: TracksMaterialValue}) =>
  <DesignPane designed={rulerDesign} binding={binding} material={material} title="Arrangement ruler" />

/** A pinned pane shows its pinned clip as selected; a following one shows THE selection. */
export function ModeTracksView({reading, pinnedRef}: {reading: TimelineHostReading; pinnedRef?: string}) {
  const presented = useTimelinePanePresentation()
  // What else the mode's tracks read as it stands draws the pane again when it moves (modeTracks.ts MODE_REDRAWS).
  const redraw = MODE_REDRAWS[reading.mode] ?? STILL
  useSyncExternalStore(redraw.subscribe, redraw.snapshot, redraw.snapshot)
  const projected = MODE_TRACKS[reading.mode](reading)
  // Each set names whose ops its object acts are, for the acts its owner does not carry yet (frame/menu/objectActions.ts), and takes a
  // constellation dropped on a track: its own maker, else its mode's refusal in its owner's words (clipMakers.ts MODE_CLIP_MAKERS).
  // Each also says what an act no owner op carries waits for, by its registration (modeTracks.ts MODE_WAITING), beneath its own words.
  const owner = MODE_OWNERS[reading.mode]
  const owned = projected && !('waiting' in projected) && !projected.actions?.owner && owner
    ? {...projected, actions: {...projected.actions, owner}} : projected
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
  // The Session grid and the Arrangement ruler stand as their catalogue designs (parity D-25, D-26; sessionGridBinding.ts, rulerBinding.ts):
  // the Session and the Arrangement this pane draws are the designs' Fulls, and every place of each device draws the same.
  const holds = useHolds()
  const gridBinding = useMemo(() => sessionGridBinding(shown, selection, reading.mode, holds[SESSION_GRID_ID]),
    [shown, selection.ref, selection.select, reading.mode, holds])
  const ruler = useMemo(() => rulerBinding(shown, selection, reading.mode, holds[RULER_ID]), [shown, selection.ref, selection.select, reading.mode, holds])
  useEffect(() => {
    publishDevice(SESSION_GRID_ID, {device: sessionGridDevice, binding: gridBinding, full: {draw: () => <SessionPane binding={gridBinding} material={{set: shown, selection, empty: waiting}} />}})
  }, [gridBinding, waiting])
  useEffect(() => {
    publishDevice(RULER_ID, {device: rulerDevice, binding: ruler, full: {draw: () => <ArrangementPane binding={ruler} material={{set: shown, selection, empty: waiting}} />}})
  }, [ruler, waiting])
  useEffect(() => () => { publishDevice(SESSION_GRID_ID, null); publishDevice(RULER_ID, null) }, [])
  return <div className="tracks-pane" style={{position: 'absolute', inset: 0}} data-tracks-mode={reading.mode} data-waiting={waiting !== undefined || undefined}>
    {presented === 'arrangement' ? <ArrangementPane binding={ruler} material={{set: shown, selection, empty: waiting}} /> : <SessionPane binding={gridBinding} material={{set: shown, selection, empty: waiting}} />}
  </div>
}
