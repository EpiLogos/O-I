// Expressions track adapter: projects one Expressions work reading into the
// neutral World track shape the Timeline renders (DEVICE-SEMANTICS-LOCK §9.1–9.3).
//
// Projection:
// - tracks: each Expression is a track with two lanes, a visual side and an audio
//   side (`expression:<id>:visual`, `expression:<id>:audio`), grouped under
//   `expression:<id>`.
// - clips: each scene is a clip on both of its Expression's lanes, with the same
//   span, so the two sides stay locked. Spans are column-local (the contract's
//   law): a scene starts at 0 in its stop's column, and an Expression's scenes
//   that share a column lie end to end by duration inside it. Order across
//   stops is the columns' order (lead's ruling, 13 Oct 2026).
// - columns: the stops (Live's scene rows) when stops are given. A scene no stop
//   names sits in a trailing `unstopped` column. Without stops, one column per
//   scene position.
// - transport.takes: each scene's captured takes, targeting the scene.
//
// Takes are transport material: never a clock, never a track.
// The inside of one scene is projected by expressionsSequenceEditor.ts.
//
// Pure TypeScript. No React, no family names.

import type {
  WorldTrack,
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackSet,
  WorldTrackTake,
} from './worldTrackAdapter';

export interface ExpressionsWorkReading {
  expressions: {
    id: string;
    name: string;
    scenes: {id: string; name: string; duration: number; takes?: {id: string; name: string}[]}[];
  }[];
  // Live's scene rows: each stop stands one or more scenes at once.
  stops?: {id: string; name: string; scenes: {expressionId: string; sceneId: string}[]}[];
}

export const EXPRESSIONS_TRACK_ADAPTER_ID = 'expressions-track-adapter';

const expressionGroupId = (expressionId: string): string => `expression:${expressionId}`;
const visualLaneId = (expressionId: string): string => `expression:${expressionId}:visual`;
const audioLaneId = (expressionId: string): string => `expression:${expressionId}:audio`;
const sceneKey = (expressionId: string, sceneId: string): string => `scene:${expressionId}:${sceneId}`;
const stopColumnId = (stopId: string): string => `stop:${stopId}`;
const positionColumnId = (index: number): string => `position:${index}`;
const UNSTOPPED_COLUMN_ID = 'unstopped';

function requireDuration(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative number`);
  }
  return value;
}

// Which column each scene sits in. A scene takes the first stop that names it.
function placeScenes(reading: ExpressionsWorkReading): {columns: WorldTrackColumn[]; columnOf: Map<string, string>} {
  const columns: WorldTrackColumn[] = [];
  const columnOf = new Map<string, string>();

  if (reading.stops === undefined) {
    const positions = Math.max(0, ...reading.expressions.map((expression) => expression.scenes.length));
    for (let index = 0; index < positions; index += 1) {
      columns.push({id: positionColumnId(index), name: `Scene ${index + 1}`});
    }
    for (const expression of reading.expressions) {
      expression.scenes.forEach((scene, index) => {
        columnOf.set(sceneKey(expression.id, scene.id), positionColumnId(index));
      });
    }
    return {columns, columnOf};
  }

  const known = new Set(reading.expressions.flatMap((expression) =>
    expression.scenes.map((scene) => sceneKey(expression.id, scene.id))));
  for (const stop of reading.stops) {
    columns.push({id: stopColumnId(stop.id), name: stop.name});
    for (const ref of stop.scenes) {
      const key = sceneKey(ref.expressionId, ref.sceneId);
      if (!known.has(key)) {
        throw new Error(`Stop ${stop.id} names scene ${ref.sceneId} of ${ref.expressionId}, which is not in the reading`);
      }
      if (!columnOf.has(key)) columnOf.set(key, stopColumnId(stop.id));
    }
  }
  const unstopped = [...known].filter((key) => !columnOf.has(key));
  if (unstopped.length > 0) {
    columns.push({id: UNSTOPPED_COLUMN_ID, name: 'Unstopped'});
    for (const key of unstopped) columnOf.set(key, UNSTOPPED_COLUMN_ID);
  }
  return {columns, columnOf};
}

export function projectExpressionsWork(reading: ExpressionsWorkReading): WorldTrackSet {
  const {columns, columnOf} = placeScenes(reading);

  const tracks: WorldTrack[] = [];
  const clips: WorldTrackClip[] = [];
  const takes: WorldTrackTake[] = [];

  for (const expression of reading.expressions) {
    const groupId = expressionGroupId(expression.id);
    tracks.push(
      {id: visualLaneId(expression.id), name: `${expression.name}: visual`, kind: 'expression-visual', groupId, lane: 'visual'},
      {id: audioLaneId(expression.id), name: `${expression.name}: audio`, kind: 'expression-audio', groupId, lane: 'audio'},
    );

    // column-local cursors: one per column this Expression's scenes occupy
    const cursor = new Map<string, number>();
    expression.scenes.forEach((scene) => {
      const duration = requireDuration(scene.duration, `Scene ${scene.id} duration`);
      const key = sceneKey(expression.id, scene.id);
      const columnId = columnOf.get(key);
      if (columnId === undefined) throw new Error(`Scene ${scene.id} of ${expression.id} has no column`);
      const start = cursor.get(columnId) ?? 0;
      const end = start + duration;
      clips.push(
        {id: `${key}:visual`, trackId: visualLaneId(expression.id), columnId, label: scene.name, span: {start, end}},
        {id: `${key}:audio`, trackId: audioLaneId(expression.id), columnId, label: scene.name, span: {start, end}},
      );
      for (const take of scene.takes ?? []) {
        takes.push({id: `${key}:${take.id}`, target: key, name: take.name});
      }
      cursor.set(columnId, end);
    });
  }

  return {columns, tracks, clips, transport: {takes}};
}

export const expressionsTrackAdapter: WorldTrackAdapter<ExpressionsWorkReading> = {
  id: EXPRESSIONS_TRACK_ADAPTER_ID,
  project: projectExpressionsWork,
};
