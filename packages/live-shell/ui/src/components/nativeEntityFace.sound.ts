import type {Entity, NativeEditorReading, NativeEntitySoundChange} from '../../../../expressions-boundary/src/editor'
import {soundWithCarry, validateNativeEntitySoundChange} from '../../../../expressions-boundary/src/nativeEntitySound.ts'
import {DEFAULT_ENTITY_SOUND, NO_CARRY, validateEntitySound, type EntitySound, type VoiceCarry} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts'
import type {QlMusicModes} from '../live/modes.ts'
import type {LiveModeCatalogueState} from '../native/liveModeCatalogue.ts'
import type {EntityFaceModel} from './nativeEntityFaceModel.ts'

/** Pure facts and draft arithmetic for the ENTITY Sound device. No React, no commits.
 * The fields are the whole `sound` block of the selected object (soundControls.ts, native-field/entitySound.ts), not registry parameters:
 * every write is one `{kind:'entity-sound'}` change carrying the next whole sound.
 *
 * A symbol's voice is a name or a mode carrying the torus's sound (DLW §20.2), so the page holds the voice's switch, what it carries, its gain
 * and its envelope, and nothing of an oscillator: no frequency, no follow, no waveform, no pan (the voice stands where its symbol stands). */

export type SoundField = 'enabled' | 'carry' | 'gain' | 'attack' | 'release'
/** The three envelope handles drive these numeric fields. */
export type EnvelopeField = 'attack' | 'release' | 'gain'

/** Panel groups: the voice (its switch, what it carries, its gain), then its envelope. */
export const SOUND_GROUPS = [
  {title: 'Voice', fields: ['enabled', 'carry', 'gain']},
  {title: 'Envelope', fields: ['attack', 'release']},
] as const satisfies readonly {title: string; fields: readonly SoundField[]}[]

/** The numeric fields with the app validator's inclusive bounds (native-field/entitySound.ts) and the inspector's step (soundControls.ts). */
export interface SoundNumberSpec {field: 'gain' | 'attack' | 'release'; label: string; unit: string; min: number; max: number; step: number}
export const SOUND_NUMBERS: readonly SoundNumberSpec[] = [
  {field: 'gain', label: 'Gain', unit: '(linear, 0 silent to 1)', min: 0, max: 1, step: 0.01},
  {field: 'attack', label: 'Attack', unit: 's', min: 0, max: 10, step: 0.01},
  {field: 'release', label: 'Release', unit: 's', min: 0, max: 30, step: 0.01},
]
export const soundNumberSpec = (field: SoundNumberSpec['field']): SoundNumberSpec => SOUND_NUMBERS.find(spec => spec.field === field)!
/** The app's default for a numeric sound field: the value a Home reset returns to. */
export const soundDefault = (field: 'gain'): number => DEFAULT_ENTITY_SOUND[field]

/** The text a refused number shows: the bound it must sit inside. Null when the value is admitted. */
export function numberProblem(spec: SoundNumberSpec, value: number): string | null {
  // Units written in brackets are descriptions, not suffixes: "Gain must be from 0 to 1."
  const suffix = spec.unit && !spec.unit.startsWith('(') ? ` ${spec.unit}` : ''
  const range = `${spec.label} must be from ${spec.min} to ${spec.max}${suffix}.`
  if (!Number.isFinite(value)) return `${spec.label} must be a number from ${spec.min} to ${spec.max}${suffix}.`
  return value < spec.min || value > spec.max ? range : null
}
/** Exact-value text to a number: blank or non-numeric text is NaN, which numberProblem refuses. */
export function parseNumberText(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? Number.NaN : Number(trimmed)
}

const decimalsOf = (step: number) => step >= 1 ? 0 : 2
/** Clamp to the field's bounds and snap to its step, so drag and key values never carry float noise. */
export function snapValue(spec: SoundNumberSpec, value: number): number {
  const clamped = Math.min(spec.max, Math.max(spec.min, Number.isFinite(value) ? value : spec.min))
  return Number((Math.round(clamped / spec.step) * spec.step).toFixed(decimalsOf(spec.step)))
}
/** One arrow step: the control's step, times ten with Shift. Null when the step cannot move (already at the bound). */
export function steppedValue(spec: SoundNumberSpec, current: number, direction: 1 | -1, shift: boolean): number | null {
  const next = snapValue(spec, current + direction * spec.step * (shift ? 10 : 1))
  return next === current ? null : next
}

