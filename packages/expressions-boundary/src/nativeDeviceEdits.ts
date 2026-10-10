/** Device gestures edit the retained authoring document, then the receiver
 * commits through NativeWorkspace. This reducer performs no I/O or history. */
import type {Journey, Scene, Entity, NativeDeviceChange, NativeMorphSettingChange, NativeColourChange, NativeFieldPanelChange} from './editor.ts';
import {FIELD_PANEL_SETTINGS, type FieldPanelSettingKey} from './nativeFieldPanelSettings';
import {ENTITY_SETTING_EXEMPT_FROM_LOCK, validateNativeEntitySettingChange} from './nativeEntitySettings';
import {clone, pin, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {NATIVE_BINDINGS, entityTargets, bindValue} from './parameters';
import {effectiveScene, isShared, toggleShared, useLocalPointer, writeShared} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings';
import {sharedFieldBinding} from './nativeSharedSettings';
import {offsetAutomatedTarget, resolvedAutomation} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks';
import {transformObjectStates} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sourceState';
import {blueprintMember} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import {liveValue} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/liveValues';
import {COLOR_DISTRIBUTION_MODES, COLOR_PALETTES} from '../../../desktop/cradle/expressions-app/src/engine/colorPalettes';
import {applyPalette} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeFeatures';
import {validateNativeEntitySoundChange} from './nativeEntitySound';
import {applyEntitySemantic, applySemanticFieldSetting, validateNativeEntitySemanticChange, validateNativeSemanticFieldChange} from './nativeEntitySemantic';
import {validateNativeFieldMaterialChange, validateNativeInkModeChange} from './nativeFieldStyle';

export const NATIVE_COLOUR_MODES = COLOR_DISTRIBUTION_MODES;
export const NATIVE_COLOUR_PALETTES = COLOR_PALETTES;
export function validateNativeColourChange(change: unknown): NativeColourChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted native Colour Field edit.');
  const row = change as Record<string, unknown>, keys = row.kind === 'colour-setting' ? ['kind','key','value'] : row.kind === 'colour-palette' ? ['kind','colors'] : row.kind === 'colour-preset' ? ['kind','palette_id'] : ['kind','value'];
  if (Object.keys(row).some(key => !keys.includes(key))) throw Error('A Colour Field edit cannot carry foreign scope or entity operands.');
  const colour = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
  const valid = row.kind === 'colour-setting' ? row.key === 'colorEnabled' ? typeof row.value === 'boolean' : row.key === 'colorMode' && NATIVE_COLOUR_MODES.some(mode => mode.id === row.value)
    : row.kind === 'colour-palette' ? Array.isArray(row.colors) && row.colors.length >= 2 && row.colors.length <= 8 && Array.from(row.colors).every(colour)
    : row.kind === 'colour-background' ? colour(row.value)
    : row.kind === 'colour-preset' && typeof row.palette_id === 'string' && NATIVE_COLOUR_PALETTES.some(palette => palette.id === row.palette_id);
  if (!valid) throw Error('Use 2–8 six-digit hex colours or an exact disclosed native colour setting/preset.');
  return change as NativeColourChange;
}

/** Values already owned by Scene.engine/Scene.morph. The adapter's admission
 * and its graphical editor consume this one disclosure. */
export const NATIVE_MORPH_SETTINGS = {
  morphEnabled: [false, true], autoOscillate: [false, true],
  trajectory: ['linear', 'toroidalHopf', 'vortexSpiral', 'quantumInterference'],
  driveShape: ['sine', 'triangle', 'smooth', 'pulse'],
  law: ['theta', 'product', 'sum', 'beat'],
} as const;
export function validateNativeMorphSetting(change: unknown): NativeMorphSettingChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted native Morph setting and value.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !['kind', 'key', 'value'].includes(key))) throw Error('A Morph setting belongs only to the shared Field; foreign operands were retained.');
  if (row.kind !== 'morph-setting' || typeof row.key !== 'string' || !Object.hasOwn(NATIVE_MORPH_SETTINGS, row.key)) throw Error('Choose an admitted native Morph setting and value.');
  const values: readonly unknown[] = NATIVE_MORPH_SETTINGS[row.key as keyof typeof NATIVE_MORPH_SETTINGS];
  if (!values.includes(row.value)) throw Error('Choose an admitted native Morph setting and value.');
  return change as NativeMorphSettingChange;
}

