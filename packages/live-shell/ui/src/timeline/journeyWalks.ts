// The Journey's walk model (T-TIMELINE-WALKS leg 2): Technē's tracks (timeline/techneTrackAdapter.ts, drawn by the shared
// Session grid) present the walks the World's track sets carry — the same `WorldWalk` objects the Timeline reads, by
// reference. Nothing is derived a second time and nothing is stored. A stop's focus is the Timeline's own rule: the occasion
// the civil reading gives the clip the stop stands, or its reading's epoch in the atlas.
//
// Pure TypeScript. No React, no family names (the walks arrive already projected by their families).

import type {TemporalEventRow} from './timeSpine';
import type {WorldTrackSet, WorldWalk, WorldWalkStop} from './worldTrackAdapter';

/** The shell's door to an Expression a walk stop carries — the workspace's request, the one the Sources rows use. The App
 * publishes it with the tracks pane's reading over the World cut (projections/timelinePaneHost.ts). */
export interface JourneyPresentation {
  openExpression: (ref: string) => void;
}

/** The walks the Journey presents: the walks the sets carry, in set order, the same objects (identity kept). */
export function journeyWalksOf(sets: readonly WorldTrackSet[]): WorldWalk[] {
  return sets.flatMap((set) => set.walks ?? []);
}

/** What a walk stop focuses (T-TIMELINE-WALKS leg 3). An occasion is the Timeline's own rule for the stop's clip. A layer
 * stop is a stop of a walk that belongs to a reading: the reading's layer id and the stop's own id name the event the
 * atlas's epoch jump goes to. Anything else names its absence. */
export type WalkStopFocus =
  | {kind: 'occasion'; event: TemporalEventRow}
  | {kind: 'layer'; layerId: string; stopId: string}
  | {kind: 'absent'; reason: string};

/** The focus of a stop of a walk, read from the walk and the stop alone (an occasion wins over a layer). */
export function walkStopFocus(walk: WorldWalk, stop: WorldWalkStop, eventByClipId: ReadonlyMap<string, TemporalEventRow>): WalkStopFocus {
  const occasion = stop.clipId === undefined ? undefined : eventByClipId.get(stop.clipId);
  if (occasion) return {kind: 'occasion', event: occasion};
  if (walk.layerId !== undefined) return {kind: 'layer', layerId: walk.layerId, stopId: stop.id};
  return {
    kind: 'absent',
    reason: stop.clipId === undefined
      ? `${stop.label} stands no clip and belongs to no reading, so there is nothing to focus.`
      : `${stop.label} stands a clip the civil reading does not give as an occasion, and its walk belongs to no reading.`,
  };
}