/** Every field a sound resolves to, as the engine resolves it (entitySoundPlan, soundControlsHTML). `carry` is null when the voice carries nothing yet. */
export interface ResolvedSound {enabled: boolean; carry: VoiceCarry | null; gain: number; attack: number; release: number}
export function resolvedSound(sound: EntitySound | undefined): ResolvedSound {
  const d = DEFAULT_ENTITY_SOUND
  return {enabled: sound?.enabled ?? false, carry: sound?.carry ?? null, gain: sound?.gain ?? d.gain, attack: sound?.attack ?? d.attack, release: sound?.release ?? d.release}
}

/** The sound Add sound sends: the app's defaults with the voice on and nothing yet to carry (DEFAULT_ENTITY_SOUND, enabled). The voice is silent and says so until a name or mode is chosen. */
export const addedSound = (): EntitySound => validateEntitySound({...DEFAULT_ENTITY_SOUND, enabled: true}) as EntitySound

/** The next WHOLE sound with one field set. A carry is a `{kind, ref}` or null (it clears the carry). Throws on a refused value. */
export function soundWithField(base: EntitySound | undefined, field: SoundField, value: boolean | number | VoiceCarry | null): EntitySound {
  if (field === 'carry') return soundWithCarry(base, value as VoiceCarry | null)
  return validateEntitySound({...(base ?? {enabled: false}), [field]: value}) as EntitySound
}

/** The one admitted change for a gesture: the whole sound, or null to remove it. The boundary validator is the gate. */
export function soundChange(entityId: string, sound: EntitySound | null): NativeEntitySoundChange {
  return validateNativeEntitySoundChange({kind: 'entity-sound', entity_id: entityId, sound})
}

/** The owner's refusal text from a reply the editor returned, or null when the reply is not a refusal. */
export function replyRefusal(reply: unknown): string | null {
  if (!reply || typeof reply !== 'object' || (reply as {ok?: unknown}).ok !== false) return null
  const error = (reply as {error?: unknown}).error
  return typeof error === 'string' && error ? error : 'The owner refused this sound change.'
}

/** The lock law: a locked object refuses its device edits (nativeDeviceEdits.ts). The note states it before any send. */
export const LOCKED_NOTE = 'This object is locked. Unlock this entity to change its sound.'

// ── the voice choice: a name or a mode of M2′'s store ───────────────────────

/** A carry as one option value: `mode:<catalogue key>` or `name:<the store's name>`; the empty value is "None yet". */
export const carryValue = (carry: VoiceCarry | null | undefined): string => carry ? `${carry.kind}:${carry.ref}` : ''
export function carryFromValue(value: string): VoiceCarry | null {
  if (!value) return null
  const at = value.indexOf(':'), kind = value.slice(0, at), ref = value.slice(at + 1)
  if (at < 0 || (kind !== 'mode' && kind !== 'name') || !ref) throw new Error('A voice carries a mode or a name of the store.')
  return {kind, ref}
}
export interface VoiceOption {value: string; label: string}
export interface VoiceChoiceGroup {label: string; options: readonly VoiceOption[]}

/** The choices of the "Name or mode" row, from the owner's catalogue (ql.music-modes/v1, as the shell already reads it): the modes grouped as the
 * catalogue groups them, then the names of the store with the status the catalogue gives each. With no catalogue there are no modes to offer and the
 * row says why (voiceChoiceNote); a carry the voice already holds stays listed as what it is, so the row never shows a choice that is not there. */
export function voiceChoices(catalogue: QlMusicModes | null, held: VoiceCarry | null = null): VoiceChoiceGroup[] {
  const groups: VoiceChoiceGroup[] = [{label: 'No carry', options: [{value: '', label: 'None yet'}]}]
  const byGroup = new Map<string, VoiceOption[]>()
  for (const scale of catalogue?.scales ?? []) {
    const group = scale.kind === 'lens-cf' ? `${scale.lens} on the ${scale.anchorBasis} basis` : scale.family
    byGroup.set(group, [...(byGroup.get(group) ?? []), {value: `mode:${scale.key}`, label: scale.label}])
  }
  for (const [label, options] of byGroup) groups.push({label, options})
  const names = (catalogue?.sourcesAbsent ?? []).map(entry => ({value: `name:${entry.scale}`, label: `${entry.scale} · ${entry.status}`}))
  if (names.length) groups.push({label: 'names of the store', options: names})
  const listed = groups.some(group => group.options.some(option => option.value === carryValue(held)))
  if (held && !listed) groups.splice(1, 0, {label: 'held by this voice', options: [{value: carryValue(held), label: `${held.ref} · not in the store`}]})
  return groups
}

