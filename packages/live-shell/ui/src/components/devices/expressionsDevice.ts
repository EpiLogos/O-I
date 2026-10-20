// The Expressions field devices as devices of the runtime (FOUNDATION F5; manual §7 and §10.4: "Put one on your rack as a small
// widget with its four most-played controls, open it whole in the browser, or bring it up full size in the studio. Its settings
// stay live whether or not the widget is showing."). Physics, pointer, relational forces, medium, contacts, morph, focus, colour,
// ink, depth and resonance each stand as one `DeviceInstance` the three sizes draw. Pure: no React, no commits, no storage.
//
// Nothing here is a second reading. The rows are the catalogue's own (components/nativeDeviceCatalogue.ts: the paths, the
// groups, the four compact controls, the enable light and its toggle), the labels and ranges are the native bindings'
// (expressions-boundary parameters), the values are the retained editor's reading (baseValue over the reading's scene), and a
// change leaves as the editor's own admitted change kinds — `parameter`, `field-setting`, `panel-setting`, `morph-setting`,
// `colour-setting` — through the one `apply` the rack already holds. Owners write, faces read (lock §0.4): every row here
// carries the write path of that owner (`kernel:native_expression`); a light is the owner's `enabled` reading and stays dark
// when the catalogue discloses no enable operation (physics, pointer, ink).
import type {DeviceDeclaration, SdkParamRow} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import type {NativeEditorBasis, NativeEditorChange, NativeEditorReading, NativeEditorReply, Scene} from '@epilogos/expressions-boundary/editor'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import {NATIVE_COLOUR_MODES, NATIVE_MORPH_SETTINGS, validateNativeColourChange, validateNativeFieldPanelChange, validateNativeMorphSetting} from '../../../../../expressions-boundary/src/nativeDeviceEdits'
import {EXPRESSIONS_FACE_SEMANTICS} from '../../expressions/expressionsFamilyManifest.ts'
import {deviceCatalogue, type RackDevice} from '../nativeDeviceCatalogue.ts'
import {morphSettingValue} from '../nativeMorphController.ts'
import {stripToggleChanges} from '../nativeDeviceStripModel'
import {modulationOf, modulationView} from '../nativeModulation'

export const EXPRESSIONS_DEVICE_FAMILY = 'expressions'
/** The owner every row writes through: the retained native expression (the same op the Expressions faces declare they generate by). */
export const EXPRESSIONS_WRITE_PATH = 'kernel:native_expression'
/** The row of the device's own on/off light, when the catalogue discloses an enable operation. */
export const ENABLED_KEY = 'enabled'
/** A discrete setting's row key: `set:` and the owner's own key for it. */
export const SETTING_PREFIX = 'set:'
const SETTINGS_GROUP = 'Settings'

/** The one device a Field family is: `expressions:<family>`. A Field family is one instance, whether or not it stands on the rack. */
export const expressionsDeviceId = (family: string): string => `${EXPRESSIONS_DEVICE_FAMILY}:${family}`

/** The marks of the cut (icon-cut.html, inhabitants/sdk/icons.ts) the field devices wear. */
export const EXPRESSIONS_DEVICE_ICONS: Readonly<Record<string, IconName>> = {
  physics: 'orbit', pointer: 'select', relational: 'trav', medium: 'form', contacts: 'contact', morph: 'loop',
  focus: 'bind', colour: 'cap', ink: 'draw', depth: 'arrangement', resonance: 'live',
}

/** The Field devices of the catalogue, in its order: the eleven this ticket realises. */
export function expressionsFieldEntries(): readonly RackDevice[] {
  return deviceCatalogue().filter(device => device.scope === 'field')
}

export function expressionsFieldEntry(family: string): RackDevice | null {
  return expressionsFieldEntries().find(device => device.family === family) ?? null
}

// ---------------------------------------------------------------------------
// the discrete settings: each is a write the editor admits and a reading the scene holds

