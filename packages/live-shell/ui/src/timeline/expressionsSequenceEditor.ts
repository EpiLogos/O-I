// Expressions sequence editor: the inside of one scene (DEVICE-SEMANTICS-LOCK
// §9.4, the note-editor row). Entity lanes run across the sequence steps of the
// presented scene. A step's hold is a note's length; its transition is the
// note's glide. The same step, read as Live reads a note.
//
// Ports (path:line at HEAD 8bf279d3e):
// - the projection moved from packages/live-shell/ui/src/timeline/expressionsTrackAdapter.ts:
//   requireDuration 79-84, glyphLabel 86-89, projectExpressionsTracks 91-135.
//   Its output is kept byte-for-byte by sceneSequenceAsTracks; the deep-equal
//   case in tests/expressions-track-adapter.test.mjs holds it.
// - the step model: desktop/cradle/expressions-app/src/engine/types.ts:193-194
//   (a chain link's hold and transition, in seconds), :207 (phase hold |
//   transition), :491-498 (per-entity link telemetry, entityId and linkIndex).
//
// Pure functions. No store, no writes, and the reading is never mutated.
//
// Pure TypeScript. No React, no family names.

import type {WorldTrack, WorldTrackClip, WorldTrackColumn, WorldTrackSet, WorldTrackTake} from './worldTrackAdapter';

export interface ExpressionsScene {
  id: string;
  name: string;
  duration: number;
}

export interface ExpressionsGlyph {
  text?: string;
  shape?: string;
}

export interface ExpressionsSequenceStep {
  id: string;
  hold: number;
  transition: number;
  // Optional per-step glyph. Falls back to the entity glyph.
  glyph?: ExpressionsGlyph;
}

export interface ExpressionsEntity {
  id: string;
  name: string;
  glyph?: ExpressionsGlyph;
  sequence?: ExpressionsSequenceStep[];
}

export interface ExpressionsAutomationLane {
  id: string;
  target: string;
  enabled: boolean;
}

export interface ExpressionsPropertyTrack {
  id: string;
  bind: string;
}

export interface ExpressionsTrackReading {
  scenes: ExpressionsScene[];
  presentedSceneId: string;
  presented: {
    entities: ExpressionsEntity[];
    automationLanes: ExpressionsAutomationLane[];
    propertyTracks: ExpressionsPropertyTrack[];
  };
}

// One entity lane of the sequence editor.
export interface SequenceLane {
  id: string;
  entityId: string;
  name: string;
}

// One sequence step as a note: it starts at `start`, holds for `length`, then glides for `glide`.
export interface SequenceNote {
  id: string;
  laneId: string;
  start: number;
  length: number;
  glide: number;
  label: string;
}

// One automation lane of the presented scene, drawn as a clip envelope.
export interface SequenceEnvelope {
  id: string;
  target: string;
  enabled: boolean;
  // The source moving the parameter (lock §9.4, §14: every modulated parameter
  // shows its modulator), when the reading names one.
  modulatedBy?: string;
}

export interface SceneSequence {
  lanes: SequenceLane[];
  notes: SequenceNote[];
  envelopes: SequenceEnvelope[];
  takes: WorldTrackTake[];
}

const entityLaneId = (entityId: string): string => `entity:${entityId}`;
const automationTrackId = (sceneId: string): string => `automation:${sceneId}`;

function requireDuration(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative number`);
  }
  return value;
}

function glyphLabel(step: ExpressionsSequenceStep, entity: ExpressionsEntity): string {
  const glyph = step.glyph ?? entity.glyph;
  return glyph?.text ?? glyph?.shape ?? step.id;
}

function presentedSceneOf(reading: ExpressionsTrackReading): ExpressionsScene {
  const presentedScene = reading.scenes.find((scene) => scene.id === reading.presentedSceneId);
  if (!presentedScene) {
    throw new Error(`Presented scene ${reading.presentedSceneId} is not in the reading`);
  }
  return presentedScene;
}

// The presented scene's sequence: lanes per entity, notes per step, envelopes per
// automation lane, takes per property track. Steps lie end to end within a lane.
export function projectSceneSequence(reading: ExpressionsTrackReading): SceneSequence {
  presentedSceneOf(reading);

  const lanes: SequenceLane[] = [];
  const notes: SequenceNote[] = [];
  for (const entity of reading.presented.entities) {
    lanes.push({id: entityLaneId(entity.id), entityId: entity.id, name: entity.name});
    let start = 0;
    for (const step of entity.sequence ?? []) {
      const hold = requireDuration(step.hold, `Step ${step.id} hold`);
      const glide = requireDuration(step.transition, `Step ${step.id} transition`);
      notes.push({
        id: `clip:${entity.id}:${step.id}`,
        laneId: entityLaneId(entity.id),
        start,
        length: hold,
        glide,
        label: glyphLabel(step, entity),
      });
      start = start + hold + glide;
    }
  }

  const envelopes: SequenceEnvelope[] = reading.presented.automationLanes.map((lane) => ({
    id: lane.id,
    target: lane.target,
    enabled: lane.enabled,
  }));

  // Takes are transport material, not tracks and not a clock.
  const takes: WorldTrackTake[] = reading.presented.propertyTracks.map((track) => ({
    id: track.id,
    target: track.bind,
    name: `Take ${track.id}`,
  }));

  return {lanes, notes, envelopes, takes};
}

// The same presentation as the Timeline's neutral shape: the columns are the
// scenes, the tracks are the entities plus one automation track, the clips are the
// steps. The output is the pre-move projectExpressionsTracks, unchanged.
export function sceneSequenceAsTracks(reading: ExpressionsTrackReading): WorldTrackSet {
  const sequence = projectSceneSequence(reading);
  const columnId = presentedSceneOf(reading).id;

  const columns: WorldTrackColumn[] = reading.scenes.map(({id, name}) => ({id, name}));

  const tracks: WorldTrack[] = sequence.lanes.map((lane) => ({id: lane.id, name: lane.name, kind: 'entity'}));
  if (sequence.envelopes.length > 0) {
    tracks.push({id: automationTrackId(columnId), name: 'Automation', kind: 'automation'});
  }

  const clips: WorldTrackClip[] = sequence.notes.map((note) => ({
    id: note.id,
    trackId: note.laneId,
    columnId,
    label: note.label,
    span: {start: note.start, end: note.start + note.length + note.glide},
  }));

  return {columns, tracks, clips, transport: {takes: sequence.takes}};
}