/** What the voice says about itself, in words: why it is silent, or what it carries. Pure over the catalogue reading. */
export function voiceChoiceNote(sound: EntitySound | undefined, reading: LiveModeCatalogueState): string {
  if (!sound?.enabled) return 'This voice is off.'
  if (!sound.carry) return NO_CARRY
  if (reading.state === 'loading') return 'The mode catalogue is being read from the kernel'
  if (reading.state === 'refused') return reading.reason
  const catalogue = reading.catalogue
  if (sound.carry.kind === 'name') {
    const entry = catalogue.sourcesAbsent.find(item => item.scale === sound.carry!.ref)
    return entry ? `${entry.scale} (${entry.status}): ${entry.reason}` : `The store names no "${sound.carry.ref}", so this voice has no sound to carry`
  }
  const mode = catalogue.scales.find(scale => scale.key === sound.carry!.ref)
  return mode ? `Carries ${mode.label} of the torus's sound, over the torus's root.` : `The mode catalogue has no mode "${sound.carry.ref}"`
}

const num = (value: number) => String(Number(value.toFixed(4)))
/** The rack summary and the panel heading line, from the object's own sound. */
export function soundSummaryText(sound: EntitySound | undefined): string {
  if (!sound) return 'No sound'
  const s = resolvedSound(sound)
  const carries = s.carry ? `${s.carry.kind} ${s.carry.ref}` : 'no name or mode yet'
  return `${s.enabled ? '' : 'off · '}${carries} · gain ${num(s.gain)}`
}
export const soundSummary = (entity: Entity): string => soundSummaryText(entity.sound)

/** The envelope's shared time axis: 0 to 40 seconds. The sustain is drawn as a break at 10 s (the attack maximum) because its length is set by the object's presence, not by a parameter. */
export const ENVELOPE = {x0: 30, span: 300, seconds: 40, breakSeconds: 10, baseY: 110, topY: 18} as const
export const timeToX = (seconds: number) => ENVELOPE.x0 + seconds / ENVELOPE.seconds * ENVELOPE.span
export const xToTime = (x: number) => (x - ENVELOPE.x0) / ENVELOPE.span * ENVELOPE.seconds
export const gainToY = (gain: number) => ENVELOPE.baseY - gain * (ENVELOPE.baseY - ENVELOPE.topY)
export const yToGain = (y: number) => (ENVELOPE.baseY - y) / (ENVELOPE.baseY - ENVELOPE.topY)

/** The value an envelope handle takes at a point in viewBox space (the drag mapping). Clamped and snapped to the field. */
export function envelopeValueAt(field: EnvelopeField, x: number, y: number): number {
  if (field === 'attack') return snapValue(soundNumberSpec('attack'), xToTime(x))
  if (field === 'release') return snapValue(soundNumberSpec('release'), xToTime(x) - ENVELOPE.breakSeconds)
  return snapValue(soundNumberSpec('gain'), yToGain(y))
}

/** Geometry of the envelope from the sound's own attack, release and gain (the drawn values). */
export function envelopeGeometry(s: Pick<ResolvedSound, 'attack' | 'release' | 'gain'>) {
  const attackX = timeToX(s.attack), breakX = timeToX(ENVELOPE.breakSeconds), releaseX = timeToX(ENVELOPE.breakSeconds + s.release)
  const gainY = gainToY(s.gain), baseY = ENVELOPE.baseY
  const path = `M${ENVELOPE.x0} ${baseY} L${attackX.toFixed(2)} ${gainY.toFixed(2)} L${breakX.toFixed(2)} ${gainY.toFixed(2)} L${releaseX.toFixed(2)} ${baseY}`
  return {
    path, attackX, releaseX, gainY, baseY,
    handles: {
      attack: {x: attackX, y: baseY},
      release: {x: releaseX, y: baseY},
      gain: {x: (attackX + breakX) / 2, y: gainY},
    },
  }
}

/** The Sound device's model. Paths are empty: the sound fields are not registry parameters (entityTargets has no sound rows), so the shared body renders no exact-value grid; the view draws every control itself. */
export const soundFaceModel: EntityFaceModel = {
  name: 'Sound',
  paths: [],
  // Registry compact is empty: sound fields are not entityTargets rows. The rack's whole-sound controls are declared here instead.
  compactEntity: [{kind: 'entity-sound', field: 'gain'}, {kind: 'entity-sound', field: 'carry'}],
  studio: 'formations',
  enabled: (_reading: NativeEditorReading, entity: Entity) => entity.sound?.enabled,
  strip: {summary: (_reading: NativeEditorReading, entity: Entity) => soundSummary(entity), toggle: null},
}