export type Choice = {readonly value: string; readonly label: string}
type SettingKind = 'field-setting' | 'panel-setting' | 'morph-setting' | 'colour-setting'
interface SettingSpec {
  /** The owner's own key for the setting (the change's `key`). */
  readonly key: string
  readonly kind: SettingKind
  readonly title: string
  /** The owner's choices (the value written, the label shown); absent: a boolean. */
  readonly choices?: readonly Choice[]
  /** The owner's reading of it in the scene; undefined when the scene does not carry it. */
  readonly read: (scene: Scene) => string | boolean | undefined
}

// A partial reading never throws: a part of the scene it does not carry is unknown, not a default and not a fault.
const engine = (scene: Scene): Record<string, unknown> => (scene.engine ?? {}) as unknown as Record<string, unknown>
const composition = (scene: Scene): Record<string, unknown> => (scene.composition ?? {}) as unknown as Record<string, unknown>
const morphing = (scene: Scene, key: 'autoOscillate' | 'trajectory' | 'driveShape' | 'law'): unknown => {
  try { return morphSettingValue(scene, key) } catch { return undefined }
}
const text = (value: unknown, fallback?: string): string | undefined => typeof value === 'string' ? value : fallback
const same = (...values: string[]): Choice[] => values.map(value => ({value, label: value}))
const choice = (value: string, label: string): Choice => ({value, label})

/** The settings each family's whole panel carries as plain switches and selects (components/NativeFieldFace.<family>.tsx `switches`),
 * as rows. The light's own toggle (the catalogue's `toggle`) is the `enabled` row, not repeated here. What stays out is named in the
 * ticket's return: Ink's material and glyph pickers, Depth's coupling shares, Focus's route list, Colour's palette stops. */
