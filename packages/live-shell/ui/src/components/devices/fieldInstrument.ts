// The Field on its owners (manual §20.2; the catalogue's design inhabitants/catalogue/panels/expressions__field.tsx, `expressions:field`):
// the sound, level, tempo and key of the whole field, standing at the head of the Studio (§20.3 "Then the Field, and each chain in turn";
// §20.1 Where everything is: "Set the sound, level, tempo and key of the whole field | The Field (§20.2), in the Studio"). The Field is no
// family of the rack's catalogue: it is the front of owners the field devices already carry, read and written through those devices, so
// a value moved on the Field moves on Resonance, Physics and Morph at once (the design's own words: "a value moved here moves in
// Resonance and Physics too"). Owners write, faces read (lock §0.4):
//   sound                 the hosted frame's object-sound mute, as it announces it (`soundMuted`, app.ts announceHostState) and as the
//                         Activator holds it (native/frameSound.ts frameSoundReading); a change is the Activator's own hand,
//                         setExpressionMuted, the frame's `sound` stage command (stageCommands.ts `{command: 'sound', muted}`);
//   plate                 the resonant medium on or off: Resonance's own switch (nativeFieldFace.resonance.ts `toggle` resonanceEnabled);
//   medium                the resonator's dimension: Resonance's `templateDimension` setting, 2D the plate and 3D the chamber (the frame's
//                         nativeBridge.ts:87 projectNativeConfig sets cymatics.dimension from it; PointCloudField.ts:1918 tickCymaticMedium
//                         turns '3D' into the 4 × 4 × 4 cavity);
//   resonance, dominance, baseFrequency   Resonance's rows (cymatics.frequencyHz, cymatics.dominance, cymatics.baseFrequency);
//   tempo                 Physics's time scale (fluid.timeScale); hold the morph's dwell (toroidalMorph.holdRatio, Morph's row);
//   particles             Ink's particle count (particleCount): a reading here, set in Ink;
//   keySource, symbolVoices   the scene's own composition, read and written as the editor's panel settings (expressionsDevice.ts
//                         SETTINGS.field; boundary nativeFieldPanelSettings.ts keySource, symbolVoices);
//   voices                the symbols of the open scene that have a voice (Entity.sound.enabled, native-field/entitySound.ts EntitySound).
// The level has no owner: object sound carries a gain per symbol only (entitySound.ts EntitySound.gain), and the frame takes no field-wide
// level, so it stands absent and its dial disabled with that operation's name. Pure: no React, no owner call (the ports carry them).
import type {NativeEditorChange, NativeEditorReading, NativeEditorReply} from '@epilogos/expressions-boundary/editor'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import type {DeviceDeclaration} from '../../inhabitants/sdk/define'
import {ENABLED_KEY, SETTING_PREFIX, expressionsSettingChange, expressionsSettingChoices, expressionsSettingRead} from './expressionsDevice'

/** The design's id, and the device's id on the door (designKey('expressions', 'field')). */
export const FIELD_DESIGN = 'expressions:field'
export const FIELD_DEVICE_ID = 'expressions:field'

/** The Field as a device of the runtime: no rows of its own, its values its binding's. Its family and face are the design's key, so the
 * door hands it to the Studio's Full at the Field's place (expressions__studio.tsx Suite, deviceDoor.ts publishedByDesign). */
export const FIELD_DEVICE: DeviceInstance = {
  id: FIELD_DEVICE_ID, family: 'expressions', rows: [], values: {},
  face: {id: 'field', title: 'Field', icon: 'expr', liveSemantic: 'device-instrument', invariant: {generates: 'kernel:native_expression'},
    note: 'The field of an Expression (DLW §20.2): its sound, level, tempo and key, the front of the owners its field devices carry.'} as DeviceDeclaration,
}

