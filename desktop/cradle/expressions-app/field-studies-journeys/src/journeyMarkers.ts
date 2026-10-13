/**
 * Journey locators and the loop brace (lane-3 E12 markers, E13 in/out region).
 *
 * Pure model: no DOM, no store. Times are journey seconds on the ruler clock
 * (`expressionTiming` with full scene durations), the clock the timeline draws.
 * Markers and the region are presentation carried by the journey-properties
 * envelope (`compositionProperties` -> composition_set). They are authoring and
 * navigation furniture: the stage never reads them.
 */

export const MARKER_COLOURS = ['amber', 'rose', 'sage', 'sky', 'violet'] as const;
export type MarkerColour = typeof MARKER_COLOURS[number];
export const MARKER_LIMIT = 64;
export const MARKER_NAME_MAX = 80;
/** Snap tolerance for markers and loop edges against scene boundaries, in pixels. */
export const MARKER_SNAP_PX = 6;
/** The shortest loop region the brace admits. */
export const LOOP_MIN_SECONDS = .05;
/** Kernel bound for any journey time: 64 scenes of at most 3600 seconds. */
export const JOURNEY_TIME_MAX = 64 * 3600;

export interface JourneyMarker {id: string; name: string; time: number; colour: MarkerColour}
export interface LoopRegion {from: number; to: number}
export type LoopEdge = 'from' | 'to';

const SAFE_ID = /^[a-zA-Z0-9_.:-]{1,160}$/;
const MARKER_FIELDS = ['id', 'name', 'time', 'colour'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const round2 = (n: number) => Math.round(n * 100) / 100;
const clampTime = (t: number, duration: number) => Math.min(Math.max(0, t), Math.max(0, duration));

/** The journey's length on the ruler clock. */
export function journeyTotal(durations: readonly number[]): number {
  return durations.reduce((sum, d) => sum + d, 0);
}

/** Start time of every scene, then the journey end: boundaries[i] is where scene i starts. */
export function sceneBoundaries(durations: readonly number[]): number[] {
  const out = [0];
  let sum = 0;
  for (const d of durations) { sum += d; out.push(sum); }
  return out;
}

/** The scene under journey time `t` and its local time. A boundary belongs to the scene it starts,
 * matching the playhead's own index walk in app.ts. */
export function sceneAtJourneyTime(durations: readonly number[], t: number): {sceneIndex: number; local: number} {
  let index = 0, value = Math.max(0, t);
  while (index < durations.length - 1 && value >= durations[index]) { value -= durations[index]; index++; }
  return {sceneIndex: index, local: value};
}

/** Snaps `time` to the nearest scene boundary within `tolerancePx` pixels at `secondsPerPx`. */
export function snapToBoundary(time: number, boundaries: readonly number[], secondsPerPx: number,
  tolerancePx = MARKER_SNAP_PX): number {
  if (!Number.isFinite(time) || !(secondsPerPx > 0)) return time;
  const gap = tolerancePx * secondsPerPx;
  let best: number | null = null;
  for (const b of boundaries) {
    const d = Math.abs(b - time);
    if (d <= gap && (best === null || d < Math.abs(best - time))) best = b;
  }
  return best ?? time;
}

export function sortMarkers(list: readonly JourneyMarker[]): JourneyMarker[] {
  return [...list].sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Validates the persisted marker list. Shape and count are refused; times are clamped to
 * [0, duration] because scene trims can shorten the journey under a marker. */
export function validateMarkers(value: unknown, duration: number): JourneyMarker[] {
  if (!Array.isArray(value) || value.length > MARKER_LIMIT) throw new Error(`A journey holds at most ${MARKER_LIMIT} markers.`);
  const ids = new Set<string>();
  return sortMarkers(value.map(row => {
    if (!isRecord(row) || Object.keys(row).some(key => !MARKER_FIELDS.includes(key))) throw new Error('Invalid journey marker.');
    const {id, name, time, colour} = row;
    if (typeof id !== 'string' || !SAFE_ID.test(id) || ids.has(id)) throw new Error('Marker identities must be unique and safe.');
    ids.add(id);
    if (typeof name !== 'string' || name.length < 1 || name.length > MARKER_NAME_MAX) throw new Error(`Marker names are 1–${MARKER_NAME_MAX} characters.`);
    if (typeof time !== 'number' || !Number.isFinite(time)) throw new Error('Marker time must be a finite number.');
    if (!(MARKER_COLOURS as readonly unknown[]).includes(colour)) throw new Error('Marker colour must be a palette key.');
    return {id, name, time: clampTime(round2(time), duration), colour: colour as MarkerColour};
  }));
}

/** Validates the persisted loop region. Absent means no region. A region clamped to nothing is dropped. */
export function validateLoopRegion(value: unknown, duration: number): LoopRegion | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'from' && key !== 'to')
    || typeof value.from !== 'number' || typeof value.to !== 'number' || !Number.isFinite(value.from) || !Number.isFinite(value.to)) {
    throw new Error('Invalid loop region.');
  }
  const from = clampTime(round2(value.from), duration), to = clampTime(round2(value.to), duration);
  return to - from >= LOOP_MIN_SECONDS ? {from, to} : undefined;
}