const SETTINGS: Readonly<Record<string, readonly SettingSpec[]>> = {
  physics: [
    {key: 'mediumPlane', kind: 'field-setting', title: 'Physical medium plane', read: scene => text(engine(scene).mediumPlane),
      choices: [choice('vertical', 'XY · vertical'), choice('horizontal', 'XZ · horizontal')]},
  ],
  medium: [
    {key: 'mediumDimension', kind: 'field-setting', title: 'Medium dimensions', read: scene => text(engine(scene).mediumDimension, '2D'), choices: same('2D', '3D')},
  ],
  // The Field's Key source (manual §20.2): which pitches tune the plate under the Torus driver. The catalogue has no Field device yet
  // (nativeDeviceCatalogue.ts lists the eleven field families), so no rack row carries this setting until one does; the choices, the
  // reading and the write (the editor's `keySource` panel setting) are the owner's already. A scene saved before the key carries none: absent.
  field: [
    {key: 'keySource', kind: 'panel-setting', title: 'Key source', read: scene => text(composition(scene).keySource),
      choices: [choice('torus', 'Torus'), choice('sky', 'Sky'), choice('manual', 'Manual')]},
    // Symbol voices (manual §20.2: On · Off, default On): whether symbols carry the torus's sound to where they stand. The scene carries it only
    // once it is set; the manual's own meaning of a scene that carries none is On. Off silences every voice and changes no symbol's block.
    {key: 'symbolVoices', kind: 'panel-setting', title: 'Symbol voices', read: scene => composition(scene).symbolVoices !== false},
  ],
  resonance: [
    // Torus · Manual · Focus · Automation, in the manual's order (§20.14). A scene that carries no driver is unknown, not a default.
    {key: 'frequencyDriver', kind: 'panel-setting', title: 'Frequency driver', read: scene => text(composition(scene).frequencyDriver),
      choices: [choice('torus', 'Torus'), choice('manual', 'Manual tuning'), choice('focus', 'Travelling focus'), choice('automation', 'Automation / station sweep')]},
    {key: 'autoSweep', kind: 'panel-setting', title: 'Sweep linked stations', read: scene => engine(scene).autoSweep === true},
    {key: 'sweepDirection', kind: 'panel-setting', title: 'Sweep direction', read: scene => text(engine(scene).sweepDirection, 'ascent'),
      choices: [choice('ascent', 'Ascending'), choice('descent', 'Descending'), choice('pingpong', 'There and back')]},
    {key: 'templateDimension', kind: 'panel-setting', title: 'Dimension', read: scene => text(engine(scene).templateDimension, '2D'),
      choices: [choice('2D', '2D · planar plate'), choice('3D', '3D · volumetric field')]},
    {key: 'resonatorMode', kind: 'panel-setting', title: 'Compatibility', read: scene => text(engine(scene).resonatorMode, 'resonator'),
      choices: [choice('resonator', 'Continuous modal resonator'), choice('template', 'Legacy templates · no live medium')]},
  ],
  contacts: [
    {key: 'collisionMode', kind: 'field-setting', title: 'Wall law', read: scene => text(engine(scene).collisionMode, 'obstacle'),
      choices: [choice('obstacle', 'Obstacle'), choice('vessel', 'Vessel')]},
    {key: 'pairwiseEnabled', kind: 'field-setting', title: 'Particle contacts', read: scene => engine(scene).pairwiseEnabled === true},
  ],
  ink: [
    {key: 'grainProfile', kind: 'panel-setting', title: 'Extended grain profile', read: scene => engine(scene).grainProfile !== false},
    {key: 'dotShape', kind: 'panel-setting', title: 'Native dot shape', read: scene => text(engine(scene).dotShape, 'circle'),
      choices: [choice('circle', 'Circle'), choice('square', 'Square')]},
  ],
  depth: [
    {key: 'volumeProfile', kind: 'panel-setting', title: 'Depth profile', read: scene => text(engine(scene).volumeProfile, 'round'),
      choices: [choice('slab', 'Slab · constant thickness'), choice('bevel', 'Bevel · chamfered from the contour'), choice('round', 'Round · pillow, steep shoulders'),
        choice('dome', 'Dome · convex bulge'), choice('taper', 'Taper · knife-edge sliver')]},
    {key: 'depthPerspective', kind: 'panel-setting', title: 'Perspective projection', read: scene => engine(scene).depthPerspective === true},
    {key: 'depthOcclusion', kind: 'panel-setting', title: 'Surfaces occlude', read: scene => engine(scene).depthOcclusion === true || engine(scene).depthOcclusion === 'on'},
  ],
  relational: [
    {key: 'relationalMode', kind: 'panel-setting', title: 'Relational law', read: scene => text(engine(scene).relationalMode, 'orbital'),
      choices: [choice('orbital', 'Orbital'), choice('nbody', 'N-body'), choice('chaos', 'Chaotic')]},
  ],
  pointer: [
    {key: 'pointerScope', kind: 'panel-setting', title: 'Pointer scope', read: scene => (scene as unknown as Record<string, unknown>).pointerScope === 'local' ? 'local' : 'global',
      choices: [choice('global', 'Expression override · global'), choice('local', 'Local to this scene')]},
    {key: 'pointerMode', kind: 'panel-setting', title: 'Temporary pointer force', read: scene => text(engine(scene).pointerMode),
      choices: [choice('attract', 'Attract'), choice('repel', 'Repel'), choice('vortex', 'Vortex')]},
    {key: 'pointerClick', kind: 'panel-setting', title: 'Click effect', read: scene => text(engine(scene).pointerClick, 'pulse'),
      choices: [choice('pulse', 'Pulse · shockwave outward'), choice('implode', 'Implode · gather inward'), choice('vortex', 'Vortex · whirl around the click'),
        choice('shove', 'Shove · random burst'), choice('off', 'Off · clicks stay quiet')]},
  ],
  focus: [
    {key: 'focus', kind: 'panel-setting', title: 'Orchestration', read: scene => text(composition(scene).focus),
      choices: [choice('parallel', 'Parallel'), choice('travelling', 'Travelling focus')]},
    {key: 'focusOrder', kind: 'panel-setting', title: 'Traversal', read: scene => text(engine(scene).focusOrder, 'listed'),
      choices: [choice('listed', 'Listed order'), choice('reverse', 'Reverse order'), choice('pingpong', 'There and back')]},
    {key: 'carryTint', kind: 'panel-setting', title: 'Carry local tint', read: scene => composition(scene).carryTint === true},
    {key: 'frequencyDriver', kind: 'panel-setting', title: 'Shared tuning driver', read: scene => text(composition(scene).frequencyDriver),
      choices: [choice('torus', 'Torus'), choice('manual', 'Manual'), choice('focus', 'Travelling focus'), choice('automation', 'Automation')]},
  ],
  morph: [
    {key: 'autoOscillate', kind: 'morph-setting', title: 'Oscillating drive', read: scene => morphing(scene, 'autoOscillate') === true},
    {key: 'trajectory', kind: 'morph-setting', title: 'Spatial trajectory', read: scene => text(morphing(scene, 'trajectory')), choices: same(...NATIVE_MORPH_SETTINGS.trajectory)},
    {key: 'driveShape', kind: 'morph-setting', title: 'Drive waveform', read: scene => text(morphing(scene, 'driveShape')), choices: same(...NATIVE_MORPH_SETTINGS.driveShape)},
    {key: 'law', kind: 'morph-setting', title: 'Conjugate interference', read: scene => text(morphing(scene, 'law')), choices: same(...NATIVE_MORPH_SETTINGS.law)},
  ],
  colour: [
    {key: 'colorMode', kind: 'colour-setting', title: 'Colour distribution', read: scene => text(engine(scene).colorMode),
      choices: NATIVE_COLOUR_MODES.map(mode => choice(mode.id, mode.label))},
  ],
}

