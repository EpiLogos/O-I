// Walk rails on the shared Arrangement ruler (lock §9.2 a walk; manual §8: "Take a thread from the timeline and walk it, and each
// stop sets the clock to its year and the world to its place"; §4: "a walk laid along the ruler"). Ported from the World cut
// presentation the tracks pane replaced: git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx
// :433-447 — one rail per walk the set carries, its stops in walk order, numbered n/N, titled with the stop's label, year, place and
// what is attached (:441), its head saying the walk's kind, whether it was derived on read or curated, and its stop count
// (:436-437); pressing a stop focuses it (:258-261, :442). The old rail listed the stops as a row of chips; on the ruler a stop
// stands where its clip stands, so the rail runs through the stops in order, under the lane that holds them (as an automation
// lane stands under its track), and a stop with no place on the ruler is counted, never placed by guess.
//
// Pure TypeScript. No React.
import {formatYear} from '../../projections/atlas/src/data/time'
import type {WorldTrackClip, WorldTrackSet, WorldWalk, WorldWalkStop} from '../../timeline/worldTrackAdapter'

export interface RailStop {
  stop: WorldWalkStop
  /** Its place in the walk, from 0. */
  index: number
  /** Where its clip stands on the ruler; absent when the stop stands no placed clip. */
  at?: number
}

export interface WalkRail {
  walk: WorldWalk
  /** The track the rail runs under: the track of its first placed stop's clip. Absent when no stop has a place. */
  trackId?: string
  stops: RailStop[]
  /** How many of its stops have a place on the ruler. */
  placed: number
}

/** Every walk the set carries as a rail, in the set's order. `placed` is the ruler's placement of the set's clips
 * (ArrangementRuler.tsx placeClips). */
export function walkRails(set: Pick<WorldTrackSet, 'walks'>, placed: readonly {clip: WorldTrackClip; start: number}[]): WalkRail[] {
  const at = new Map<string, {start: number; trackId: string}>()
  for (const entry of placed) if (!at.has(entry.clip.id)) at.set(entry.clip.id, {start: entry.start, trackId: entry.clip.trackId})
  return (set.walks ?? []).map(walk => {
    let trackId: string | undefined
    const stops = walk.stops.map((stop, index): RailStop => {
      const place = stop.clipId !== undefined ? at.get(stop.clipId) : undefined
      if (place && trackId === undefined) trackId = place.trackId
      return place ? {stop, index, at: place.start} : {stop, index}
    })
    return {walk, ...(trackId !== undefined ? {trackId} : {}), stops, placed: stops.filter(stop => stop.at !== undefined).length}
  })
}

/** The rail's segments: from each placed stop to the next placed one, in walk order (a walk may turn back on the ruler). */
export function railSegments(rail: WalkRail): {from: number; to: number}[] {
  const points = rail.stops.flatMap(stop => stop.at === undefined ? [] : [stop.at])
  const out: {from: number; to: number}[] = []
  for (let i = 1; i < points.length; i++) out.push({from: Math.min(points[i - 1], points[i]), to: Math.max(points[i - 1], points[i])})
  return out
}

/** A stop's hover words (:441): its label, its year, its place, and how much is attached to it. */
export function railStopTitle(stop: WorldWalkStop): string {
  return `${stop.label}${stop.year !== undefined ? ` · ${formatYear(stop.year)}` : ''}${stop.place?.label ? ` · ${stop.place.label}` : ''}${stop.also.length ? ` · ${stop.also.length} attached` : ''}`
}

/** The rail's head words (:437): the walk's kind, derived or curated, and its stops. */
export function railKindText(walk: WorldWalk): string {
  return `${walk.kind} · ${walk.derived ? 'derived on read' : 'curated'} · ${walk.stops.length} ${walk.stops.length === 1 ? 'stop' : 'stops'}`
}
