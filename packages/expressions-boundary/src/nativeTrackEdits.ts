/** Recorded property tracks (Scene.propertyTracks) as typed native edits
 * (editor.ts NativeTrackChange). Pure: clones the Journey, removes one named
 * track or draws over its moves (XT10, round 889), and returns a validated copy. Recording and preview sample the live
 * frame inside the Expressions application (stageCommands.ts take/tracks); they
 * are never a document write loop. The readings here are derived from the
 * Scene's own points only. */
import type {Journey, Scene, NativeTrackChange} from './editor.ts';
import {channelRange, validateCurveEdit, type PropertyTrack} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks';
import {clone, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {isShared} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings';
import {entityTargets, nativeBinding} from './parameters';

const SHAPE_REFUSAL = 'Choose an admitted property track edit.';
const ID_LIMIT = 200;
const CHANGE_LIMIT = 64;
const KEYS = ['kind', 'track_id'] as const;
const DRAW_KEYS = ['kind', 'track_id', 'points'] as const;
/** XT10 (round 889): a drawn lane's points, at most as many as a Live envelope drawn across a scene keeps here. */
const DRAW_POINTS = {min: 2, max: 512} as const;
const DRAW_REFUSAL = 'Draw a lane with 2 to 512 points, in time order, from 0 to 3600 s.';
const closedKeys = (row: Record<string, unknown>, keys: readonly string[]) => Object.keys(row).every(key => keys.includes(key));

/** Shape-only check; the track must still exist in the addressed Scene (applyNativeTrackChanges). */
export function validateNativeTrackChange(change: unknown): NativeTrackChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error(SHAPE_REFUSAL);
  const row = change as Record<string, unknown>;
  if (row.kind === 'track-draw') {
    if (!closedKeys(row, DRAW_KEYS)) throw Error(SHAPE_REFUSAL);
    if (typeof row.track_id !== 'string' || row.track_id.length === 0 || row.track_id.length > ID_LIMIT) throw Error('Choose a recorded property track to draw.');
    const points = row.points;
    if (!Array.isArray(points) || points.length < DRAW_POINTS.min || points.length > DRAW_POINTS.max) throw Error(DRAW_REFUSAL);
    const drawn: {time: number; value: number}[] = [];
    for (const point of points as unknown[]) {
      if (!point || typeof point !== 'object' || Array.isArray(point) || !closedKeys(point as Record<string, unknown>, ['time', 'value'])) throw Error(DRAW_REFUSAL);
      const {time, value} = point as {time: unknown; value: unknown};
      if (typeof time !== 'number' || typeof value !== 'number' || !Number.isFinite(time) || !Number.isFinite(value) || time < 0 || time > 3600
        || drawn.length && time <= drawn[drawn.length - 1].time) throw Error(DRAW_REFUSAL);
      drawn.push({time, value});
    }
    return {kind: 'track-draw', track_id: row.track_id, points: drawn};
  }
  if (row.kind !== 'track-remove' || !closedKeys(row, KEYS)) throw Error(SHAPE_REFUSAL);
  if (typeof row.track_id !== 'string' || row.track_id.length === 0 || row.track_id.length > ID_LIMIT) throw Error('Choose a recorded property track to remove.');
  return {kind: 'track-remove', track_id: row.track_id};
}

/** The parameter a recorded track drives, named as the Scene's own binding names it. */
export function nativeTrackLabels(scene: Scene): Map<string, string> {
  const tracks = scene.propertyTracks ?? [];
  const targets = tracks.some(track => track.bind.startsWith('entity.')) ? entityTargets(scene) : [];
  return new Map(tracks.map(track => {
    const label = track.bind.startsWith('field.params.')
      ? nativeBinding(track.bind.slice('field.params.'.length))?.label
      : targets.find(target => target.entityId === track.entityId && target.bind === track.bind)?.label;
    return [track.id, label ?? track.bind] as const;
  }));
}

/** One read-only row per recorded track: identity, binding label, its parameter's own range, and its own keyframes. */
export interface NativeTakeTrack {
  id: string;
  bind: string;
  entity_id: string | null;
  label: string;
  /** The hard limits of the parameter it moves (propertyTracks.ts channelRange), where the Scene still holds it: a lane drawn over it
   * stays inside them (XT10, round 889). */
  range: {min: number; max: number} | null;
  point_count: number;
  start: number;
  end: number;
  duration: number;
  points: readonly {time: number; value: number}[];
}
/** A recorded track's parameter range, or null where the Scene no longer holds what it moves (or holds no entities to look in). */
function rangeOf(scene: Scene, track: Pick<PropertyTrack, 'bind' | 'entityId'>): {min: number; max: number} | null {
  try { const range = channelRange(scene, track); return range ? {min: range.min, max: range.max} : null; } catch { return null; }
}
export function readNativeTakeTracks(scene: Scene): NativeTakeTrack[] {
  const labels = nativeTrackLabels(scene);
  return (scene.propertyTracks ?? []).map((track: PropertyTrack) => {
    const points = track.points.map(point => ({time: point.time, value: point.value}));
    const start = points[0]?.time ?? 0, end = points.at(-1)?.time ?? 0;
    const range = rangeOf(scene, track);
    return {id: track.id, bind: track.bind, entity_id: track.entityId ?? null, label: labels.get(track.id) ?? track.bind, range,
      point_count: points.length, start, end, duration: end - start, points};
  });
}

/** Atomic, validated copy. A refused change leaves the caller's document untouched. */
export function applyNativeTrackChanges(journey: Journey, sceneId: string, changes: readonly NativeTrackChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > CHANGE_LIMIT) throw Error('Choose between 1 and 64 property track changes.');
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  for (const raw of changes) {
    const change = validateNativeTrackChange(raw), tracks = scene.propertyTracks ?? [];
    const track = tracks.find(row => row.id === change.track_id);
    if (!track) throw Error('The recorded property track no longer belongs to this Scene. Read it again.');
    if (change.kind === 'track-remove') { scene.propertyTracks = tracks.filter(row => row.id !== change.track_id); continue; }
    // XT10 (round 889; §20.3 Rules "A macro set to All scenes is not recorded"): the drawn moves lie over the stretch they cover, inside the
    // scene and the parameter's own range, and the moves outside it stay; a macro on All scenes is neither recorded nor drawn.
    if (isShared(draft, scene, track.bind)) throw Error('A macro set to All scenes is not recorded. Turn All scenes off to draw its moves.');
    const range = channelRange(scene, track);
    if (!range) throw Error('The parameter this lane moves is no longer in the Scene. Read it again.');
    const from = change.points[0].time, to = change.points[change.points.length - 1].time;
    if (to > scene.duration) throw Error(`A lane is drawn within its scene: 0 to ${scene.duration} s.`);
    // a kept move's curve handle never reaches into the stretch drawn over: the moves on either side of it meet the drawn ones in a line
    const kept = track.points.filter(point => point.time < from || point.time > to).map(point => {
      const {in: inward, out, ...rest} = point;
      return {...rest, ...(inward && point.time < from ? {in: inward} : {}), ...(out && point.time > to ? {out} : {})};
    });
    const points = [...kept, ...change.points.map(point => ({...point}))].sort((a, b) => a.time - b.time);
    validateCurveEdit(points, range, change.points.map(point => ({key: points.findIndex(row => row.time === point.time)})));
    track.points = points;
  }
  return validateJourney(draft);
}