/** The settings a family's whole device carries as rows (for the tests and the notes that name what stays out). */
export function expressionsSettingKeys(family: string): readonly string[] {
  return (SETTINGS[family] ?? []).map(spec => spec.key)
}

/** A setting's choices as the owner writes them (the value) and the row shows them (the label); undefined for a switch or an unknown
 * setting. A designed device draws the owner's values, so its binding maps the row's label back to the value (physicsBinding.ts). */
export function expressionsSettingChoices(family: string, key: string): readonly Choice[] | undefined {
  return (SETTINGS[family] ?? []).find(spec => spec.key === key)?.choices
}

/** A setting's value in a scene as a row shows it (the owner's label for a choice, the boolean for a switch), or undefined when the scene
 * does not say or the family has no such setting. */
export function expressionsSettingRead(family: string, key: string, scene: Scene): ParamValue | undefined {
  const spec = (SETTINGS[family] ?? []).find(candidate => candidate.key === key)
  return spec ? settingValue(spec, scene) : undefined
}

/** A setting's value as the row shows it: the owner's label for a choice, the boolean for a switch; unknown when the scene does not say. */
function settingValue(spec: SettingSpec, scene: Scene): ParamValue | undefined {
  const read = spec.read(scene)
  if (!spec.choices) return typeof read === 'boolean' ? read : undefined
  return spec.choices.find(item => item.value === read)?.label
}

/** One change from a setting row: the editor's own admitted kind, validated by the boundary's own validator before it leaves. */
function settingChange(spec: SettingSpec, value: ParamValue): NativeEditorChange {
  let written: boolean | string
  if (spec.choices) {
    const picked = spec.choices.find(item => item.label === value)
    if (!picked) throw Error(`${spec.title}: not one of the owner's choices`)
    written = picked.value
  } else {
    if (typeof value !== 'boolean') throw Error(`${spec.title} is an on/off setting`)
    written = value
  }
  switch (spec.kind) {
    case 'panel-setting': return validateNativeFieldPanelChange({kind: 'panel-setting', key: spec.key, value: written})
    case 'morph-setting': return validateNativeMorphSetting({kind: 'morph-setting', key: spec.key, value: written})
    case 'colour-setting': return validateNativeColourChange({kind: 'colour-setting', key: spec.key, value: written})
    case 'field-setting': return {kind: 'field-setting', key: spec.key, value: written} as unknown as NativeEditorChange
  }
}

// ---------------------------------------------------------------------------
// the rows

