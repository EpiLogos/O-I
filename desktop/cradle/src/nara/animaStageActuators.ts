/**
 * Map an admitted Anima ExpressionProfile onto existing Expression entities.
 * Presentation only — does not invent centres, copy private M4, or treat
 * locus identity as a cymatic station.
 */

import type {AnimaExpressionProfile, PersonalProjectionBinding} from "./personalProjection";

export type EntityPoseTarget = {
  entity_ref: string;
  subject_ref?: string;
  title?: string;
  tintWeight?: number;
  size?: {x: number; y: number};
  rotation?: number;
};

export type CentreActuatorPlan =
  | {
      applied: true;
      entity_ref: string;
      locus_ref: string;
      ordinal: number;
      tintWeight: number;
      sizeScale: number;
      standing: string;
    }
  | {
      applied: false;
      locus_ref: string;
      ordinal: number;
      reason: string;
    };

export type AnimaStageActuatorResult = {
  schema: 'oi.anima-stage-actuator-plan/v1';
  standing: string;
  centres: CentreActuatorPlan[];
  earth_body:
    | {applied: true; entity_ref: string; standing: string}
    | {applied: false; reason: string};
};

function findCentreEntity(
  entities: EntityPoseTarget[],
  centre: {locus_ref: string; label: string; ordinal: number},
): EntityPoseTarget | undefined {
  return entities.find(
    (entity) =>
      entity.subject_ref === centre.locus_ref
      || entity.title === centre.label
      || entity.entity_ref.includes(`centre-${centre.ordinal}`)
      || entity.entity_ref.includes(`centre:${centre.ordinal}`)
      || entity.title?.toLowerCase() === centre.label.toLowerCase(),
  );
}

/** Pure plan: how live Anima amplitudes drive existing Expression body params. */
export function planAnimaStageActuators(
  binding: PersonalProjectionBinding | null | undefined,
  entities: EntityPoseTarget[],
): AnimaStageActuatorResult {
  if (!binding || binding.disconnected || !binding.profile) {
    return {
      schema: 'oi.anima-stage-actuator-plan/v1',
      standing: 'authored Expression retained; no live Anima actuators',
      centres: [],
      earth_body: {applied: false, reason: 'personal projection disconnected or absent'},
    };
  }
  const profile: AnimaExpressionProfile = binding.profile;
  if (!profile.centre_identity_neq_cymatic_station) {
    return {
      schema: 'oi.anima-stage-actuator-plan/v1',
      standing: 'refused — centre identity collapsed into cymatic station',
      centres: profile.centres.map((c) => ({
        applied: false as const,
        locus_ref: c.locus_ref,
        ordinal: c.ordinal,
        reason: 'centre identity must remain distinct from cymatic stations',
      })),
      earth_body: {applied: false, reason: 'profile standing refused'},
    };
  }
  const centres: CentreActuatorPlan[] = profile.centres.map((centre) => {
    const entity = findCentreEntity(entities, centre);
    if (!entity) {
      return {
        applied: false as const,
        locus_ref: centre.locus_ref,
        ordinal: centre.ordinal,
        reason: 'no bound Expression entity for this centre locus',
      };
    }
    const amplitude = Number.isFinite(centre.amplitude) ? Math.min(1, Math.max(0, centre.amplitude)) : 0.5;
    return {
      applied: true as const,
      entity_ref: entity.entity_ref,
      locus_ref: centre.locus_ref,
      ordinal: centre.ordinal,
      tintWeight: amplitude,
      sizeScale: 0.85 + amplitude * 0.35,
      standing: 'Anima amplitude → existing tintWeight/size; not a new centre ontology',
    };
  });
  const earth = entities.find(
    (entity) =>
      entity.title === 'EarthBody'
      || entity.subject_ref === profile.earth_body.locus_ref
      || entity.subject_ref?.includes('earth'),
  );
  return {
    schema: 'oi.anima-stage-actuator-plan/v1',
    standing: profile.standing,
    centres,
    earth_body: earth
      ? {
          applied: true,
          entity_ref: earth.entity_ref,
          standing: profile.earth_body.standing,
        }
      : {
          applied: false,
          reason: 'EarthBody grounding entity not present in Expression; not invented as eighth centre',
        },
  };
}
