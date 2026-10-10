import type {Entity, NativeEditorReading, NativeEntitySemanticChange, NativeSemanticFieldChange} from '../../../../expressions-boundary/src/editor'
import {
  bindingFor, defaultSemanticColor, validateNativeEntitySemanticChange, validateNativeSemanticFieldChange,
} from '../../../../expressions-boundary/src/nativeEntitySemantic.ts'
import {CHAKRA_BY_ID, CHAKRA_DEFINITIONS} from '../../../../../desktop/cradle/expressions-app/src/engine/semantics/chakraSemantics.ts'
import type {SemanticBinding, SemanticColorCoupling, SemanticFieldConfig, SemanticModulation} from '../../../../../desktop/cradle/expressions-app/src/engine/semantics/semanticTypes.ts'
import type {EntityFaceModel} from './nativeEntityFaceModel.ts'

/** Pure facts, option lists and draft arithmetic for the ENTITY Meaning device (the inspector's Semantic binding panel).
 * No React, no commits. The data is the object's SemanticBinding inside Scene.semanticField.bindings, not an Entity field:
 * every write is one `entity-semantic` change carrying the whole binding (or null), and the Scene field's two settings are
 * `semantic-field-setting` changes. Option labels are the inspector's (inspector.ts semanticControls, L158-L171). */

/** Option lists, in the inspector's order. Values are the stored ids; labels are the inspector's text. */
export const MEANING_OPTIONS = {
  meaning: [['none', 'No semantic binding'], ...CHAKRA_DEFINITIONS.map(node => [node.id, node.name] as const)] as const,
  colourSource: [['canonical', 'Canonical semantic colour'], ['entityTint', 'Entity tint'], ['override', 'Override']] as const,
  activation: [['constant', 'Authored / constant'], ['resonanceAffinity', 'Live resonant affinity'], ['focus', 'Travelling focus']] as const,
  radiusSource: [['force', 'Follow physical force radius'], ['independent', 'Independent']] as const,
  falloff: [['gaussian', 'Gaussian'], ['compact', 'Compact']] as const,
  metric: [['compositionPlane', 'Composition plane'], ['world3d', 'World 3D']] as const,
  blend: [['weighted', 'Weighted · order independent'], ['additive', 'Additive']] as const,
  signal: [['resonanceAffinity', 'Resonant affinity'], ['focus', 'Travelling focus'], ['carrierSpeed', 'Carrier speed'], ['forceStrength', 'Force strength'], ['forceSpin', 'Force spin']] as const,
  target: [['color.gain', 'Colour gain'], ['color.radius', 'Colour radius'], ['color.hueShift', 'Hue phase']] as const,
}

/** Exact-value inputs. Ranges are the inspector's (inspector.ts L166-L171); the boundary validator admits the wider app bounds. */
export interface MeaningNumberSpec {label: string; unit: string; min: number; max: number; step: number}
export const MEANING_NUMBERS = {
  colourGain: {label: 'Colour gain', unit: '', min: 0, max: 100, step: 0.01},
  resonanceGain: {label: 'Resonance gain', unit: '', min: 0, max: 100, step: 0.01},
  radius: {label: 'Independent radius', unit: 'native px', min: 1, max: 100000, step: 1},
  globalColourGain: {label: 'Global semantic colour gain', unit: '', min: 0, max: 100, step: 0.01},
  amount: {label: 'Amount', unit: '', min: -100, max: 100, step: 0.01},
  offset: {label: 'Offset', unit: '', min: -100, max: 100, step: 0.01},
} as const satisfies Record<string, MeaningNumberSpec>

/** The engine's fallback radius for a carrier with no force emitter (semanticFieldRuntime.ts, carrier sample: `force?.radius ?? 220`), and the
 * engine's minimum emitter radius (forceRuntime.ts compileEntityForceEmitters: `radius: Math.max(5, forces.radius)`). */
export const DEFAULT_RADIUS_PX = 220
const MIN_EMITTER_RADIUS = 5

/** The Scene's semantic field is one object for the whole Scene; this device reads it from the reading and writes it only through the two changes. */
export const semanticFieldOf = (reading: NativeEditorReading): SemanticFieldConfig | undefined => reading.scene.semanticField
export const bindingOfEntity = (reading: NativeEditorReading, entity: Entity): SemanticBinding | undefined => bindingFor(reading.scene, entity.id)

