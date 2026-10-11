/** Parameter addresses: the one typed address that a native editor change writes.
 *
 * Shape (WORLD-SHELL-DESIGN.md §14): {family, deviceInstance, key, type, range, unit, writePath}.
 * Every value here is read from the existing registries and is not a second grammar:
 *   - registry Field and entity parameters, their admitted hard range, unit and bind path (parameters.ts);
 *   - the Field panel settings, their type and number range (nativeFieldPanelSettings.ts);
 *   - the field material and ink mode (nativeFieldStyle.ts).
 * The write paths are the exact paths the owner writes (nativeDeviceEdits.ts applyNativeDeviceChanges, hostEditor.ts).
 *
 * Pure: no store, no owner, no React, no I/O. parameterAddresses never throws. It classifies by kind and does not
 * validate values, so an invalid change still receives its honest classification.
 *
 * A kind is either addressed (one address per typed value it writes) or structural: it writes no single addressable
 * value (a list, a whole block, a creation or removal, a relation, a macro that resolves through the reading). A structural
 * result names the kind itself. CLASSIFIERS is typed over every kind of the change unions, so a new kind cannot ship
 * without a row here. */
import type {NativeEditorChange, Scene} from './editor';
import type {NativeSceneMaterialChange} from './sceneMaterialEdits';
import {NATIVE_BINDINGS, entityTargets, type AutomationTarget, type NativeBinding} from './parameters';
import {FIELD_PANEL_SETTINGS, type FieldPanelSettingKey} from './nativeFieldPanelSettings';

export interface ParameterAddress {
  /** The Expressions device family the value belongs to, or 'expressions' when no device owns it. */
  family: string;
  /** The change's entity_id or device_id, or the entity id carried in an `entity:<id>:<suffix>` target. Null for a Field value. */
  deviceInstance: string | null;
  /** The admitted name of the value inside the change grammar (a Field target, a setting key, an entity target). */
  key: string;
  type: string;
  /** The admitted hard range of the value, when its source states one. */
  range?: {min?: number; max?: number};
  /** The unit, when its source states one. */
  unit?: string;
  /** The path the owner writes, under the writeShared law where the change is shared. */
  writePath: string;
}
export interface ParameterAddressing {
  addresses: ParameterAddress[];
  /** Set when the change writes no addressable value: the kind itself. */
  structural?: string;
}

/** Every kind of NativeEditorChange, plus the NativeSceneMaterialChange discriminant (`change`). */
export type NativeChangeKind = NativeEditorChange['kind'] | NativeSceneMaterialChange['change'];
type ChangeOf<K extends NativeChangeKind> = Extract<NativeEditorChange | NativeSceneMaterialChange, {kind: K} | {change: K}>;

// ——— Family tables ———

/** Native binding groups (nativeParameters.ts groups) to the Expressions device whose face shows them (nativeFieldFace.*.ts). */
const GROUP_FAMILY: Readonly<Record<string, string>> = {
  motion: 'physics', physics: 'physics', pointer: 'pointer', relational: 'relational', medium: 'medium',
  collision: 'contacts', pairwise: 'contacts', morph: 'morph', color: 'colour', material: 'ink',
  resonance: 'resonance', composition: 'focus', depth: 'depth', volume: 'depth',
};
/** Field panel settings to their device (the panel's own face, nativeFieldFace.* and the Colour, Ink and Arrange panels). */
const PANEL_FAMILY: Record<FieldPanelSettingKey, string> = {
  backgroundMode: 'colour', grainProfile: 'ink', dotShape: 'ink',
  volumeEnabled: 'depth', volumeProfile: 'depth', depthPerspective: 'depth', depthOcclusion: 'depth', vortex3d: 'depth', dispersion3d: 'depth',
  pointerMode: 'pointer', pointerClick: 'pointer', pointerScope: 'pointer',
  relationalEnabled: 'relational', relationalMode: 'relational',
  frequencyDriver: 'resonance', autoSweep: 'resonance', sweepDirection: 'resonance', templateDimension: 'resonance', resonatorMode: 'resonance',
  focus: 'focus', focusOrder: 'focus', carryTint: 'focus', carryStation: 'focus',
  plane: 'arrange', layout: 'arrange', autoFitSizes: 'glyph',
};
/** field-setting keys (nativeDeviceEdits.ts): the device whose face holds the switch. The medium plane lives in Physics (nativeFieldFace.medium.ts). */
const FIELD_SETTINGS: Readonly<Record<string, {family: string; type: string}>> = {
  mediumEnabled: {family: 'medium', type: 'boolean'}, mediumDimension: {family: 'medium', type: 'enum'}, mediumPlane: {family: 'physics', type: 'enum'},
  resonanceEnabled: {family: 'resonance', type: 'boolean'},
  collisionEnabled: {family: 'contacts', type: 'boolean'}, collisionMode: {family: 'contacts', type: 'enum'}, pairwiseEnabled: {family: 'contacts', type: 'boolean'},
};
/** morph-setting keys (nativeDeviceEdits.ts NATIVE_MORPH_SETTINGS). */
const MORPH_TYPES: Readonly<Record<string, string>> = {morphEnabled: 'boolean', autoOscillate: 'boolean', trajectory: 'enum', driveShape: 'enum', law: 'enum'};
/** colour-setting keys (nativeDeviceEdits.ts validateNativeColourChange). */
const COLOUR_SETTING_TYPES: Readonly<Record<string, string>> = {colorEnabled: 'boolean', colorMode: 'enum'};
/** entity-setting keys (nativeEntitySettings.ts): the object's own name, lock and enabled state. */
const ENTITY_SETTING_TYPES: Readonly<Record<string, string>> = {name: 'text', locked: 'boolean', enabled: 'boolean'};
/** semantic-field-setting keys (nativeEntitySemantic.ts applySemanticFieldSetting). */
const SEMANTIC_FIELD_TYPES: Readonly<Record<string, string>> = {enabled: 'boolean', globalColorGain: 'number'};
/** sequence-settings keys (hostEditor.ts sequence-settings). Ranged keys read the entity sequence registry entries below. */
const SEQUENCE_TYPES: Readonly<Record<string, string>> = {
  enabled: 'boolean', manual: 'boolean', clock: 'enum', order: 'enum', easing: 'enum',
  hold: 'number', transition: 'number', rateMul: 'number', phaseOffset: 'number', jitter: 'number', impulse: 'number',
};
/** Sequence registry entries (entityParamDefs, read through entityTargets) for the keys that have one. */
const SEQUENCE_REGISTRY_KEY: Readonly<Record<string, string>> = {hold: 'sequence.hold', transition: 'sequence.transition', rateMul: 'sequence.rateMul', phaseOffset: 'sequence.phaseOffset'};

