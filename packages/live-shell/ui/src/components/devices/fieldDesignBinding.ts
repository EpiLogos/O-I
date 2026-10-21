// The field devices' bindings (R5, after Physics's lane BE, physicsBinding.ts): each field family's catalogue design (manual §20.4–§20.14,
// inhabitants/catalogue/panels/expressions__<family>.tsx) drawn on the field engine's own readings and writes. Owners write, faces read
// (lock §0.4). The designs key their values on the engine's own paths, so one binding serves them all:
//   - a numeric row (key = the engine path, NATIVE_BINDINGS) is the design's value under the same path, in the binding's display units
//     (the path's factor, as Physics's px values are), and a change goes back through the device's one submit;
//   - a setting row (`set:<key>`, the owner's label) is the design's value under the setting's own key, as the owner writes it;
//   - the device's `enabled` row is the design's switch under the family's toggle key (nativeFieldFace.<family>.ts `toggle`);
//   - what the open scene keeps that is no row of the device (Colour's palette and paper, Focus's route) is read from the scene, and
//     a change the editor admits for it (colour-palette, colour-background) leaves through the family's one send, on the reading's basis.
//   - an optional setting the scene sets only once it is chosen (Colour's paper, Depth's swirl and bridge) is absent until set and still
//     written (FIELD_UNSET); Depth's two numbers leave as the editor's panel settings; Focus's chosen formation is the view's own (FIELD_LOCAL).
// A key the owner does not report stays absent, and a key with no owner operation stands disabled with its reason (manual §16.12).
// Pure: no React, no transport.
import type {NativeEditorChange, NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import {validateNativeFieldPanelChange} from '../../../../../expressions-boundary/src/nativeDeviceEdits'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import {ENABLED_KEY, SETTING_PREFIX, expressionsFieldEntry, expressionsSettingChoices, type FieldDeviceSend} from './expressionsDevice'
import {handsFor, heldFor} from '../../techne/devices/designDevices'

/** The field families whose catalogue design this binding hosts (Physics has its own, physicsBinding.ts). */
export const FIELD_DESIGN_FAMILIES = ['pointer', 'relational', 'medium', 'contacts', 'morph', 'focus', 'colour', 'ink', 'depth', 'resonance'] as const
export type FieldDesignFamily = typeof FIELD_DESIGN_FAMILIES[number]
export const isFieldDesignFamily = (family: string): family is FieldDesignFamily => (FIELD_DESIGN_FAMILIES as readonly string[]).includes(family)

const factorOf = (path: string): number => NATIVE_BINDINGS.find(binding => binding.path === path)?.factor ?? 1
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {})

/** Why each key a family's design draws has no owner reading or no owner write here (manual §16.12: "say which one"). */
export const FIELD_ABSENT: Readonly<Record<FieldDesignFamily, Readonly<Record<string, string>>>> = {
  pointer: {
    light: 'Pointer has no on or off: the engine gates no pointer term by an enable (nativeDeviceCatalogue.ts: no toggle), so its light has no reading.',
  },
  relational: {},
  medium: {
    mediumPlane: 'A reading here: the plane the medium flows in is set on Physics (its Physical medium plane).',
  },
  contacts: {},
  morph: {
    'phase.theta': 'The engine keeps the toroidal phase in its own accumulator (its telemetry drive.theta, which the Studio\'s phase instrument draws) — missing: its announcement to the shell (the editor reading carries no phase).',
    'phase.phi': 'The engine keeps the poloidal phase in its own accumulator (its telemetry drive.phi, which the Studio\'s phase instrument draws) — missing: its announcement to the shell (the editor reading carries no phase).',
  },
  focus: {
    'focus.at': 'The engine does not report which formation holds the focus now.',
    route: 'The route is the scene\'s formations in order; the editor admits no reorder of formations from a device yet.',
  },
  colour: {},
  ink: {},
  depth: {},
  resonance: {
    stations: 'The plate\'s stations are computed in the Expression from its modes (the Studio\'s station ticks) — missing: their announcement to the shell (the editor reading carries none).',
    'body.source': 'No body source: the plate takes its Q factor, agitation and edge as rows of its own, and no owner holds body constants by tattva (QL\'s scene material is a declared policy too).',
    'tattva.name': 'The plate rings under no M2 condition of its own (the field engine is not QL\'s scene); the live scene\'s tattva, QL\'s condition source_path, is not announced to the shell either.',
    'tattva.fibre': 'No tattva sets the plate, so no element fibre does: the live scene\'s fibre (QL\'s condition material_fibre) is not announced to the shell.',
    'tattva.standing': 'No table of body constants by tattva stands: the plate\'s constants are its own rows.',
  },
}

/** What the scene keeps for a family that no reading has yet, and that the owner still takes: an optional setting the scene sets only once
 * it is chosen (manual §16.11: drawn unread, never a default). Not disabled: a choice writes it. */
