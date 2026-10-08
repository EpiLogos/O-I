/** Existing parameter definitions and reversible authored/native projection.
 * These exports confer no mutation authority. Native editor admission still
 * needs the exact instance/parameter, owner operation, revision and receipt.
 * `entityTargets().defaultValue` is its retained current value; imported
 * unknown-path fallback ranges/labels are preservation, not editor metadata. */
export {PARAM_REGISTRY, PARAM_GROUPS, getParamDef, entityParamDefs} from '../../../desktop/cradle/expressions-app/src/engine/paramRegistry';
export type {ParamDef} from '../../../desktop/cradle/expressions-app/src/engine/paramRegistry';
export {
  NATIVE_BINDINGS, WORLD_SCALE, nativeBinding, baseValue, bindValue,
  entityTargets, automationTarget, automationTargets, stableNativeTarget,
  pinCycleClockId, entityCycleGroups,
} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters';
export type {NativeBinding, AutomationTarget} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters';
