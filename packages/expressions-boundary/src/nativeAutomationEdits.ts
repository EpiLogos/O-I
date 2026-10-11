/** Scene automation lanes (Scene.automation) as typed native edits (editor.ts
 * NativeAutomationChange). Pure: clones the Journey, reuses the app's exported
 * automationLinks helpers, checks each value against its target's registry
 * binding, and returns a validated copy. No I/O, history or engine clock.
 * automation-fire (bumps firedAt, the engine trigger token) and manual takeover
 * (a direct base write outside native history) are not admitted here. */
import type {Journey, Scene, NativeAutomationChange, NativeAutomationLaneValues} from './editor.ts';
import {linkAutomation, removeAutomation, removeGroupTarget} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks';
import {clamp, clone, uid, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {effectiveScene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings';
import {automationTarget} from './parameters';

export const NATIVE_AUTOMATION_WAVES = ['sine', 'triangle', 'square', 'saw', 'steps', 'smooth', 'morph'] as const;
export const NATIVE_AUTOMATION_TYPES = ['lfo', 'ramp'] as const;
export const NATIVE_AUTOMATION_BLENDS = ['replace', 'add', 'multiply'] as const;
export const NATIVE_AUTOMATION_LOOPS = ['once', 'loop', 'pingpong'] as const;
/** Same list as engine/types.ts AutomationEasing and the inspector's Easing select. */
export const NATIVE_AUTOMATION_EASINGS = ['linear', 'smooth', 'easeIn', 'easeOut', 'elastic', 'bounce'] as const;
/** Inspector slider bounds (automationEditor.ts). Min and Max are bounded by the target binding instead. */
export const NATIVE_AUTOMATION_RANGES = {rate: [0, 2], phase: [0, 1], duration: [0.01, 30], delay: [0, 10]} as const;
export const NATIVE_AUTOMATION_LANE_LIMIT = 64;
const VALUE_KEYS = ['enabled', 'type', 'wave', 'rate', 'phase', 'min', 'max', 'blend', 'duration', 'delay', 'loop', 'easing'] as const;
/** Fields a target takes from its group leader (automationLinks.ts resolvedAutomation). `enabled` is combined with the leader, not inherited. */
const INHERITED_KEYS: readonly string[] = ['type', 'wave', 'rate', 'phase', 'duration', 'delay', 'loop', 'easing'];
const ADMITTED_TARGET = /^(field\.|entity:)/;
const ID_LIMIT = 200;
const SHAPE_REFUSAL = 'Choose an admitted native automation edit.';
const VALUE_REFUSAL = 'Choose an admitted native automation setting and value.';

type AddChange = Extract<NativeAutomationChange, {kind: 'automation-add'}>;
type SetChange = Extract<NativeAutomationChange, {kind: 'automation-set'}>;

const finiteIn = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const oneOf = (list: readonly unknown[], value: unknown) => list.includes(value);
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= ID_LIMIT;

function admittedValue(key: string, value: unknown): boolean {
  if (key === 'enabled') return typeof value === 'boolean';
  if (key === 'type') return oneOf(NATIVE_AUTOMATION_TYPES, value);
  if (key === 'wave') return oneOf(NATIVE_AUTOMATION_WAVES, value);
  if (key === 'blend') return oneOf(NATIVE_AUTOMATION_BLENDS, value);
  if (key === 'loop') return oneOf(NATIVE_AUTOMATION_LOOPS, value);
  if (key === 'easing') return oneOf(NATIVE_AUTOMATION_EASINGS, value);
  if (key === 'min' || key === 'max') return typeof value === 'number' && Number.isFinite(value);
  const [min, max] = NATIVE_AUTOMATION_RANGES[key as keyof typeof NATIVE_AUTOMATION_RANGES];
  return finiteIn(value, min, max);
}

/** Shape, enum and scene-independent range checks. Scene-dependent checks (target
 * binding for min/max, group membership, permutation) run in applyNativeAutomationChanges. */
export function validateNativeAutomationChange(change: unknown): NativeAutomationChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error(SHAPE_REFUSAL);
  const row = change as Record<string, unknown>;
  const operands: Record<string, readonly string[]> = {
    'automation-add': ['kind', 'target', 'group_id'], 'automation-set': ['kind', 'lane_id', 'values'],
    'automation-link': ['kind', 'lane_id', 'leader_id'], 'automation-remove': ['kind', 'lane_id', 'scope'], 'automation-order': ['kind', 'lane_ids'],
  };
  const allowed = typeof row.kind === 'string' && Object.hasOwn(operands, row.kind) ? operands[row.kind] : undefined;
  if (!allowed) throw Error(SHAPE_REFUSAL);
  if (Object.keys(row).some(key => !allowed.includes(key))) throw Error('An automation edit carries only its own operands; foreign operands were refused.');
  if (row.kind === 'automation-add') {
    if (typeof row.target !== 'string' || row.target.length > 250 || !ADMITTED_TARGET.test(row.target)) throw Error('Choose an admitted automation parameter.');
    if (row.group_id !== undefined && !id(row.group_id)) throw Error('Choose an existing automation group to join.');
  } else if (row.kind === 'automation-set') {
    if (!id(row.lane_id)) throw Error(SHAPE_REFUSAL);
    const values = row.values;
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw Error(VALUE_REFUSAL);
    const keys = Object.keys(values);
    if (!keys.length || keys.some(key => !(VALUE_KEYS as readonly string[]).includes(key))) throw Error(VALUE_REFUSAL);
    for (const key of keys) if (!admittedValue(key, (values as Record<string, unknown>)[key])) throw Error(VALUE_REFUSAL);
  } else if (row.kind === 'automation-link') {
    if (!id(row.lane_id) || (row.leader_id !== null && !id(row.leader_id))) throw Error(SHAPE_REFUSAL);
  } else if (row.kind === 'automation-remove') {
    if (!id(row.lane_id) || !oneOf(['lane', 'group-target'], row.scope)) throw Error(SHAPE_REFUSAL);
  } else {
    const ids = row.lane_ids;
    if (!Array.isArray(ids) || ids.length > NATIVE_AUTOMATION_LANE_LIMIT || !ids.every(id)) throw Error('Give the automation order as a complete list of automation ids.');
  }
  return change as NativeAutomationChange;
}

function laneOf(scene: Scene, laneId: string) {
  const lane = scene.automation.find(value => value.id === laneId);
  if (!lane) throw Error('The automation no longer belongs to this Scene. Read it again.');
  return lane;
}

/** Mirrors app.ts addLane: same span, clamp, defaults and frequency-driver side effect. */
function addLane(journey: Journey, scene: Scene, change: AddChange) {
  if (scene.automation.length >= NATIVE_AUTOMATION_LANE_LIMIT) throw Error(`This Scene already has its ${NATIVE_AUTOMATION_LANE_LIMIT} automations.`);
  if (scene.automation.some(lane => lane.target === change.target)) throw Error('This parameter is already automated. Add to its group or edit that automation.');
  let syncWith: string | undefined;
  if (change.group_id !== undefined) {
    const leader = laneOf(scene, change.group_id);
    if (leader.syncWith) throw Error('Join an automation group through its leader, not one of its targets.');
    syncWith = leader.id;
  }
  const parameter = automationTarget(effectiveScene(journey, scene), change.target);
  if (!parameter || !Number.isFinite(parameter.value)) throw Error('This parameter has no admitted automation target in this Scene.');
  const span = (parameter.max - parameter.min) * .1;
  const low = clamp(parameter.value - span, parameter.hardMin, parameter.hardMax), high = clamp(parameter.value + span, parameter.hardMin, parameter.hardMax);
  scene.automation.push({id: uid('lane'), ...(syncWith ? {syncWith} : {}), enabled: true, target: change.target, type: 'lfo', wave: 'sine', min: low, max: high, rate: .08, phase: 0, blend: 'replace', duration: 4, delay: 0, loop: 'once', firedAt: null});
  if (change.target === 'field.frequency') scene.composition.frequencyDriver = 'automation';
}

/** Group targets refuse inherited fields; min and max are checked against the binding's hard range. */
function setLane(journey: Journey, scene: Scene, change: SetChange) {
  const lane = laneOf(scene, change.lane_id), values = change.values as Record<string, unknown>, keys = Object.keys(values);
  const inherited = lane.syncWith ? keys.filter(key => INHERITED_KEYS.includes(key)) : [];
  if (inherited.length) throw Error(`${inherited.join(', ')} belongs to this group's leader. Edit the leader, or unlink this target first.`);
  if (keys.includes('min') || keys.includes('max')) {
    const binding = automationTarget(effectiveScene(journey, scene), lane.target);
    if (!binding) throw Error('This automation target no longer exists in this Scene, so its range cannot be checked.');
    for (const key of ['min', 'max'] as const) {
      const value = values[key] as number | undefined;
      if (value !== undefined && (value < binding.hardMin || value > binding.hardMax)) throw Error(`${binding.label} must be between ${binding.hardMin} and ${binding.hardMax}.`);
    }
  }
  Object.assign(lane, change.values as NativeAutomationLaneValues);
}

/** Group semantics are app automationLinks.ts linkAutomation. A leader with targets stays a leader. */
function linkLane(scene: Scene, laneId: string, leaderId: string | null) {
  const lane = laneOf(scene, laneId);
  if (leaderId === null) {
    if (!lane.syncWith) throw Error('This automation is not linked to a group.');
    linkAutomation(scene.automation, lane.id, '');
    return;
  }
  if (leaderId === lane.id) throw Error('An automation cannot lead itself.');
  const leader = laneOf(scene, leaderId);
  if (leader.syncWith) throw Error('Link to a group leader, not to one of its targets.');
  if (scene.automation.some(value => value.syncWith === lane.id)) throw Error('This automation leads a group. Unlink its targets before joining another group.');
  linkAutomation(scene.automation, lane.id, leader.id);
}

/** scope 'lane' is app delete-lane (removeAutomation); 'group-target' is app remove-group-target (removeGroupTarget). */
function removeLane(scene: Scene, laneId: string, scope: 'lane' | 'group-target') {
  const lane = laneOf(scene, laneId);
  scene.automation = scope === 'lane' ? removeAutomation(scene.automation, lane.id) : removeGroupTarget(scene.automation, lane.id);
}

/** Array order is semantic: the engine applies lanes in order, and parameter() takes the last enabled replacing lane. */
function reorderLanes(scene: Scene, ids: readonly string[]) {
  if (ids.length !== scene.automation.length || new Set(ids).size !== ids.length || ids.some(laneId => !scene.automation.some(lane => lane.id === laneId)))
    throw Error('Reordering must retain every automation exactly once. Read it again.');
  const byId = new Map(scene.automation.map(lane => [lane.id, lane] as const));
  scene.automation = ids.map(laneId => byId.get(laneId)!);
}

/** Atomic, validated copy. A refused change leaves the caller's document untouched. */
export function applyNativeAutomationChanges(journey: Journey, sceneId: string, changes: readonly NativeAutomationChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > 64) throw Error('Choose between 1 and 64 automation changes.');
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  for (const raw of changes) {
    const change = validateNativeAutomationChange(raw);
    if (change.kind === 'automation-add') addLane(draft, scene, change);
    else if (change.kind === 'automation-set') setLane(draft, scene, change);
    else if (change.kind === 'automation-link') linkLane(scene, change.lane_id, change.leader_id);
    else if (change.kind === 'automation-remove') removeLane(scene, change.lane_id, change.scope);
    else reorderLanes(scene, change.lane_ids);
  }
  return validateJourney(draft);
}
