import type { Entity, SequenceState } from './fieldModel';
import { effectiveLinks, resolveSequence } from './fieldModel';

export interface EvaluatedEntityPose {
  entityId: string;
  x: number;
  y: number;
  z: number;
  /** Per-link object state, blended A→B; falls back to the entity base. */
  scale: number;
  extent: Entity['extent'];
  tint: string;
  tintWeight: number;
  forces: Entity['forces'];
  sequence: SequenceState;
}

/**
 * Single source of truth for an entity's authored/evaluated world pose.
 * Formations, pins, force emitters and semantic carriers consume this same pose.
 * Per-link object states (authored scale/extent/tint/forces) blend across the
 * link transition exactly as the targets themselves do — moving never re-bakes.
 */
export function resolveEntityPose(
  entity: Entity,
  simTime: number,
  drivePhase: number,
  manualMorph: number,
  holdRatio: number
): EvaluatedEntityPose {
  const sequence = resolveSequence(entity, simTime, drivePhase, manualMorph, holdRatio);
  const links = effectiveLinks(entity);
  const a = links[sequence.linkIndex];
  const b = links[sequence.nextIndex];
  const t = sequence.progress;
  const mix = (x: number, y: number) => x + (y - x) * t;
  const sa = a?.state, sb = b?.state;
  const fa = sa?.forces ?? entity.forces, fb = sb?.forces ?? entity.forces;
  return {
    entityId: entity.id,
    x: entity.x + (a?.x ?? 0) * (1 - t) + (b?.x ?? 0) * t,
    y: entity.y + (a?.y ?? 0) * (1 - t) + (b?.y ?? 0) * t,
    z: entity.z + (a?.z ?? 0) * (1 - t) + (b?.z ?? 0) * t,
    scale: mix(sa?.scale ?? entity.scale, sb?.scale ?? entity.scale),
    extent: {
      width: mix(sa?.extent?.width ?? entity.extent?.width ?? 400, sb?.extent?.width ?? entity.extent?.width ?? 400),
      height: mix(sa?.extent?.height ?? entity.extent?.height ?? 400, sb?.extent?.height ?? entity.extent?.height ?? 400),
      rotation: mix(sa?.extent?.rotation ?? entity.extent?.rotation ?? 0, sb?.extent?.rotation ?? entity.extent?.rotation ?? 0),
      normalized: entity.extent?.normalized ?? true,
    },
    tint: t < .5 ? (sa?.tint ?? entity.tint) : (sb?.tint ?? entity.tint),
    tintWeight: mix(sa?.tintWeight ?? entity.tintWeight, sb?.tintWeight ?? entity.tintWeight),
    forces: {
      mode: t < .5 ? fa.mode : fb.mode,
      strength: mix(fa.strength, fb.strength),
      radius: mix(fa.radius, fb.radius),
      spin: mix(fa.spin, fb.spin),
    },
    sequence,
  };
}
