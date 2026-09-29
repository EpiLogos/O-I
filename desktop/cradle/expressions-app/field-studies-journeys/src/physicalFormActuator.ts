/**
 * Apply an admitted ql.m3-physical-form-target to an existing Expression entity.
 * Source angles must never be used as a pose substitute. A pose is "applied"
 * only when a named engine consumer actually reads it; a computed rotation
 * that nothing consumes is not actuation.
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
  | {applied: false; status: 'unavailable'; reason: string}
  | {applied: false; status: 'not-actuated'; reason: string; pose_ordinal: number; state_count: number; standing: string};

/** No Expression engine surface reads a physical-form pose. Stated, not hidden. */
export const NO_POSE_CONSUMER_REASON =
  'no Expression engine consumer reads a physical-form pose; the fold-pose is an inspectable reading, not material in the body (K2-EXPRESSION-BINDING open question). M3 reaches the field only through the M2 Vimarśā voices.';

/** Report the admitted symbolic pose without inventing a rotation law. Native
 * hinge presentation is a separate source-qualified geometry consumer. */
export function applyPhysicalFormPose(
  form: PhysicalFormTarget | null | undefined,
  consumerConnected: boolean,
): FormPoseActuatorResult {
  if (!consumerConnected) {
    return {applied: false, status: 'unavailable', reason: 'physical-form consumer disconnected'};
  }
  if (!form) {
    return {applied: false, status: 'unavailable', reason: 'physical form target not supplied by this native output'};
  }
  if (form.schema !== 'ql.m3-physical-form-target/v1') {
    return {applied: false, status: 'unavailable', reason: 'physical_form schema mismatch'};
  }
  if (!form.standing.includes('not orientation_seed') || !form.standing.includes('not source angles as pose')) {
    return {applied: false, status: 'unavailable', reason: 'physical_form standing refused — would collapse into orientation_seed/angles'};
  }
  if (!Number.isInteger(form.pose_ordinal) || form.pose_ordinal < 0 || !Number.isInteger(form.state_count) || form.state_count <= 0) {
    return {applied: false, status: 'unavailable', reason: 'physical_form pose/state incomplete'};
  }
  return {applied: false, status: 'not-actuated', reason: NO_POSE_CONSUMER_REASON,
    pose_ordinal: form.pose_ordinal, state_count: form.state_count, standing: form.standing};
}
