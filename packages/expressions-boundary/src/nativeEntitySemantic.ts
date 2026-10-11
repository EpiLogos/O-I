/** Per-object meaning (inspector.ts semanticControls) and the Scene semantic field (enable, global colour gain) as admitted
 * native device changes. The object's meaning is its SemanticBinding inside Scene.semanticField.bindings (app.ts
 * assignSemanticNode, setSemanticBindingValue); the Entity itself carries no semantic block. Bounds and option lists mirror the
 * app validator (field-studies-journeys/src/model.ts validateJourney, semanticField block) and the inspector's controls; a drift
 * test runs the app validator over the same values. Pure: no I/O, no document. */
import type {SemanticBinding, SemanticColorCoupling, SemanticFieldConfig, SemanticModulation} from '../../../desktop/cradle/expressions-app/src/engine/semantics/semanticTypes.ts';
import {CHAKRA_DEFINITIONS} from '../../../desktop/cradle/expressions-app/src/engine/semantics/chakraSemantics.ts';
import {CHAKRA_PROFILE_ID} from '../../../desktop/cradle/expressions-app/src/engine/semantics/chakraProfile.ts';
import type {Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import type {NativeEntitySemanticChange, NativeSemanticFieldChange} from './editor';

/** The seven centres in declaration order: the Meaning select's option values (inspector.ts L158). */
export const MEANING_NODE_IDS = CHAKRA_DEFINITIONS.map(node => node.id);
export const MEANING_COLOUR_SOURCES = ['canonical', 'entityTint', 'override'] as const;
export const MEANING_ACTIVATIONS = ['constant', 'resonanceAffinity', 'focus'] as const;
export const MEANING_RADIUS_SOURCES = ['force', 'independent'] as const;
export const MEANING_FALLOFFS = ['gaussian', 'compact'] as const;
export const MEANING_METRICS = ['compositionPlane', 'world3d'] as const;
export const MEANING_BLENDS = ['weighted', 'additive'] as const;
export const MEANING_SIGNALS = ['resonanceAffinity', 'focus', 'carrierSpeed', 'forceStrength', 'forceSpin'] as const;
export const MEANING_TARGETS = ['color.gain', 'color.radius', 'color.hueShift'] as const;
export const MEANING_SCENE_KEYS = ['enabled', 'globalColorGain'] as const;

/** Inclusive bounds of the app validator (model.ts semanticField block). The device's inputs use the narrower inspector ranges. */
export const MEANING_BOUNDS = {
  colourGain: [0, 100], resonanceGain: [-100, 100], radius: [0.001, 100000], globalColorGain: [0, 100],
  modulation: [-10000, 10000], clamp: [-1e9, 1e9], modulations: 16, carriers: 16, label: 160,
} as const;

const BINDING_KEYS = ['id', 'semanticNodeId', 'enabled', 'resonance', 'carriers', 'color', 'modulations'];
const COLOUR_KEYS = ['enabled', 'colorSource', 'overrideColor', 'gain', 'radius', 'falloff', 'metric', 'blend', 'activation'];
const SAFE_ID = /^[a-zA-Z0-9_.:-]{1,160}$/;
const HEX = /^#[\da-f]{6}$/i;

const inRange = (value: unknown, [min, max]: readonly [number, number]): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const onlyKeys = (row: Record<string, unknown>, keys: readonly string[]) => Object.keys(row).every(key => keys.includes(key));

/** One carrier, the object itself: a meaning is attached by stable entity identity (inspector.ts L159). */
const isOwnCarrier = (value: unknown, entityId: string) => isRecord(value) && onlyKeys(value, ['kind', 'id']) && value.kind === 'entity' && value.id === entityId;

function resonanceOf(value: unknown): NonNullable<SemanticBinding['resonance']> {
  if (!isRecord(value) || !onlyKeys(value, ['gain', 'anchorId'])) throw Error('Resonance gain must be a number from -100 to 100.');
  if (!inRange(value.gain, MEANING_BOUNDS.resonanceGain)) throw Error('Resonance gain must be a number from -100 to 100.');
  if (value.anchorId !== undefined && (typeof value.anchorId !== 'string' || value.anchorId.length > MEANING_BOUNDS.label)) throw Error('A resonance anchor is a name of at most 160 characters.');
  return value.anchorId === undefined ? {gain: value.gain} : {gain: value.gain, anchorId: value.anchorId};
}

function colourOf(value: unknown): SemanticColorCoupling {
  if (!isRecord(value) || !onlyKeys(value, COLOUR_KEYS)) throw Error('A colour contribution carries only its own coupling fields; foreign operands were retained.');
  if (typeof value.enabled !== 'boolean') throw Error('The colour contribution flag must be true or false.');
  if (!oneOf(MEANING_COLOUR_SOURCES, value.colorSource)) throw Error('Choose a colour identity: canonical, entity tint or override.');
  if (value.overrideColor !== undefined && (typeof value.overrideColor !== 'string' || !HEX.test(value.overrideColor))) throw Error('Use a six-digit hex colour for the override.');
  if (!inRange(value.gain, MEANING_BOUNDS.colourGain)) throw Error('Colour gain must be a number from 0 to 100.');
  const radius = value.radius;
  if (!isRecord(radius) || !onlyKeys(radius, ['source', 'value']) || !oneOf(MEANING_RADIUS_SOURCES, radius.source)) throw Error('Choose a colour radius: follow the force radius or independent.');
  if (radius.value !== undefined && !inRange(radius.value, MEANING_BOUNDS.radius)) throw Error('The independent radius must be a number from 0.001 to 100000.');
  if (!oneOf(MEANING_FALLOFFS, value.falloff)) throw Error('Choose a falloff: gaussian or compact.');
  if (!oneOf(MEANING_METRICS, value.metric)) throw Error('Choose a metric: composition plane or world 3D.');
  if (!oneOf(MEANING_BLENDS, value.blend)) throw Error('Choose a mix law: weighted or additive.');
  if (!oneOf(MEANING_ACTIVATIONS, value.activation)) throw Error('Choose an activation: authored, live resonant affinity or travelling focus.');
  const colour: SemanticColorCoupling = {
    enabled: value.enabled, colorSource: value.colorSource, gain: value.gain,
    radius: radius.value === undefined ? {source: radius.source} : {source: radius.source, value: radius.value},
    falloff: value.falloff, metric: value.metric, blend: value.blend, activation: value.activation,
  };
  if (value.overrideColor !== undefined) colour.overrideColor = value.overrideColor;
  return colour;
}

function modulationsOf(value: unknown): NonNullable<SemanticBinding['modulations']> {
  if (!Array.isArray(value) || value.length > MEANING_BOUNDS.modulations) throw Error('A meaning carries at most 16 signal mappings.');
  return value.map(row => {
    if (!isRecord(row) || !onlyKeys(row, ['source', 'target', 'amount', 'offset', 'clamp'])) throw Error('A signal mapping carries only its own fields; foreign operands were retained.');
    if (!isRecord(row.source) || !onlyKeys(row.source, ['kind']) || !oneOf(MEANING_SIGNALS, row.source.kind)) throw Error('Choose a mapping signal from the five disclosed signals.');
    if (!oneOf(MEANING_TARGETS, row.target)) throw Error('Choose a mapping target: colour gain, colour radius or hue phase.');
    if (!inRange(row.amount, MEANING_BOUNDS.modulation)) throw Error('Mapping amount must be a finite number from -10000 to 10000.');
    if (row.offset !== undefined && !inRange(row.offset, MEANING_BOUNDS.modulation)) throw Error('Mapping offset must be a finite number from -10000 to 10000.');
    const mapping: SemanticModulation = {source: {kind: row.source.kind}, target: row.target, amount: row.amount};
    if (row.offset !== undefined) mapping.offset = row.offset;
    if (row.clamp !== undefined) {
      if (!Array.isArray(row.clamp) || row.clamp.length !== 2 || !row.clamp.every(v => inRange(v, MEANING_BOUNDS.clamp))) throw Error('A mapping clamp is two finite numbers.');
      mapping.clamp = [row.clamp[0], row.clamp[1]];
    }
    return mapping;
  });
}

/** The whole meaning of one object, as the app validator would accept it. Throws the owner's bound text on a refused value. */
function bindingOf(value: unknown, entityId: string): SemanticBinding {
  if (!isRecord(value) || !onlyKeys(value, BINDING_KEYS)) throw Error('An object meaning carries only its own fields; foreign operands were retained.');
  if (typeof value.id !== 'string' || !SAFE_ID.test(value.id)) throw Error('A meaning needs a safe identity of 1 to 160 characters.');
  if (!oneOf(MEANING_NODE_IDS, value.semanticNodeId)) throw Error('Choose one of the seven centres as this object\'s meaning.');
  if (typeof value.enabled !== 'boolean') throw Error('The meaning\'s enabled flag must be true or false.');
  if (!Array.isArray(value.carriers) || value.carriers.length !== 1 || !isOwnCarrier(value.carriers[0], entityId)) throw Error('A meaning belongs to its own object only; foreign carriers were retained.');
  const binding: SemanticBinding = {id: value.id, semanticNodeId: value.semanticNodeId, enabled: value.enabled, carriers: [{kind: 'entity', id: entityId}]};
  if (value.resonance !== undefined) binding.resonance = resonanceOf(value.resonance);
  if (value.color !== undefined) binding.color = colourOf(value.color);
  if (value.modulations !== undefined) binding.modulations = modulationsOf(value.modulations);
  return binding;
}

/** The one admitted per-object change: the whole meaning of `entity_id`, or null to remove it. */
export function validateNativeEntitySemanticChange(change: unknown): NativeEntitySemanticChange {
  if (!isRecord(change) || change.kind !== 'entity-semantic') throw Error('Choose an admitted object meaning change.');
  if (!onlyKeys(change, ['kind', 'entity_id', 'semantic'])) throw Error('An object meaning belongs only to its entity; foreign operands were retained.');
  if (typeof change.entity_id !== 'string' || !change.entity_id) throw Error('Choose the object whose meaning changes.');
  if (!Object.hasOwn(change, 'semantic') || change.semantic === undefined) throw Error('Give the object\'s whole meaning, or null to remove it.');
  if (change.semantic === null) return {kind: 'entity-semantic', entity_id: change.entity_id, semantic: null};
  return {kind: 'entity-semantic', entity_id: change.entity_id, semantic: bindingOf(change.semantic, change.entity_id)};
}

/** The one admitted Scene-level change: the semantic layer's enable flag or the global colour gain (inspector.ts L121, L161). */
export function validateNativeSemanticFieldChange(change: unknown): NativeSemanticFieldChange {
  if (!isRecord(change) || change.kind !== 'semantic-field-setting') throw Error('Choose an admitted semantic field setting and value.');
  if (!onlyKeys(change, ['kind', 'key', 'value'])) throw Error('The semantic field belongs only to its Scene; foreign operands were retained.');
  if (change.key === 'enabled') {
    if (typeof change.value !== 'boolean') throw Error('Semantic layer enabled must be true or false.');
    return {kind: 'semantic-field-setting', key: 'enabled', value: change.value};
  }
  if (change.key === 'globalColorGain') {
    if (!inRange(change.value, MEANING_BOUNDS.globalColorGain)) throw Error('Global semantic colour gain must be a number from 0 to 100.');
    return {kind: 'semantic-field-setting', key: 'globalColorGain', value: change.value};
  }
  throw Error('Choose an admitted semantic field setting and value.');
}

/** The app's default field (app.ts ensureSemanticField): chakra profile, modal affinity, unit global gain. */
export function defaultSemanticField(): SemanticFieldConfig {
  return {enabled: true, profile: {kind: 'chakra', profileId: CHAKRA_PROFILE_ID}, affinity: {method: 'modalProjection', bandwidth: 0.14}, globalColorGain: 1, bindings: []};
}
/** The app's default colour coupling (app.ts defaultSemanticColor): canonical colour, follows force radius, gaussian, plane metric. */
export function defaultSemanticColor(): SemanticColorCoupling {
  return {enabled: true, colorSource: 'canonical', gain: 1, radius: {source: 'force'}, falloff: 'gaussian', metric: 'compositionPlane', blend: 'weighted', activation: 'constant'};
}
export const bindingCarries = (binding: SemanticBinding, entityId: string) => binding.carriers.some(carrier => carrier.kind === 'entity' && carrier.id === entityId);
/** The object's binding in a Scene, or undefined when it has no meaning. */
export const bindingFor = (scene: Pick<Scene, 'semanticField'>, entityId: string) => scene.semanticField?.bindings.find(binding => bindingCarries(binding, entityId));

/** Writes one object's whole meaning into the Scene, with the app's law (assignSemanticNode): removing the last meaning
 * switches the field off; a new meaning or a changed centre switches it on; other edits leave the enable flag alone. */
export function applyEntitySemantic(scene: Scene, entityId: string, semantic: SemanticBinding | null): void {
  const field = scene.semanticField;
  const existing = field ? bindingFor(scene, entityId) : undefined;
  if (!semantic) {
    if (!field) return;
    field.bindings = field.bindings.filter(binding => !bindingCarries(binding, entityId));
    if (!field.bindings.length) field.enabled = false;
    return;
  }
  const next = field ?? (scene.semanticField = defaultSemanticField());
  if (next.bindings.some(binding => binding.id === semantic.id && !bindingCarries(binding, entityId))) throw Error('This meaning identity belongs to another object. Read the Scene again.');
  next.bindings = [...next.bindings.filter(binding => !bindingCarries(binding, entityId)), structuredClone(semantic)];
  if (!existing || existing.semanticNodeId !== semantic.semanticNodeId) next.enabled = true;
}

/** Writes one Scene-level semantic setting. The field must already exist: its first meaning creates it. */
export function applySemanticFieldSetting(scene: Scene, change: NativeSemanticFieldChange): void {
  if (!scene.semanticField) throw Error('This Scene has no semantic field yet. Give an object a meaning first.');
  if (change.key === 'enabled') scene.semanticField.enabled = change.value;
  else scene.semanticField.globalColorGain = change.value;
}
