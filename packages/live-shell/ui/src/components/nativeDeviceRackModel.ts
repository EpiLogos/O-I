import type {Entity, NativeEditorChange, NativeEditorReading, NativeDeviceWidgetChange, NativeDeviceChange} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, baseValue, entityTargets} from '@epilogos/expressions-boundary/parameters'
import type {StripToggle} from './nativeFieldFaceModel'
import {deviceCatalogue, selectedEntityOf, type RackDevice} from './nativeDeviceCatalogue.ts'
import {entityFaceModel, type EntityCompactControl} from './nativeEntityFaceModel.ts'
import {resolvedSound, soundChange, soundDefault, soundNumberSpec, soundWithField, SOUND_WAVEFORMS} from './nativeEntityFace.sound.ts'
import type {SceneCompactAction} from './nativeSceneFaceModel.ts'
import {stripToggleChanges} from './nativeDeviceStripModel'

/** Pure bottom-rack projection. The rack shows only reading.devices (the widgets the person added), joined with the catalogue.
 * No React, no commits. Expanded settings are not here: the Browser's pool opens them. */
export {deviceCatalogue}
export type {RackDevice}
const CATALOGUE = deviceCatalogue()

/** One compact control: the live reading value plus the binding's real label, unit and ranges.
 * Field controls: path is the native binding path. Entity controls: path is the entity target (`entity:<id>:<suffix>`). */
export interface RackControl {
  path: string; label: string; unit: string; value: number
  min: number; max: number; step: number; hardMin: number; hardMax: number; scale?: 'linear' | 'log'; defaultValue: number
}
/** One non-registry compact control of an entity device: a whole-sound numeric field (a RackControl row) or the waveform choice. `blocked` names why it cannot be written. */
export type RackEntityCompact =
  | {kind: 'entity-sound'; field: 'gain' | 'frequencyHz'; control: RackControl; blocked: string | null}
  | {kind: 'entity-sound'; field: 'waveform'; value: string; options: readonly string[]; blocked: string | null}
export const NO_SOUND_NOTE = 'No sound on this object'
export const LOCKED_OBJECT_NOTE = 'This object is locked. Unlock it to change this device.'
export interface RackDeviceWidget {
  unavailable: false; id: string; family: string; name: string
  scope: 'field' | 'entity' | 'scene'
  /** The selected object's name for an entity device (it acts on the current selection); the presented Scene's name for a scene device; null for Field devices and when nothing is selected. */
  target: string | null
  /** Entity devices: the selected object's id, or null with no single selection. */
  entityId: string | null
  /** Entity devices: the selected object is locked, so every control here is disabled. */
  locked: boolean
  on: boolean | undefined; toggle: StripToggle | null; summary: string
  compact: RackControl[]
  /** Entity devices: whole-sound controls for the selected object; empty with no selection or no declaration. */
  entityCompact: RackEntityCompact[]
  studio?: string
  /** Scene devices only: their compact actions, present only on scene widgets (at most four). */
  actions?: readonly SceneCompactAction[]
}
/** A placed family this shell has no device for: shown with its family id and a Remove action only, never dropped. */
export interface RackUnavailableWidget {unavailable: true; id: string; family: string}
export type RackWidget = RackDeviceWidget | RackUnavailableWidget

function rackControl(reading: NativeEditorReading, path: string): RackControl | null {
  const binding = NATIVE_BINDINGS.find(row => row.path === path)
  if (!binding) return null
  return {
    path, label: binding.label, unit: binding.unit ?? '', value: baseValue(reading.scene, binding.key),
    min: binding.min, max: binding.max, step: binding.step, hardMin: binding.hardMin, hardMax: binding.hardMax,
    scale: binding.scale, defaultValue: binding.defaultValue,
  }
}

/** One entity compact control for the selected object: the entityTargets row for that suffix, addressed by its entity target. */
function entityControl(reading: NativeEditorReading, entityId: string, suffix: string): RackControl | null {
  const row = entityTargets(reading.scene).find(item => item.entityId === entityId && item.key === suffix)
  if (!row) return null
  return {
    path: row.target, label: row.label, unit: row.unit ?? '', value: row.value,
    min: row.min, max: row.max, step: row.step, hardMin: row.hardMin, hardMax: row.hardMax, scale: row.scale, defaultValue: row.defaultValue,
  }
}

/** The rack's ordered widgets: reading.devices joined with the catalogue. Unknown families stay in place as unavailable.
 * An entity device's controls and target follow the current single selection; with no selection it has none. */