export const FIELD_UNSET: Readonly<Partial<Record<FieldDesignFamily, Readonly<Record<string, string>>>>> = {
  colour: {backgroundMode: 'The scene sets no paper glow of its own yet (EngineSettings.backgroundMode is optional): choose one to set it.'},
  depth: {
    vortex3d: 'The scene sets no depth in the swirl of its own: the engine derives it from the body law (GPGPUSimulator.ts `?? depthGeometry`) until it is set.',
    dispersion3d: 'The scene sets no depth in the bridge of its own: the engine derives it from the body law (GPGPUSimulator.ts `?? depthGeometry`) until it is set.',
  },
}
/** Readings the engine reports only at times, each with why it is not drawn when it does not: a reading, never a control. */
export const FIELD_UNREPORTED: Readonly<Partial<Record<FieldDesignFamily, Readonly<Record<string, string>>>>> = {
  resonance: {'resonance.live': 'The engine has not reported the frequency the plate sounds now (observation.effectiveValues): a reading, when it does.'},
}
/** The view's own keys of a family's design (DesignBinding.local): Focus's chosen formation in its route. */
export const FIELD_LOCAL: Readonly<Partial<Record<FieldDesignFamily, readonly string[]>>> = {focus: ['chosen']}
/** The depth settings the scene keeps as numbers, written as the editor's panel settings (nativeFieldPanelSettings.ts vortex3d, dispersion3d). */
const DEPTH_NUMBERS = ['vortex3d', 'dispersion3d'] as const

/** The family's switch: the key its design reads for the device's light (nativeFieldFace.<family>.ts `toggle`), when it has one. */
export function toggleKeyOf(family: string): string | undefined {
  const toggle = expressionsFieldEntry(family)?.toggle as {key?: string} | null | undefined
  return toggle?.key
}

/** What the open scene keeps for a family that is no row of its device. Only what the scene says. */
function sceneValues(family: FieldDesignFamily, reading: Pick<NativeEditorReading, 'scene' | 'observation'> | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (!reading) return values
  const scene = reading.scene as unknown as Record<string, unknown>
  const field = record(scene.field), engine = record(scene.engine)
  if (family === 'colour') {
    if (Array.isArray(field.palette) && field.palette.every(c => typeof c === 'string')) values.palette = JSON.stringify(field.palette)
    if (typeof field.background === 'string') values.background = field.background
    if (typeof engine.colorEnabled === 'boolean') values.colorEnabled = engine.colorEnabled
  }
  if (family === 'medium' && typeof engine.mediumPlane === 'string') values.mediumPlane = engine.mediumPlane
  if (family === 'depth') for (const key of DEPTH_NUMBERS) if (finite(engine[key])) values[key] = engine[key] as number
  if (family === 'focus' && Array.isArray(scene.entities)) {
    const formations = (scene.entities as unknown[]).map(record).filter(e => e.kind === 'formation' && typeof e.id === 'string')
    values.route = JSON.stringify(formations.map(e => ({id: e.id, name: typeof e.name === 'string' ? e.name : e.id, tint: typeof e.tint === 'string' ? e.tint : null})))
  }
  if (family === 'resonance') {
    const live = reading.observation?.effectiveValues?.['cymatics.frequencyHz'] ?? reading.observation?.effectiveValues?.['field.cymatics.frequencyHz']
    if (finite(live)) values['resonance.live'] = live
  }
  return values
}

/** The design's values: the device's rows in the design's keys, then what the scene keeps. Only what the owner reports. */
export function fieldDesignValues(family: FieldDesignFamily, device: DeviceInstance, reading: Pick<NativeEditorReading, 'scene' | 'observation'> | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  const toggle = toggleKeyOf(family)
  for (const row of device.rows) {
    const value = device.values[row.key]
    if (value === undefined || value === null) continue
    if (row.key === ENABLED_KEY) { if (toggle && typeof value === 'boolean') values[toggle] = value; continue }
    if (row.key.startsWith(SETTING_PREFIX)) {
      const key = row.key.slice(SETTING_PREFIX.length), choices = expressionsSettingChoices(family, key)
      if (choices) { const choice = choices.find(item => item.label === value); if (choice) values[key] = choice.value }
      else if (typeof value === 'boolean') values[key] = value
      continue
    }
    if (finite(value)) values[row.key] = value * factorOf(row.key)
  }
  if (!reading) values.reason = 'No native Expression is open: its field has no reading here.'
  return {...values, ...sceneValues(family, reading)}
}