/** A design key the Field reads from a field device's row: the family whose device carries it and the row's key. */
interface RowKey {readonly family: 'resonance' | 'physics' | 'morph' | 'ink'; readonly row: string}
export const FIELD_ROWS: Readonly<Record<string, RowKey>> = {
  plate: {family: 'resonance', row: ENABLED_KEY},
  medium: {family: 'resonance', row: SETTING_PREFIX + 'templateDimension'},
  resonance: {family: 'resonance', row: 'cymatics.frequencyHz'},
  dominance: {family: 'resonance', row: 'cymatics.dominance'},
  baseFrequency: {family: 'resonance', row: 'cymatics.baseFrequency'},
  tempo: {family: 'physics', row: 'fluid.timeScale'},
  hold: {family: 'morph', row: 'toroidalMorph.holdRatio'},
  particles: {family: 'ink', row: 'particleCount'},
}
/** The design's plate and chamber, as Resonance's `templateDimension` writes them. */
const MEDIUM_OF: Readonly<Record<string, string>> = {'2D': 'plate', '3D': 'chamber'}
const DIMENSION_OF: Readonly<Record<string, string>> = {plate: '2D', chamber: '3D'}
/** The Field's own settings: the scene's composition, through the editor's panel settings. */
export const FIELD_SETTINGS = ['keySource', 'symbolVoices'] as const
/** The keys the Field's controls set (the design's dials, toggles and radios). The rest it draws are readings: set them where they live. */
export const FIELD_CONTROLS = ['sound', 'level', 'plate', 'medium', 'keySource', 'symbolVoices', 'resonance', 'tempo', 'hold'] as const

export const FIELD_NO_LEVEL = 'Level: no owner operation carries it here — missing op: a field-wide level of the Expression\'s sound in the Expressions '
  + 'engine (object sound carries a gain per symbol only, native-field/entitySound.ts EntitySound.gain, and the frame takes no level command) (Expressions).'
export const FIELD_READINGS: Readonly<Record<string, string>> = {
  dominance: 'A reading: set it on Resonance, where the plate\'s share of the particles is ruled.',
  baseFrequency: 'A reading: set the resonator\'s f0 on Resonance.',
  particles: 'A reading: set the count in Ink.',
  voices: 'A reading: give a symbol its voice on the Sound page of the scene\'s Expression tab.',
}
const NO_FRAME = 'No Expressions application is mounted: the field\'s sound is the frame\'s.'
const NO_SCENE = 'The frame presents no native Expression: the Activator mutes the open one.'
const NO_SOUND_READING = 'The frame has not reported its object sound yet.'
const LOCKED = 'Waiting for the native owner to acknowledge the last change.'
const NO_DEVICE = (family: string) => `No ${family} device of the open Expression carries it.`

const factorOf = (path: string): number => NATIVE_BINDINGS.find(binding => binding.path === path)?.factor ?? 1
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** The field devices the Field reads and writes through (useFieldDevices builds them over the one reading). */
export type FieldDevices = Readonly<Partial<Record<RowKey['family'], DeviceInstance | null>>>

/** The frame's object sound as the Activator reads it: muted, or null while nothing says; `mute` absent while no frame takes it. */
export interface FieldSound {
  readonly muted: boolean | null
  readonly mute: ((muted: boolean) => Promise<{readonly ok: boolean; readonly error?: string}>) | null
  /** Why `mute` is absent (no frame, no presented Expression). */
  readonly why?: string
}

export interface FieldInput {
  readonly reading: NativeEditorReading | null
  readonly devices: FieldDevices
  readonly sound: FieldSound
  /** The editor's one apply for the Field's own settings, on the reading's basis; null while the work is busy or not yet read. */
  readonly apply: ((changes: NativeEditorChange[]) => Promise<NativeEditorReply>) | null
}

/** The design's values: each key from the owner that reports it, or absent. */
export function fieldValues(input: FieldInput): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (input.sound.muted !== null) values.sound = !input.sound.muted
  for (const [key, {family, row}] of Object.entries(FIELD_ROWS)) {
    const value = input.devices[family]?.values[row]
    if (value === undefined || value === null) continue
    if (key === 'plate') { if (typeof value === 'boolean') values.plate = value; continue }
    if (key === 'medium') {
      const dimension = expressionsSettingChoices('resonance', 'templateDimension')?.find(choice => choice.label === value)?.value
      if (dimension && MEDIUM_OF[dimension]) values.medium = MEDIUM_OF[dimension]!
      continue
    }
    if (finite(value)) values[key] = value * factorOf(row)
  }
  const scene = input.reading?.scene
  if (scene) {
    const source = expressionsSettingRead('field', 'keySource', scene)
    const keySource = expressionsSettingChoices('field', 'keySource')?.find(choice => choice.label === source)?.value
    if (keySource) values.keySource = keySource
    const voiced = expressionsSettingRead('field', 'symbolVoices', scene)
    if (typeof voiced === 'boolean') values.symbolVoices = voiced
    values.voices = scene.entities.filter(entity => (entity as {sound?: {enabled?: unknown}}).sound?.enabled === true).length
  }
  return values
}

