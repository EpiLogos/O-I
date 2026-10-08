/** Pure models behind the native Browser, chosen controls and rack mapping.
 * Each rule here is the same rule the owner enforces; the owner still validates
 * every committed change. No React, no DOM. */
import {entityTargets, NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {NativeChosenControlChange, NativeEditorReading, NativeEditorChange} from '../../../../expressions-boundary/src/editor'
import {FORMATION_SCENE_LIMIT} from '../../../../expressions-boundary/src/nativeFormations'
import type {NativeParameterRack} from '../../../../expressions-boundary/src/nativeRackSchema'
import {roleAccepts, type ReuseRole} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/reuse'
import {FIELD_FACE_MODELS} from './nativeFieldFaceModel'
import type {ParameterDrag} from './nativeDrag'
import type {RackDevice} from './nativeDeviceCatalogue.ts'

export const format = (value: number) => Number.isFinite(value) ? String(Number(value.toPrecision(6))) : 'Unavailable'

/** Row text is the registry label; only the owner prefix of object labels is dropped. */
export const rowLabel = (label: string) => label.replace(/^.*? · /, '')

export function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// ---- Row navigation -------------------------------------------------------

export type RowKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'
/** Index of the row a key moves to. -1 is the search field above the rows.
 * Clamped at both ends: ArrowUp from the first row returns to the search. */
export function rowAfter(count: number, current: number, key: RowKey): number {
  if (count <= 0) return -1
  const at = Math.min(current, count - 1)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  if (key === 'ArrowDown') return at < 0 ? 0 : Math.min(count - 1, at + 1)
  return at <= 0 ? -1 : at - 1
}

// ---- Grouping -------------------------------------------------------------

export interface RowGroup<T> {group: string; rows: T[]}
/** Groups in order of first appearance; rows keep their registry order inside a group. */
export function groupRows<T extends {group: string}>(rows: readonly T[]): RowGroup<T>[] {
  const buckets = new Map<string, T[]>()
  for (const row of rows) {
    const bucket = buckets.get(row.group)
    if (bucket) bucket.push(row)
    else buckets.set(row.group, [row])
  }
  return [...buckets].map(([group, members]) => ({group, rows: members}))
}

// ---- Chosen-control reordering -------------------------------------------

/** Moves the item at `from` so it ends at final index `to` (clamped). */
export function reorderIds<T>(ids: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || from < 0 || from >= ids.length) throw Error('Choose a chosen control to move')
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(ids.length - 1, to)), 0, moved)
  return next
}

/** The full order to send to `chosen-order`, or null when nothing moves. */
export function reorderChange(ids: readonly string[], from: number, to: number): string[] | null {
  const next = reorderIds(ids, from, to)
  return next.every((id, index) => id === ids[index]) ? null : next
}

/** A drop gap is the insertion point before element `gap` (0..n); this gives the final index. */
export function gapToIndex(from: number, gap: number): number {
  return gap > from ? gap - 1 : gap
}
export function edgeGap(index: number, edge: 'before' | 'after'): number {
  return edge === 'after' ? index + 1 : index
}

// ---- Parameter scope, drag payload and chosen-add ------------------------

export interface BindingFacts {path: string; key: string; label: string; unit?: string; min: number; max: number; entityId?: string}
export type ObjectScope = 'selected' | 'named'

/** The one scope rule for both 'Add to toolbelt' and a drag onto the chosen rack. */
export function chosenScopeFor(kind: 'field' | 'object', objectScope: ObjectScope): ParameterDrag['scope'] {
  return kind === 'field' ? 'field' : objectScope
}

export function parameterDragFor(binding: BindingFacts, kind: 'field' | 'object', objectScope: ObjectScope): ParameterDrag {
  if (kind === 'object' && !binding.entityId) throw Error('An object parameter names its object')
  return {
    path: kind === 'field' ? binding.path : binding.key, key: binding.key, label: rowLabel(binding.label),
    unit: binding.unit ?? null, min: binding.min, max: binding.max, kind, scope: chosenScopeFor(kind, objectScope),
    ...(kind === 'object' ? {entityId: binding.entityId} : {}),
  }
}

export function chosenAddChange(drag: ParameterDrag): NativeChosenControlChange {
  return {kind: 'chosen-add', key: drag.key, scope: drag.scope, ...(drag.scope === 'named' && drag.entityId ? {entity_id: drag.entityId} : {})}
}

