// Expressions track adapter: projects one Expressions reading into the neutral
// World track shape the Timeline renders.
//
// Projection:
// - columns: the scenes
// - tracks: one row per entity of the presented scene, plus one automation
//   track when the presented scene has any automation lane
// - clips: each sequence step of an entity is a glyph-state span on the
//   presented scene column. Span length is hold + transition.
// - transport.takes: the presented scene's property tracks, named as takes.
//
// Takes belong to the Transport stratum of the time spine. This adapter only
// exposes them as transport material. It does not build a clock, and it does
// not put takes on the track rows.
//
// Pure TypeScript. No React, no other family's adapter.

import type {
  WorldTrack,
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackSet,
  WorldTrackTake,
} from './worldTrackAdapter';

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

export const EXPRESSIONS_TRACK_ADAPTER_ID = 'expressions-track-adapter';

const entityTrackId = (entityId: string): string => `entity:${entityId}`;
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

export function projectExpressionsTracks(reading: ExpressionsTrackReading): WorldTrackSet {
  const presentedScene = reading.scenes.find((scene) => scene.id === reading.presentedSceneId);
  if (!presentedScene) {
    throw new Error(`Presented scene ${reading.presentedSceneId} is not in the reading`);
  }
  const columnId = presentedScene.id;

  const columns: WorldTrackColumn[] = reading.scenes.map(({id, name}) => ({id, name}));

  const tracks: WorldTrack[] = reading.presented.entities.map((entity) => ({
    id: entityTrackId(entity.id),
    name: entity.name,
    kind: 'entity',
  }));
  if (reading.presented.automationLanes.length > 0) {
    tracks.push({id: automationTrackId(columnId), name: 'Automation', kind: 'automation'});
  }

  const clips: WorldTrackClip[] = [];
  for (const entity of reading.presented.entities) {
    let start = 0;
    for (const step of entity.sequence ?? []) {
      const hold = requireDuration(step.hold, `Step ${step.id} hold`);
      const transition = requireDuration(step.transition, `Step ${step.id} transition`);
      const end = start + hold + transition;
      clips.push({
        id: `clip:${entity.id}:${step.id}`,
        trackId: entityTrackId(entity.id),
        columnId,
        label: glyphLabel(step, entity),
        span: {start, end},
      });
      start = end;
    }
  }

  // Takes are transport material, not tracks and not a clock.
  const takes: WorldTrackTake[] = reading.presented.propertyTracks.map((track) => ({
    id: track.id,
    target: track.bind,
    name: `Take ${track.id}`,
  }));

  return {columns, tracks, clips, transport: {takes}};
}

export const expressionsTrackAdapter: WorldTrackAdapter<ExpressionsTrackReading> = {
  id: EXPRESSIONS_TRACK_ADAPTER_ID,
  project: projectExpressionsTracks,
};