/** Whether the object exerts a force emitter, as the engine compiles it (forceRuntime.ts L39-L41): enabled, and a mode other than none or a spin. */
export function emitterPresent(entity: Entity): boolean {
  return entity.enabled !== false && (entity.force.kind !== 'none' || Math.abs(entity.force.spin) >= 1e-9)
}
/** The force radius the Follow force radius coupling reads: the emitter's radius, or the engine fallback when no emitter exists. Authored value only. */
export function forceRadiusOf(entity: Entity): {value: number; emitter: boolean} {
  return emitterPresent(entity) ? {value: Math.max(MIN_EMITTER_RADIUS, entity.force.radius), emitter: true} : {value: DEFAULT_RADIUS_PX, emitter: false}
}
/** The colour radius the engine uses for this object (semanticFieldRuntime.ts: `radius.source==='force' ? forceRadius : radius.value ?? 220`). */
export function resolvedRadius(binding: SemanticBinding, entity: Entity): {value: number; source: 'force' | 'independent'} {
  const radius = binding.color?.radius ?? {source: 'force' as const}
  return radius.source === 'force' ? {value: forceRadiusOf(entity).value, source: 'force'} : {value: radius.value ?? DEFAULT_RADIUS_PX, source: 'independent'}
}
/** The falloff kernel of the particle shader (particleShaders.ts L309-L313): gaussian exp(-0.5 d²), compact (1 - d)² clamped at 0, d = distance / radius. */
export function falloffKernel(falloff: SemanticColorCoupling['falloff'], normalisedDistance: number): number {
  const d = Math.abs(normalisedDistance)
  return falloff === 'compact' ? Math.max(0, 1 - d) ** 2 : Math.exp(-0.5 * d * d)
}
/** The contributed colour (semanticFieldRuntime.ts colour choice: override, else entity tint, else the canonical colour). */
export function contributionColour(binding: SemanticBinding, entity: Entity): string | null {
  const colour = binding.color
  if (colour?.colorSource === 'override' && colour.overrideColor) return colour.overrideColor
  if (colour?.colorSource === 'entityTint' && entity.tint) return entity.tint
  return CHAKRA_BY_ID.get(binding.semanticNodeId as never)?.canonicalColor ?? null
}
export const canonicalColourOf = (binding: SemanticBinding): string | null => CHAKRA_BY_ID.get(binding.semanticNodeId as never)?.canonicalColor ?? null

/** The authored peak gain before activation and mapping: colour.gain x resonance.gain x global gain (semanticFieldRuntime.ts L69).
 * Zero when the layer, the meaning or its colour contribution is off (the engine skips them). */
export function authoredGain(binding: SemanticBinding, field: SemanticFieldConfig | undefined): number {
  if (!field?.enabled || !binding.enabled || !binding.color?.enabled) return 0
  return binding.color.gain * (binding.resonance?.gain ?? 1) * field.globalColorGain
}
/** The medium plane the engine measures in (nativeBridge.ts L85 passes engine.mediumPlane as the composition plane). */
export const planeOf = (reading: NativeEditorReading): 'XZ' | 'XY' => reading.scene.engine.mediumPlane === 'horizontal' ? 'XZ' : 'XY'

const num = (value: number) => String(Number(value.toFixed(4)))
/** The rack summary and the panel's one-line summary, from the object's own meaning. */
export function meaningSummaryText(binding: SemanticBinding | undefined, field: SemanticFieldConfig | undefined): string {
  if (!binding) return 'No meaning'
  const name = CHAKRA_BY_ID.get(binding.semanticNodeId as never)?.name ?? binding.semanticNodeId
  const colour = binding.color
  const contribution = !colour ? 'no colour authored' : colour.enabled ? `${colour.colorSource === 'canonical' ? 'canonical' : colour.colorSource === 'entityTint' ? 'entity tint' : 'override'} · gain ${num(colour.gain)}` : 'no colour contribution'
  return `${field?.enabled ? '' : 'layer off · '}${name} · ${contribution}`
}
export const meaningSummary = (reading: NativeEditorReading, entity: Entity): string => meaningSummaryText(bindingOfEntity(reading, entity), semanticFieldOf(reading))

/** The enable light: no meaning on this object shows no light; otherwise the Scene's semantic layer flag (the app's Semantic layer enabled). */
export const meaningEnabled = (reading: NativeEditorReading, entity: Entity): boolean | undefined => bindingOfEntity(reading, entity) ? semanticFieldOf(reading)?.enabled === true : undefined

/** The next whole binding for a Meaning choice (app.ts assignSemanticNode): keeps the identity, resonance gain, colour and mappings of the old one. */
export function withMeaning(existing: SemanticBinding | undefined, entityId: string, nodeId: string | null, makeId: () => string): SemanticBinding | null {
  if (!nodeId) return null
  return {
    id: existing?.id ?? makeId(), semanticNodeId: nodeId, enabled: true, resonance: {gain: existing?.resonance?.gain ?? 1},
    carriers: [{kind: 'entity', id: entityId}], color: structuredClone(existing?.color ?? defaultSemanticColor()), modulations: structuredClone(existing?.modulations ?? []),
  }
}
/** A fresh identity for a new meaning. */
export const newMeaningId = (): string => 'semantic-' + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12))

