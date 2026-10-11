import type {Entity, NativeDeviceChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {short, type StripToggle} from './nativeFieldFaceModel'
import {deviceCatalogue} from './nativeDeviceCatalogue.ts'

/** Pure device-card facts shared by the bottom rack and the Force card. No React, no commits.
 * The rack renders only the widgets the person added (reading.devices); nativeDeviceStrip is a catalogue projection for listings, not the rack. */
export type {StripToggle}
export interface StripDevice {
  id: string; name: string; scope: 'entity' | 'field' | 'scene'; family: string
  /** undefined = no enable operation is disclosed for this device (Physics, Pointer, Ink). */
  on: boolean | undefined
  toggle: StripToggle | null
  summary: string
}

/** Every device card in catalogue order, the contextual Force card first when one object is selected. Each card carries its catalogue scope.
 * The catalogue's own Force row is left out: the contextual Force card stands for it. Not rendered by the rack; kept for the Browser's
 * catalogue listing and the sibling device tests that read a card by family. */
export function nativeDeviceStrip(reading: NativeEditorReading): StripDevice[] {
  const force = forceStripDevice(reading)
  return [
    ...(force ? [force] : []),
    ...deviceCatalogue().filter(device => device.family !== 'force').map((device): StripDevice => ({
      id: `${device.scope}:${device.family}`, name: device.name, scope: device.scope, family: device.family,
      on: device.enabled(reading), toggle: device.toggle, summary: device.summary(reading),
    })),
  ]
}

/** The selected object, only when exactly one object is selected and it resolves to an entity. */
export function selectedEntity(reading: NativeEditorReading): Entity | null {
  const ids = reading.selection.entity_ids
  if (ids.length !== 1) return null
  return reading.scene.entities.find(item => item.id === ids[0]) ?? null
}

/** The contextual Force device of the selected object. Entity-scoped: it is never a reading.devices widget. */
export function forceStripDevice(reading: NativeEditorReading): StripDevice | null {
  const entity = selectedEntity(reading)
  if (!entity) return null
  const {force} = entity
  return {
    id: `force:${entity.id}`, name: `Force · ${entity.name}`, scope: 'entity', family: 'force',
    on: !(entity.enabled === false || force.kind === 'none' && Math.abs(force.spin) < 1e-9),
    toggle: null,
    summary: `${force.kind} · strength ${short(force.strength)} · radius ${short(force.radius)}`,
  }
}

/** A single boolean commit for an activator; null when the device has no such operation. */
export function stripToggleChange(device: Pick<StripDevice, 'toggle'>, value: boolean): NativeDeviceChange | null {
  const toggle = device.toggle
  if (!toggle) return null
  if (toggle.kind === 'field-setting') return {kind: 'field-setting', key: toggle.key, value}
  if (toggle.kind === 'morph-setting') return {kind: 'morph-setting', key: toggle.key, value}
  if (toggle.kind === 'panel-setting') return {kind: 'panel-setting', key: toggle.key, value}
  return {kind: 'colour-setting', key: toggle.key, value}
}

/** Every change one activator click commits together (one native apply, one undo step). */
export function stripToggleChanges(device: Pick<StripDevice, 'toggle'>, value: boolean): NativeDeviceChange[] {
  const change = stripToggleChange(device, value)
  if (!change) return []
  const toggle = device.toggle
  return !value && toggle?.kind === 'field-setting' && toggle.clears ? [change, {kind: 'field-setting', key: toggle.clears, value: false}] : [change]
}
