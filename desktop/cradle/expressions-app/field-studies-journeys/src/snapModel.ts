/**
 * Timeline snap model (lane-3 E25, pure: no DOM, no store).
 *
 * Mirrors Kdenlive's SnapModel: a set of points a drag may land on, the closest
 * point within a pixel tolerance wins, and next / previous navigation walks the same
 * points in time order. Points are journey seconds on the ruler clock. The tolerance
 * is pixels converted by the timeline's own scale (seconds per pixel), so a snap is
 * the same width on screen at every zoom.
 *
 * Callers choose which points a drag may use and exclude what it moves (its own
 * edge, marker or keyframe) by id.
 */

/** The snap tolerance in pixels; the same width the markers always snapped with. */
export const SNAP_TOLERANCE_PX = 6;

export type SnapKind = 'scene' | 'marker' | 'playhead' | 'loop-in' | 'loop-out' | 'keyframe';

export interface SnapPoint {
  time: number;
  kind: SnapKind;
  /** Stable within one candidate set: `scene:<index>`, `marker:<id>`, `playhead`, `loop:from`, `loop:to`, or the caller's keyframe id. */
  id: string;
}

export interface SnapSources {
  /** Scene starts and the journey end, as sceneBoundaries returns them; the index is the scene's. */
  boundaries?: readonly number[];
  markers?: readonly {id: string; time: number}[];
  playhead?: number;
  loop?: {from: number; to: number};
  /** Keyframe times on the ruler clock, each with the caller's own id. */
  keyframes?: readonly {id: string; time: number}[];
}

/** Candidates in their tie order: when two are equally close, the earlier kind wins. */
export function snapCandidates(src: SnapSources): SnapPoint[] {
  const out: SnapPoint[] = [];
  (src.boundaries ?? []).forEach((time, index) => out.push({time, kind: 'scene', id: `scene:${index}`}));
  for (const marker of src.markers ?? []) out.push({time: marker.time, kind: 'marker', id: `marker:${marker.id}`});
  if (src.playhead !== undefined && Number.isFinite(src.playhead)) out.push({time: src.playhead, kind: 'playhead', id: 'playhead'});
  if (src.loop) {
    out.push({time: src.loop.from, kind: 'loop-in', id: 'loop:from'});
    out.push({time: src.loop.to, kind: 'loop-out', id: 'loop:to'});
  }
  for (const key of src.keyframes ?? []) out.push({time: key.time, kind: 'keyframe', id: key.id});
  return out.filter(point => Number.isFinite(point.time));
}

export interface SnapQuery {
  /** Tolerance in pixels; defaults to SNAP_TOLERANCE_PX. */
  tolerancePx?: number;
  /** Candidate ids this drag moves itself and must not snap to. */
  exclude?: ReadonlySet<string> | readonly string[];
}

/**
 * The candidate nearest to `time` within the tolerance, or null. Strictly closer wins,
 * so on a tie the earlier candidate stands. A non-finite time or a non-positive scale
 * snaps nothing.
 */
export function closestSnap(points: readonly SnapPoint[], time: number, secondsPerPx: number, query: SnapQuery = {}): SnapPoint | null {
  if (!Number.isFinite(time) || !(secondsPerPx > 0)) return null;
  const gap = (query.tolerancePx ?? SNAP_TOLERANCE_PX) * secondsPerPx;
  const excluded = query.exclude instanceof Set ? query.exclude : new Set(query.exclude ?? []);
  let best: SnapPoint | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    if (excluded.has(point.id)) continue;
    const distance = Math.abs(point.time - time);
    if (distance <= gap && distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return best;
}

/** `time` moved onto the closest candidate within the tolerance, or `time` unchanged. */
export function snapTime(points: readonly SnapPoint[], time: number, secondsPerPx: number, query?: SnapQuery): number {
  return closestSnap(points, time, secondsPerPx, query)?.time ?? time;
}

/** The first candidate strictly after `t` (one within `eps` of it is passed). */
export function nextSnapPoint(points: readonly SnapPoint[], t: number, eps = .005): SnapPoint | null {
  let best: SnapPoint | null = null;
  for (const point of points) if (point.time > t + eps && (best === null || point.time < best.time)) best = point;
  return best;
}

/** The last candidate strictly before `t` (one within `eps` of it is passed). */
export function prevSnapPoint(points: readonly SnapPoint[], t: number, eps = .005): SnapPoint | null {
  let best: SnapPoint | null = null;
  for (const point of points) if (point.time < t - eps && (best === null || point.time > best.time)) best = point;
  return best;
}
