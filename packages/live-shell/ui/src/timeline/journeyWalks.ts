// The Journey's walk model (T-TIMELINE-WALKS leg 2): Technē's Session (M3′) presents the walks the World's track sets
// carry — the same `WorldWalk` objects the Timeline reads, by reference. Nothing is derived a second time and nothing is
// stored. A stop's focus is the Timeline's own rule: the occasion the civil reading gives the clip the stop stands.
//
// Pure TypeScript. No React, no family names (the walks arrive already projected by their families).

import type {TemporalEventRow} from './timeSpine';
import type {WorldTrackSet, WorldWalk, WorldWalkStop} from './worldTrackAdapter';

/** The walks the Journey presents: the walks the sets carry, in set order, the same objects (identity kept). */
export function journeyWalksOf(sets: readonly WorldTrackSet[]): WorldWalk[] {
  return sets.flatMap((set) => set.walks ?? []);
}

/** What a stop shows in the Journey's columns. A column the stop does not carry is null, never invented. */
export interface JourneyStopCells {
  place: string | null;
  occasion: string | null;
  artefact: string;
  expression: string | null;
  /** Bucket-mates and attached material reached from this stop (nothing dropped; counted here, listed by the walk). */
  also: number;
}

/** The stop's cells, read from the stop alone. A place falls back to its coordinates when it has no label. */
export function journeyStopCells(stop: WorldWalkStop): JourneyStopCells {
  const place = stop.place
    ? stop.place.label || (stop.place.lat !== undefined && stop.place.lon !== undefined
      ? `${stop.place.lat.toFixed(2)}, ${stop.place.lon.toFixed(2)}`
      : null)
    : null;
  return {
    place: place || null,
    occasion: stop.year === undefined ? null : stop.year < 0 ? `${-stop.year} BCE` : String(stop.year),
    artefact: stop.label,
    expression: stop.sceneRef ?? null,
    also: stop.also.length,
  };
}

/** What selecting a stop focuses: the occasion the Timeline would focus for its clip, or the named reason it cannot. */
export type JourneyFocus =
  | {kind: 'occasion'; event: TemporalEventRow}
  | {kind: 'absent'; reason: string};

/** A stop focuses the subject the Timeline would focus for its clip: the occasion the civil reading gives that clip
 * (the same `eventByClipId` the Timeline selects through). A stop with no clip, or a clip the reading does not give as
 * an occasion, names its absence. Nothing is written here: the caller hands an occasion to the spine. */
export function journeyStopFocus(stop: WorldWalkStop, eventByClipId: ReadonlyMap<string, TemporalEventRow>): JourneyFocus {
  if (stop.clipId === undefined) {
    return {kind: 'absent', reason: `${stop.label} stands no clip, so the Timeline has no occasion to focus.`};
  }
  const event = eventByClipId.get(stop.clipId);
  if (event === undefined) {
    return {kind: 'absent', reason: `${stop.label} stands a clip the civil reading does not give as an occasion.`};
  }
  return {kind: 'occasion', event};
}