/** Why a parameter cannot be chosen now, or null when the chosen rack accepts it. */
export function chosenDropReason(drag: ParameterDrag, reading: NativeEditorReading | null): string | null {
  if (!reading) return 'Open an Expression to choose controls'
  const chosen = reading.chosenControls
  if (!chosen?.available) return 'The retained owner has not disclosed chosen controls'
  if (reading.standing.pending) return 'Waiting for the native owner to acknowledge the last change'
  if (drag.kind === 'field') {
    if (!NATIVE_BINDINGS.some(binding => binding.key === drag.key)) return 'This Field parameter has no native definition'
  } else {
    const entityId = drag.entityId
    if (!entityId) return 'The parameter does not name its object'
    if (drag.scope === 'selected' && reading.selection.entity_ids[0] !== entityId) return 'The selection changed since this parameter was dragged'
    const entity = reading.scene.entities.find(item => item.id === entityId)
    if (!entity) return 'The bound object is absent from this Scene'
    if (!reading.entityOccurrences[entity.id]) return 'This object has no admitted native occurrence'
    if (entity.locked) return 'This object is locked'
    if (!entityTargets(reading.scene).some(target => target.entityId === entity.id && target.key === drag.key)) return 'This object property has no native definition'
  }
  if (chosen.entries.some(entry => entry.key === drag.key && entry.scope === drag.scope && (drag.scope !== 'named' || entry.entityId === drag.entityId))) return 'Already chosen in this scope'
  return null
}

// ---- Macro mapping -------------------------------------------------------

/** The path the mapping form selects: Field racks use the native path, entity racks the binding key. */
export function rackMappingPath(rack: NativeParameterRack, drag: ParameterDrag): string {
  return rack.scope.kind === 'field' ? drag.path : drag.key
}

/** Why this parameter cannot map onto this rack, or null when the mapping form accepts it. */
export function rackMapReason(drag: ParameterDrag, rack: NativeParameterRack, reading: NativeEditorReading | null): string | null {
  if (!reading) return 'Open a native Scene to map parameters'
  if (reading.standing.pending) return 'Waiting for the native owner to acknowledge the last change'
  if (!rack.macros.length) return 'This rack has no macro to map to'
  if (rack.scope.kind === 'field') {
    if (drag.kind !== 'field') return 'Field racks take Field parameters'
    if (!NATIVE_BINDINGS.some(binding => binding.path === drag.path)) return 'This Field parameter has no admitted native mapping'
    return null
  }
  if (drag.kind !== 'object') return 'Entity racks take parameters of their own object'
  const ref = rack.scope.entity_ref
  const owners = Object.keys(reading.entityOccurrences).filter(id => reading.entityOccurrences[id] === ref)
  if (owners.length !== 1) return 'The rack object is absent from this Scene'
  if (drag.entityId !== owners[0]) return 'This parameter belongs to another object'
  const entity = reading.scene.entities.find(item => item.id === owners[0])
  if (!entity) return 'The rack object is absent from this Scene'
  if (entity.locked) return 'Unlock the object to edit this rack'
  if (!entityTargets(reading.scene).some(target => target.entityId === entity.id && target.key === drag.key)) return 'This object parameter has no admitted native mapping'
  return null
}

export function mappableRacks(drag: ParameterDrag, racks: readonly NativeParameterRack[], reading: NativeEditorReading | null): NativeParameterRack[] {
  return racks.filter(rack => rackMapReason(drag, rack, reading) === null)
}

// ---- Device family for 'Open device' -------------------------------------

/** The scope is the target family's registry scope. No registry parameter belongs to a scene family, so a parameter resolves to field or entity. */
export interface DeviceTarget {scope: 'field' | 'entity' | 'scene'; family: string}
/** The device editor that discloses this parameter, or null when no editor does. */
export function deviceTargetFor(binding: {path: string; key: string}, kind: 'field' | 'object'): DeviceTarget | null {
  if (kind === 'object') return binding.key.startsWith('forces.') ? {scope: 'entity', family: 'force'} : null
  for (const [family, model] of Object.entries(FIELD_FACE_MODELS)) if (model.paths.includes(binding.path)) return {scope: 'field', family}
  if (binding.path.startsWith('toroidalMorph.') || binding.path === 'morphProgress') return {scope: 'field', family: 'morph'}
  if (binding.path.startsWith('color.') || binding.path === 'paperGrain' || binding.path === 'backgroundGlowIntensity') return {scope: 'field', family: 'colour'}
  return null
}

// ---- Reusable material compatibility -------------------------------------

export type EntitySlot = 'agent' | 'object'
export interface SelectionSlot {name: string; slot: EntitySlot}
/** The selected object as a material role would see it: a role name decides agent or object. */
export function selectionSlot(reading: NativeEditorReading | null): SelectionSlot | null {
  const id = reading?.selection.entity_ids[0]
  const entity = id === undefined ? undefined : reading?.scene.entities.find(item => item.id === id)
  if (!entity) return null
  const accepted = entity.role ? roleAccepts(entity.role, 'entity') : 'object'
  return {name: entity.name, slot: accepted === 'agent' ? 'agent' : 'object'}
}

export type Compatibility = {state: 'none'} | {state: 'compatible'} | {state: 'incompatible'; reason: string}
/** An agent can take an agent or object role; an object takes only object roles.
 * Materials whose roles name no entity slot need no selected object. */
export function materialCompatibility(roles: readonly Pick<ReuseRole, 'accepts'>[], slot: SelectionSlot | null): Compatibility {
  if (!slot) return {state: 'none'}
  const entityRoles = roles.filter(role => role.accepts === 'agent' || role.accepts === 'object')
  if (!entityRoles.length) return {state: 'compatible'}
  const fits = slot.slot === 'agent' ? entityRoles : entityRoles.filter(role => role.accepts === 'object')
  return fits.length ? {state: 'compatible'} : {state: 'incompatible', reason: `Needs an agent role; ${slot.name} is an object`}
}

