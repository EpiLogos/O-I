import {NATIVE_BINDINGS, getParamDef, nativeBinding} from '@epilogos/expressions-boundary/parameters'
import type {NativeEditorChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {nativeRackMappingValue, type NativeParameterRack} from '../../../../expressions-boundary/src/nativeRackSchema'
import {readNativeRacks} from '../../../../expressions-boundary/src/nativeRacks'
import type {LivePoint} from './nativeBarSession'
import {fraction, fromFraction, type HandleBinding} from './nativeFieldHandleModel'

/** The bar's control slots: a closed catalogue of what the bar can show, the owner-approved default seed, and the projection of the
 * Expression's own Field-scoped chosen controls. There is no store here. Seed slots are a presentation default; hiding one is a
 * per-viewer convenience kept in the browser; a pin is a chosen control in the document (nativePinMode.ts). */
export interface BarToggleSpec {
  id: string; label: string; title: string
  read: (reading: NativeEditorReading) => boolean | undefined
  /** The reading is passed so a toggle can pair a companion value with its switch (Cymatic and its plate size). */
  changes: (on: boolean, reading?: NativeEditorReading) => NativeEditorChange[]
}
export interface BarMacroSpec {
  rackId: string; macroId: string; title: string
  /** Each mapping drives one registry parameter between two soft-range endpoints, in registry units. */
  mappings: readonly {path: string; min: number; max: number}[]
}
export type BarSlot =
  | {kind: 'value'; id: string; path: string; placement: 'bar' | 'transport'; entryId?: string}
  | {kind: 'toggle'; id: string; toggle: BarToggleSpec}
  | {kind: 'pair'; id: string; label: string; toggle: BarToggleSpec; path: string}
  | {kind: 'range'; id: string; label: string; minPath: string; maxPath: string; band: {from: number; to: number}; title: string}
  | {kind: 'macro'; id: string; label: string; title: string; macro: BarMacroSpec}

const SHAPE_HOLD: BarMacroSpec = {
  rackId: 'bar.shape-hold', macroId: 'hold', title: 'Shape hold',
  // Snap rigidity pulls particles back onto the formation, density tether holds them to its density; both to their soft maximum is a firm hold.
  mappings: [{path: 'fluid.snapRigidity', min: 0, max: 5}, {path: 'fluid.densityTether', min: 0, max: 3}],
}
const VOLUME_3D: BarToggleSpec = {
  id: '3d', label: '3D', title: 'Switch the body to 3D: volume on and perspective depth on (volumeEnabled and depthPerspective).',
  read: reading => reading.scene.engine.volumeEnabled === undefined ? undefined : reading.scene.engine.volumeEnabled === true,
  changes: on => [{kind: 'panel-setting', key: 'volumeEnabled', value: on}, {kind: 'panel-setting', key: 'depthPerspective', value: on}],
}
/** The plate size the Cymatic pair starts a field at. Low reads clearly; the person can raise it, and turning the field on never raises it. */
export const CYMATIC_LOW_PLATE = 300
const CYMATIC: BarToggleSpec = {
  id: 'cymatic', label: 'Cymatic', title: `Cymatic field on or off (resonanceEnabled). Turning it on also sets the plate size to ${CYMATIC_LOW_PLATE} unless it is already lower, so the pattern reads clearly.`,
  read: reading => reading.scene.engine.resonanceEnabled === undefined ? undefined : reading.scene.engine.resonanceEnabled === true,
  changes: (on, reading) => {
    const changes: NativeEditorChange[] = [{kind: 'field-setting', key: 'resonanceEnabled', value: on}]
    const plate = NATIVE_BINDINGS.find(item => item.path === 'cymatics.plateSize')
    if (on && reading && plate) {
      const current = Number(reading.scene.field.params[plate.key] ?? plate.defaultValue)
      if (current > CYMATIC_LOW_PLATE) changes.push({kind: 'parameter', target: 'field.' + plate.key, value: CYMATIC_LOW_PLATE})
    }
    return changes
  },
}
const RELATIONAL: BarToggleSpec = {
  id: 'relational', label: 'Relational', title: 'Relational forces on or off (relationalEnabled).',
  read: reading => reading.scene.engine.relationalEnabled === undefined ? undefined : reading.scene.engine.relationalEnabled === true,
  changes: on => [{kind: 'panel-setting', key: 'relationalEnabled', value: on}],
}

/** The owner-approved default seed, in priority order. Time Scale sits in the transport group; the rest fill the controls row.
 * Grid size for the Cymatic field is the resonator's plate size (cymatics.plateSize): the engine's resonator reads uResPlateSize and never
 * medium.gridRes, which is the shared medium's grid (simulationShaders.ts:758, PointCloudField.ts:1877-1886). */
export const SEED_SLOTS: readonly BarSlot[] = [
  {kind: 'value', id: 'time-scale', path: 'fluid.timeScale', placement: 'transport'},
  {kind: 'value', id: 'viscosity', path: 'fluid.viscosity', placement: 'bar'},
  {kind: 'macro', id: 'shape-hold', label: 'Shape hold', macro: SHAPE_HOLD, title: 'One macro: snap rigidity and density tether together.'},
  {kind: 'toggle', id: '3d', toggle: VOLUME_3D},
  {kind: 'range', id: 'particle-size', label: 'Particle size', minPath: 'particleSize.min', maxPath: 'particleSize.max', band: {from: 0.2, to: 1.4},
    title: 'Minimum and maximum particle size. The shaded band is the 0.2 to 1.4 sweet spot; the hard bounds are unchanged.'},
  {kind: 'pair', id: 'cymatic', label: 'Cymatic', toggle: CYMATIC, path: 'cymatics.plateSize'},
  {kind: 'toggle', id: 'relational', toggle: RELATIONAL},
  {kind: 'value', id: 'turbulence', path: 'fluid.turbulence', placement: 'bar'},
  {kind: 'value', id: 'ink-opacity', path: 'material.opacity', placement: 'bar'},
]

const slotPaths = (slot: BarSlot): string[] => slot.kind === 'value' ? [slot.path] : slot.kind === 'pair' ? [slot.path] : slot.kind === 'range' ? [slot.minPath, slot.maxPath]
  : slot.kind === 'macro' ? slot.macro.mappings.map(mapping => mapping.path) : []

/** The slots the bar shows: the seed minus what this viewer hid, then the Expression's Field-pinned controls that no seed slot already shows. */
export function barSlots(reading: NativeEditorReading | null, hidden: ReadonlySet<string>): BarSlot[] {
  const seed = SEED_SLOTS.filter(slot => !hidden.has(slot.id))
  if (!reading) return seed
  // Only visible seed slots claim a path: hiding a seed slot must not also hide a Field pin on the same parameter.
  const shown = new Set(seed.flatMap(slotPaths))
  const pinned: BarSlot[] = []
  for (const entry of reading.chosenControls.entries) {
    if (entry.scope !== 'field') continue
    const binding = nativeBinding(entry.key)
    if (!binding || shown.has(binding.path)) continue
    shown.add(binding.path)
    pinned.push({kind: 'value', id: 'pin:' + entry.id, path: binding.path, placement: 'bar', entryId: entry.id})
  }
  return [...seed, ...pinned]
}

/** Per-viewer convenience only: which seed slots this browser hides. Never read back by anything but the bar; an unreadable store means none hidden. */
const HIDDEN_KEY = 'oi.live-shell.bar-hidden'
export function readHiddenSlots(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(HIDDEN_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && SEED_SLOTS.some(slot => slot.id === id)) : [])
  } catch {return new Set()}
}
export function writeHiddenSlots(hidden: ReadonlySet<string>): void {
  try {globalThis.localStorage?.setItem(HIDDEN_KEY, JSON.stringify([...hidden]))} catch {/* the bar still works; the choice is not kept */}
}