export function rackWidgets(reading: NativeEditorReading): RackWidget[] {
  const selected = selectedEntityOf(reading)
  return reading.devices.map(({id, family}): RackWidget => {
    const device = CATALOGUE.find(row => row.family === family)
    if (!device) return {unavailable: true, id, family}
    const compact = device.scope === 'entity'
      ? (selected ? device.compact.flatMap(suffix => {const control = entityControl(reading, selected.id, suffix); return control ? [control] : []}) : [])
      : device.compact.flatMap(path => {const control = rackControl(reading, path); return control ? [control] : []})
    const declared = device.scope === 'entity' ? entityFaceModel(family)?.compactEntity ?? [] : []
    return {
      unavailable: false, id, family, name: device.name, scope: device.scope,
      target: device.scope === 'entity' ? selected?.name ?? null : device.scope === 'scene' ? reading.scene?.name ?? null : null,
      entityId: device.scope === 'entity' ? selected?.id ?? null : null, locked: device.scope === 'entity' && selected?.locked === true,
      on: device.enabled(reading), toggle: device.toggle, summary: device.summary(reading), compact, studio: device.studio,
      entityCompact: selected ? declared.map(row => entityCompactRow(selected, row)) : [],
      ...(device.actions ? {actions: device.actions(reading)} : {}),
    }
  })
}

/** One declared whole-sound control for the selected object. Gain and frequency carry bounds from the sound validator; waveform carries its options. */
function entityCompactRow(entity: Entity, row: EntityCompactControl): RackEntityCompact {
  const blocked = entity.sound ? null : NO_SOUND_NOTE, sound = resolvedSound(entity.sound)
  if (row.field === 'waveform') return {kind: 'entity-sound', field: 'waveform', value: sound.waveform, options: SOUND_WAVEFORMS, blocked}
  const spec = soundNumberSpec(row.field)
  return {kind: 'entity-sound', field: row.field, blocked, control: {
    path: `entity-sound:${row.field}`, label: spec.label, unit: spec.unit.startsWith('(') ? '' : spec.unit, value: sound[row.field],
    min: spec.min, max: spec.max, step: spec.step, hardMin: spec.min, hardMax: spec.max, defaultValue: soundDefault(row.field),
  }}
}

/** A registry compact control on an entity device commits one parameter change addressed by its entity target (`entity:<id>:<suffix>`). */
export const entityParameterChange = (target: string, value: number): NativeEditorChange => ({kind: 'parameter', target, value})

/** The one whole-sound change for a sound control on the selected object: the object's sound with one field set, built from the reading's own sound.
 * Throws when no object is selected or the boundary validator refuses the value. */
export function entitySoundControlChange(reading: NativeEditorReading, field: 'gain' | 'frequencyHz' | 'waveform', value: number | string): NativeEditorChange {
  const entity = selectedEntityOf(reading)
  if (!entity) throw Error('Select one object to change its sound.')
  return soundChange(entity.id, soundWithField(entity.sound, field, value))
}

/** Catalogue minus the Field families already on the rack: Field families are one instance each. Entity devices repeat, one per placed device. */
export function addableDevices(reading: NativeEditorReading): RackDevice[] {
  const placed = new Set(reading.devices.map(device => device.family))
  return CATALOGUE.filter(device => device.scope === 'entity' || !placed.has(device.family))
}

/** The panel's group titles joined: the one-line description in the add menu. */
export const deviceNote = (device: Pick<RackDevice, 'groups'>) => device.groups.map(group => group.title).join(' · ') || 'Parameters'

/** Moves the id at `from` to `to` (splice semantics). Out-of-range or same-index moves return an unchanged copy. */
export function reorderWidgetIds(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export const deviceAddChange = (family: string): NativeDeviceWidgetChange => ({kind: 'device-add', family})
export const deviceRemoveChange = (deviceId: string): NativeDeviceWidgetChange => ({kind: 'device-remove', device_id: deviceId})
export const deviceOrderChange = (deviceIds: readonly string[]): NativeDeviceWidgetChange => ({kind: 'device-order', device_ids: [...deviceIds]})
/** One activator click: the same admitted change(s) the device's own toggle uses. Off with a clears flag commits both. */
export const activatorChanges = (widget: Pick<RackDeviceWidget, 'toggle' | 'on'>): NativeDeviceChange[] => stripToggleChanges(widget, widget.on !== true)
