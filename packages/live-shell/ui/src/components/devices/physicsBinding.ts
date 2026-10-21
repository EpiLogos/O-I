// Physics's binding (lane BE): the catalogue's Physics design (inhabitants/catalogue/panels/physics.tsx, id `expressions:physics`) drawn
// on the field engine's own readings and writes (frame/devices/designed.ts DesignBinding; the pattern of central/devices/dayBinding.ts).
// Owners write, faces read (lock §0.4): every value is the engine's reading of the open work — the very rows the runtime's Physics device
// already carries (expressionsDevice.ts expressionsFieldDevice: the retained editor's reading, baseValue over the Scene) — and every
// change leaves through that device's one submit (the editor's `parameter` and `field-setting` changes, validated by the boundary), so a
// value moved on the design moves on the rack, in the pool and in a pane at once. Pure: no React, no transport.
//
// The engine owns the field's law (desktop/cradle/expressions-app/src/engine/paramRegistry.ts:59-78, the 'Fluid' and 'Physics+' groups;
// field-studies-journeys/src/nativeParameters.ts:12-18 their native keys and factors). Two of them are authored in stage units and drawn
// in the engine's own pixels (factor 400: Vortex Radius, Speed Limit): the design's px is the stage value × the factor, and back.
import type {NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import {SETTING_PREFIX, expressionsSettingChoices} from './expressionsDevice'

/** The design's id (designs.ts designKey('expressions', 'physics')). */
export const PHYSICS_DESIGN_ID = 'expressions:physics'

/** The design's numeric keys, each the engine path that reads and writes it (nativeFieldFace.physics.ts FLUID and PHYSICS_PLUS). */
export const PHYSICS_KEYS: Readonly<Record<string, string>> = {
  viscosity: 'fluid.viscosity', vortex: 'fluid.vortexStrength', radius: 'fluid.vortexRadius', spring: 'fluid.returnSpeed',
  snap: 'fluid.snapRigidity', tether: 'fluid.densityTether', curlScale: 'fluid.curlScale', curlSpeed: 'fluid.curlSpeed', curlDepth: 'fluid.curlDepth',
  turbulence: 'fluid.turbulence', dispersion: 'fluid.dispersion', gx: 'fluid.gravityX', gy: 'fluid.gravityY', gz: 'fluid.gravityZ',
  drag: 'fluid.quadraticDrag', jitter: 'fluid.thermalJitter', speedLimit: 'fluid.maxSpeed', zConfine: 'fluid.zConfinement', timeScale: 'fluid.timeScale',
}

/** The medium plane: the engine's `mediumPlane` field-setting (the device's `set:mediumPlane` row). */
const PLANE = 'plane', PLANE_SETTING = 'mediumPlane'
/** The engine's runtime actions the design's Field section presses (stageCommands.ts STAGE_ENGINE_ACTIONS; app.ts:1636-1639): Disperse
 * spreads the particles (a press, `true`); Reset reseeds every particle onto its shape and resets the morph phases, a change that asks
 * first (manual §16.10), so it runs only on the value `confirmed` — the shell's own two-step (NativeEngineActions.tsx) is the gesture. */
export type PhysicsAction = 'disperse' | 'reset'
export const PHYSICS_PRESSES: Readonly<Record<string, {action: PhysicsAction; value: Value}>> = {
  disperse: {action: 'disperse', value: true}, reset: {action: 'reset', value: 'confirmed'},
}

/** Keys a change goes to the engine for. `paused` is a reading: the engine reports it, and exposes no pause to write. */
export const PHYSICS_WRITES: ReadonlySet<string> = new Set([...Object.keys(PHYSICS_KEYS), PLANE, ...Object.keys(PHYSICS_PRESSES)])

/** Why each design key this binding leaves absent, or reads only, has no write (manual §16.12 "say which one"). */
export const PHYSICS_ABSENT: Readonly<Record<string, string>> = {
  light: 'Physics has no on or off: the engine gates no fluid term by an enable (nativeFieldFace.physics.ts:12), so its light has no reading.',
  paused: 'A reading: the engine reports whether the field is held (observation.fieldPaused); it exposes no pause to write.',
}

const factorOf = (path: string): number => NATIVE_BINDINGS.find(binding => binding.path === path)?.factor ?? 1
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** The engine's runtime action, run through the Expressions panel's one engine command (native/engineCommand.ts). */
export type PhysicsPress = (action: PhysicsAction) => void

/** The design's values from the engine's reading, as the Physics device carries it. Only what the engine reports. */
export function physicsValuesOf(device: DeviceInstance, reading: Pick<NativeEditorReading, 'observation'> | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  for (const [key, path] of Object.entries(PHYSICS_KEYS)) {
    const value = device.values[path]
    if (finite(value)) values[key] = value * factorOf(path)
  }
  // The plane: the owner's choice by its value (the row carries the label the generic plate shows).
  const label = device.values[SETTING_PREFIX + PLANE_SETTING]
  const plane = expressionsSettingChoices('physics', PLANE_SETTING)?.find(choice => choice.label === label)?.value
  if (plane) values[PLANE] = plane
  const paused = reading?.observation?.fieldPaused
  if (typeof paused === 'boolean') values.paused = paused
  return values
}

/** The device's row changes for the design's changes, in the engine's units; the presses apart. Throws in words for a key that is a
 * reading or no key of the engine's. */
export function physicsRowChanges(changes: readonly ValueChange[]): {rows: {key: string; value: ParamValue}[]; presses: PhysicsAction[]} {
  const rows: {key: string; value: ParamValue}[] = [], presses: PhysicsAction[] = []
  for (const change of changes) {
    const path = PHYSICS_KEYS[change.key]
    if (path) {
      if (!finite(change.value)) throw new Error(`${change.key} takes a number.`)
      rows.push({key: path, value: change.value / factorOf(path)})
    } else if (change.key === PLANE) {
      const choice = expressionsSettingChoices('physics', PLANE_SETTING)?.find(item => item.value === change.value)
      if (!choice) throw new Error(`The medium plane is vertical or horizontal; ${String(change.value)} is neither.`)
      rows.push({key: SETTING_PREFIX + PLANE_SETTING, value: choice.label})
    } else if (PHYSICS_PRESSES[change.key]) {
      const press = PHYSICS_PRESSES[change.key]!
      if (change.value !== press.value) throw new Error(press.action === 'reset'
        ? 'Reset reseeds every particle: it asks first, and runs only once you confirm it.'
        : `${change.key} is a press: it runs once, and nothing here undoes it.`)
      presses.push(press.action)
    } else {
      throw new Error(PHYSICS_ABSENT[change.key] ?? `${change.key}: no parameter of the engine's Physics.`)
    }
  }
  return {rows, presses}
}

/** The binding the runtime hosts the Physics design on: the engine's readings, the device's one submit, the engine's two presses.
 * While the work is busy or waits on the owner the device has no submit, and every value is a reading. */
export function physicsDesignBinding(device: DeviceInstance, reading: Pick<NativeEditorReading, 'observation'> | null, press: PhysicsPress): DesignBinding {
  const modulatedBy: Record<string, string> = {}
  for (const [key, path] of Object.entries(PHYSICS_KEYS)) {
    const by = device.rows.find(row => row.key === path)?.modulatedBy
    if (by) modulatedBy[key] = by
  }
  const submit = device.submit
  // Physics's light and its held-field reading say why they take no change (manual §16.12: "say which one").
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries(PHYSICS_ABSENT).map(([key, why]) => [key, {disabled: why}]))
  return {
    id: device.id,
    values: physicsValuesOf(device, reading),
    standing,
    writes: key => PHYSICS_WRITES.has(key),
    ...(submit ? {write: async (changes: readonly ValueChange[]) => {
      const {rows, presses} = physicsRowChanges(changes)
      if (rows.length) await submit(rows)
      for (const action of presses) press(action)
    }} : {}),
    ...(Object.keys(modulatedBy).length ? {modulatedBy} : {}),
  }
}