const unitOf = (path: string) => getParamDef(path)?.unit ?? 'scalar'
/** The rack a macro slot drives, read from the Scene: absent until the person adds it. */
export function barMacroRack(reading: NativeEditorReading, macro: BarMacroSpec): NativeParameterRack | null {
  try {return readNativeRacks(reading.scene, reading.entityOccurrences).racks.find(rack => rack.id === macro.rackId) ?? null} catch {return null}
}
/** The rack-set change that adds the macro. Its position starts where the first mapped parameter already is, so adding it moves nothing. */
export function barMacroCreate(reading: NativeEditorReading, macro: BarMacroSpec): NativeEditorChange {
  const first = macro.mappings[0], binding = NATIVE_BINDINGS.find(item => item.path === first.path)
  const current = binding ? Number(reading.scene.field.params[binding.key] ?? binding.defaultValue) : first.min
  const position = Math.min(1, Math.max(0, (current - first.min) / (first.max - first.min)))
  return {kind: 'rack-set', rack: {schema: 'oi.parameter-rack/v1', id: macro.rackId, title: macro.title, scope: {kind: 'field'},
    macros: [{id: macro.macroId, name: macro.title, value: Number.isFinite(position) ? position : 0, mappings: macro.mappings.map((mapping, index) => ({
      id: `${macro.macroId}.${index}`, target: {kind: 'field' as const, path: mapping.path}, min: mapping.min, max: mapping.max, unit: unitOf(mapping.path), law: 'linear' as const}))}],
    excluded: [], variations: []}}
}
/** The live targets one macro position drives: exactly what the rack write will commit, in the parameters' own units. */
export function barMacroPoints(macro: BarMacroSpec, position: number): LivePoint[] {
  return macro.mappings.map(mapping => {
    const binding = NATIVE_BINDINGS.find(item => item.path === mapping.path)!
    const value = nativeRackMappingValue({id: 'live', target: {kind: 'field', path: mapping.path}, min: mapping.min, max: mapping.max, unit: unitOf(mapping.path), law: 'linear'}, position)
    return {target: 'field.' + binding.key, value: value / binding.factor}
  })
}