/** Incompatible rows stay reachable: hidden by default, shown marked under 'Show all',
 * and always kept while selected. */
export function materialRowVisible(compat: Compatibility, showAll: boolean, selected: boolean): boolean {
  return compat.state !== 'incompatible' || showAll || selected
}

// ---- Parameter detail facts ----------------------------------------------

export interface ParameterFacts {label: string; unit: string; soft: string; hard: string; step: string; native: string; scope: string; base: string; effective: string | null}
export function parameterFacts(binding: {label: string; unit?: string; min: number; max: number; hardMin: number; hardMax: number; step: number; bind: string},
  base: number, effective: number | undefined, scope: string): ParameterFacts {
  return {
    label: binding.label, unit: binding.unit ?? 'scalar',
    soft: `${format(binding.min)} – ${format(binding.max)}`, hard: `${format(binding.hardMin)} – ${format(binding.hardMax)}`,
    step: binding.step > 0 ? format(binding.step) : 'continuous', native: binding.bind, scope,
    base: format(base), effective: effective !== undefined && Number.isFinite(effective) ? format(effective) : null,
  }
}

// ---- Devices category ----------------------------------------------------

export interface DeviceRow {family: string; name: string; summary: string; onRack: boolean; enabled: boolean | undefined; studio?: string;
  scope: 'field' | 'entity' | 'scene'}
/** Catalogue rows for the Devices category. `summary` is the panel's group titles joined; `onRack` reads reading.devices only;
 * search matches the name and the group titles, case-insensitively. Changes nothing. */
export function deviceRows(devices: readonly Pick<RackDevice, 'family' | 'name' | 'groups' | 'studio' | 'enabled' | 'scope'>[],
  reading: NativeEditorReading | null, query: string): DeviceRow[] {
  const placed = new Set((reading?.devices ?? []).map(device => device.family))
  const needle = query.trim().toLocaleLowerCase()
  return devices.map(device => ({
    family: device.family, name: device.name, summary: device.groups.map(group => group.title).join(' · ') || 'Parameters',
    onRack: placed.has(device.family), enabled: reading ? device.enabled(reading) : undefined, studio: device.studio, scope: device.scope,
  })).filter(row => !needle || `${row.name} ${row.summary}`.toLocaleLowerCase().includes(needle))
}

/** Creatable objects for the Objects category. Formation shapes are the add picker's; 'force' is the existing
 * force-insert (the device '+ Force' gesture). `full` is the scene budget, read from the reading only. */
export type ObjectKind = 'text' | 'ring' | 'disc' | 'triangle' | 'square' | 'force'
export interface ObjectRow {kind: ObjectKind; name: string; summary: string; full: boolean}
const OBJECT_ROWS: readonly Omit<ObjectRow, 'full'>[] = [
  {kind: 'text', name: 'Glyph or word', summary: 'Formation · text state'},
  {kind: 'ring', name: 'Ring', summary: 'Formation · ring'},
  {kind: 'disc', name: 'Disc', summary: 'Formation · disc'},
  {kind: 'triangle', name: 'Triangle', summary: 'Formation · triangle'},
  {kind: 'square', name: 'Plane', summary: 'Formation · plane'},
  {kind: 'force', name: 'Force pin', summary: 'Pin · pulls or repels the field'},
]
export function objectRows(reading: NativeEditorReading | null, query: string): ObjectRow[] {
  const needle = query.trim().toLocaleLowerCase(), full = (reading?.scene.entities.length ?? 0) >= FORMATION_SCENE_LIMIT
  return OBJECT_ROWS.map(row => ({...row, full})).filter(row => !needle || `${row.name} ${row.summary}`.toLocaleLowerCase().includes(needle))
}
/** The one change an Objects row adds. Glyph text rides only on the 'text' row. */
export function objectAddChange(kind: ObjectKind, text: string): NativeEditorChange {
  if (kind === 'force') return {kind: 'force-insert', position: {x: 0, y: 0, z: 0}}
  if (kind === 'text') return {kind: 'formation-add', shape: 'text', text}
  return {kind: 'formation-add', shape: kind}
}

/** Scene favourites the Field chosen controls do not yet hold (legacy app.ts import-favourites). A favourite that names no native Field
 * binding is skipped and reported, never invented. One chosen-add per admitted favourite, for one apply. */
export function favouriteImportChanges(favourites: readonly string[] | undefined, chosen: readonly {key: string; scope: string}[]): {changes: NativeChosenControlChange[]; skipped: string[]} {
  const changes: NativeChosenControlChange[] = [], skipped: string[] = [], seen = new Set<string>()
  for (const key of favourites ?? []) {
    if (seen.has(key)) continue
    seen.add(key)
    if (!NATIVE_BINDINGS.some(binding => binding.key === key)) {skipped.push(key); continue}
    if (chosen.some(entry => entry.key === key && entry.scope === 'field')) continue
    changes.push({kind: 'chosen-add', key, scope: 'field'})
  }
  return {changes, skipped}
}
