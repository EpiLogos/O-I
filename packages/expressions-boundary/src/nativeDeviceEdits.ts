/** Device gestures edit the retained authoring document, then the receiver
 * commits through NativeWorkspace. This reducer performs no I/O or history. */
import type {Journey, Scene, Entity, NativeDeviceChange} from './editor.ts';
import {clone, pin, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {NATIVE_BINDINGS, entityTargets, bindValue} from './parameters';
import {effectiveScene, isShared, writeShared} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings';
import {offsetAutomatedTarget, resolvedAutomation} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks';
import {transformObjectStates} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sourceState';
import {blueprintMember} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import {liveValue} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/liveValues';

function editableEntity(scene: Scene, id: string): Entity {
  const entity = scene.entities.find(value => value.id === id);
  if (!entity) throw Error('The selected force no longer belongs to this Scene. Read it again.');
  if (entity.locked) throw Error('Unlock this entity before editing its device.');
  return entity;
}
function read(root: unknown, path: string): unknown {
  let value: unknown = root;
  for (const key of path.split('.')) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  return value;
}
function parameter(journey: Journey, scene: Scene, target: string, value: number, observed: Readonly<Record<string, number>>) {
  if (!Number.isFinite(value)) throw Error('Enter a finite parameter value.');
  const effective = effectiveScene(journey, scene);
  const binding = target.startsWith('field.')
    ? NATIVE_BINDINGS.find(item => target === 'field.' + item.key)
    : entityTargets(effective).find(item => item.target === target);
  if (!binding) throw Error('This parameter has no admitted native device binding.');
  if (value < binding.hardMin || value > binding.hardMax) throw Error(`${binding.label} must be between ${binding.hardMin} and ${binding.hardMax}.`);
  // Solver cardinalities are discrete even though their registry step may
  // also describe useful UI increments (e.g. grid resolution in fours).
  if (['medium.iterations', 'medium.gridRes', 'particleCount', 'cymatics.modeCount'].includes(binding.path) && !Number.isInteger(value * binding.factor)) throw Error(`${binding.label} requires a whole number.`);
  const entityId = 'entityId' in binding && typeof binding.entityId === 'string' ? binding.entityId : undefined;
  const entity = entityId ? editableEntity(scene, entityId) : undefined;
  const localPath = entity ? binding.bind.slice(7) : binding.bind;
  if (entity && localPath.startsWith('position.') && blueprintMember(scene, entity.id)) throw Error('Use Blueprint to move this shape, or release it before moving an individual centre.');
  const shared = !entity && isShared(journey, scene, binding.bind);
  const replacing = shared ? undefined : scene.automation.filter(lane => lane.target === target && resolvedAutomation(scene.automation, lane).enabled).at(-1);
  if (replacing?.blend === 'replace') {
    const previous = observed[target];
    if (!Number.isFinite(previous)) throw Error('Read the effective automated value before moving this control.');
    const delta = value - previous;
    if (!Number.isFinite(replacing.min + delta) || !Number.isFinite(replacing.max + delta)) throw Error('The automated range would exceed finite values.');
    offsetAutomatedTarget(scene.automation, target, delta);
    return;
  }
  const before = read(entity ?? effective, localPath);
  if (!writeShared(journey, scene, binding.bind, value)) {
    if (entity) bindValue(entity as unknown as Scene, localPath, value);
    else bindValue(scene, binding.bind, value);
  }
  if (entity) transformObjectStates(entity, binding.bind, before, value);
  if (binding.bind === 'field.params.native_composition__orchestration__focusTintWeight' && value > 0) scene.composition.carryTint = true;
}

/** Read only the evaluated production configuration supplied by the engine.
 * Resolve entities by their native ID, so a stale or reordered config cannot
 * accidentally report another emitter's output as this target's observation. */
export function readNativeDeviceEffectiveValues(scene: Scene, telemetry: {params?: Record<string, number>; config?: unknown} | null | undefined): Record<string, number> {
  const values: Record<string, number> = {};
  if (!telemetry?.config) return values;
  for (const binding of NATIVE_BINDINGS) {
    const value = liveValue(scene, binding.bind, undefined, telemetry.params ?? {}, telemetry.config);
    if (typeof value === 'number' && Number.isFinite(value)) values['field.' + binding.key] = value;
  }
  const entities = read(telemetry.config, 'entities');
  if (!Array.isArray(entities)) return values;
  for (const binding of entityTargets(scene)) {
    const matches = entities.filter(entity => read(entity, 'id') === binding.entityId);
    if (matches.length !== 1) continue;
    const value = read(matches[0], binding.key);
    if (typeof value === 'number' && Number.isFinite(value)) values[binding.target] = value / binding.factor;
  }
  return values;
}

/** Atomic, validated copy. An invalid second edit cannot leak the first edit
 * into the caller's document, nor can a device invent a native path. */
export function applyNativeDeviceChanges(journey: Journey, sceneId: string, changes: readonly NativeDeviceChange[], observed: Readonly<Record<string, number>> = {}): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > 256) throw Error('Choose between 1 and 256 device changes.');
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  const touched = new Set<string>();
  for (const change of changes) {
    if (change.kind === 'parameter') {
      if (touched.has(change.target)) throw Error('A device gesture cannot write the same target twice.');
      touched.add(change.target);
      parameter(draft, scene, change.target, change.value, observed);
    } else if (change.kind === 'force-mode') {
      if (!['none', 'attract', 'repel', 'vortex'].includes(change.value)) throw Error('Choose an admitted force mode.');
      const entity = editableEntity(scene, change.entity_id), before = entity.force.kind;
      entity.force.kind = change.value;
      transformObjectStates(entity, 'entity.force.kind', before, change.value);
    } else if (change.kind === 'field-setting') {
      const valid = ['mediumEnabled', 'resonanceEnabled', 'collisionEnabled', 'pairwiseEnabled'].includes(change.key) ? typeof change.value === 'boolean'
        : change.key === 'mediumDimension' ? change.value === '2D' || change.value === '3D'
        : change.key === 'mediumPlane' ? change.value === 'vertical' || change.value === 'horizontal'
        : change.key === 'collisionMode' ? change.value === 'obstacle' || change.value === 'vessel' : false;
      if (!valid) throw Error('Choose an admitted shared-medium setting.');
      const path = 'engine.' + change.key;
      if (!writeShared(draft, scene, path, change.value)) bindValue(scene, path, change.value);
    } else if (change.kind === 'force-insert') {
      if (scene.entities.length >= 32) throw Error('This authoring Scene already has its 32 entities.');
      if (!change.position || !['x', 'y', 'z'].every(axis => Number.isFinite(change.position[axis as keyof typeof change.position]) && Math.abs(change.position[axis as keyof typeof change.position]) <= 50)) throw Error('A force centre must have three finite stage coordinates within ±50.');
      if (change.name !== undefined && (!change.name.trim() || change.name.length > 160)) throw Error('Name the force using 1–160 characters.');
      const entity = pin(change.position);
      entity.name = change.name?.trim() ?? `Force ${scene.entities.filter(item => item.kind === 'pin').length + 1}`;
      scene.entities.push(entity);
    } else throw Error('This operation belongs to another editor owner.');
  }
  return validateJourney(draft);
}