/** A two-handle range's state and the rule that keeps its handles ordered. The hard bounds are the registry's, unchanged.
 * `track` is the shared soft range both handles move over, on the registry's own scale (log for particle size). */
export interface BarRangeState {min: number; max: number; lowest: number; highest: number; track: HandleBinding}
export function barRangeState(reading: NativeEditorReading, minPath: string, maxPath: string): BarRangeState | null {
  const low = NATIVE_BINDINGS.find(item => item.path === minPath), high = NATIVE_BINDINGS.find(item => item.path === maxPath)
  if (!low || !high) return null
  const read = (binding: typeof low) => Number(reading.scene.field.params[binding.key] ?? binding.defaultValue)
  const track: HandleBinding = {label: low.label, min: low.min, max: high.max, hardMin: low.hardMin, hardMax: high.hardMax, step: Math.min(low.step, high.step),
    scale: low.scale === 'log' && high.scale === 'log' ? 'log' : 'linear', unit: low.unit, defaultValue: low.defaultValue}
  return {min: read(low), max: read(high), lowest: low.hardMin, highest: high.hardMax, track}
}
/** The handles never cross: a handle moved past the other stops at it. */
export function clampRangeHandle(handle: 'min' | 'max', value: number, state: Pick<BarRangeState, 'min' | 'max' | 'lowest' | 'highest'>): number {
  return handle === 'min' ? Math.min(Math.max(value, state.lowest), state.max) : Math.max(Math.min(value, state.highest), state.min)
}
/** A position on the track, 0 to 1, over the shared soft range. */
export const rangeFraction = (value: number, state: Pick<BarRangeState, 'track'>) => fraction(state.track, value)
export const rangeValue = (ratio: number, state: Pick<BarRangeState, 'track'>) => fromFraction(state.track, Math.min(1, Math.max(0, ratio)))