const binding = (path: string) => NATIVE_BINDINGS.find(row => row.path === path)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** What moves a row's value, in one sentence the row's tooltip carries (the disclosure line under the control says it in full). */
function modulatedByOf(reading: NativeEditorReading, key: string): string | undefined {
  const view = modulationView(modulationOf(reading, 'field.' + key))
  if (!view) return undefined
  return view.named ? `${view.driven} · base ${view.base} · effective ${view.effective}` : `an unexplained difference · base ${view.base} · effective ${view.effective}`
}

/** The paths in the order the whole device shows them: the catalogue's groups in order, else its flat list. */
function orderedPaths(entry: RackDevice): string[] {
  const grouped = entry.groups.flatMap(group => group.paths)
  return grouped.length ? [...grouped] : [...entry.paths]
}

function numericRows(entry: RackDevice, reading: NativeEditorReading): SdkParamRow[] {
  const groupOf = new Map<string, string>()
  for (const group of entry.groups) for (const path of group.paths) groupOf.set(path, group.title)
  const compact = new Set(entry.compact)
  return orderedPaths(entry).flatMap(path => {
    const found = binding(path)
    if (!found) return []
    const value = baseValue(reading.scene, found.key)
    // The control's span is the binding's performance range, widened to hold the live value when an exact entry or an agent put it beyond.
    const low = finite(value) ? Math.min(found.min, value) : found.min, high = finite(value) ? Math.max(found.max, value) : found.max
    const modulatedBy = modulatedByOf(reading, found.key), group = groupOf.get(path)
    return [{
      family: EXPRESSIONS_DEVICE_FAMILY, deviceInstance: entry.family, key: path, type: 'number', title: found.label,
      range: {min: low, max: high, ...(found.unit ? {unit: found.unit} : {})}, writePath: EXPRESSIONS_WRITE_PATH,
      ...(group ? {group} : {}), ...(compact.has(path) ? {compact: true} : {}), ...(modulatedBy ? {modulatedBy} : {}),
    } as SdkParamRow]
  })
}

function settingRows(entry: RackDevice): SdkParamRow[] {
  const toggle: SdkParamRow[] = entry.toggle
    ? [{family: EXPRESSIONS_DEVICE_FAMILY, deviceInstance: entry.family, key: ENABLED_KEY, type: 'boolean', title: 'Enabled', group: SETTINGS_GROUP, writePath: EXPRESSIONS_WRITE_PATH} as SdkParamRow]
    : []
  const specs = (SETTINGS[entry.family] ?? []).map(spec => ({
    family: EXPRESSIONS_DEVICE_FAMILY, deviceInstance: entry.family, key: SETTING_PREFIX + spec.key, title: spec.title, group: SETTINGS_GROUP,
    type: spec.choices ? 'enumerated' : 'boolean', ...(spec.choices ? {values: spec.choices.map(item => item.label)} : {}), writePath: EXPRESSIONS_WRITE_PATH,
  } as SdkParamRow))
  return [...toggle, ...specs]
}

/** The device's declaration: its Live semantic and invariant are the Expressions family's own (expressionsFamilyManifest.ts, lock §2.4). */
export function expressionsFieldDeclaration(entry: RackDevice): DeviceDeclaration {
  const semantic = EXPRESSIONS_FACE_SEMANTICS[entry.family]
  if (!semantic) throw Error(`Expressions face "${entry.family}" declares no Live semantic (DEVICE-SEMANTICS-LOCK §5.1)`)
  return {
    id: entry.family, title: entry.name, icon: EXPRESSIONS_DEVICE_ICONS[entry.family] ?? 'form', liveSemantic: semantic.liveSemantic,
    ...(semantic.invariant ? {invariant: semantic.invariant} : {}),
    note: `The ${entry.name} field device of the open Expression: every setting is the retained editor's own reading, and a change goes through its one apply.`,
  } as DeviceDeclaration
}

// ---------------------------------------------------------------------------
// the instance

/** What the model asks of a host to write: one apply on the reading's basis. The numeric edits ride along so a host with
 * private input custody can retain them (fieldDeviceSend.ts); a host without simply applies. */
export interface NumericEdit {readonly id: string; readonly value: number; readonly initial: number}
export type FieldDeviceSend = (edits: readonly NativeEditorChange[], numeric: readonly NumericEdit[], basis: NativeEditorBasis) => Promise<NativeEditorReply>

