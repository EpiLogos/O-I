/** Recorded property tracks (Scene.propertyTracks) as typed native edits
 * (editor.ts NativeTrackChange). Pure: clones the Journey, removes one named
 * track, and returns a validated copy. Recording and preview sample the live
 * frame inside the Expressions application (stageCommands.ts take/tracks); they
 * are never a document write loop. The readings here are derived from the
 * Scene's own points only. */
import type {Journey, Scene, NativeTrackChange} from './editor.ts';
import type {PropertyTrack} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks';
import {clone, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {entityTargets, nativeBinding} from './parameters';

const SHAPE_REFUSAL = 'Choose an admitted property track edit.';
const ID_LIMIT = 200;
const CHANGE_LIMIT = 64;
const KEYS = ['kind', 'track_id'] as const;

/** Shape-only check; the track must still exist in the addressed Scene (applyNativeTrackChanges). */
export function validateNativeTrackChange(change: unknown): NativeTrackChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error(SHAPE_REFUSAL);
  const row = change as Record<string, unknown>;
  if (row.kind !== 'track-remove' || Object.keys(row).some(key => !(KEYS as readonly string[]).includes(key))) throw Error(SHAPE_REFUSAL);
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

/** One read-only row per recorded track: identity, binding label, and its own keyframes. */
export interface NativeTakeTrack {
  id: string;
  bind: string;
  entity_id: string | null;
  label: string;
  point_count: number;
  start: number;
  end: number;
  duration: number;
  points: readonly {time: number; value: number}[];
}
export function readNativeTakeTracks(scene: Scene): NativeTakeTrack[] {
  const labels = nativeTrackLabels(scene);
  return (scene.propertyTracks ?? []).map((track: PropertyTrack) => {
    const points = track.points.map(point => ({time: point.time, value: point.value}));
    const start = points[0]?.time ?? 0, end = points.at(-1)?.time ?? 0;
    return {id: track.id, bind: track.bind, entity_id: track.entityId ?? null, label: labels.get(track.id) ?? track.bind,
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
    if (!tracks.some(track => track.id === change.track_id)) throw Error('The recorded property track no longer belongs to this Scene. Read it again.');
    scene.propertyTracks = tracks.filter(track => track.id !== change.track_id);
  }
  return validateJourney(draft);
}
