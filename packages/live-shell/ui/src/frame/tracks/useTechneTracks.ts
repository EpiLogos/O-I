// Technē's tracks for the shared Session and Arrangement (T-TRACKS-TECHNE; lock §9.1 Technē row): the mode's hook over the reading
// the frame publishes. Technē's owners are read here, never copied into a second store and never polled a second time:
// - the readings, their walks and the runs: the World cut's one temporal read, which the frame already publishes as
//   `reading.world` (projections/useWorldTemporalReading.ts) — the hook calls no `useWorldTemporalReading` of its own (one poller
//   per frame). The atlas's Aion readings reach those sets through the family door, and appear only while the atlas holds one;
// - the Earth's standing: the plain observable store the atlas host and the Places browser already read
//   (provider/suiteStanding.ts `subscribeSuiteStanding` / `suiteStanding`), for the words a stream without an owner read gives.
// It returns the six streams always — a read that has not landed is named in the tracks' `kind` text, and a stream without an owner
// read stands as a named, empty track (timeline/techneTrackAdapter.ts). Registered as `techne: worldCut(useTechneTracks)` in
// modeTracks.ts.
//
// The World's recorded walks (O-I #760) are read from the walk's own store (projections/atlas/walks/walkSession.ts, which the atlas host
// binds and reads through the walk's owner): its takes and kept views as walks (walkRecord.ts recordedWalksOf) with the stops kept at an
// instant (recordedInstantsOf), and its one write arm while the World is open. A stop of one is stood by the World (the session's play: a
// take walks on from it, turning the window to each stop's moment; a kept view reopens), never the spine.
//
// Its actions go through the owners that exist: a walk stop is stood by the rule the Timeline and the Journey share
// (timeline/journeyWalks.ts walkStopFocus → timeline/walkFocus.ts applyWalkStopFocus: its occasion on the spine, or its epoch in
// the atlas), and the Expression it carries is opened through the shell's own door — `journey.openExpression`, the workspace's
// `requestExpression` that the frame publishes with the reading (projections/timelinePaneHost.ts TimelineHostReading.journey,
// App.tsx `usePublishTimelineReading`). `TracksReading` does not yet declare `journey`, so this hook widens it locally (its own
// parameter stays `TracksReading`, so it registers as a `UseModeTracks` as it stands). With no door the stops are stood and their
// Expressions named, not opened. The atlas jump is loaded when a stop is stood, as the atlas loads its own Aion adapter: the track
// set does not carry the atlas pane's module graph.
import {useMemo, useRef, useSyncExternalStore} from 'react'
import {subscribeSuiteStanding, suiteStanding} from '../../projections/atlas/provider/suiteStanding'
import {walkStopFocus, type JourneyPresentation, type WalkStopFocus} from '../../timeline/journeyWalks'
import type {TemporalEventRow} from '../../timeline/timeSpine'
import {projectTechneTracks, worldReadingOf, type TechneControls} from '../../timeline/techneTrackAdapter'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {WorldTimelineView} from '../../projections/useWorldTemporalReading'
import type {TracksReading} from './modeTracks'
import {setReadingShown, setReadingSolo, useReadingShown} from '../../timeline/readingShown'
import {isRecordedWalk} from '../../timeline/techneTrackAdapter'
import {walkSession, type WalkSession} from '../../projections/atlas/walks/walkSession'
import {recordedInstantsOf, recordedWalksOf} from '../../projections/atlas/walks/walkRecord'

/** The published reading, with the Expression door the frame hands it. */
export type TechneTracksReading = TracksReading & {journey?: JourneyPresentation}

/** What applying a stop's focus does: the owner's write, resolving to the named absence or null (timeline/walkFocus.ts). */
export type ApplyFocus = (focus: WalkStopFocus, selectOccasion: (event: TemporalEventRow) => void) => Promise<string | null>

const NO_WORLD = 'The shell publishes no World reading to this pane, so no stop can be stood.'

const applyThroughOwner: ApplyFocus = async (focus, selectOccasion) => (await import('../../timeline/walkFocus')).applyWalkStopFocus(focus, selectOccasion)

/** The owners behind the actions. `live` is read at the moment of the launch: the shell remakes its door and the World view on
 * every render, and a launch must not hold the ones a past render saw. A recorded walk's stop is the World's to stand (`walks`). */
export function techneControls(live: () => {view: WorldTimelineView | undefined; door: ((ref: string) => void) | undefined}, apply: ApplyFocus = applyThroughOwner, walks: Pick<WalkSession, 'play'> = walkSession): TechneControls {
  return {
    stand: (walk, stop) => {
      if (isRecordedWalk(walk)) return Promise.resolve(walks.play(walk.id, walk.stops.indexOf(stop)))
      const view = live().view
      return view ? apply(walkStopFocus(walk, stop, view.source.eventByClipId), view.selectOccasion) : Promise.resolve(NO_WORLD)
    },
    ...(live().door ? {openExpression: (ref: string) => live().door?.(ref)} : {}),
  }
}

export function useTechneTracks(reading: TracksReading): WorldTrackSet {
  const earth = useSyncExternalStore(subscribeSuiteStanding, suiteStanding, suiteStanding)
  const view = reading.world
  const source = view?.source
  const door = reading.journey?.openExpression
  const now = useRef({view, door})
  now.current = {view, door}
  const hasDoor = door !== undefined
  // The owners are read through `now` at launch, so only the door's presence changes the controls.
  const controls = useMemo(() => techneControls(() => now.current), [hasDoor])
  const world = useMemo(() => worldReadingOf(source), [source])
  const shownState = useReadingShown()
  const shown = useMemo(() => ({state: shownState, show: setReadingShown, solo: setReadingSolo}), [shownState])
  const walk = useSyncExternalStore(walkSession.subscribe, walkSession.get, walkSession.get)
  const recorded = useMemo(() => ({
    walks: walk.reading.phase === 'read' ? recordedWalksOf(walk.reading.walk) : [],
    ...(walk.reading.phase === 'read' ? {instants: recordedInstantsOf(walk.reading.walk)} : {}),
    armed: walk.armed,
    ...(walk.bound ? {arm: (on: boolean) => {
      walkSession.arm(on)
      const after = walkSession.get()
      return after.armed === on ? {ok: true as const, note: after.line ?? ''} : {ok: false as const, error: after.line ?? 'The World did not take the arm.'}
    }} : {}),
  }), [walk.reading, walk.armed, walk.bound])
  return useMemo(() => projectTechneTracks({world, earth, controls, shown, recorded}), [world, earth, controls, shown, recorded])
}