/** Admitted Field panel settings: an exact key of the disclosed table with a
 * boolean, a finite number inside its admitted inclusive range, or a listed option
 * value. A scope or entity operand is refused. */
export function validateNativeFieldPanelChange(change: unknown): NativeFieldPanelChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted native Field panel setting and value.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !['kind', 'key', 'value'].includes(key))) throw Error('A Field panel setting belongs only to its Scene field; foreign operands were retained.');
  if (row.kind !== 'panel-setting' || typeof row.key !== 'string' || !Object.hasOwn(FIELD_PANEL_SETTINGS, row.key)) throw Error('Choose an admitted native Field panel setting and value.');
  const spec = FIELD_PANEL_SETTINGS[row.key as FieldPanelSettingKey];
  const valid = spec.type === 'boolean' ? typeof row.value === 'boolean'
    : spec.type === 'number' ? typeof row.value === 'number' && Number.isFinite(row.value) && row.value >= spec.min && row.value <= spec.max
    : (spec.options as readonly string[]).includes(row.value as string);
  if (!valid) throw Error('Choose an admitted native Field panel setting and value.');
  return change as NativeFieldPanelChange;
}
/** A Field parameter's Expression-share toggle (legacy app.ts 'toggle-global'). Only the app's shareable Field bindings are
 * admitted; `shared` is the requested state, and a scope or entity operand is refused. */
export function validateNativeSharedSettingChange(change: unknown): {kind: 'shared-setting'; target: string; shared: boolean} {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose a Field parameter that the Expression can share.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !['kind', 'target', 'shared'].includes(key)) || row.kind !== 'shared-setting') throw Error('Choose a Field parameter that the Expression can share.');
  if (typeof row.shared !== 'boolean' || !sharedFieldBinding(row.target)) throw Error('This Field parameter cannot be shared across the Expression.');
  return change as {kind: 'shared-setting'; target: string; shared: boolean};
}
/** The focus route is the complete ordered id list of this Scene's formations. */
export function validateNativeRouteOrderChange(change: unknown): {kind: 'route-order'; entity_ids: string[]} {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Give the focus route as a complete list of formation ids.');
  const row = change as Record<string, unknown>;
  if (row.kind !== 'route-order' || Object.keys(row).some(key => !['kind', 'entity_ids'].includes(key))) throw Error('A focus route belongs only to this Scene; foreign operands were retained.');
  const ids = row.entity_ids;
  if (!Array.isArray(ids) || ids.length > 32) throw Error('Give the focus route as a complete list of formation ids.');
  for (let i = 0; i < ids.length; i++) if (typeof ids[i] !== 'string') throw Error('Give the focus route as a complete list of formation ids.');
  return change as {kind: 'route-order'; entity_ids: string[]};
}
/** Rewrites only the formation slots of Scene.entities, so pins keep their index
 * and objects. Mirrors timeline.ts reorderFocus, which also ignores entity locks. */
