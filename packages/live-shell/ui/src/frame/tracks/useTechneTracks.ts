// Technē's tracks for the shared Session and Arrangement (T-TRACKS-TECHNE; lock §9.1 Technē row): the mode's hook over the reading
// the frame publishes. Technē's owners are read here, never copied into a second store and never polled a second time:
// - the readings, their walks and the runs: the World cut's one temporal read, which the frame already publishes as
//   `reading.world` (projections/useWorldTemporalReading.ts) — the hook calls no `useWorldTemporalReading` of its own (one poller
//   per frame). The atlas's Aion readings reach those sets through the family door, and appear only while the atlas holds one;
// - the Earth's standing: the plain observable store the atlas host and the Places browser already read
//   (provider/suiteStanding.ts `subscribeSuiteStanding` / `suiteStanding`), for the words a stream without an owner read gives.
// It returns the six streams always — a read that has not landed is named in the tracks' `kind` text, and a stream without an owner
// read stands as a named, empty track (timeline/techneTrackAdapter.ts). Registered by the lead as `techne: useTechneTracks` in
// modeTracks.ts.
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
import {walkStopFocus, type WalkStopFocus} from '../../timeline/journeyWalks'
import type {JourneyPresentation} from '../../timeline/JourneyRows'
import type {TemporalEventRow} from '../../timeline/timeSpine'
import {projectTechneTracks, worldReadingOf, type TechneControls} from '../../timeline/techneTrackAdapter'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {WorldTimelineView} from '../../projections/useWorldTemporalReading'
import type {TracksReading} from './modeTracks'

/** The published reading, with the Expression door the frame hands it. */
export type TechneTracksReading = TracksReading & {journey?: JourneyPresentation}

/** What applying a stop's focus does: the owner's write, resolving to the named absence or null (timeline/walkFocus.ts). */
export type ApplyFocus = (focus: WalkStopFocus, selectOccasion: (event: TemporalEventRow) => void) => Promise<string | null>

const NO_WORLD = 'The shell publishes no World reading to this pane, so no stop can be stood.'

const applyThroughOwner: ApplyFocus = async (focus, selectOccasion) => (await import('../../timeline/walkFocus')).applyWalkStopFocus(focus, selectOccasion)

/** The owners behind the actions. `live` is read at the moment of the launch: the shell remakes its door and the World view on
 * every render, and a launch must not hold the ones a past render saw. */
export function techneControls(live: () => {view: WorldTimelineView | undefined; door: ((ref: string) => void) | undefined}, apply: ApplyFocus = applyThroughOwner): TechneControls {
  return {
    stand: (walk, stop) => {
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
  return useMemo(() => projectTechneTracks({world, earth, controls}), [world, earth, controls])
}