/** The family of an entity parameter by its suffix. Position and scale are shared by formations and force centres; they are
 * filed under the formation device (the write is the same entity path either way). */
function entityFamily(suffix: string): string {
  if (suffix.startsWith('forces.')) return 'force';
  if (suffix.startsWith('sequence.')) return 'glyph';
  if (suffix === 'tintWeight') return 'colour';
  return 'formation';
}
function fieldFamily(binding: NativeBinding): string {
  return GROUP_FAMILY[binding.group] ?? 'expressions';
}

// ——— Registry reads ———

/** entityTargets reads its ranges, units and bind paths from the registry for one entity. One reference formation gives the
 * owner's own table (formation kind carries the full set) without a second copy of its scaling. */
const REFERENCE_FORMATION = {
  id: 'reference', name: 'Reference', kind: 'formation', position: {x: 0, y: 0, z: 0}, size: {x: 1, y: 1}, rotation: 0, share: 1, tintWeight: 0,
  force: {kind: 'none', strength: 0, radius: 1, spin: 0}, sequence: {steps: []}, native: {},
};
let entityTable: AutomationTarget[] | undefined;
function entityBindings(): AutomationTarget[] {
  entityTable ??= entityTargets({entities: [REFERENCE_FORMATION]} as unknown as Scene);
  return entityTable;
}
const fieldBinding = (target: unknown) => NATIVE_BINDINGS.find(binding => 'field.' + binding.key === target);
const entityBinding = (suffix: unknown) => entityBindings().find(binding => binding.key === suffix);

function bindingAddress(binding: NativeBinding, key: string, family: string, deviceInstance: string | null): ParameterAddress {
  return {
    family, deviceInstance, key, type: 'number', range: {min: binding.hardMin, max: binding.hardMax},
    ...(binding.unit ? {unit: binding.unit} : {}), writePath: binding.bind,
  };
}

// ——— Helpers ———

const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
/** An own entry only: a key such as `constructor` must not read the Object prototype. */
const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined => Object.hasOwn(table, key) ? table[key] : undefined;
const deviceInstance = (change: {entity_id?: unknown; device_id?: unknown}): string | null => text(change.entity_id) ?? text(change.device_id) ?? null;
const addressed = (addresses: ParameterAddress[]): ParameterAddressing => ({addresses});
const structural = (kind: NativeChangeKind): ParameterAddressing => ({addresses: [], structural: kind});
const recordOf = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The address of one sequence value: the entity-level sequence (`Object.assign(e.sequence, v)`) or one step's own timing. */
function sequenceAddress(key: string, writePath: string, entity: string | null): ParameterAddress {
  const type = own(SEQUENCE_TYPES, key) ?? 'unknown';
  const registryKey = own(SEQUENCE_REGISTRY_KEY, key);
  const registry = registryKey ? entityBinding(registryKey) : undefined;
  return {
    family: 'glyph', deviceInstance: entity, key, type,
    ...(registry ? {range: {min: registry.hardMin, max: registry.hardMax}, ...(registry.unit ? {unit: registry.unit} : {})} : {}),
    writePath,
  };
}