/** Why the owners do not take a change of this key now, or null when they do. */
export function fieldStanding(input: FieldInput, key: string): string | null {
  if (key === 'level') return FIELD_NO_LEVEL
  if (FIELD_READINGS[key]) return FIELD_READINGS[key]!
  if (key === 'sound') return input.sound.mute ? null : input.sound.why ?? NO_FRAME
  if ((FIELD_SETTINGS as readonly string[]).includes(key)) return input.reading ? (input.apply ? null : LOCKED) : 'No native Expression is open: its field has no reading here.'
  const at = FIELD_ROWS[key]
  if (!at) return `${key}: no setting of the field.`
  const device = input.devices[at.family]
  if (!device) return NO_DEVICE(at.family)
  if (!device.submit) return LOCKED
  return device.rows.some(row => row.key === at.row) ? null : NO_DEVICE(at.family)
}

/** Apply the design's changes through the owners: each field device's own submit for its rows, the editor's apply for the Field's own
 * settings, the Activator for the sound. Throws in words for one the owners do not take, before any is sent. */
export async function applyFieldChanges(input: FieldInput, changes: readonly ValueChange[]): Promise<void> {
  const rows = new Map<RowKey['family'], {key: string; value: ParamValue}[]>()
  const edits: NativeEditorChange[] = []
  let muted: boolean | undefined
  for (const {key, value} of changes) {
    const why = fieldStanding(input, key)
    if (why) throw new Error(why)
    if (key === 'sound') {
      if (typeof value !== 'boolean') throw new Error('The field sounds or it does not.')
      muted = !value
    } else if (key === 'keySource') {
      const label = expressionsSettingChoices('field', 'keySource')?.find(choice => choice.value === value)?.label
      if (!label) throw new Error(`${String(value)}: the key comes from the Torus, the Sky or your hand (Manual).`)
      edits.push(expressionsSettingChange('field', 'keySource', label))
    } else if (key === 'symbolVoices') {
      if (typeof value !== 'boolean') throw new Error('Symbol voices are on or off.')
      edits.push(expressionsSettingChange('field', 'symbolVoices', value))
    } else {
      const at = FIELD_ROWS[key]!
      let written: ParamValue
      if (key === 'plate') {
        if (typeof value !== 'boolean') throw new Error('The plate is on or off.')
        written = value
      } else if (key === 'medium') {
        const dimension = typeof value === 'string' ? DIMENSION_OF[value] : undefined
        const label = dimension ? expressionsSettingChoices('resonance', 'templateDimension')?.find(choice => choice.value === dimension)?.label : undefined
        if (!label) throw new Error(`${String(value)}: the medium is a plate or a chamber.`)
        written = label
      } else {
        if (!finite(value)) throw new Error(`${key} takes a number.`)
        written = value / factorOf(at.row)
      }
      rows.set(at.family, [...(rows.get(at.family) ?? []), {key: at.row, value: written}])
    }
  }
  for (const [family, changed] of rows) await input.devices[family]!.submit!(changed)
  if (edits.length) {
    const reply = await input.apply!(edits)
    if (!reply.ok) throw new Error(reply.error)
  }
  if (muted !== undefined) {
    const result = await input.sound.mute!(muted)
    if (!result.ok) throw new Error(result.error ?? 'The frame refused the sound.')
  }
}

/** The binding the runtime hosts the Field's design on: the owners' readings, their hands, and every key they do not take disabled with
 * its reason. What moves a row (an envelope, the sky) is named on the Field's control as it is on the device that carries it. */
export function fieldBinding(input: FieldInput): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const key of [...FIELD_CONTROLS, ...Object.keys(FIELD_READINGS)]) {
    const why = fieldStanding(input, key)
    if (why) standing[key] = {disabled: why}
  }
  if (input.sound.muted === null) standing.sound = {disabled: standing.sound?.disabled ?? NO_SOUND_READING}
  const modulatedBy: Record<string, string> = {}
  for (const [key, {family, row}] of Object.entries(FIELD_ROWS)) {
    const by = input.devices[family]?.rows.find(item => item.key === row)?.modulatedBy
    if (by) modulatedBy[key] = by
  }
  return {
    id: FIELD_DEVICE_ID,
    values: fieldValues(input),
    standing,
    writes: key => fieldStanding(input, key) === null,
    write: changes => applyFieldChanges(input, changes),
    enabledKey: 'sound',
    ...(Object.keys(modulatedBy).length ? {modulatedBy} : {}),
  }
}

/** Why the frame's sound is not the Field's to set now, in words, for a link that cannot take it. */
export function fieldSoundWhy(link: {readonly run: unknown; readonly state: {readonly nativeScene?: unknown} | null}): string | undefined {
  if (!link.run) return NO_FRAME
  if (!link.state?.nativeScene) return NO_SCENE
  return undefined
}