export function markerNamed(list: readonly JourneyMarker[], id: string): JourneyMarker | undefined {
  return list.find(m => m.id === id);
}

export function markerAdd(list: readonly JourneyMarker[], marker: JourneyMarker): JourneyMarker[] {
  if (list.length >= MARKER_LIMIT) throw new Error(`A journey holds at most ${MARKER_LIMIT} markers.`);
  if (list.some(m => m.id === marker.id)) throw new Error('This marker already exists.');
  return sortMarkers([...list, {...marker, time: round2(marker.time)}]);
}

export function markerRename(list: readonly JourneyMarker[], id: string, name: string): JourneyMarker[] {
  const next = name.trim();
  if (!next || next.length > MARKER_NAME_MAX) throw new Error(`Marker names are 1–${MARKER_NAME_MAX} characters.`);
  if (!markerNamed(list, id)) throw new Error('This marker is no longer on the journey.');
  return list.map(m => m.id === id ? {...m, name: next} : m);
}

export function markerMove(list: readonly JourneyMarker[], id: string, time: number, duration: number): JourneyMarker[] {
  if (!markerNamed(list, id)) throw new Error('This marker is no longer on the journey.');
  return sortMarkers(list.map(m => m.id === id ? {...m, time: clampTime(round2(time), duration)} : m));
}

export function markerRemove(list: readonly JourneyMarker[], id: string): JourneyMarker[] {
  if (!markerNamed(list, id)) throw new Error('This marker is no longer on the journey.');
  return list.filter(m => m.id !== id);
}

/** The first marker strictly after `t` (a marker under the playhead is passed). */
export function nextMarkerTime(list: readonly JourneyMarker[], t: number, eps = .005): number | null {
  let best: number | null = null;
  for (const m of list) if (m.time > t + eps && (best === null || m.time < best)) best = m.time;
  return best;
}

/** The last marker strictly before `t`. */
export function prevMarkerTime(list: readonly JourneyMarker[], t: number, eps = .005): number | null {
  let best: number | null = null;
  for (const m of list) if (m.time < t - eps && (best === null || m.time > best)) best = m.time;
  return best;
}

/** Sets the in or out point at `time`. With no region yet, the other edge is the journey's start or end. */
export function setLoopEdge(region: LoopRegion | undefined, edge: LoopEdge, time: number, duration: number):
  {region: LoopRegion} | {refusal: string} {
  const t = clampTime(round2(time), duration);
  const base = region ?? {from: 0, to: duration};
  const next = edge === 'from' ? {from: t, to: base.to} : {from: base.from, to: t};
  if (next.to - next.from < LOOP_MIN_SECONDS) {
    return {refusal: edge === 'from' ? 'The loop in must come before the loop out.' : 'The loop out must come after the loop in.'};
  }
  return {region: next};
}

/** Drags one edge to `time`, held on the far side by the minimum length. */
export function dragLoopEdge(region: LoopRegion, edge: LoopEdge, time: number, duration: number): LoopRegion {
  const t = clampTime(round2(time), duration);
  return edge === 'from'
    ? {from: Math.min(t, region.to - LOOP_MIN_SECONDS), to: region.to}
    : {from: region.from, to: Math.max(t, region.from + LOOP_MIN_SECONDS)};
}

/** Moves the whole region by `delta` seconds, keeping its length inside [0, duration]. */
export function moveLoopRegion(region: LoopRegion, delta: number, duration: number): LoopRegion {
  const length = region.to - region.from;
  const from = round2(Math.min(Math.max(region.from + delta, 0), Math.max(0, duration - length)));
  return {from, to: round2(from + length)};
}

/**
 * Journey playback reaches the region's out point. Returns where playback continues: the in point
 * plus whatever the frame overshot the out point by, so the wrap is exact to the frame. Null while the
 * playhead is outside the region or has not reached out during this advance.
 */
export function regionWrap(durations: readonly number[], sceneIndex: number, elapsed: number, advance: number,
  region: LoopRegion | undefined): {sceneIndex: number; local: number} | null {
  if (!region || !(region.to > region.from) || !(advance > 0) || !Number.isFinite(elapsed)) return null;
  const before = (sceneBoundaries(durations)[sceneIndex] ?? 0) + elapsed;
  const after = before + advance;
  if (!(before < region.to && after >= region.to)) return null;
  const over = (after - region.to) % (region.to - region.from);
  return sceneAtJourneyTime(durations, region.from + over);
}