function reorderFocusRoute(scene: Scene, ids: readonly string[]) {
  const slots = scene.entities.flatMap((entity, index) => entity.kind === 'formation' ? [index] : []);
  const formations = new Map(slots.map(index => [scene.entities[index].id, scene.entities[index]] as const));
  if (ids.length !== slots.length) throw Error('The focus route must list every formation in this Scene exactly once. Read it again.');
  if (new Set(ids).size !== ids.length || ids.some(id => !formations.has(id))) throw Error('The focus route names a non-formation entity or repeats one. Read it again.');
  const ordered = ids.map(id => formations.get(id)!);
  slots.forEach((index, position) => { scene.entities[index] = ordered[position]; });
}
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
    } else if (change.kind === 'morph-setting') {
      validateNativeMorphSetting(change);
      const target = 'morph-setting:' + change.key;
      if (touched.has(target)) throw Error('A device gesture cannot write the same Morph setting twice.');
      touched.add(target);
      const path = change.key === 'law' ? 'morph.law' : 'engine.' + change.key;
      if (!writeShared(draft, scene, path, change.value)) bindValue(scene, path, change.value);
    } else if (['colour-setting','colour-palette','colour-background','colour-preset'].includes(change.kind)) {
      const colour = validateNativeColourChange(change);
      const target = colour.kind === 'colour-setting' ? 'colour-setting:' + colour.key : colour.kind === 'colour-background' ? 'colour-background' : 'colour-palette';
      if (touched.has(target)) throw Error('A device gesture cannot write the same Colour Field target twice.');
      touched.add(target);
      if (colour.kind === 'colour-setting') {
        const path = 'engine.' + colour.key;
        if (!writeShared(draft, scene, path, colour.value)) bindValue(scene, path, colour.value);
      } else if (colour.kind === 'colour-background') {
        if (!writeShared(draft, scene, 'field.background', colour.value)) scene.field.background = colour.value;
      } else if (colour.kind === 'colour-palette') {
        scene.field.palette = [...colour.colors];
        if (!writeShared(draft, scene, 'engine.paletteSource', 'custom')) scene.engine.paletteSource = 'custom';
      } else {
        const palette = NATIVE_COLOUR_PALETTES.find(value => value.id === colour.palette_id);
        if (!palette) throw Error('This native palette is no longer disclosed.');
        applyPalette(scene, colour.palette_id);
        // Use the actual catalogue writer, including legacy three-colour mode.
        // Only scalar paths already admitted by SharedSettings can propagate.
        const recommended = [['color.angle',palette.recommendedAngle],['color.cycleSpeed',palette.recommendedSpeed],['color.waveFrequency',palette.recommendedFrequency],['color.turbulenceModulation',palette.recommendedTurbulence]] as const;
        const paths = ['engine.colorEnabled','engine.paletteId','engine.paletteSource','engine.colorMode',...recommended.filter(([,value]) => value !== undefined).map(([path]) => NATIVE_BINDINGS.find(binding => binding.path === path)!.bind)];
        for (const path of paths) {
          const value = read(scene, path);
          if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') writeShared(draft, scene, path, value);
        }
      }
    } else if (change.kind === 'panel-setting') {
      const panel = validateNativeFieldPanelChange(change);
      const target = 'panel-setting:' + panel.key;
      if (touched.has(target)) throw Error('A device gesture cannot write the same Field panel setting twice.');
      touched.add(target);
      // Scene-local scope switch: copies the effective pointer values into the Scene.
      if (panel.key === 'pointerScope') useLocalPointer(draft, scene, panel.value === 'local');
      else {
        // Same sharing law as field-setting: a shared path, or a pointer path under global scope, writes the Expression.
        const path = FIELD_PANEL_SETTINGS[panel.key].target + '.' + panel.key;
        if (!writeShared(draft, scene, path, panel.value)) bindValue(scene, path, panel.value);
      }
    } else if (change.kind === 'field-material') {
      // Scene.field.material: the sharing law of colour-background (a shared path writes the Expression, else the Scene).
      const material = validateNativeFieldMaterialChange(change);
      if (touched.has('field-material')) throw Error('A device gesture cannot write the Field material twice.');
      touched.add('field-material');
      if (!writeShared(draft, scene, 'field.material', material.value)) scene.field.material = material.value;
    } else if (change.kind === 'ink-mode') {
      // Scene.engine.inkMode, the value the native compile reads (nativeBridge.ts). The same sharing law as the other engine settings.
      const ink = validateNativeInkModeChange(change);
      if (touched.has('ink-mode')) throw Error('A device gesture cannot write the ink mode twice.');
      touched.add('ink-mode');
      if (!writeShared(draft, scene, 'engine.inkMode', ink.value)) scene.engine.inkMode = ink.value;
    } else if (change.kind === 'shared-setting') {
      // The app's own toggleShared moves the value: sharing copies the Scene's effective value into the Expression,
      // un-sharing copies the shared value into every Scene. Requesting the state already held is a no-op.
      const share = validateNativeSharedSettingChange(change), bind = sharedFieldBinding(share.target)!.bind;
      if (touched.has('shared-setting:' + bind)) throw Error('A device gesture cannot toggle the same shared parameter twice.');
      touched.add('shared-setting:' + bind);
      if (isShared(draft, scene, bind) !== share.shared) toggleShared(draft, scene, bind);
    } else if (change.kind === 'route-order') {
      const route = validateNativeRouteOrderChange(change);
      if (touched.has('route-order')) throw Error('A device gesture cannot write the focus route twice.');
      touched.add('route-order');
      reorderFocusRoute(scene, route.entity_ids);
    } else if (change.kind === 'force-insert') {
      if (scene.entities.length >= 32) throw Error('This authoring Scene already has its 32 entities.');
      if (!change.position || !['x', 'y', 'z'].every(axis => Number.isFinite(change.position[axis as keyof typeof change.position]) && Math.abs(change.position[axis as keyof typeof change.position]) <= 50)) throw Error('A force centre must have three finite stage coordinates within ±50.');
      if (change.name !== undefined && (!change.name.trim() || change.name.length > 160)) throw Error('Name the force using 1–160 characters.');
      const entity = pin(change.position);
      entity.name = change.name?.trim() ?? `Force ${scene.entities.filter(item => item.kind === 'pin').length + 1}`;
      scene.entities.push(entity);
    } else if (change.kind === 'entity-sound') {
      const sound = validateNativeEntitySoundChange(change);
      const target = 'entity-sound:' + sound.entity_id;
      if (touched.has(target)) throw Error('A device gesture cannot write the same object sound twice.');
      touched.add(target);
      // Whole-block replacement of the object's own material. No state transform:
      // the inspector writes entity.sound directly as well.
      const entity = editableEntity(scene, sound.entity_id);
      if (sound.sound) entity.sound = sound.sound;
      else delete entity.sound;
    } else if (change.kind === 'entity-semantic') {
      // Whole meaning of one object (its SemanticBinding in Scene.semanticField). The object's lock refuses it, as for sound.
      const semantic = validateNativeEntitySemanticChange(change);
      const target = 'entity-semantic:' + semantic.entity_id;
      if (touched.has(target)) throw Error('A device gesture cannot write the same object meaning twice.');
      touched.add(target);
      editableEntity(scene, semantic.entity_id);
      applyEntitySemantic(scene, semantic.entity_id, semantic.semantic);
    } else if (change.kind === 'semantic-field-setting') {
      const setting = validateNativeSemanticFieldChange(change);
      const target = 'semantic-field-setting:' + setting.key;
      if (touched.has(target)) throw Error('A device gesture cannot write the same semantic field setting twice.');
      touched.add(target);
      applySemanticFieldSetting(scene, setting);
    } else if (change.kind === 'entity-setting') {
      // Name, Lock and Enabled write the entity field itself. Share is never touched: the engine normalises over enabled formations.
      const setting = validateNativeEntitySettingChange(change);
      const target = 'entity-setting:' + setting.entity_id + ':' + setting.key;
      if (touched.has(target)) throw Error('A device gesture cannot write the same object setting twice.');
      touched.add(target);
      const entity = scene.entities.find(value => value.id === setting.entity_id);
      if (!entity) throw Error('The selected object no longer belongs to this Scene. Read it again.');
      if (entity.locked && !ENTITY_SETTING_EXEMPT_FROM_LOCK.includes(setting.key)) throw Error('Unlock this entity before editing its name or enabled state.');
      if (setting.key === 'name') entity.name = setting.value.trim();
      else if (setting.key === 'locked') entity.locked = setting.value;
      else entity.enabled = setting.value;
    } else throw Error('This operation belongs to another editor owner.');
  }
  return validateJourney(draft);
}
