import type {Entity, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {formationFaceModel} from './nativeEntityFace.formation.ts'
import {soundFaceModel} from './nativeEntityFace.sound.ts'
import {meaningFaceModel} from './nativeEntityFace.meaning.ts'

/** Pure per-family facts for one ENTITY device: the device acts on the SELECTED object, not on the Field.
 * Force is not in this registry; it stays the bespoke ForceEditor. No React, no commits.
 * `paths` are entity parameter suffixes as keyed by entityTargets (desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters.ts),
 * e.g. 'x', 'y', 'z', 'forces.strength'. */
/** A compact control that is not a registry parameter. `entity-sound` writes the whole sound block through nativeEntityFace.sound.ts builders. */
export type EntityCompactControl = {kind: 'entity-sound'; field: 'gain' | 'frequencyHz' | 'waveform'}

export interface EntityFaceModel {
  name: string
  paths: readonly string[]
  /** Coupled groups in the app's own panel order; when present they cover `paths` exactly. */
  groups?: readonly {title: string; paths: readonly string[]; note?: string}[]
  /** At most four default controls for the compact rack widget. */
  compact?: readonly string[]
  /** Non-registry compact controls (at most four): whole-object changes built from the entity's own fields, which are not entityTargets rows. */
  compactEntity?: readonly EntityCompactControl[]
  /** The Expressions Studio section id this panel opens in (studioSections.ts). */
  studio?: string
  /** true/false = enable light for this object; undefined = no enable operation disclosed. */
  enabled: (reading: NativeEditorReading, entity: Entity) => boolean | undefined
  /** Suffixes this object cannot change right now, with the reason; null or absent when nothing is frozen. Other controls stay enabled. */
  frozen?: (reading: NativeEditorReading, entity: Entity) => {paths: readonly string[]; reason: string} | null
  strip: {summary: (reading: NativeEditorReading, entity: Entity) => string; toggle: null}
}

export const ENTITY_FACE_MODELS = {
  formation: formationFaceModel,
  sound: soundFaceModel,
  meaning: meaningFaceModel,
} as const satisfies Record<string, EntityFaceModel>

export type EntityFaceFamily = keyof typeof ENTITY_FACE_MODELS

/** Every entity family in selector order: the built-in Force, then the registry keys in declaration order. */
export const entityFamilies = (models: Readonly<Record<string, unknown>> = ENTITY_FACE_MODELS): string[] => ['force', ...Object.keys(models)]

/** The registry entry for a family, or null for Force and for any unknown family. */
export function entityFaceModel(family: string, models: Readonly<Record<string, EntityFaceModel>> = ENTITY_FACE_MODELS): EntityFaceModel | null {
  return Object.prototype.hasOwnProperty.call(models, family) ? models[family] : null
}
