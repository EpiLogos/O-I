import type {Entity, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {FIELD_FACE_MODELS, short, type FieldFaceModel, type StripToggle} from './nativeFieldFaceModel'
import {ENTITY_FACE_MODELS, type EntityFaceModel} from './nativeEntityFaceModel.ts'
import {SCENE_FACE_MODELS, type SceneCompactAction, type SceneFaceModel} from './nativeSceneFaceModel.ts'
import {morphDeviceFacts} from './nativeMorphController.ts'
import {colourDeviceFacts} from './nativeColourController.ts'

/** Every device this shell can place, as one descriptor shape. Pure: no React, no commits, no strip or rack imports.
 * The rack joins reading.devices with this list; the Browser lists it; expanded settings open from it.
 * scope 'field' devices act on the Field; scope 'entity' devices act on the ONE selected object (see selectedEntityOf);
 * scope 'scene' devices act on the presented Scene or Expression (scene-edit intents and scene-material changes, no parameters). */
export interface RackDevice {
  family: string; name: string; scope: 'field' | 'entity' | 'scene'
  paths: readonly string[]
  groups: readonly {title: string; paths: readonly string[]; note?: string}[]
  /** At most four default compact controls; empty when the face model declares none. */
  compact: readonly string[]
  studio?: string
  enabled: (reading: NativeEditorReading) => boolean | undefined
  toggle: StripToggle | null
  summary: (reading: NativeEditorReading) => string
  /** Scene devices only: the compact actions the rack widget may offer (at most four). Absent for Field and entity devices. */
  actions?: (reading: NativeEditorReading) => readonly SceneCompactAction[]
}
type DeviceFacts = Omit<FieldFaceModel, 'controlPath'>

/** The one object an entity device acts on: exactly one selected object that resolves to an entity; null otherwise. */
export function selectedEntityOf(reading: NativeEditorReading): Entity | null {
  const ids = reading.selection.entity_ids
  return ids.length === 1 ? reading.scene.entities.find(item => item.id === ids[0]) ?? null : null
}

const describe = (family: string, facts: DeviceFacts): RackDevice => ({
  family, name: facts.name, scope: 'field', paths: facts.paths, groups: facts.groups ?? [], compact: facts.compact ?? [], studio: facts.studio,
  enabled: facts.enabled, toggle: facts.strip.toggle, summary: facts.strip.summary,
})
/** Entity families act on the selected object; with no single selection they show no light and no values. */
const describeEntity = (family: string, facts: EntityFaceModel): RackDevice => ({
  family, name: facts.name, scope: 'entity', paths: facts.paths, groups: facts.groups ?? [], compact: facts.compact ?? [], studio: facts.studio,
  enabled: reading => {const entity = selectedEntityOf(reading); return entity ? facts.enabled(reading, entity) : undefined},
  toggle: null,
  summary: reading => {const entity = selectedEntityOf(reading); return entity ? facts.strip.summary(reading, entity) : `Select one object to act on its ${facts.name}`},
})
/** Force is built in (the bespoke ForceEditor). Its paths are the six entity parameters that editor writes. Enable light mirrors the Force card in nativeDeviceStripModel. */
const FORCE: RackDevice = {
  family: 'force', name: 'Force', scope: 'entity',
  paths: ['forces.strength', 'forces.spin', 'forces.radius', 'x', 'y', 'z'],
  groups: [{title: 'Force', paths: ['forces.strength', 'forces.spin', 'forces.radius']}, {title: 'Centre', paths: ['x', 'y', 'z']}],
  compact: ['forces.strength', 'forces.radius', 'forces.spin'],
  studio: 'formations',
  enabled: reading => {
    const entity = selectedEntityOf(reading)
    return entity ? !(entity.enabled === false || entity.force.kind === 'none' && Math.abs(entity.force.spin) < 1e-9) : undefined
  },
  toggle: null,
  summary: reading => {
    const entity = selectedEntityOf(reading)
    return entity ? `${entity.force.kind} · strength ${short(entity.force.strength)} · radius ${short(entity.force.radius)}` : 'Select one object to act on its Force'
  },
}
/** Scene devices act on the presented Scene or Expression: no registry paths, no slider, no enable light. Their groups are titles only. */
const describeScene = (family: string, facts: SceneFaceModel): RackDevice => ({
  family, name: facts.name, scope: 'scene', paths: [], groups: facts.groups.map(group => ({title: group.title, paths: []})), compact: [], studio: facts.studio,
  enabled: facts.enabled, toggle: null, summary: facts.summary, actions: facts.compactActions ?? (() => []),
})
/** The Field face registry, then Morph and Colour (bespoke hosts, same facts shape), then Force, then the entity registry, then the scene registry. */
const CATALOGUE: readonly RackDevice[] = [
  ...Object.entries(FIELD_FACE_MODELS).map(([family, facts]) => describe(family, facts)),
  describe('morph', morphDeviceFacts),
  describe('colour', colourDeviceFacts),
  FORCE,
  ...Object.entries(ENTITY_FACE_MODELS as Readonly<Record<string, EntityFaceModel>>).map(([family, facts]) => describeEntity(family, facts)),
  ...Object.entries(SCENE_FACE_MODELS as Readonly<Record<string, SceneFaceModel>>).map(([family, facts]) => describeScene(family, facts)),
]
export function deviceCatalogue(): readonly RackDevice[] {
  return CATALOGUE
}
