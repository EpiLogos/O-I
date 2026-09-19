import type { Entity } from './fieldModel';
import type { EvaluatedEntityPose } from './entityPose';
import type { PlacedInteractionPoint, PointCloudRelationalConfig } from './types';

export const MAX_FORCE_EMITTERS = 18;
export type ForceEmitterLaw = 'radial' | 'vortex';
export type ForceEmitterPolarity = 'attract' | 'repel';
export type ForceEmitterMetric = 'compositionPlane' | 'world3d';

export interface ForceEmitterState {
  id: string;
  sourceEntityId?: string;
  position: { x:number; y:number; z:number };
  law: ForceEmitterLaw;
  polarity: ForceEmitterPolarity;
  strength: number;
  radius: number;
  spin: number;
  metric: ForceEmitterMetric;
  enabled: boolean;
}

export function compileEntityForceEmitters(
  entities: Entity[],
  poses: readonly EvaluatedEntityPose[],
  legacyPoints: readonly PlacedInteractionPoint[] = [],
  formationMetric: ForceEmitterMetric = 'compositionPlane'
): ForceEmitterState[] {
  const poseById = new Map(poses.map((pose) => [pose.entityId, pose] as const));
  const emitters: ForceEmitterState[] = [];
  // First-class entity identity shadows any legacy placed-point record even when the entity
  // is disabled/off. A stale migration input must never resurrect a deliberately disabled pin.
  const seen = new Set(entities.map((entity)=>entity.id));
  for (const entity of entities) {
    // Per-link object states blend forces across the transition; the pose carries
    // the evaluated value, falling back to the entity base when no state is authored.
    const pose = poseById.get(entity.id);
    const forces = pose?.forces ?? entity.forces;
    if (!entity.enabled || (forces.mode === 'none' && Math.abs(forces.spin) < 1e-9)) continue;
    emitters.push({
      id:`entity:${entity.id}`,
      sourceEntityId:entity.id,
      position:pose ? {x:pose.x,y:pose.y,z:pose.z} : {x:entity.x,y:entity.y,z:entity.z},
      law:forces.mode === 'vortex' ? 'vortex' : 'radial',
      polarity:forces.mode === 'repel' ? 'repel' : 'attract',
      strength:forces.mode === 'none' ? 0 : forces.strength,
      radius:Math.max(5, forces.radius),
      spin:forces.spin,
      // Formations inherit the caller's metric: planar for flat compositions,
      // full 3D once the true-3D body law is on (their force then acts through
      // the body). Pins are always full 3D.
      metric: entity.kind === 'pin' ? 'world3d' : formationMetric,
      enabled:true,
    });
  }
  // Back compatibility for callers that still supply placedPoints without first-class pin entities.
  for (const point of legacyPoints) {
    if (seen.has(point.id) || point.active === false || (Math.abs(point.strength) < 1e-9 && Math.abs(point.spin ?? 0) < 1e-9)) continue;
    emitters.push({
      id:`legacy-pin:${point.id}`,
      position:{x:point.x,y:point.y,z:point.z??0},
      law:point.mode === 'vortex' ? 'vortex' : 'radial',
      polarity:point.mode === 'repel' ? 'repel' : 'attract',
      strength:point.strength,
      radius:Math.max(5,point.radius),
      spin:point.spin??0,
      metric:'world3d',
      enabled:true,
    });
  }
  return emitters.slice(0, MAX_FORCE_EMITTERS);
}

export interface RelationalCarrierState {
  id: string;
  position:{x:number;y:number;z:number};
  strength:number;
  spin:number;
  radius:number;
}

/** Exposes relational centres as semantic carriers without changing their native Plummer/chaos force law. */
export function relationalCarrierStates(
  positions: ReadonlyArray<{x:number;y:number;z:number}>,
  config: PointCloudRelationalConfig | undefined
): RelationalCarrierState[] {
  if (!config?.enabled) return [];
  return positions.map((position,index)=>({
    id:`relational:${index}`,
    position:{...position},
    strength:config.attractorGravity??1.5,
    spin:(index%2===0?1:-1)*(config.relationalSpin??1.2),
    radius:config.swirlRadius??500,
  }));
}