/** The editor's changes for a set of row changes. Throws, naming the row, when a change is not one this device can make. */
export function fieldDeviceEdits(entry: RackDevice, reading: NativeEditorReading, changes: readonly {key: string; value: ParamValue}[]): {edits: NativeEditorChange[]; numeric: NumericEdit[]} {
  const edits: NativeEditorChange[] = [], numeric: NumericEdit[] = []
  for (const change of changes) {
    if (change.key === ENABLED_KEY) {
      if (typeof change.value !== 'boolean') throw Error(`${entry.name}: Enabled is an on/off setting`)
      const toggled = stripToggleChanges(entry, change.value)
      if (!toggled.length) throw Error(`${entry.name} has no enable operation`)
      edits.push(...toggled)
    } else if (change.key.startsWith(SETTING_PREFIX)) {
      const spec = (SETTINGS[entry.family] ?? []).find(item => SETTING_PREFIX + item.key === change.key)
      if (!spec) throw Error(`${change.key}: not a setting of ${entry.name}`)
      edits.push(settingChange(spec, change.value))
    } else {
      const found = entry.paths.includes(change.key) ? binding(change.key) : undefined
      if (!found) throw Error(`${change.key}: not a parameter of ${entry.name}`)
      if (!finite(change.value)) throw Error(`${found.label} takes a number`)
      if (change.value < found.hardMin || change.value > found.hardMax) throw Error(`${found.label} must be from ${found.hardMin} to ${found.hardMax}`)
      const id = 'field.' + found.key
      edits.push({kind: 'parameter', target: id, value: change.value})
      numeric.push({id, value: change.value, initial: baseValue(reading.scene, found.key)})
    }
  }
  return {edits, numeric}
}

/** One field device over the owner's reading. `send` absent: every row is a reading (the work is busy or not yet read). */
export function expressionsFieldDevice(reading: NativeEditorReading, family: string, send: FieldDeviceSend | null): DeviceInstance | null {
  const entry = expressionsFieldEntry(family)
  if (!entry) return null
  const rows = [...settingRows(entry), ...numericRows(entry, reading)]
  const values: Record<string, ParamValue> = {}
  const on = entry.enabled(reading)
  if (typeof on === 'boolean') values[ENABLED_KEY] = on
  for (const spec of SETTINGS[entry.family] ?? []) {
    const shown = settingValue(spec, reading.scene)
    if (shown !== undefined) values[SETTING_PREFIX + spec.key] = shown
  }
  for (const row of rows) {
    const found = row.key === ENABLED_KEY || row.key.startsWith(SETTING_PREFIX) ? undefined : binding(row.key)
    if (!found) continue
    const value = baseValue(reading.scene, found.key)
    if (finite(value)) values[row.key] = value
  }
  const submit: DeviceInstance['submit'] = send
    ? async changes => {
      const {edits, numeric} = fieldDeviceEdits(entry, reading, changes)
      if (!edits.length) return
      const reply = await send(edits, numeric, reading.basis)
      if (!reply.ok) throw Error(reply.error)
    }
    : undefined
  return {
    id: expressionsDeviceId(entry.family), family: EXPRESSIONS_DEVICE_FAMILY, face: expressionsFieldDeclaration(entry), rows, values,
    ...(typeof on === 'boolean' ? {enabledKey: ENABLED_KEY} : {}), ...(submit ? {submit} : {}),
  }
}

/** The rack's order: the catalogue's four most-played controls first, in the catalogue's order, then the rest. The compact size
 * shows the first four marked rows; the whole and full sizes keep the groups' order (`device.rows`). */
export function inCompactOrder(device: DeviceInstance, entry: RackDevice): DeviceInstance {
  const rank = new Map(entry.compact.map((path, index) => [path, index]))
  const compact = device.rows.filter(row => rank.has(row.key)).sort((a, b) => rank.get(a.key)! - rank.get(b.key)!)
  const rest = device.rows.filter(row => !rank.has(row.key))
  return {...device, rows: [...compact, ...rest]}
}
