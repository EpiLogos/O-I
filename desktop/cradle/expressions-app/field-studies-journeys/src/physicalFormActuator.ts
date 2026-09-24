/**
 * Apply an admitted ql.m3-physical-form-target to an existing Expression entity.
 * Source angles must never be used as a pose substitute.
 */
export type PhysicalFormTarget = {
  schema: string;
  target_kind: string;
  constituent_ref: string;
  pose_ordinal: number;
  state_count: number;
  address: number;
  standing: string;
};

export type FormPoseActuatorResult =
  | {applied: true; rotationDegrees: number; pose_ordinal: number; standing: string}
  | {applied: false; reason: string};

/** Map fold-pose ordinal onto a bounded rotation on the existing glyph/form body. */
export function applyPhysicalFormPose(
  form: PhysicalFormTarget | null | undefined,
  consumerConnected: boolean,
): FormPoseActuatorResult {
  if (!consumerConnected) {
    return {applied: false, reason: 'physical-form consumer disconnected'};
  }
  if (!form) {
    return {applied: false, reason: 'physical form actuator unavailable'};
  }
  if (form.schema !== 'ql.m3-physical-form-target/v1') {
    return {applied: false, reason: 'physical_form schema mismatch'};
  }
  if (!form.standing.includes('not orientation_seed') || !form.standing.includes('not source angles as pose')) {
    return {applied: false, reason: 'physical_form standing refused — would collapse into orientation_seed/angles'};
  }
  if (!Number.isInteger(form.pose_ordinal) || form.pose_ordinal < 0 || !Number.isInteger(form.state_count) || form.state_count <= 0) {
    return {applied: false, reason: 'physical_form pose/state incomplete'};
  }
  const rotationDegrees = (360 / form.state_count) * (form.pose_ordinal % form.state_count);
  return {
    applied: true,
    rotationDegrees,
    pose_ordinal: form.pose_ordinal,
    standing: form.standing,
  };
}