/** The device's row changes and the editor's own changes for the design's changes. Throws in words for a key with no owner write. */
export function fieldDesignChanges(family: FieldDesignFamily, device: DeviceInstance, changes: readonly ValueChange[]): {rows: {key: string; value: ParamValue}[]; edits: NativeEditorChange[]} {
  const rows: {key: string; value: ParamValue}[] = [], edits: NativeEditorChange[] = []
  const toggle = toggleKeyOf(family), keys = new Set(device.rows.map(row => row.key))
  for (const change of changes) {
    const {key, value} = change
    if (toggle && key === toggle && keys.has(ENABLED_KEY)) {
      if (typeof value !== 'boolean') throw new Error(`${key} is an on/off setting.`)
      rows.push({key: ENABLED_KEY, value})
    } else if (keys.has(key)) {
      if (!finite(value)) throw new Error(`${key} takes a number.`)
      rows.push({key, value: value / factorOf(key)})
    } else if (keys.has(SETTING_PREFIX + key)) {
      const choices = expressionsSettingChoices(family, key)
      if (choices) {
        const choice = choices.find(item => item.value === value)
        if (!choice) throw new Error(`${key}: ${String(value)} is not one of the owner's choices.`)
        rows.push({key: SETTING_PREFIX + key, value: choice.label})
      } else {
        if (typeof value !== 'boolean') throw new Error(`${key} is an on/off setting.`)
        rows.push({key: SETTING_PREFIX + key, value})
      }
    } else if (family === 'colour' && key === 'palette' && typeof value === 'string') {
      let colors: unknown
      try { colors = JSON.parse(value) } catch { throw new Error('The palette is a list of colours.') }
      if (!Array.isArray(colors) || colors.length < 2 || colors.length > 8 || !colors.every(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) throw new Error('A palette holds two to eight colours.')
      edits.push({kind: 'colour-palette', colors} as NativeEditorChange)
    } else if (family === 'colour' && key === 'background' && typeof value === 'string') {
      if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('The paper is one colour.')
      edits.push({kind: 'colour-background', value} as NativeEditorChange)
    } else if (family === 'colour' && key === 'colorEnabled' && typeof value === 'boolean') {
      edits.push({kind: 'colour-setting', key: 'colorEnabled', value} as NativeEditorChange)
    } else if (family === 'depth' && (DEPTH_NUMBERS as readonly string[]).includes(key)) {
      if (!finite(value)) throw new Error(`${key} takes a number.`)
      edits.push(validateNativeFieldPanelChange({kind: 'panel-setting', key, value}))
    } else {
      throw new Error(FIELD_ABSENT[family][key] ?? `${key}: no parameter of the engine's ${expressionsFieldEntry(family)?.name ?? family}.`)
    }
  }
  return {rows, edits}
}

/** The keys a change goes to the owner for: the device's rows, its settings, its switch, and what the scene's editor admits. */
export function fieldDesignWrites(family: FieldDesignFamily, device: DeviceInstance): (key: string) => boolean {
  const keys = new Set(device.rows.map(row => row.key)), toggle = toggleKeyOf(family)
  const scene = family === 'colour' ? new Set(['palette', 'background', 'colorEnabled']) : family === 'depth' ? new Set<string>(DEPTH_NUMBERS) : new Set<string>()
  return key => keys.has(key) || keys.has(SETTING_PREFIX + key) || (!!toggle && key === toggle && keys.has(ENABLED_KEY)) || scene.has(key)
}

/** The binding the runtime hosts a field family's design on: the engine's readings, the device's one submit for its rows, the family's
 * send for what the scene's editor admits. While the work is busy or waits on the owner the device has no submit, and every value is a
 * reading. Keys with no owner stand disabled with their reason. */
export function fieldDesignBinding(family: FieldDesignFamily, device: DeviceInstance, reading: NativeEditorReading | null, send: FieldDeviceSend | null): DesignBinding {
  const modulatedBy: Record<string, string> = {}
  for (const row of device.rows) if (row.modulatedBy && !row.key.startsWith(SETTING_PREFIX)) modulatedBy[row.key] = row.modulatedBy
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(FIELD_ABSENT[family])) standing[key] = {disabled: why}
  const submit = device.submit, toggle = toggleKeyOf(family)
  const local = FIELD_LOCAL[family]
  const values = {...fieldDesignValues(family, device, reading), ...(local ? Object.fromEntries(Object.entries(heldFor(device.id)).filter(([key]) => local.includes(key))) : {})}
  for (const [key, why] of Object.entries(FIELD_UNREPORTED[family] ?? {})) if (!(key in values)) standing[key] = {disabled: why}
  return {
    id: device.id,
    values,
    ...(local ? {local: handsFor(device.id, local)} : {}),
    writes: fieldDesignWrites(family, device),
    ...(submit ? {write: async (changes: readonly ValueChange[]) => {
      const {rows, edits} = fieldDesignChanges(family, device, changes)
      if (rows.length) await submit(rows)
      if (edits.length) {
        if (!send || !reading) throw new Error('No native Expression is open to take the change.')
        const reply = await send(edits, [], reading.basis)
        if (!reply.ok) throw new Error(reply.error)
      }
    }} : {}),
    ...(toggle && device.rows.some(row => row.key === ENABLED_KEY) ? {enabledKey: toggle} : {}),
    ...(Object.keys(modulatedBy).length ? {modulatedBy} : {}),
    ...(Object.keys(standing).length ? {standing} : {}),
  }
}