// ——— Classification, one row per kind (type-enforced over the change unions) ———

const CLASSIFIERS: {[K in NativeChangeKind]: (change: ChangeOf<K>) => ParameterAddressing} = {
  // Device changes (NativeDeviceChange)
  'colour-setting': change => {
    const key = text(change.key) ?? '';
    const type = own(COLOUR_SETTING_TYPES, key);
    return type ? addressed([{family: 'colour', deviceInstance: null, key, type, writePath: 'engine.' + key}]) : structural('colour-setting');
  },
  'colour-palette': () => addressed([{family: 'colour', deviceInstance: null, key: 'palette', type: 'colour-list', writePath: 'field.palette'}]),
  'colour-background': () => addressed([{family: 'colour', deviceInstance: null, key: 'background', type: 'colour', writePath: 'field.background'}]),
  'colour-preset': () => addressed([{family: 'colour', deviceInstance: null, key: 'palette_id', type: 'palette-preset', writePath: 'engine.paletteId'}]),
  'entity-sound': () => structural('entity-sound'),
  'entity-semantic': () => structural('entity-semantic'),
  'semantic-field-setting': change => {
    const key = text(change.key) ?? '';
    const type = own(SEMANTIC_FIELD_TYPES, key);
    return type ? addressed([{family: 'meaning', deviceInstance: null, key, type, writePath: 'semanticField.' + key}]) : structural('semantic-field-setting');
  },
  'morph-setting': change => {
    const key = text(change.key) ?? '';
    const type = own(MORPH_TYPES, key);
    return type ? addressed([{family: 'morph', deviceInstance: null, key, type, writePath: key === 'law' ? 'morph.law' : 'engine.' + key}]) : structural('morph-setting');
  },
  'panel-setting': change => {
    const key = text(change.key) ?? '';
    if (!Object.hasOwn(FIELD_PANEL_SETTINGS, key)) return structural('panel-setting');
    const spec = FIELD_PANEL_SETTINGS[key as FieldPanelSettingKey];
    return addressed([{
      family: PANEL_FAMILY[key as FieldPanelSettingKey], deviceInstance: null, key, type: spec.type,
      ...(spec.type === 'number' ? {range: {min: spec.min, max: spec.max}} : {}), writePath: spec.target + '.' + key,
    }]);
  },
  'entity-setting': change => {
    const key = text(change.key) ?? '';
    const type = own(ENTITY_SETTING_TYPES, key);
    return type ? addressed([{family: 'formation', deviceInstance: deviceInstance(change), key, type, writePath: 'entity.' + key}]) : structural('entity-setting');
  },
  'route-order': () => structural('route-order'),
  parameter: change => {
    const target = text(change.target) ?? '';
    const field = fieldBinding(target);
    if (field) return addressed([bindingAddress(field, target, fieldFamily(field), null)]);
    const entity = /^entity:([^:]+):(.+)$/.exec(target);
    if (entity) {
      const binding = entityBinding(entity[2]);
      if (binding) return addressed([bindingAddress(binding, entity[2], entityFamily(entity[2]), entity[1])]);
      return addressed([{family: 'expressions', deviceInstance: entity[1], key: entity[2], type: 'number', writePath: target}]);
    }
    return addressed([{family: 'expressions', deviceInstance: null, key: target, type: 'number', writePath: target}]);
  },
  'force-mode': change => addressed([{family: 'force', deviceInstance: deviceInstance(change), key: 'force.kind', type: 'enum', writePath: 'entity.force.kind'}]),
  'field-setting': change => {
    const key = text(change.key) ?? '';
    const setting = own(FIELD_SETTINGS, key);
    return setting ? addressed([{family: setting.family, deviceInstance: null, key, type: setting.type, writePath: 'engine.' + key}]) : structural('field-setting');
  },
  'shared-setting': change => {
    const target = text(change.target) ?? '';
    const field = fieldBinding(target);
    if (!field) return addressed([{family: 'expressions', deviceInstance: null, key: target, type: 'shared-flag', writePath: target}]);
    return addressed([{family: fieldFamily(field), deviceInstance: null, key: target, type: 'shared-flag', writePath: field.bind}]);
  },
  'force-insert': () => structural('force-insert'),
  'field-material': () => addressed([{family: 'ink', deviceInstance: null, key: 'material', type: 'enum', writePath: 'field.material'}]),
  'ink-mode': () => addressed([{family: 'ink', deviceInstance: null, key: 'inkMode', type: 'enum', writePath: 'engine.inkMode'}]),

  // Glyph changes (NativeGlyphChange)
  'field-font': () => structural('field-font'),
  'sequence-settings': change => {
    const entity = deviceInstance(change);
    const values = recordOf(change.values);
    const out = Object.keys(values).filter(key => own(SEQUENCE_TYPES, key) !== undefined).map(key => sequenceAddress(key, 'entity.sequence.' + key, entity));
    return out.length ? addressed(out) : structural('sequence-settings');
  },
  'step-timing': change => {
    const entity = deviceInstance(change), step = text(change.step_id) ?? '';
    const out: ParameterAddress[] = [];
    if (change.hold !== undefined) out.push(sequenceAddress('hold', `entity.sequence.steps[${step}].hold`, entity));
    if (change.transition !== undefined) out.push(sequenceAddress('transition', `entity.sequence.steps[${step}].transition`, entity));
    return out.length ? addressed(out) : structural('step-timing');
  },
  'step-source': () => structural('step-source'),
  'step-position': () => structural('step-position'),
  'step-overrides': () => structural('step-overrides'),
  'step-layers': () => structural('step-layers'),
  'step-insert': () => structural('step-insert'),
  'step-duplicate': () => structural('step-duplicate'),
  'step-remove': () => structural('step-remove'),
  'step-order': () => structural('step-order'),
  'formation-glyph': () => structural('formation-glyph'),

  // Rack changes (NativeRackChange). A macro value resolves through its mappings in the rack reading, so only rack-set carries addresses.
  'rack-set': change => {
    const out: ParameterAddress[] = [];
    for (const macro of change.rack?.macros ?? []) {
      for (const mapping of macro?.mappings ?? []) {
        const target = mapping?.target;
        if (target?.kind === 'field') {
          const binding = NATIVE_BINDINGS.find(row => row.path === target.path);
          if (binding) out.push(bindingAddress(binding, 'field.' + binding.key, fieldFamily(binding), null));
        } else if (target?.kind === 'entity') {
          const binding = entityBinding(target.path);
          if (binding) out.push(bindingAddress(binding, target.path, entityFamily(target.path), text(target.entity_ref) ?? null));
        }
      }
    }
    return out.length ? addressed(out) : structural('rack-set');
  },
  'rack-remove': () => structural('rack-remove'),
  'rack-macro-value': () => structural('rack-macro-value'),
  'rack-exclusions': () => structural('rack-exclusions'),
  'rack-variation-capture': () => structural('rack-variation-capture'),
  'rack-variation-recall': () => structural('rack-variation-recall'),
  'rack-variation-remove': () => structural('rack-variation-remove'),

  // Chosen controls (toolbelt entries), device widgets, scene text, automation, fold, formation, object, track
  'chosen-add': () => structural('chosen-add'),
  'chosen-remove': () => structural('chosen-remove'),
  'chosen-order': () => structural('chosen-order'),
  'chosen-scope': () => structural('chosen-scope'),
  'device-add': () => structural('device-add'),
  'device-remove': () => structural('device-remove'),
  'device-order': () => structural('device-order'),
  'text-layer-add': () => structural('text-layer-add'),
  'text-layer-remove': () => structural('text-layer-remove'),
  'text-layer-set': () => structural('text-layer-set'),
  'automation-add': () => structural('automation-add'),
  'automation-set': () => structural('automation-set'),
  'automation-link': () => structural('automation-link'),
  'automation-remove': () => structural('automation-remove'),
  'automation-order': () => structural('automation-order'),
  'state-fold': () => structural('state-fold'),
  'formation-add': () => structural('formation-add'),
  'entity-duplicate': () => structural('entity-duplicate'),
  'entity-remove': () => structural('entity-remove'),
  'track-remove': () => structural('track-remove'),

  // Scene body and trigger relations (NativeSceneMaterialChange)
  'scene_body_set': () => structural('scene_body_set'),
  'scene_body_clear': () => structural('scene_body_clear'),
  'scene_trigger_attach': () => structural('scene_trigger_attach'),
  'scene_trigger_detach': () => structural('scene_trigger_detach'),
};

/** Every kind the classifier covers, in table order. The test checks one example per entry. */
export const PARAMETER_ADDRESS_KINDS: readonly string[] = Object.freeze(Object.keys(CLASSIFIERS));

/** Classifies one native editor change (or scene-material change) into its parameter addresses, or names it structural.
 * Never throws: an unknown or malformed change is classified by its kind, or as 'unclassified' when it has none. */
export function parameterAddresses(change: unknown): ParameterAddressing {
  const row = recordOf(change);
  const kind = text(row.kind) ?? text(row.change);
  if (!kind || !Object.hasOwn(CLASSIFIERS, kind)) return {addresses: [], structural: kind ?? 'unclassified'};
  return (CLASSIFIERS as Record<string, (value: unknown) => ParameterAddressing>)[kind]!(change);
}