/** Colour fields, one at a time (app.ts setSemanticBindingValue creates the default colour when none is authored). */
export function withColour(binding: SemanticBinding, patch: Partial<Omit<SemanticColorCoupling, 'radius'>>): SemanticBinding {
  return {...structuredClone(binding), color: {...structuredClone(binding.color ?? defaultSemanticColor()), ...patch}}
}
/** Radius source and independent value. The value is kept when the source changes, as the app keeps it. */
export function withRadius(binding: SemanticBinding, patch: {source?: 'force' | 'independent'; value?: number}): SemanticBinding {
  const base = binding.color ?? defaultSemanticColor()
  const radius: SemanticColorCoupling['radius'] = {source: patch.source ?? base.radius.source}
  const value = patch.value ?? base.radius.value
  if (value !== undefined) radius.value = value
  return {...structuredClone(binding), color: {...structuredClone(base), radius}}
}
export function withResonanceGain(binding: SemanticBinding, gain: number): SemanticBinding {
  return {...structuredClone(binding), resonance: {...(binding.resonance ?? {gain: 1}), gain}}
}
export const mappingsOf = (binding: SemanticBinding | undefined): readonly SemanticModulation[] => binding?.modulations ?? []
export const addedMapping = (): SemanticModulation => ({source: {kind: 'resonanceAffinity'}, target: 'color.gain', amount: 1, offset: 0})
export function withMappings(binding: SemanticBinding, mappings: readonly SemanticModulation[]): SemanticBinding {
  return {...structuredClone(binding), modulations: structuredClone([...mappings])}
}

/** The one admitted change for a whole meaning (or null), through the boundary validator: an invalid value throws its owner text. */
export function meaningChange(entityId: string, semantic: SemanticBinding | null): NativeEntitySemanticChange {
  return validateNativeEntitySemanticChange({kind: 'entity-semantic', entity_id: entityId, semantic})
}
/** The one admitted Scene-level change. */
export function fieldChange(key: 'enabled', value: boolean): NativeSemanticFieldChange
export function fieldChange(key: 'globalColorGain', value: number): NativeSemanticFieldChange
export function fieldChange(key: 'enabled' | 'globalColorGain', value: boolean | number): NativeSemanticFieldChange {
  return validateNativeSemanticFieldChange({kind: 'semantic-field-setting', key, value})
}

/** Exact-value parsing and bounds: a blank or non-numeric text is NaN, and a bad value shows the bound it must sit inside. */
export function parseNumberText(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? Number.NaN : Number(trimmed)
}
export function numberProblem(spec: MeaningNumberSpec, value: number): string | null {
  const suffix = spec.unit ? ` ${spec.unit}` : ''
  if (!Number.isFinite(value)) return `${spec.label} must be a number from ${spec.min} to ${spec.max}${suffix}.`
  return value < spec.min || value > spec.max ? `${spec.label} must be from ${spec.min} to ${spec.max}${suffix}.` : null
}

/** Geometry of the configuration diagram. The disc is drawn to a fixed scale of 220 native px (the engine's default radius, DEFAULT_RADIUS_PX),
 * so a followed force radius and an independent radius are drawn on one scale and a change to either moves the disc. A radius beyond
 * 1.6 times that scale is drawn at the edge. */
export const DIAGRAM = {width: 360, height: 226, cx: 92, cy: 100, radius: 60, scale: DEFAULT_RADIUS_PX, maxFactor: 1.6, plotX: 212, plotWidth: 132, plotTop: 40, plotBase: 150} as const
/** The drawn radius of a radius value on the disc scale, clamped at the edge. */
export function discRadius(value: number): number {
  return Math.min(DIAGRAM.radius * DIAGRAM.maxFactor, DIAGRAM.radius * value / DIAGRAM.scale)
}
/** The radius a pointer at this distance from the centre sets (the handle drag), clamped to the field's bounds. */
export function radiusAtDistance(distance: number): number {
  const value = Math.round(distance / DIAGRAM.radius * DIAGRAM.scale)
  return Math.min(MEANING_NUMBERS.radius.max, Math.max(MEANING_NUMBERS.radius.min, value))
}
/** The falloff curve on the plot: x in units of the colour radius (0 to 2 r), y the kernel. */
export function falloffPath(falloff: SemanticColorCoupling['falloff'], samples = 48): string {
  const points: string[] = []
  for (let index = 0; index <= samples; index++) {
    const x = index / samples * 2
    const px = DIAGRAM.plotX + index / samples * DIAGRAM.plotWidth
    const py = DIAGRAM.plotBase - falloffKernel(falloff, x) * (DIAGRAM.plotBase - DIAGRAM.plotTop)
    points.push(`${index === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`)
  }
  return points.join(' ')
}
/** The disc's radial stops: the kernel at five radii from the centre to r, as the fill opacity of the contributed colour. */
export const discStops = (falloff: SemanticColorCoupling['falloff']) => [0, 0.25, 0.5, 0.75, 1].map(offset => ({offset, opacity: falloffKernel(falloff, offset)}))

/** The option-list label for a value, or the raw value when the option is not disclosed (never invented). */
export const labelOf = (options: readonly (readonly [string, string])[], value: string) => options.find(([id]) => id === value)?.[1] ?? value

/** The rack face: the entity family model. No registry parameter rows and no compact set: the rack resolves compact controls only from entityTargets rows,
 * and no semantic field is one. */
export const meaningFaceModel: EntityFaceModel = {
  name: 'Meaning',
  paths: [],
  studio: 'formations',
  enabled: (reading: NativeEditorReading, entity: Entity) => meaningEnabled(reading, entity),
  strip: {summary: (reading: NativeEditorReading, entity: Entity) => meaningSummary(reading, entity), toggle: null},
}
